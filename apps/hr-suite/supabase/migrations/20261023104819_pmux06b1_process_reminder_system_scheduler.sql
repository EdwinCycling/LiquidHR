begin;

-- System-generated reminders are attributable to SYSTEM without impersonating a user.
alter table public.reminders alter column created_by_user_id drop not null;
alter table public.reminders add column created_by_actor_type text not null default 'USER';
alter table public.reminders add constraint reminders_created_by_actor_type_check
  check (
    (created_by_actor_type = 'USER' and created_by_user_id is not null)
    or (created_by_actor_type = 'SYSTEM' and created_by_user_id is null)
  );

create or replace function internal_security.claim_workflow_job(requested_worker_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_row public.workflow_jobs%rowtype;
  actor_user_id uuid := auth.uid();
  scheduler_execution boolean := coalesce(auth.jwt() ->> 'role' = 'service_role' and auth.uid() is null, false);
begin
  if actor_user_id is null and not scheduler_execution then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if requested_worker_id is null then
    raise exception 'WORKER_ID_REQUIRED' using errcode = '22023';
  end if;

  update public.workflow_jobs
  set status = 'RETRY'::public.workflow_job_status,
      available_at = pg_catalog.now(),
      locked_at = null,
      locked_by = null,
      last_error_code = coalesce(last_error_code, 'WORKER_TIMEOUT'),
      last_error_at = coalesce(last_error_at, pg_catalog.now())
  where status = 'RUNNING'::public.workflow_job_status
    and locked_at < pg_catalog.now() - interval '15 minutes'
    and (not scheduler_execution or job_type = 'PROCESS_REMINDER'::public.workflow_job_type);

  select job.* into job_row
  from public.workflow_jobs job
  where job.status in ('READY'::public.workflow_job_status, 'RETRY'::public.workflow_job_status)
    and job.available_at <= pg_catalog.now()
    and job.attempts < job.max_attempts
    and (scheduler_execution or internal_security.process_scope_has_permission(
      job.tenant_id,
      job.hr_group_id,
      (select instance.scope_type from public.process_instances instance where instance.id = job.process_instance_id),
      job.administration_id,
      'process-operations:write'
    ))
    and (not scheduler_execution or job.job_type = 'PROCESS_REMINDER'::public.workflow_job_type)
  order by job.available_at, job.created_at, job.id
  limit 1
  for update skip locked;

  if job_row.id is null then
    return null;
  end if;

  update public.workflow_jobs
  set status = 'RUNNING'::public.workflow_job_status,
      attempts = attempts + 1,
      locked_at = pg_catalog.now(),
      locked_by = requested_worker_id,
      last_attempt_at = pg_catalog.now(),
      last_error_code = null,
      last_error_at = null
  where id = job_row.id;

  return jsonb_build_object(
    'id', job_row.id,
    'jobType', job_row.job_type,
    'tenantId', job_row.tenant_id,
    'hrGroupId', job_row.hr_group_id,
    'administrationId', job_row.administration_id,
    'processInstanceId', job_row.process_instance_id,
    'stepInstanceId', job_row.step_instance_id,
    'workItemId', job_row.work_item_id,
    'attempts', job_row.attempts + 1,
    'maxAttempts', job_row.max_attempts,
    'payload', job_row.payload,
    'correlationId', job_row.correlation_id
  );
end;
$$;

grant execute on function internal_security.claim_workflow_job(uuid) to service_role;

create or replace function internal_security.finish_workflow_job(
  requested_job_id uuid,
  requested_worker_id uuid,
  requested_outcome text,
  requested_error_code text default null,
  requested_result_reference_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_row public.workflow_jobs%rowtype;
  normalized_error_code text := nullif(regexp_replace(upper(coalesce(requested_error_code, 'WORKFLOW_JOB_FAILED')), '[^A-Z0-9_]+', '_', 'g'), '');
  next_status public.workflow_job_status;
  next_available_at timestamptz;
  scheduler_execution boolean := coalesce(auth.jwt() ->> 'role' = 'service_role' and auth.uid() is null, false);
begin
  if auth.uid() is null and not scheduler_execution then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if requested_outcome not in ('SUCCEEDED', 'FAILED') then
    raise exception 'WORKFLOW_JOB_OUTCOME_INVALID' using errcode = '22023';
  end if;

  select job.* into job_row
  from public.workflow_jobs job
  where job.id = requested_job_id
    and job.locked_by = requested_worker_id
    and job.status = 'RUNNING'::public.workflow_job_status
    and (not scheduler_execution or job.job_type = 'PROCESS_REMINDER'::public.workflow_job_type)
  for update;
  if job_row.id is null then
    raise exception 'WORKFLOW_JOB_NOT_OWNED' using errcode = '42501';
  end if;

  if requested_outcome = 'SUCCEEDED' then
    next_status := 'SUCCEEDED'::public.workflow_job_status;
    next_available_at := pg_catalog.now();
  elsif job_row.attempts >= job_row.max_attempts then
    next_status := 'DEAD_LETTER'::public.workflow_job_status;
    next_available_at := pg_catalog.now();
  else
    next_status := 'RETRY'::public.workflow_job_status;
    next_available_at := pg_catalog.now() + least(make_interval(secs => (power(2, greatest(job_row.attempts - 1, 0)) * 30)::integer), interval '1 hour');
  end if;

  update public.workflow_jobs
  set status = next_status,
      available_at = next_available_at,
      locked_at = null,
      locked_by = null,
      result_reference_id = case when requested_outcome = 'SUCCEEDED' then requested_result_reference_id else result_reference_id end,
      last_error_code = case when requested_outcome = 'SUCCEEDED' then null else normalized_error_code end,
      last_error_at = case when requested_outcome = 'SUCCEEDED' then null else pg_catalog.now() end
  where id = job_row.id;

  return jsonb_build_object(
    'id', job_row.id,
    'status', next_status,
    'availableAt', next_available_at,
    'attempts', job_row.attempts
  );
end;
$$;

grant execute on function internal_security.finish_workflow_job(uuid, uuid, text, text, uuid) to service_role;
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
  scheduler_execution boolean := coalesce(auth.jwt() ->> 'role' = 'service_role' and auth.uid() is null, false);
begin
  if auth.uid() is null and not scheduler_execution then
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
  if not scheduler_execution and not coalesce(internal_security.process_scope_has_permission(
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
      jsonb_build_object('deliveryKind', delivery_kind, 'executionActor', case when scheduler_execution then 'SYSTEM' else 'USER' end, 'executionPath', case when scheduler_execution then 'SCHEDULED' else 'AUTHORIZED_RUNNER' end), auth.uid(), null,
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
    tenant_id, administration_id, created_by_user_id, created_by_actor_type, reminder_type, target_type,
    title, description, remind_at, status, published_at
  ) values (
    job_row.tenant_id, instance_row.administration_id, auth.uid(), case when scheduler_execution then 'SYSTEM' else 'USER' end, 'HR'::public.reminder_type,
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
    jsonb_build_object('deliveryKind', delivery_kind, 'executionActor', case when scheduler_execution then 'SYSTEM' else 'USER' end, 'executionPath', case when scheduler_execution then 'SCHEDULED' else 'AUTHORIZED_RUNNER' end), auth.uid(), null,
    'process-sla-delivery:' || job_row.id::text, job_row.correlation_id
  );

  return jsonb_build_object('jobId', job_row.id, 'reminderId', reminder_id, 'created', true);
end;
$$;
create or replace function public.claim_process_reminder_job_system(requested_worker_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' or auth.uid() is not null then
    raise exception 'PROCESS_SCHEDULER_FORBIDDEN' using errcode = '42501';
  end if;
  return internal_security.claim_workflow_job(requested_worker_id);
end;
$$;

create or replace function public.finish_process_reminder_job_system(
  requested_job_id uuid,
  requested_worker_id uuid,
  requested_outcome text,
  requested_error_code text default null,
  requested_result_reference_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' or auth.uid() is not null then
    raise exception 'PROCESS_SCHEDULER_FORBIDDEN' using errcode = '42501';
  end if;
  return internal_security.finish_workflow_job(
    requested_job_id, requested_worker_id, requested_outcome,
    requested_error_code, requested_result_reference_id
  );
end;
$$;

create or replace function public.create_process_deadline_reminder_system(
  requested_job_id uuid,
  requested_worker_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_row public.workflow_jobs%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' or auth.uid() is not null then
    raise exception 'PROCESS_SCHEDULER_FORBIDDEN' using errcode = '42501';
  end if;
  if requested_worker_id is null then
    raise exception 'WORKER_ID_REQUIRED' using errcode = '22023';
  end if;

  select job.* into job_row
  from public.workflow_jobs job
  where job.id = requested_job_id
    and job.job_type = 'PROCESS_REMINDER'::public.workflow_job_type
    and job.status = 'RUNNING'::public.workflow_job_status
    and job.locked_by = requested_worker_id
  for update;
  if job_row.id is null then
    raise exception 'WORKFLOW_JOB_NOT_OWNED' using errcode = '42501';
  end if;

  return internal_security.create_process_deadline_reminder(requested_job_id, requested_language);
end;
$$;

-- Private implementation access is limited to the existing authorized user worker.
grant usage on schema internal_security to service_role;
grant execute on function internal_security.create_process_deadline_reminder(uuid, text) to authenticated;

revoke all on function public.claim_process_reminder_job_system(uuid) from public, anon, authenticated;
revoke all on function public.finish_process_reminder_job_system(uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_process_deadline_reminder_system(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_process_reminder_job_system(uuid) to service_role;
grant execute on function public.finish_process_reminder_job_system(uuid, uuid, text, text, uuid) to service_role;
grant execute on function public.create_process_deadline_reminder_system(uuid, uuid, text) to service_role;

commit;
