begin;

-- Keep the existing durable workflow queue and reminder tables. A delivery is
-- unique per step activation, work item, and configured event.
alter table public.process_reminder_deliveries
  add column delivery_kind text not null default 'LEGACY_DEADLINE',
  add column work_item_id uuid;

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select constraint_item.conname
    from pg_catalog.pg_constraint constraint_item
    where constraint_item.conrelid = 'public.process_reminder_deliveries'::regclass
      and constraint_item.contype = 'u'
      and pg_catalog.pg_get_constraintdef(constraint_item.oid) = 'UNIQUE (tenant_id, hr_group_id, step_instance_id)'
  loop
    execute pg_catalog.format('alter table public.process_reminder_deliveries drop constraint %I', constraint_row.conname);
  end loop;
end;
$$;

alter table public.process_reminder_deliveries
  add constraint process_reminder_deliveries_delivery_kind_check
    check (delivery_kind in ('LEGACY_DEADLINE', 'BEFORE_DEADLINE', 'AT_DEADLINE', 'BREACH')),
  add constraint process_reminder_deliveries_work_item_fkey
    foreign key (tenant_id, hr_group_id, work_item_id)
    references public.process_work_items(tenant_id, hr_group_id, id)
    on delete restrict,
  add constraint process_reminder_deliveries_event_key
    unique (tenant_id, hr_group_id, step_instance_id, work_item_id, delivery_kind);

create unique index process_reminder_deliveries_legacy_step_key
  on public.process_reminder_deliveries (tenant_id, hr_group_id, step_instance_id)
  where work_item_id is null and delivery_kind = 'LEGACY_DEADLINE';

comment on column public.process_reminder_deliveries.delivery_kind is
  'Immutable delivery event selected by the pinned SLA version.';
comment on column public.process_reminder_deliveries.work_item_id is
  'The existing authorized work item whose assignees receive this reminder; null only for legacy subject reminders.';

-- Preserve the original deadline reminder for published versions that do not
-- carry PMUX-06B notification settings. New settings are materialized per work
-- item by the companion trigger below.
create or replace function internal_security.enqueue_process_workflow_jobs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  instance_row public.process_instances%rowtype;
  version_json jsonb;
  definition_content jsonb;
  step_json jsonb;
  output_json jsonb;
