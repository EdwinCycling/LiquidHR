begin;

-- A process permission is necessary but not sufficient: execution also requires
-- the actor's current claim and latest eligible candidate status.
create or replace function internal_security.process_work_item_actor_can_act(
  requested_work_item_id uuid,
  requested_actor_user_id uuid,
  requested_actor_employee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select requested_actor_user_id is not null
    and requested_actor_employee_id is not null
    and exists (
      select 1
      from public.process_work_items item
      where item.id = requested_work_item_id
        and item.status = 'CLAIMED'::public.process_work_item_status
        and item.claimed_by_user_id = requested_actor_user_id
        and internal_security.process_work_item_user_has_permission(
          item.id, requested_actor_user_id, requested_actor_employee_id, 'process-task:act'
        )
        and internal_security.process_work_item_user_is_latest_candidate(
          item.id, requested_actor_user_id, requested_actor_employee_id
        )
    );
$$;

revoke all on function internal_security.process_work_item_actor_can_act(uuid, uuid, uuid)
  from public, anon, authenticated;

-- Every execution adapter flows through this RPC. Recheck current scope, claim
-- ownership, and latest candidate state before allowing an action transition.
create or replace function internal_security.perform_process_work_item_action(
  requested_work_item_id uuid,
  requested_action text,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  step_row public.process_step_instances%rowtype;
  version_row public.process_versions%rowtype;
  actor_user_id uuid := auth.uid();
  actor_employee_id uuid;
  existing_event_id uuid;
  existing_actor_user_id uuid;
  existing_event_work_item_id uuid;
  existing_event_action text;
  event_id uuid;
  transition jsonb;
  definition_content jsonb;
  step_definition jsonb;
  subject jsonb;
  fields jsonb;
  remaining_all integer;
begin
  if actor_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if requested_idempotency_key is null or pg_catalog.btrim(requested_idempotency_key) = '' then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001'; end if;

  select instance.* into instance_row
  from public.process_instances instance
  join public.process_work_items item
    on item.tenant_id = instance.tenant_id
   and item.hr_group_id = instance.hr_group_id
   and item.process_instance_id = instance.id
   and item.id = requested_work_item_id
  for update of instance;
  if instance_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;

  actor_employee_id := internal_security.current_employee_id(instance_row.tenant_id, instance_row.hr_group_id);
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;
  if not internal_security.process_instance_user_has_permission(instance_row.id, actor_user_id, 'process-task:act', current_date) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select event.id, event.actor_user_id, event.work_item_id, event.payload ->> 'action'
    into existing_event_id, existing_actor_user_id, existing_event_work_item_id, existing_event_action
  from public.process_events event
  where event.tenant_id = instance_row.tenant_id
    and event.hr_group_id = instance_row.hr_group_id
    and event.process_instance_id = instance_row.id
    and event.idempotency_key = pg_catalog.btrim(requested_idempotency_key);
  if existing_event_id is not null then
    if existing_actor_user_id is distinct from actor_user_id
      or existing_event_work_item_id is distinct from requested_work_item_id
      or existing_event_action is distinct from requested_action then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001';
    end if;
    return internal_security.process_runtime_result(instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, existing_event_id);
  end if;

  select item.* into item_row
  from public.process_work_items item
  where item.tenant_id = instance_row.tenant_id
    and item.hr_group_id = instance_row.hr_group_id
    and item.id = requested_work_item_id
  for update;
  select step.* into step_row
  from public.process_step_instances step
  where step.tenant_id = item_row.tenant_id
    and step.hr_group_id = item_row.hr_group_id
    and step.process_instance_id = item_row.process_instance_id
    and step.id = item_row.step_instance_id
  for update;
  if item_row.id is null or step_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if instance_row.status not in ('RUNNING'::public.process_instance_status, 'BLOCKED'::public.process_instance_status) then
    raise exception 'PROCESS_INSTANCE_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  if step_row.status <> 'ACTIVE'::public.process_step_instance_status then raise exception 'STEP_NOT_ACTIVE' using errcode = 'P0001'; end if;
  if item_row.status not in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then
    raise exception 'WORK_ITEM_NOT_OPEN' using errcode = 'P0001';
  end if;
  if item_row.expected_version <> requested_expected_version then raise exception 'STALE_STATE' using errcode = 'P0001'; end if;

  if requested_step_expected_version is not null and step_row.expected_version <> requested_step_expected_version then
    raise exception 'STALE_STATE' using errcode = 'P0001';
  end if;

  if not internal_security.process_work_item_actor_can_act(item_row.id, actor_user_id, actor_employee_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select version.* into version_row
  from public.process_versions version
  where version.tenant_id = instance_row.tenant_id
    and version.hr_group_id = instance_row.hr_group_id
    and version.id = instance_row.process_version_id;
  if version_row.id is null then raise exception 'PROCESS_VERSION_NOT_FOUND' using errcode = 'P0002'; end if;
  definition_content := internal_security.process_definition_content(version_row.definition_json);
  select value into step_definition
  from pg_catalog.jsonb_array_elements(coalesce(definition_content -> 'steps', '[]'::jsonb)) value
  where value ->> 'key' = item_row.step_key;
  if step_definition is null then raise exception 'STEP_NOT_FOUND' using errcode = 'P0001'; end if;
  if not (exists (
    select 1 from pg_catalog.jsonb_array_elements(coalesce(step_definition -> 'allowedActions', '[]'::jsonb)) action
    where action #>> '{}' = requested_action
  )) then raise exception 'FORBIDDEN_ACTION' using errcode = '42501'; end if;

  subject := internal_security.process_subject_context(instance_row.tenant_id, instance_row.hr_group_id, instance_row.id);
  fields := coalesce(instance_row.metadata -> 'fields', '{}'::jsonb);
  if step_definition ->> 'type' = 'FORM' then
    fields := fields || coalesce(internal_security.process_form_runtime_fields(item_row.id), '{}'::jsonb);
    perform internal_security.prepare_process_form_action(item_row.id, requested_action);
  end if;
  transition := internal_security.select_process_transition(definition_content, item_row.step_key, requested_action, fields, subject);

  update public.process_work_items
  set status = 'COMPLETED'::public.process_work_item_status,
      expected_version = expected_version + 1
  where id = item_row.id;

  if item_row.assignment_mode = 'ALL'::public.process_assignment_mode then
    select count(*) into remaining_all
    from public.process_work_items sibling
    where sibling.tenant_id = item_row.tenant_id
      and sibling.hr_group_id = item_row.hr_group_id
      and sibling.step_instance_id = item_row.step_instance_id
      and sibling.status <> 'COMPLETED'::public.process_work_item_status
      and sibling.status <> 'CANCELLED'::public.process_work_item_status;
    if remaining_all > 0 then
      update public.process_step_instances
      set expected_version = expected_version + 1
      where id = step_row.id;
      update public.process_instances
      set instance_version = instance_version + 1
      where id = instance_row.id;
      event_id := internal_security.append_process_runtime_event(
        item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.id,
        'PROCESS_WORK_ITEM_ACTIONED', jsonb_build_object('action', requested_action, 'stepKey', item_row.step_key, 'remainingParallelItems', remaining_all),
        actor_user_id, actor_employee_id, pg_catalog.btrim(requested_idempotency_key), coalesce(requested_correlation_id, instance_row.correlation_id)
      );
      return internal_security.process_runtime_result(item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, event_id);
    end if;
  end if;

  update public.process_step_instances
  set status = case requested_action
    when 'REJECT' then 'REJECTED'::public.process_step_instance_status
    when 'CANCEL' then 'CANCELLED'::public.process_step_instance_status
    else 'COMPLETED'::public.process_step_instance_status
  end,
      completed_at = timezone('utc', now()), expected_version = expected_version + 1
  where id = step_row.id;
  update public.process_instances
  set instance_version = instance_version + 1,
      current_step_key = null
  where id = instance_row.id;
  perform internal_security.activate_process_step(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id,
    instance_row.scope_type, instance_row.administration_id, instance_row.process_version_id,
    definition_content, transition ->> 'toStepKey', coalesce(requested_correlation_id, instance_row.correlation_id),
    actor_user_id, actor_employee_id
  );
  event_id := internal_security.append_process_runtime_event(
    item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.id,
    'PROCESS_WORK_ITEM_ACTIONED', jsonb_build_object('action', requested_action, 'stepKey', item_row.step_key, 'transitionKey', transition ->> 'key'),
    actor_user_id, actor_employee_id, pg_catalog.btrim(requested_idempotency_key), coalesce(requested_correlation_id, instance_row.correlation_id)
  );
  return internal_security.process_runtime_result(item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, event_id);
end;
$$;

-- Expose only executable actions; OPEN work remains claimable for its current
-- eligible candidate, while claimed work is actionable only by its claimant.
create or replace function internal_security.get_process_work_item_detail(
  requested_work_item_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  definition_row public.process_definitions%rowtype;
  version_row public.process_versions%rowtype;
  step_definition jsonb;
  subject_employee_id uuid;
  subject_name text;
  candidate_ok boolean;
  scope_can_act boolean;
  can_act boolean;
  can_reassign boolean;
  timeline jsonb;
  steps jsonb;
  work_items jsonb;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;

  select item.* into item_row
  from public.process_work_items item
  where item.id = requested_work_item_id;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.process_work_item_can_read(item_row.tenant_id, item_row.hr_group_id, item_row.id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select instance.* into instance_row
  from public.process_instances instance
  where instance.tenant_id = item_row.tenant_id
    and instance.hr_group_id = item_row.hr_group_id
    and instance.id = item_row.process_instance_id;
  select definition.* into definition_row
  from public.process_definitions definition
  where definition.tenant_id = instance_row.tenant_id
    and definition.hr_group_id = instance_row.hr_group_id
    and definition.id = instance_row.process_definition_id;
  select version.* into version_row
  from public.process_versions version
  where version.tenant_id = instance_row.tenant_id
    and version.hr_group_id = instance_row.hr_group_id
    and version.process_definition_id = instance_row.process_definition_id
    and version.id = instance_row.process_version_id;

  select value into step_definition
  from pg_catalog.jsonb_array_elements(coalesce(version_row.definition_json -> 'steps', '[]'::jsonb)) value
  where value ->> 'key' = item_row.step_key
  limit 1;
  select direct_subject.employee_id into subject_employee_id
  from public.process_employee_subjects direct_subject
  where direct_subject.tenant_id = instance_row.tenant_id
    and direct_subject.hr_group_id = instance_row.hr_group_id
    and direct_subject.process_instance_id = instance_row.id;
  if subject_employee_id is null then
    select employment.employee_id into subject_employee_id
    from public.process_employment_subjects subject
    join public.employments employment
      on employment.tenant_id = subject.tenant_id
     and employment.hr_group_id = subject.hr_group_id
     and employment.administration_id = subject.administration_id
     and employment.id = subject.employment_id
    where subject.tenant_id = instance_row.tenant_id
      and subject.hr_group_id = instance_row.hr_group_id
      and subject.process_instance_id = instance_row.id;
  end if;
  select nullif(pg_catalog.concat_ws(' ', employee.first_name, employee.birth_name), '') into subject_name
  from public.employees employee
  where employee.tenant_id = instance_row.tenant_id
    and employee.hr_group_id = instance_row.hr_group_id
    and employee.id = subject_employee_id;

  select exists (
    select 1
    from public.process_work_item_candidates candidate
    where candidate.tenant_id = item_row.tenant_id
      and candidate.hr_group_id = item_row.hr_group_id
      and candidate.work_item_id = item_row.id
      and candidate.employee_id = internal_security.current_employee_id(item_row.tenant_id, item_row.hr_group_id)
      and candidate.candidate_user_id = auth.uid()
      and candidate.is_eligible
      and candidate.resolution_revision = (
        select max(latest.resolution_revision)
        from public.process_work_item_candidates latest
        where latest.tenant_id = item_row.tenant_id
          and latest.hr_group_id = item_row.hr_group_id
          and latest.work_item_id = item_row.id
      )
  ) into candidate_ok;
  scope_can_act := internal_security.process_work_item_user_has_permission(
    item_row.id, auth.uid(), internal_security.current_employee_id(item_row.tenant_id, item_row.hr_group_id), 'process-task:act'
  );
  can_act := internal_security.process_work_item_actor_can_act(item_row.id, auth.uid(), internal_security.current_employee_id(item_row.tenant_id, item_row.hr_group_id));
  can_reassign := internal_security.process_work_item_user_has_permission(
    item_row.id, auth.uid(), internal_security.current_employee_id(item_row.tenant_id, item_row.hr_group_id), 'process-task:reassign'
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', event.id,
    'eventType', event.event_type,
    'createdAt', event.created_at,
    'actorEmployeeId', event.actor_employee_id
  ) order by event.sequence_number), '[]'::jsonb) into timeline
  from public.process_events event
  where event.tenant_id = instance_row.tenant_id
    and event.hr_group_id = instance_row.hr_group_id
    and event.process_instance_id = instance_row.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', step.id,
    'stepKey', step.step_key,
    'status', step.status,
    'expectedVersion', step.expected_version,
    'activatedAt', step.activated_at,
    'completedAt', step.completed_at,
    'deadlineAt', step.deadline_at
  ) order by step.created_at, step.step_key), '[]'::jsonb) into steps
  from public.process_step_instances step
  where step.tenant_id = instance_row.tenant_id
    and step.hr_group_id = instance_row.hr_group_id
    and step.process_instance_id = instance_row.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', work_item.id,
    'stepKey', work_item.step_key,
    'participantKey', work_item.participant_key,
    'assignmentMode', work_item.assignment_mode,
    'status', work_item.status,
    'expectedVersion', work_item.expected_version,
    'availableAt', work_item.available_at,
    'deadlineAt', work_item.deadline_at
  ) order by work_item.created_at, work_item.id), '[]'::jsonb) into work_items
  from public.process_work_items work_item
  where work_item.tenant_id = instance_row.tenant_id
    and work_item.hr_group_id = instance_row.hr_group_id
    and work_item.process_instance_id = instance_row.id;

  return jsonb_build_object(
    'workItemId', item_row.id,
    'processInstanceId', instance_row.id,
    'processDefinitionId', definition_row.id,
    'processKey', definition_row.key,
    'processTitle', internal_security.process_localized_text(definition_row.title, requested_language, definition_row.key),
    'processDescription', internal_security.process_localized_text(definition_row.description, requested_language, null),
    'subjectEmployeeId', subject_employee_id,
    'subjectName', subject_name,
    'instanceStatus', instance_row.status,
    'currentStepKey', instance_row.current_step_key,
    'instanceVersion', instance_row.instance_version,
    'startedAt', instance_row.started_at,
    'completedAt', instance_row.completed_at,
    'correlationId', instance_row.correlation_id,
    'stepKey', item_row.step_key,
    'stepTitle', internal_security.process_localized_text(step_definition -> 'title', requested_language, item_row.step_key),
    'participantKey', item_row.participant_key,
    'assignmentMode', item_row.assignment_mode,
    'assignmentExplanation', internal_security.process_work_item_assignment_explanation(item_row.assignment_snapshot),
    'status', item_row.status,
    'expectedVersion', item_row.expected_version,
    'stepExpectedVersion', (select step.expected_version from public.process_step_instances step where step.id = item_row.step_instance_id),
    'claimedByUserId', item_row.claimed_by_user_id,
    'assigneeEmployeeId', item_row.assignee_employee_id,
    'claimedAt', item_row.claimed_at,
    'availableAt', item_row.available_at,
    'deadlineAt', item_row.deadline_at,
    'isOverdue', item_row.deadline_at is not null and item_row.deadline_at < timezone('utc', now()) and item_row.status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status),
    'canAct', can_act,
    'canClaim', item_row.status = 'OPEN'::public.process_work_item_status and scope_can_act and candidate_ok,
    'canRelease', item_row.status = 'CLAIMED'::public.process_work_item_status and scope_can_act and (item_row.claimed_by_user_id = auth.uid() or can_reassign),
    'canReassign', can_reassign,
    'allowedActions', case when can_act then coalesce(step_definition -> 'allowedActions', '[]'::jsonb) else '[]'::jsonb end,
    'steps', steps,
    'workItems', work_items,
    'timeline', timeline
  );
