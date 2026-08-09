begin;

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
  version_json jsonb;
  step_json jsonb;
  subject_employee_id uuid;
  subject_auth_user_id uuid;
  reminder_id uuid;
  existing_reminder_id uuid;
  reminder_title text;
  reminder_description text;
  reminder_at timestamptz;
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
  where delivery.workflow_job_id = job_row.id;
  if existing_reminder_id is not null then
    return jsonb_build_object('jobId', job_row.id, 'reminderId', existing_reminder_id, 'created', false);
  end if;

  select instance.* into instance_row
  from public.process_instances instance
  where instance.tenant_id = job_row.tenant_id
    and instance.hr_group_id = job_row.hr_group_id
    and instance.id = job_row.process_instance_id;
  select step.* into step_row
  from public.process_step_instances step
  where step.tenant_id = job_row.tenant_id
    and step.hr_group_id = job_row.hr_group_id
    and step.process_instance_id = job_row.process_instance_id
    and step.id = job_row.step_instance_id;
  if instance_row.id is null or step_row.id is null or step_row.deadline_at is null then
    raise exception 'PROCESS_REMINDER_CONTEXT_MISSING' using errcode = 'P0002';
  end if;

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
  if subject_employee_id is null or subject_auth_user_id is null then
    raise exception 'PROCESS_REMINDER_RECIPIENT_MISSING' using errcode = 'P0002';
  end if;

  select version.definition_json into version_json
  from public.process_versions version
  where version.tenant_id = job_row.tenant_id
    and version.hr_group_id = job_row.hr_group_id
    and version.id = instance_row.process_version_id;
  select value into step_json
  from pg_catalog.jsonb_array_elements(coalesce(version_json -> 'steps', '[]'::jsonb)) value
  where value ->> 'key' = step_row.step_key
  limit 1;

  reminder_title := internal_security.process_localized_text(
    coalesce(step_json -> 'label', step_json -> 'title', jsonb_build_object('nl', step_row.step_key)),
    requested_language,
    step_row.step_key
  );
  reminder_description := case when requested_language = 'en'
    then 'The deadline for this process step has been reached.'
    else 'De deadline van deze processtap is bereikt.'
  end;
  reminder_at := greatest(step_row.deadline_at, timezone('utc', now()) + interval '1 minute');

  insert into public.reminders (
    tenant_id, administration_id, created_by_user_id, reminder_type, target_type,
    title, description, remind_at, status, published_at
  ) values (
    job_row.tenant_id, instance_row.administration_id, auth.uid(), 'HR'::public.reminder_type,
    'EMPLOYEES'::public.reminder_target_type, reminder_title, reminder_description,
    reminder_at, 'DRAFT'::public.reminder_status, null
  ) returning id into reminder_id;

  insert into public.reminder_targets (
    tenant_id, administration_id, reminder_id, employee_id
  ) values (
    job_row.tenant_id, instance_row.administration_id, reminder_id, subject_employee_id
  );

  insert into public.reminder_recipients (
    tenant_id, reminder_id, user_id, employee_id, effective_remind_at
  ) values (
    job_row.tenant_id, reminder_id, subject_auth_user_id, subject_employee_id, reminder_at
  );

  insert into public.process_reminder_deliveries (
    tenant_id, hr_group_id, workflow_job_id, process_instance_id, step_instance_id, reminder_id
  ) values (
    job_row.tenant_id, job_row.hr_group_id, job_row.id, job_row.process_instance_id,
    job_row.step_instance_id, reminder_id
  );

  update public.reminders
  set status = 'PUBLISHED'::public.reminder_status,
      published_at = timezone('utc', now())
  where id = reminder_id;

  return jsonb_build_object('jobId', job_row.id, 'reminderId', reminder_id, 'created', true);
end;
$$;

revoke all on function internal_security.create_process_deadline_reminder(uuid, text) from public, anon, authenticated;

create or replace function public.create_process_deadline_reminder(
  requested_job_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.create_process_deadline_reminder(requested_job_id, requested_language);
$$;

revoke all on function public.create_process_deadline_reminder(uuid, text) from public, anon;
grant execute on function public.create_process_deadline_reminder(uuid, text) to authenticated;

commit;