begin
  if TG_TABLE_NAME = 'process_step_instances' then
    if new.status = 'ACTIVE'::public.process_step_instance_status and new.deadline_at is not null then
      select instance.*
        into instance_row
      from public.process_instances instance
      where instance.tenant_id = new.tenant_id
        and instance.hr_group_id = new.hr_group_id
        and instance.id = new.process_instance_id
        and instance.process_version_id = new.process_version_id;

      select version.definition_json
        into version_json
      from public.process_versions version
      where version.tenant_id = new.tenant_id
        and version.hr_group_id = new.hr_group_id
        and version.process_definition_id = instance_row.process_definition_id
        and version.id = new.process_version_id;

      definition_content := internal_security.process_definition_content(version_json);
      select step.value
        into step_json
      from pg_catalog.jsonb_array_elements(coalesce(definition_content -> 'steps', '[]'::jsonb)) as step(value)
      where step.value ->> 'key' = new.step_key
      limit 1;

      if coalesce(step_json #> '{sla,notifications}', 'null'::jsonb) = 'null'::jsonb then
        insert into public.workflow_jobs (
          tenant_id, hr_group_id, administration_id, process_instance_id,
          step_instance_id, job_type, available_at, idempotency_key,
          correlation_id, payload
        ) values (
          new.tenant_id, new.hr_group_id, instance_row.administration_id,
          new.process_instance_id, new.id, 'PROCESS_REMINDER'::public.workflow_job_type,
          new.deadline_at, 'process-reminder:' || new.id::text,
          instance_row.correlation_id,
          jsonb_build_object('processInstanceId', new.process_instance_id, 'stepInstanceId', new.id)
        ) on conflict (tenant_id, hr_group_id, idempotency_key) do nothing;
      end if;
    end if;
    return new;
  end if;

  if TG_TABLE_NAME = 'process_instances'
    and new.status in (
      'COMPLETED'::public.process_instance_status,
      'REJECTED'::public.process_instance_status,
      'CANCELLED'::public.process_instance_status
    )
    and old.status is distinct from new.status then
    select version.definition_json
      into version_json
    from public.process_versions version
    where version.tenant_id = new.tenant_id
      and version.hr_group_id = new.hr_group_id
      and version.id = new.process_version_id;

    output_json := internal_security.process_definition_content(version_json) -> 'output';
    if jsonb_typeof(output_json) = 'object'
      and output_json ->> 'format' = 'PDF'
      and nullif(output_json ->> 'dossierCategoryKey', '') is not null then
      insert into public.workflow_jobs (
        tenant_id, hr_group_id, administration_id, process_instance_id,
        job_type, available_at, idempotency_key, correlation_id, payload
      ) values (
        new.tenant_id, new.hr_group_id, new.administration_id, new.id,
        'PROCESS_DOCUMENT_OUTPUT'::public.workflow_job_type, pg_catalog.now(),
        'process-output:' || new.id::text || ':' || (output_json ->> 'key'),
        new.correlation_id, jsonb_build_object('processInstanceId', new.id)
      ) on conflict (tenant_id, hr_group_id, idempotency_key) do nothing;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function internal_security.enqueue_process_workflow_jobs() from public, anon, authenticated;

create or replace function internal_security.enqueue_process_sla_delivery_jobs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  instance_row public.process_instances%rowtype;
  version_json jsonb;
  definition_content jsonb;
  step_json jsonb;
  notifications_json jsonb;
  before_deadline text;
  scheduled_at timestamptz;
begin
  if new.deadline_at is null or new.status::text not in ('OPEN', 'CLAIMED') then
    return new;
  end if;

  select instance.*
    into instance_row
  from public.process_instances instance
  where instance.tenant_id = new.tenant_id
    and instance.hr_group_id = new.hr_group_id
    and instance.id = new.process_instance_id
    and instance.process_version_id = new.process_version_id;
  if instance_row.id is null or instance_row.status::text <> 'RUNNING' then
    return new;
  end if;

  select version.definition_json
    into version_json
  from public.process_versions version
  where version.tenant_id = new.tenant_id
    and version.hr_group_id = new.hr_group_id
    and version.process_definition_id = instance_row.process_definition_id
    and version.id = new.process_version_id;
  definition_content := internal_security.process_definition_content(version_json);
  select step.value
    into step_json
  from pg_catalog.jsonb_array_elements(coalesce(definition_content -> 'steps', '[]'::jsonb)) as step(value)
  where step.value ->> 'key' = new.step_key
  limit 1;

  notifications_json := step_json #> '{sla,notifications}';
  if jsonb_typeof(notifications_json) <> 'object' then
    return new;
  end if;

  before_deadline := notifications_json ->> 'beforeDeadline';
  if before_deadline in ('ONE_HOUR', 'TWENTY_FOUR_HOURS') then
    scheduled_at := case before_deadline
      when 'ONE_HOUR' then new.deadline_at - interval '1 hour'
      else new.deadline_at - interval '24 hours'
    end;
    insert into public.workflow_jobs (
      tenant_id, hr_group_id, administration_id, process_instance_id,
      step_instance_id, work_item_id, job_type, available_at, idempotency_key,
      correlation_id, payload
    ) values (
      new.tenant_id, new.hr_group_id, instance_row.administration_id,
      new.process_instance_id, new.step_instance_id, new.id,
      'PROCESS_REMINDER'::public.workflow_job_type, greatest(scheduled_at, pg_catalog.now()),
      'process-reminder:' || new.id::text || ':BEFORE_DEADLINE',
      instance_row.correlation_id, jsonb_build_object('deliveryKind', 'BEFORE_DEADLINE')
    ) on conflict (tenant_id, hr_group_id, idempotency_key) do nothing;
  end if;

  if coalesce((notifications_json ->> 'atDeadline')::boolean, false) then
    insert into public.workflow_jobs (
      tenant_id, hr_group_id, administration_id, process_instance_id,
      step_instance_id, work_item_id, job_type, available_at, idempotency_key,
      correlation_id, payload
    ) values (
      new.tenant_id, new.hr_group_id, instance_row.administration_id,
      new.process_instance_id, new.step_instance_id, new.id,
      'PROCESS_REMINDER'::public.workflow_job_type, greatest(new.deadline_at, pg_catalog.now()),
      'process-reminder:' || new.id::text || ':AT_DEADLINE',
      instance_row.correlation_id, jsonb_build_object('deliveryKind', 'AT_DEADLINE')
    ) on conflict (tenant_id, hr_group_id, idempotency_key) do nothing;
  end if;

  insert into public.workflow_jobs (
    tenant_id, hr_group_id, administration_id, process_instance_id,
    step_instance_id, work_item_id, job_type, available_at, idempotency_key,
    correlation_id, payload
  ) values (
    new.tenant_id, new.hr_group_id, instance_row.administration_id,
    new.process_instance_id, new.step_instance_id, new.id,
    'PROCESS_REMINDER'::public.workflow_job_type,
    greatest(new.deadline_at + interval '1 second', pg_catalog.now()),
    'process-reminder:' || new.id::text || ':BREACH',
    instance_row.correlation_id, jsonb_build_object('deliveryKind', 'BREACH')
  ) on conflict (tenant_id, hr_group_id, idempotency_key) do nothing;

  return new;
end;
$$;

revoke all on function internal_security.enqueue_process_sla_delivery_jobs() from public, anon, authenticated;

drop trigger if exists enqueue_process_work_item_sla_delivery_jobs on public.process_work_items;
create trigger enqueue_process_work_item_sla_delivery_jobs
after insert or update of status, deadline_at on public.process_work_items
for each row execute function internal_security.enqueue_process_sla_delivery_jobs();

create or replace function internal_security.create_process_deadline_reminder(
  requested_job_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_row public.workflow_jobs%rowtype;
  instance_row public.process_instances%rowtype;
  step_row public.process_step_instances%rowtype;
  work_item_row public.process_work_items%rowtype;
  version_json jsonb;
  definition_content jsonb;
  step_json jsonb;
  sla_definition jsonb;
  escalation_participant jsonb;
  subject_context jsonb;
  assignment jsonb;
  recipient_list jsonb := '[]'::jsonb;
  recipient jsonb;
  subject_employee_id uuid;
  subject_auth_user_id uuid;
  reminder_id uuid;
  existing_reminder_id uuid;
  reminder_title text;
  reminder_description text;
  reminder_at timestamptz := pg_catalog.now();
  delivery_kind text;
  event_type text;
  participant_key text;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  select job.* into job_row
  from public.workflow_jobs job
  where job.id = requested_job_id
    and job.job_type = 'PROCESS_REMINDER'::public.workflow_job_type
  for update;
  if job_row.id is null then
    raise exception 'PROCESS_REMINDER_JOB_NOT_FOUND' using errcode = 'P0002';
  end if;

  select delivery.reminder_id into existing_reminder_id
  from public.process_reminder_deliveries delivery
  where delivery.tenant_id = job_row.tenant_id
    and delivery.hr_group_id = job_row.hr_group_id
    and delivery.workflow_job_id = job_row.id;
  if existing_reminder_id is not null then
    return jsonb_build_object('jobId', job_row.id, 'reminderId', existing_reminder_id, 'created', false);
  end if;

  delivery_kind := coalesce(job_row.payload ->> 'deliveryKind', 'LEGACY_DEADLINE');
  if delivery_kind not in ('LEGACY_DEADLINE', 'BEFORE_DEADLINE', 'AT_DEADLINE', 'BREACH') then
    raise exception 'PROCESS_REMINDER_KIND_INVALID' using errcode = '22023';
  end if;

  select instance.* into instance_row
  from public.process_instances instance
  where instance.tenant_id = job_row.tenant_id
    and instance.hr_group_id = job_row.hr_group_id
    and instance.id = job_row.process_instance_id;
  if instance_row.id is null then
    raise exception 'PROCESS_REMINDER_CONTEXT_MISSING' using errcode = 'P0002';
  end if;
  if not coalesce(internal_security.process_scope_has_permission(
    job_row.tenant_id, job_row.hr_group_id, instance_row.scope_type,
    instance_row.administration_id, 'process-operations:write'
  ), false) then
    raise exception 'PROCESS_REMINDER_FORBIDDEN' using errcode = '42501';
  end if;

  select step.* into step_row
  from public.process_step_instances step
  where step.tenant_id = job_row.tenant_id
    and step.hr_group_id = job_row.hr_group_id
    and step.process_instance_id = job_row.process_instance_id
    and step.id = job_row.step_instance_id;
  if step_row.id is null or step_row.deadline_at is null then
    raise exception 'PROCESS_REMINDER_CONTEXT_MISSING' using errcode = 'P0002';
  end if;

  if instance_row.status::text <> 'RUNNING'
    or step_row.status::text <> 'ACTIVE'
    or step_row.completed_at is not null then
    return jsonb_build_object('jobId', job_row.id, 'created', false, 'skipped', true);
  end if;

  if job_row.work_item_id is not null then
    select item.* into work_item_row
    from public.process_work_items item
    where item.tenant_id = job_row.tenant_id
      and item.hr_group_id = job_row.hr_group_id
      and item.process_instance_id = job_row.process_instance_id
      and item.step_instance_id = job_row.step_instance_id
      and item.id = job_row.work_item_id;
    if work_item_row.id is null then
      raise exception 'PROCESS_REMINDER_CONTEXT_MISSING' using errcode = 'P0002';
    end if;
    if work_item_row.status::text not in ('OPEN', 'CLAIMED') then
      return jsonb_build_object('jobId', job_row.id, 'created', false, 'skipped', true);
    end if;
  end if;

  select version.definition_json into version_json
  from public.process_versions version
  where version.tenant_id = job_row.tenant_id
    and version.hr_group_id = job_row.hr_group_id
    and version.process_definition_id = instance_row.process_definition_id
    and version.id = instance_row.process_version_id;
  definition_content := internal_security.process_definition_content(version_json);
  select value into step_json
  from pg_catalog.jsonb_array_elements(coalesce(definition_content -> 'steps', '[]'::jsonb)) value
  where value ->> 'key' = step_row.step_key
  limit 1;
  sla_definition := step_json -> 'sla';

  if delivery_kind = 'BREACH' and sla_definition ->> 'onBreach' = 'BLOCK' then
    perform internal_security.append_process_runtime_event(
      job_row.tenant_id, job_row.hr_group_id, job_row.process_instance_id,
      job_row.work_item_id, 'PROCESS_SLA_BREACH_BLOCKED',
      jsonb_build_object('deliveryKind', delivery_kind), auth.uid(), null,
      'process-sla-delivery:' || job_row.id::text, job_row.correlation_id
    );
    return jsonb_build_object('jobId', job_row.id, 'created', false, 'blocked', true);
  end if;

  if delivery_kind = 'BREACH' and sla_definition ->> 'onBreach' = 'ESCALATE' then
    participant_key := sla_definition ->> 'escalationParticipantKey';
    select participant.value into escalation_participant
    from pg_catalog.jsonb_array_elements(coalesce(definition_content -> 'participants', '[]'::jsonb)) participant(value)
    where participant.value ->> 'key' = participant_key
    limit 1;
    if escalation_participant is null then
      raise exception 'PROCESS_ESCALATION_RECIPIENT_MISSING' using errcode = 'P0002';
    end if;

    subject_context := internal_security.process_subject_context(
      job_row.tenant_id, job_row.hr_group_id, job_row.process_instance_id
    );
    assignment := internal_security.resolve_process_assignment(
      job_row.tenant_id, job_row.hr_group_id, instance_row.scope_type,
      instance_row.administration_id, job_row.process_instance_id,
      instance_row.process_version_id, escalation_participant,
      nullif(subject_context ->> 'employeeId', '')::uuid,
      instance_row.initiator_employee_id, instance_row.business_effective_date,
      instance_row.started_at, step_row.activated_at,
      coalesce(instance_row.metadata -> 'fields', '{}'::jsonb), null
    );
    recipient_list := coalesce(assignment -> 'candidates', '[]'::jsonb);
    event_type := 'PROCESS_SLA_ESCALATED';
  elsif job_row.work_item_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('employeeId', eligible.employee_id, 'userId', eligible.candidate_user_id)), '[]'::jsonb)
      into recipient_list
    from (
      select distinct candidate.employee_id, candidate.candidate_user_id
      from public.process_work_item_candidates candidate
      join public.employees employee
        on employee.tenant_id = candidate.tenant_id
       and employee.hr_group_id = candidate.hr_group_id
       and employee.id = candidate.employee_id
       and employee.auth_user_id = candidate.candidate_user_id
       and employee.is_active
       and employee.deleted_at is null
      where candidate.tenant_id = job_row.tenant_id
        and candidate.hr_group_id = job_row.hr_group_id
        and candidate.work_item_id = work_item_row.id
        and candidate.is_eligible
        and candidate.candidate_user_id is not null
        and candidate.resolution_revision = (
          select pg_catalog.max(latest.resolution_revision)
          from public.process_work_item_candidates latest
          where latest.tenant_id = candidate.tenant_id
            and latest.hr_group_id = candidate.hr_group_id
            and latest.work_item_id = candidate.work_item_id
        )
        and (work_item_row.claimed_by_user_id is null or candidate.candidate_user_id = work_item_row.claimed_by_user_id)
    ) eligible;
    event_type := case when delivery_kind = 'BREACH' then 'PROCESS_SLA_BREACH_NOTIFIED' else 'PROCESS_SLA_REMINDER_SENT' end;
  else
    select coalesce(direct_subject.employee_id, employment.employee_id), employee.auth_user_id
      into subject_employee_id, subject_auth_user_id
    from public.process_instances instance
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
    join public.employees employee
      on employee.tenant_id = instance.tenant_id
     and employee.hr_group_id = instance.hr_group_id
     and employee.id = coalesce(direct_subject.employee_id, employment.employee_id)
    where instance.tenant_id = job_row.tenant_id
      and instance.hr_group_id = job_row.hr_group_id
      and instance.id = job_row.process_instance_id
      and employee.auth_user_id is not null
      and employee.is_active
      and employee.deleted_at is null
    limit 1;
    if subject_employee_id is not null and subject_auth_user_id is not null then
      recipient_list := jsonb_build_array(jsonb_build_object('employeeId', subject_employee_id, 'userId', subject_auth_user_id));
    end if;
    event_type := 'PROCESS_SLA_REMINDER_SENT';
  end if;

  if jsonb_array_length(recipient_list) = 0 then
    if delivery_kind = 'BREACH' and sla_definition ->> 'onBreach' = 'ESCALATE' then
      raise exception 'PROCESS_ESCALATION_RECIPIENT_MISSING' using errcode = 'P0002';
    end if;
    raise exception 'PROCESS_REMINDER_RECIPIENT_MISSING' using errcode = 'P0002';
  end if;

  reminder_title := internal_security.process_localized_text(
    coalesce(step_json -> 'label', step_json -> 'title', jsonb_build_object('nl', step_row.step_key)),
    requested_language,
    step_row.step_key
  );
  reminder_description := case
    when delivery_kind = 'BEFORE_DEADLINE' and requested_language = 'en' then 'This process step is due soon. Open /work/' || job_row.work_item_id::text
    when delivery_kind = 'BEFORE_DEADLINE' then 'Deze processtap moet binnenkort af zijn. Openen /work/' || job_row.work_item_id::text
    when delivery_kind = 'BREACH' and sla_definition ->> 'onBreach' = 'ESCALATE' and requested_language = 'en' then 'A process step has passed its deadline. Open /work/' || job_row.work_item_id::text
    when delivery_kind = 'BREACH' and sla_definition ->> 'onBreach' = 'ESCALATE' then 'Een processtap is over de deadline. Openen /work/' || job_row.work_item_id::text
    when delivery_kind = 'BREACH' and requested_language = 'en' then 'The deadline for this process step has passed. Open /work/' || job_row.work_item_id::text
    when delivery_kind = 'BREACH' then 'De deadline van deze processtap is verstreken. Openen /work/' || job_row.work_item_id::text
    when delivery_kind = 'AT_DEADLINE' and requested_language = 'en' then 'The deadline for this process step has been reached. Open /work/' || job_row.work_item_id::text
    when delivery_kind = 'AT_DEADLINE' then 'De deadline van deze processtap is bereikt. Openen /work/' || job_row.work_item_id::text
    when requested_language = 'en' then 'The deadline for this process step has been reached.'
    else 'De deadline van deze processtap is bereikt.'
  end;

  insert into public.reminders (
    tenant_id, administration_id, created_by_user_id, reminder_type, target_type,
    title, description, remind_at, status, published_at
  ) values (
    job_row.tenant_id, instance_row.administration_id, auth.uid(), 'HR'::public.reminder_type,
    'EMPLOYEES'::public.reminder_target_type, reminder_title, reminder_description,
    reminder_at, 'DRAFT'::public.reminder_status, null
  ) returning id into reminder_id;

  for recipient in select value from pg_catalog.jsonb_array_elements(recipient_list) value loop
    insert into public.reminder_targets (
      tenant_id, administration_id, reminder_id, employee_id
    ) values (
      job_row.tenant_id, instance_row.administration_id, reminder_id,
      nullif(recipient ->> 'employeeId', '')::uuid
    );

    insert into public.reminder_recipients (
      tenant_id, reminder_id, user_id, employee_id, effective_remind_at
    ) values (
      job_row.tenant_id, reminder_id,
      nullif(recipient ->> 'userId', '')::uuid,
      nullif(recipient ->> 'employeeId', '')::uuid,
      reminder_at
    );
  end loop;

  insert into public.process_reminder_deliveries (
    tenant_id, hr_group_id, workflow_job_id, process_instance_id,
    step_instance_id, work_item_id, delivery_kind, reminder_id
  ) values (
    job_row.tenant_id, job_row.hr_group_id, job_row.id,
    job_row.process_instance_id, job_row.step_instance_id,
    job_row.work_item_id, delivery_kind, reminder_id
  );

  update public.reminders
  set status = 'PUBLISHED'::public.reminder_status,
      published_at = pg_catalog.now()
  where id = reminder_id;

  perform internal_security.append_process_runtime_event(
    job_row.tenant_id, job_row.hr_group_id, job_row.process_instance_id,
    job_row.work_item_id, event_type,
    jsonb_build_object('deliveryKind', delivery_kind), auth.uid(), null,
    'process-sla-delivery:' || job_row.id::text, job_row.correlation_id
  );

  return jsonb_build_object('jobId', job_row.id, 'reminderId', reminder_id, 'created', true);
end;
$$;

revoke all on function internal_security.create_process_deadline_reminder(uuid, text) from public, anon, authenticated;

commit;
