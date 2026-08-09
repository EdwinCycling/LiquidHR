begin;

-- Herstel de eerder toegepaste functies ook in een verse lokale migratiereeks:
-- reminders worden eerst als concept opgebouwd, zodat bestaande remindertriggers
-- de doelgroep kunnen valideren voordat de reminder wordt gepubliceerd.

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

create or replace function internal_security.process_output_source(
  requested_process_instance_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  instance_row public.process_instances%rowtype;
  version_json jsonb;
  output_json jsonb;
  subject_employee_id uuid;
  output_administration_id uuid;
  field_key text;
  field_json jsonb;
  field_value jsonb;
  value_map jsonb;
  field_values jsonb := '[]'::jsonb;
  output_title jsonb;
begin
  select instance.* into instance_row
  from public.process_instances instance
  where instance.id = requested_process_instance_id;
  if instance_row.id is null then
    raise exception 'PROCESS_INSTANCE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select coalesce(direct_subject.employee_id, employment.employee_id) into subject_employee_id
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
  where instance.tenant_id = instance_row.tenant_id
    and instance.hr_group_id = instance_row.hr_group_id
    and instance.id = instance_row.id
  limit 1;
  if subject_employee_id is null then
    raise exception 'PROCESS_OUTPUT_SUBJECT_MISSING' using errcode = 'P0002';
  end if;

  select version.definition_json into version_json
  from public.process_versions version
  where version.tenant_id = instance_row.tenant_id
    and version.hr_group_id = instance_row.hr_group_id
    and version.id = instance_row.process_version_id;
  output_json := version_json -> 'output';
  if jsonb_typeof(output_json) <> 'object' then
    raise exception 'PROCESS_OUTPUT_NOT_CONFIGURED' using errcode = 'P0001';
  end if;
  if coalesce(output_json ->> 'format', '') <> 'PDF' then
    raise exception 'PROCESS_OUTPUT_FORMAT_UNSUPPORTED' using errcode = 'P0001';
  end if;

  output_administration_id := instance_row.administration_id;
  if output_administration_id is null then
    select employment_subject.administration_id into output_administration_id
    from public.process_employment_subjects employment_subject
    where employment_subject.tenant_id = instance_row.tenant_id
      and employment_subject.hr_group_id = instance_row.hr_group_id
      and employment_subject.process_instance_id = instance_row.id;
  end if;
  if output_administration_id is null then
    raise exception 'PROCESS_OUTPUT_ADMINISTRATION_MISSING' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_object_agg(value_entry.key, value_entry.value order by value_entry.priority), '{}'::jsonb)
  into value_map
  from (
    select entry.key, entry.value, 1 as priority
    from public.process_form_responses response
    cross join lateral jsonb_each(coalesce(response.current_values, '{}'::jsonb)) entry
    where response.tenant_id = instance_row.tenant_id
      and response.hr_group_id = instance_row.hr_group_id
      and response.process_instance_id = instance_row.id
    union all
    select entry.key, entry.value, 2 as priority
    from public.process_form_responses response
    cross join lateral jsonb_each(coalesce(response.new_values, '{}'::jsonb)) entry
    where response.tenant_id = instance_row.tenant_id
      and response.hr_group_id = instance_row.hr_group_id
      and response.process_instance_id = instance_row.id
  ) value_entry;

  for field_key in
    select jsonb_array_elements_text(coalesce(output_json -> 'fieldKeys', '[]'::jsonb))
  loop
    select field.value into field_json
    from jsonb_array_elements(coalesce(version_json -> 'forms', '[]'::jsonb)) as form(value)
    cross join lateral jsonb_array_elements(coalesce(form.value -> 'sections', '[]'::jsonb)) as section(value)
    cross join lateral jsonb_array_elements(coalesce(section.value -> 'fields', '[]'::jsonb)) as field(value)
    where field.value ->> 'key' = field_key
    limit 1;

    field_value := coalesce(value_map -> field_key, instance_row.metadata -> 'fields' -> field_key, 'null'::jsonb);
    field_values := field_values || jsonb_build_array(jsonb_build_object(
      'key', field_key,
      'label', coalesce(field_json -> 'label', jsonb_build_object('nl', field_key, 'en', field_key)),
      'value', field_value
    ));
  end loop;

  output_title := coalesce(output_json -> 'title', jsonb_build_object('nl', output_json ->> 'key', 'en', output_json ->> 'key'));
  return jsonb_build_object(
    'tenantId', instance_row.tenant_id,
    'hrGroupId', instance_row.hr_group_id,
    'administrationId', output_administration_id,
    'processInstanceId', instance_row.id,
    'processVersionId', instance_row.process_version_id,
    'subjectEmployeeId', subject_employee_id,
    'outputKey', output_json ->> 'key',
    'title', output_title,
    'outputFormat', output_json ->> 'format',
    'dossierCategoryKey', output_json ->> 'dossierCategoryKey',
    'language', case when requested_language = 'en' then 'en' else 'nl' end,
    'fieldValues', field_values
  );
end;
$$;

revoke all on function internal_security.process_output_source(uuid, text) from public, anon, authenticated;

commit;