end;
$$;

-- Keep both worklist projections aligned with the detail and RPC contract.
create or replace function internal_security.get_process_work_projection(
  requested_hr_group_id uuid,
  requested_tab text default 'TODO',
  requested_search text default null,
  requested_status text default null,
  requested_process_definition_id uuid default null,
  requested_subject_employee_id uuid default null,
  requested_language text default 'nl',
  requested_sort text default 'NEEDS_ACTION',
  requested_limit integer default 100,
  requested_offset integer default 0
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
with base as (
  select
    item.id,
    item.tenant_id,
    item.hr_group_id,
    item.process_instance_id,
    item.step_instance_id,
    item.step_key,
    item.participant_key,
    item.assignment_mode,
    item.status,
    item.assignee_employee_id,
    item.claimed_by_user_id,
    item.claimed_at,
    item.available_at,
    item.deadline_at,
    item.expected_version,
    item.allow_self_assignment,
    item.assignment_snapshot,
    item.created_at,
    item.updated_at,
    instance.status as instance_status,
    instance.scope_type,
    instance.administration_id,
    instance.current_step_key,
    instance.instance_version,
    instance.started_at,
    instance.completed_at,
    instance.correlation_id,
    definition.id as process_definition_id,
    definition.key as process_key,
    definition.title as process_title,
    version.definition_json,
    coalesce(direct_subject.employee_id, employment.employee_id) as subject_employee_id,
    subject_employee.first_name as subject_first_name,
    subject_employee.birth_name as subject_birth_name,
    step_definition.step as step_definition,
    exists (
      select 1
      from public.process_work_item_candidates candidate
      where candidate.tenant_id = item.tenant_id
        and candidate.hr_group_id = item.hr_group_id
        and candidate.work_item_id = item.id
        and candidate.employee_id = internal_security.current_employee_id(item.tenant_id, item.hr_group_id)
        and candidate.candidate_user_id = auth.uid()
        and candidate.is_eligible
        and candidate.resolution_revision = (
          select max(latest.resolution_revision)
          from public.process_work_item_candidates latest
          where latest.tenant_id = item.tenant_id
            and latest.hr_group_id = item.hr_group_id
            and latest.work_item_id = item.id
        )
    ) as candidate_ok,
    internal_security.process_work_item_user_has_permission(
      item.id, auth.uid(), internal_security.current_employee_id(item.tenant_id, item.hr_group_id), 'process-task:act'
    ) as scope_can_act
  from public.process_work_items item
  join public.process_instances instance
    on instance.tenant_id = item.tenant_id
   and instance.hr_group_id = item.hr_group_id
   and instance.id = item.process_instance_id
  join public.process_definitions definition
    on definition.tenant_id = instance.tenant_id
   and definition.hr_group_id = instance.hr_group_id
   and definition.id = instance.process_definition_id
  join public.process_versions version
    on version.tenant_id = instance.tenant_id
   and version.hr_group_id = instance.hr_group_id
   and version.process_definition_id = instance.process_definition_id
   and version.id = instance.process_version_id
  left join public.process_employee_subjects direct_subject
    on direct_subject.tenant_id = instance.tenant_id
   and direct_subject.hr_group_id = instance.hr_group_id
   and direct_subject.process_instance_id = instance.id
  left join public.process_employment_subjects employment_subject
    on employment_subject.tenant_id = instance.tenant_id
   and employment_subject.hr_group_id = instance.hr_group_id
   and employment_subject.process_instance_id = instance.id
  left join public.employments employment
    on employment.tenant_id = employment_subject.tenant_id
   and employment.hr_group_id = employment_subject.hr_group_id
   and employment.administration_id = employment_subject.administration_id
   and employment.id = employment_subject.employment_id
  left join public.employees subject_employee
    on subject_employee.tenant_id = instance.tenant_id
   and subject_employee.hr_group_id = instance.hr_group_id
   and subject_employee.id = coalesce(direct_subject.employee_id, employment.employee_id)
  left join lateral (
    select value as step
    from pg_catalog.jsonb_array_elements(coalesce(version.definition_json -> 'steps', '[]'::jsonb)) value
    where value ->> 'key' = item.step_key
    limit 1
  ) step_definition on true
  where item.hr_group_id = requested_hr_group_id
    and internal_security.process_work_item_can_read(item.tenant_id, item.hr_group_id, item.id)
    and (
      requested_subject_employee_id is null
      or coalesce(direct_subject.employee_id, employment.employee_id) = requested_subject_employee_id
    )
    and (
      requested_process_definition_id is null
      or instance.process_definition_id = requested_process_definition_id
    )
    and (
      requested_status is null
      or item.status::text = requested_status
      or instance.status::text = requested_status
    )
    and (
      requested_search is null
      or pg_catalog.btrim(requested_search) = ''
      or definition.key ilike '%' || pg_catalog.btrim(requested_search) || '%'
      or internal_security.process_localized_text(definition.title, requested_language, definition.key) ilike '%' || pg_catalog.btrim(requested_search) || '%'
      or pg_catalog.concat_ws(' ', subject_employee.first_name, subject_employee.birth_name) ilike '%' || pg_catalog.btrim(requested_search) || '%'
      or internal_security.process_localized_text(step_definition.step -> 'title', requested_language, item.step_key) ilike '%' || pg_catalog.btrim(requested_search) || '%'
    )
), classified as (
  select
    base.*,
    (base.status = 'CLAIMED'::public.process_work_item_status and base.claimed_by_user_id = auth.uid() and base.scope_can_act and base.candidate_ok) as can_act,
    (base.status = 'OPEN'::public.process_work_item_status and base.scope_can_act and base.candidate_ok) as can_claim,
    case
      when base.assignment_mode = 'ANY_ONE'::public.process_assignment_mode and base.candidate_ok then 'QUEUE'
      when base.candidate_ok then 'DIRECT'
      when base.scope_can_act then 'SCOPE'
      else 'PROCESS'
    end as received_via,
    case
      when base.status in ('COMPLETED'::public.process_work_item_status, 'CANCELLED'::public.process_work_item_status, 'EXPIRED'::public.process_work_item_status) then 'COMPLETED'
      when base.instance_status in ('COMPLETED'::public.process_instance_status, 'REJECTED'::public.process_instance_status, 'CANCELLED'::public.process_instance_status) then 'COMPLETED'
      when base.instance_status in ('WAITING'::public.process_instance_status, 'BLOCKED'::public.process_instance_status) then 'WAITING'
      when base.claimed_by_user_id = auth.uid() then 'CLAIMED'
      when base.status = 'OPEN'::public.process_work_item_status and base.scope_can_act and base.candidate_ok then 'TODO'
      else 'WAITING'
    end as work_tab
  from base
), filtered as (
  select *
  from classified
  where upper(coalesce(requested_tab, 'TODO')) = 'ALL'
    or work_tab = upper(coalesce(requested_tab, 'TODO'))
    or (upper(coalesce(requested_tab, 'TODO')) = 'TODO' and status = 'OPEN'::public.process_work_item_status and can_claim)
    or (upper(coalesce(requested_tab, 'TODO')) = 'CLAIMED' and claimed_by_user_id = auth.uid())
), counted as (
  select filtered.*, count(*) over () as total_count
  from filtered
), paged as (
  select *
  from counted
  order by
    case when upper(coalesce(requested_sort, 'NEEDS_ACTION')) = 'NEEDS_ACTION' and (can_act or can_claim) and status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then 0 else 1 end,
    case when deadline_at is not null and deadline_at < timezone('utc', now()) then 0 else 1 end,
    case when upper(coalesce(requested_sort, 'NEEDS_ACTION')) = 'DEADLINE' then deadline_at end asc nulls last,
    case when upper(coalesce(requested_sort, 'NEEDS_ACTION')) <> 'DEADLINE' then updated_at end desc,
    id
  offset greatest(coalesce(requested_offset, 0), 0)
  limit least(greatest(coalesce(requested_limit, 100), 1), 200)
)
select jsonb_build_object(
  'items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'workItemId', page.id,
      'processInstanceId', page.process_instance_id,
      'stepInstanceId', page.step_instance_id,
      'processDefinitionId', page.process_definition_id,
      'processKey', page.process_key,
      'processTitle', internal_security.process_localized_text(page.process_title, requested_language, page.process_key),
      'subjectEmployeeId', page.subject_employee_id,
      'subjectName', nullif(pg_catalog.concat_ws(' ', page.subject_first_name, page.subject_birth_name), ''),
      'stepKey', page.step_key,
      'stepTitle', internal_security.process_localized_text(page.step_definition -> 'title', requested_language, page.step_key),
      'participantKey', page.participant_key,
      'assignmentMode', page.assignment_mode,
      'receivedVia', page.received_via,
      'assignmentExplanation', internal_security.process_work_item_assignment_explanation(page.assignment_snapshot),
      'status', page.status,
      'instanceStatus', page.instance_status,
      'currentStepKey', page.current_step_key,
      'instanceVersion', page.instance_version,
      'expectedVersion', page.expected_version,
      'claimedByUserId', page.claimed_by_user_id,
      'assigneeEmployeeId', page.assignee_employee_id,
      'claimedAt', page.claimed_at,
      'availableAt', page.available_at,
      'deadlineAt', page.deadline_at,
      'createdAt', page.created_at,
      'updatedAt', page.updated_at,
      'canAct', page.can_act,
      'canClaim', page.can_claim,
      'isOverdue', page.deadline_at is not null and page.deadline_at < timezone('utc', now()) and page.status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status)
    ) order by page.updated_at desc, page.id)
    from paged page
  ), '[]'::jsonb),
  'total', coalesce((select max(total_count) from paged), 0),
  'hasMore', coalesce((select max(total_count) from paged), 0) > greatest(coalesce(requested_offset, 0), 0) + least(greatest(coalesce(requested_limit, 100), 1), 200)
);
$$;

