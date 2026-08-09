begin;

-- P6 houdt de werkqueue server-geautoriseerd en retourneert bewust een kleine
-- projectie. De runtimetabellen blijven read-only via de data-API; alle filters
-- hieronder worden opnieuw afgedwongen in de security-definerprojectie.

create or replace function internal_security.process_localized_text(
  requested_value jsonb,
  requested_language text,
  requested_fallback text
)
returns text
language sql
immutable
as $$
  select coalesce(
    requested_value ->> case when requested_language = 'en' then 'en' else 'nl' end,
    requested_value ->> 'nl',
    requested_value ->> 'en',
    requested_fallback
  );
$$;

revoke all on function internal_security.process_localized_text(jsonb, text, text)
  from public, anon, authenticated;

create or replace function internal_security.process_work_item_assignment_explanation(
  requested_snapshot jsonb
)
returns jsonb
language sql
immutable
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'assignmentMode', requested_snapshot -> 'resolution' ->> 'assignmentMode',
    'source', requested_snapshot -> 'resolution' ->> 'source',
    'resolutionPolicy', requested_snapshot -> 'resolution' ->> 'resolutionDatePolicy',
    'resolutionDate', requested_snapshot -> 'resolution' ->> 'asOfDate',
    'roleCode', requested_snapshot -> 'candidate' ->> 'managementRoleCode'
  ));
$$;

revoke all on function internal_security.process_work_item_assignment_explanation(jsonb)
  from public, anon, authenticated;

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
    ) as candidate_ok,
    internal_security.process_scope_has_permission(
      instance.tenant_id,
      instance.hr_group_id,
      instance.scope_type,
      instance.administration_id,
      'process-task:act'
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
    (base.scope_can_act or base.candidate_ok) as can_act,
    (base.status = 'OPEN'::public.process_work_item_status and (base.scope_can_act or base.candidate_ok)) as can_claim,
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
      when base.scope_can_act or base.candidate_ok then 'TODO'
      else 'WAITING'
    end as work_tab
  from base
), filtered as (
  select *
  from classified
  where upper(coalesce(requested_tab, 'TODO')) = 'ALL'
    or work_tab = upper(coalesce(requested_tab, 'TODO'))
    or (upper(coalesce(requested_tab, 'TODO')) = 'TODO' and status = 'OPEN'::public.process_work_item_status and can_act)
    or (upper(coalesce(requested_tab, 'TODO')) = 'CLAIMED' and claimed_by_user_id = auth.uid())
), counted as (
  select filtered.*, count(*) over () as total_count
  from filtered
), paged as (
  select *
  from counted
  order by
    case when upper(coalesce(requested_sort, 'NEEDS_ACTION')) = 'NEEDS_ACTION' and can_act and status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then 0 else 1 end,
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

revoke all on function internal_security.get_process_work_projection(uuid, text, text, text, uuid, uuid, text, text, integer, integer)
  from public, anon, authenticated;

create or replace function public.get_process_work_projection(
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
security invoker
set search_path = ''
as $$
  select internal_security.get_process_work_projection(
    requested_hr_group_id, requested_tab, requested_search, requested_status,
    requested_process_definition_id, requested_subject_employee_id, requested_language,
    requested_sort, requested_limit, requested_offset
  );
$$;

revoke all on function public.get_process_work_projection(uuid, text, text, text, uuid, uuid, text, text, integer, integer)
  from public, anon;
grant execute on function public.get_process_work_projection(uuid, text, text, text, uuid, uuid, text, text, integer, integer)
  to authenticated;

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
  ) into candidate_ok;
  scope_can_act := internal_security.process_scope_has_permission(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type,
    instance_row.administration_id, 'process-task:act'
  );
  can_act := scope_can_act or candidate_ok;
  can_reassign := internal_security.process_scope_has_permission(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type,
    instance_row.administration_id, 'process-task:reassign'
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
    'canClaim', item_row.status = 'OPEN'::public.process_work_item_status and can_act,
    'canRelease', item_row.status = 'CLAIMED'::public.process_work_item_status and item_row.claimed_by_user_id = auth.uid(),
    'canReassign', can_reassign,
    'allowedActions', coalesce(step_definition -> 'allowedActions', '[]'::jsonb),
    'steps', steps,
    'workItems', work_items,
    'timeline', timeline
  );
end;
$$;

revoke all on function internal_security.get_process_work_item_detail(uuid, text)
  from public, anon, authenticated;

create or replace function public.get_process_work_item_detail(
  requested_work_item_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select internal_security.get_process_work_item_detail(requested_work_item_id, requested_language); $$;

revoke all on function public.get_process_work_item_detail(uuid, text) from public, anon;
grant execute on function public.get_process_work_item_detail(uuid, text) to authenticated;

commit;