create or replace function internal_security.get_unified_process_work_projection(
  requested_hr_group_id uuid,
  requested_view text default 'WORK',
  requested_tab text default 'TODO',
  requested_search text default null,
  requested_status text default null,
  requested_business_type text default null,
  requested_business_category text default null,
  requested_process_definition_id uuid default null,
  requested_administration_id uuid default null,
  requested_subject_employee_id uuid default null,
  requested_subject_employment_id uuid default null,
  requested_language text default 'nl',
  requested_sort text default 'NEEDS_ACTION',
  requested_limit integer default 100,
  requested_offset integer default 0
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
with base as (
  select
    item.id,
    item.tenant_id,
    item.hr_group_id,
    item.process_instance_id,
    item.step_instance_id,
    item.step_key,
    item.participant_key,
    item.assignment_mode,
    item.status,
    item.assignee_employee_id,
    item.claimed_by_user_id,
    item.claimed_at,
    item.available_at,
    item.deadline_at,
    item.expected_version,
    item.allow_self_assignment,
    item.assignment_snapshot,
    item.created_at,
    item.updated_at,
    item.business_type,
    item.business_category,
    instance.status as instance_status,
    instance.scope_type,
    instance.administration_id,
    instance.current_step_key,
    instance.instance_version,
    instance.started_at,
    instance.completed_at,
    instance.correlation_id,
    instance.initiator_user_id,
    definition.id as process_definition_id,
    definition.key as process_key,
    definition.title as process_title,
    version.definition_json,
    coalesce(direct_subject.employee_id, employment.employee_id) as subject_employee_id,
    employment_subject.employment_id as subject_employment_id,
    subject_employee.first_name as subject_first_name,
    subject_employee.birth_name as subject_birth_name,
    step_definition.step as step_definition,
    leave_link.leave_request_id,
    leave_request.status as leave_request_status,
    exists (
      select 1
      from public.process_work_item_candidates candidate
      where candidate.tenant_id = item.tenant_id
        and candidate.hr_group_id = item.hr_group_id
        and candidate.work_item_id = item.id
        and candidate.employee_id = internal_security.current_employee_id(item.tenant_id, item.hr_group_id)
        and candidate.candidate_user_id = auth.uid()
        and candidate.is_eligible
        and candidate.resolution_revision = (
          select max(latest.resolution_revision)
          from public.process_work_item_candidates latest
          where latest.tenant_id = item.tenant_id
            and latest.hr_group_id = item.hr_group_id
            and latest.work_item_id = item.id
        )
    ) as candidate_ok,
    internal_security.process_work_item_user_has_permission(
      item.id, auth.uid(), internal_security.current_employee_id(item.tenant_id, item.hr_group_id), 'process-task:act'
    ) as scope_can_act
  from public.process_work_items item
  join public.process_instances instance
    on instance.tenant_id = item.tenant_id
   and instance.hr_group_id = item.hr_group_id
   and instance.id = item.process_instance_id
  join public.process_definitions definition
    on definition.tenant_id = instance.tenant_id
   and definition.hr_group_id = instance.hr_group_id
   and definition.id = instance.process_definition_id
  join public.process_versions version
    on version.tenant_id = instance.tenant_id
   and version.hr_group_id = instance.hr_group_id
   and version.process_definition_id = instance.process_definition_id
   and version.id = instance.process_version_id
  left join public.process_employee_subjects direct_subject
    on direct_subject.tenant_id = instance.tenant_id
   and direct_subject.hr_group_id = instance.hr_group_id
   and direct_subject.process_instance_id = instance.id
  left join public.process_employment_subjects employment_subject
    on employment_subject.tenant_id = instance.tenant_id
   and employment_subject.hr_group_id = instance.hr_group_id
   and employment_subject.process_instance_id = instance.id
  left join public.employments employment
    on employment.tenant_id = employment_subject.tenant_id
   and employment.hr_group_id = employment_subject.hr_group_id
   and employment.administration_id = employment_subject.administration_id
   and employment.id = employment_subject.employment_id
  left join public.employees subject_employee
    on subject_employee.tenant_id = instance.tenant_id
   and subject_employee.hr_group_id = instance.hr_group_id
   and subject_employee.id = coalesce(direct_subject.employee_id, employment.employee_id)
  left join lateral (
    select value as step
    from pg_catalog.jsonb_array_elements(coalesce(version.definition_json -> 'steps', '[]'::jsonb)) value
    where value ->> 'key' = item.step_key
    limit 1
  ) step_definition on true
  left join public.process_leave_subjects leave_link
    on leave_link.tenant_id = instance.tenant_id
   and leave_link.hr_group_id = instance.hr_group_id
   and leave_link.process_instance_id = instance.id
  left join public.leave_requests leave_request
    on leave_request.tenant_id = leave_link.tenant_id
   and leave_request.hr_group_id = leave_link.hr_group_id
   and leave_request.administration_id = leave_link.administration_id
   and leave_request.id = leave_link.leave_request_id
  where item.hr_group_id = requested_hr_group_id
    and internal_security.process_work_item_can_read(item.tenant_id, item.hr_group_id, item.id)
    and (
      upper(coalesce(requested_view, 'WORK')) <> 'REQUESTS'
      or instance.initiator_user_id = auth.uid()
    )
    and (
      requested_administration_id is null
      or instance.administration_id = requested_administration_id
    )
    and (
      requested_subject_employee_id is null
      or coalesce(direct_subject.employee_id, employment.employee_id) = requested_subject_employee_id
    )
    and (
      requested_subject_employment_id is null
      or employment_subject.employment_id = requested_subject_employment_id
    )
    and (
      requested_process_definition_id is null
      or instance.process_definition_id = requested_process_definition_id
    )
    and (
      requested_business_type is null
      or pg_catalog.btrim(requested_business_type) = ''
      or item.business_type = upper(pg_catalog.btrim(requested_business_type))
    )
    and (
      requested_business_category is null
      or pg_catalog.btrim(requested_business_category) = ''
      or item.business_category = upper(pg_catalog.btrim(requested_business_category))
    )
    and (
      requested_search is null
      or pg_catalog.btrim(requested_search) = ''
      or definition.key ilike '%' || pg_catalog.btrim(requested_search) || '%'
      or internal_security.process_localized_text(definition.title, requested_language, definition.key) ilike '%' || pg_catalog.btrim(requested_search) || '%'
      or pg_catalog.concat_ws(' ', subject_employee.first_name, subject_employee.birth_name) ilike '%' || pg_catalog.btrim(requested_search) || '%'
      or internal_security.process_localized_text(step_definition.step -> 'title', requested_language, item.step_key) ilike '%' || pg_catalog.btrim(requested_search) || '%'
    )
), ranked as (
  select base.*,
    pg_catalog.row_number() over (
      partition by base.process_instance_id
      order by case when base.status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then 0 else 1 end, base.updated_at desc, base.id
    ) as request_rank
  from base
), classified as (
  select ranked.*,
    (ranked.status = 'CLAIMED'::public.process_work_item_status and ranked.claimed_by_user_id = auth.uid() and ranked.scope_can_act and ranked.candidate_ok) as can_act,
    (ranked.status = 'OPEN'::public.process_work_item_status and ranked.scope_can_act and ranked.candidate_ok) as can_claim,
    case
      when ranked.assignment_mode = 'ANY_ONE'::public.process_assignment_mode and ranked.candidate_ok then 'QUEUE'
      when ranked.candidate_ok then 'DIRECT'
      when ranked.scope_can_act then 'SCOPE'
      else 'PROCESS'
    end as received_via,
    case
      when ranked.business_type = 'LEAVE' and ranked.leave_request_status is not null then case ranked.leave_request_status
        when 'PENDING'::public.leave_request_status then case when ranked.status = 'CLAIMED'::public.process_work_item_status then 'IN_PROGRESS' else case when ranked.scope_can_act then 'OPEN' else 'WAITING' end end
        when 'CHANGES_REQUESTED'::public.leave_request_status then 'CHANGES_REQUESTED'
        when 'APPROVED'::public.leave_request_status then 'COMPLETED'
        when 'REJECTED'::public.leave_request_status then 'REJECTED'
        when 'CANCELLED'::public.leave_request_status then 'CANCELLED'
      end
      when ranked.instance_status = 'REJECTED'::public.process_instance_status then 'REJECTED'
      when ranked.instance_status = 'CANCELLED'::public.process_instance_status or ranked.status = 'CANCELLED'::public.process_work_item_status then 'CANCELLED'
      when ranked.status = 'EXPIRED'::public.process_work_item_status then 'CANCELLED'
      when ranked.status = 'CLAIMED'::public.process_work_item_status then 'IN_PROGRESS'
      when ranked.status = 'COMPLETED'::public.process_work_item_status and ranked.instance_status = 'COMPLETED'::public.process_instance_status then 'COMPLETED'
      when ranked.scope_can_act then 'OPEN'
      else 'WAITING'
    end as business_status,
    case
      when ranked.status in ('COMPLETED'::public.process_work_item_status, 'CANCELLED'::public.process_work_item_status, 'EXPIRED'::public.process_work_item_status) then 'COMPLETED'
      when ranked.instance_status in ('COMPLETED'::public.process_instance_status, 'REJECTED'::public.process_instance_status, 'CANCELLED'::public.process_instance_status) then 'COMPLETED'
      when ranked.instance_status in ('WAITING'::public.process_instance_status, 'BLOCKED'::public.process_instance_status) then 'WAITING'
      when ranked.claimed_by_user_id = auth.uid() then 'CLAIMED'
      when ranked.status = 'OPEN'::public.process_work_item_status and ranked.scope_can_act and ranked.candidate_ok then 'TODO'
      else 'WAITING'
    end as work_tab
  from ranked
), filtered as (
  select classified.*
  from classified
  where (
    (upper(coalesce(requested_view, 'WORK')) = 'REQUESTS' and classified.request_rank = 1)
    or upper(coalesce(requested_view, 'WORK')) <> 'REQUESTS'
  )
  and (
    upper(coalesce(requested_view, 'WORK')) = 'REQUESTS'
    or upper(coalesce(requested_tab, 'TODO')) = 'ALL'
    or classified.work_tab = upper(coalesce(requested_tab, 'TODO'))
    or (upper(coalesce(requested_tab, 'TODO')) = 'TODO' and classified.status = 'OPEN'::public.process_work_item_status and classified.can_claim)
    or (upper(coalesce(requested_tab, 'TODO')) = 'CLAIMED' and classified.claimed_by_user_id = auth.uid())
  )
  and (
    requested_status is null
    or pg_catalog.btrim(requested_status) = ''
    or classified.business_status = upper(pg_catalog.btrim(requested_status))
    or classified.status::text = upper(pg_catalog.btrim(requested_status))
    or classified.instance_status::text = upper(pg_catalog.btrim(requested_status))
  )
), counted as (
  select filtered.*, count(*) over () as total_count
  from filtered
), paged as (
  select *
  from counted
  order by
    case when upper(coalesce(requested_sort, 'NEEDS_ACTION')) = 'NEEDS_ACTION' and (can_act or can_claim) and status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then 0 else 1 end,
    case when deadline_at is not null and deadline_at < timezone('utc', now()) then 0 else 1 end,
    case when upper(coalesce(requested_sort, 'NEEDS_ACTION')) = 'DEADLINE' then deadline_at end asc nulls last,
    case when upper(coalesce(requested_sort, 'NEEDS_ACTION')) <> 'DEADLINE' then updated_at end desc,
    id
  offset greatest(coalesce(requested_offset, 0), 0)
  limit least(greatest(coalesce(requested_limit, 100), 1), 200)
)
select jsonb_build_object(
  'items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'workItemId', page.id,
      'processInstanceId', page.process_instance_id,
      'stepInstanceId', page.step_instance_id,
      'processDefinitionId', page.process_definition_id,
      'processKey', page.process_key,
      'processTitle', internal_security.process_localized_text(page.process_title, requested_language, page.process_key),
      'subjectEmployeeId', page.subject_employee_id,
      'subjectEmploymentId', page.subject_employment_id,
      'subjectName', nullif(pg_catalog.concat_ws(' ', page.subject_first_name, page.subject_birth_name), ''),
      'stepKey', page.step_key,
      'stepTitle', internal_security.process_localized_text(page.step_definition -> 'title', requested_language, page.step_key),
      'participantKey', page.participant_key,
      'assignmentMode', page.assignment_mode,
      'receivedVia', page.received_via,
      'assignmentExplanation', internal_security.process_work_item_assignment_explanation(page.assignment_snapshot),
      'status', page.status,
      'instanceStatus', page.instance_status,
      'currentStepKey', page.current_step_key,
      'instanceVersion', page.instance_version,
      'expectedVersion', page.expected_version,
      'claimedByUserId', page.claimed_by_user_id,
      'assigneeEmployeeId', page.assignee_employee_id,
      'claimedAt', page.claimed_at,
      'availableAt', page.available_at,
      'deadlineAt', page.deadline_at,
      'createdAt', page.created_at,
      'updatedAt', page.updated_at,
      'canAct', page.can_act,
      'canClaim', page.can_claim,
      'isOverdue', page.deadline_at is not null and page.deadline_at < timezone('utc', now()) and page.status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status),
      'businessType', page.business_type,
      'businessCategory', page.business_category,
      'businessStatus', page.business_status,
      'leaveRequestId', page.leave_request_id
    ) order by page.updated_at desc, page.id)
    from paged page
  ), '[]'::jsonb),
  'total', coalesce((select max(total_count) from paged), 0),
  'hasMore', coalesce((select max(total_count) from paged), 0) > greatest(coalesce(requested_offset, 0), 0) + least(greatest(coalesce(requested_limit, 100), 1), 200)
);
$$;

commit;