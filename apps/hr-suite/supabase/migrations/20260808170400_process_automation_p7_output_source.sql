begin;

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

create or replace function internal_security.begin_process_output(
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
  output_row public.process_outputs%rowtype;
  source_json jsonb;
  output_id uuid;
  subject_employee_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  select job.* into job_row
  from public.workflow_jobs job
  where job.id = requested_job_id
    and job.job_type = 'PROCESS_DOCUMENT_OUTPUT'::public.workflow_job_type
  for share;
  if job_row.id is null then
    raise exception 'PROCESS_OUTPUT_JOB_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not internal_security.process_scope_has_permission(
    job_row.tenant_id,
    job_row.hr_group_id,
    (select instance.scope_type from public.process_instances instance where instance.id = job_row.process_instance_id),
    job_row.administration_id,
    'process-operations:write'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  source_json := internal_security.process_output_source(job_row.process_instance_id, requested_language);
  subject_employee_id := (source_json ->> 'subjectEmployeeId')::uuid;
  if not internal_security.can_manage_employee(subject_employee_id, 'document:write') then
    raise exception 'PROCESS_OUTPUT_DOCUMENT_FORBIDDEN' using errcode = '42501';
  end if;

  select output.* into output_row
  from public.process_outputs output
  where output.tenant_id = job_row.tenant_id
    and output.hr_group_id = job_row.hr_group_id
    and output.process_instance_id = job_row.process_instance_id
    and output.output_key = source_json ->> 'outputKey'
  for update;
  if output_row.id is not null then
    output_id := output_row.id;
    if output_row.status = 'FAILED'::public.process_output_status then
      update public.process_outputs
      set status = 'PENDING'::public.process_output_status,
          html_summary = null,
          document_id = null,
          last_error_code = null,
          generated_at = null
      where id = output_row.id;
    end if;
  else
    insert into public.process_outputs (
      tenant_id, hr_group_id, administration_id, process_instance_id, process_version_id,
      subject_employee_id, output_key, title, output_format, status
    ) values (
      (source_json ->> 'tenantId')::uuid,
      (source_json ->> 'hrGroupId')::uuid,
      (source_json ->> 'administrationId')::uuid,
      (source_json ->> 'processInstanceId')::uuid,
      (source_json ->> 'processVersionId')::uuid,
      subject_employee_id,
      source_json ->> 'outputKey',
      source_json -> 'title',
      source_json ->> 'outputFormat',
      'PENDING'::public.process_output_status
    ) returning id into output_id;
  end if;

  return jsonb_build_object(
    'outputId', output_id,
    'status', 'PENDING',
    'source', source_json
  );
end;
$$;

revoke all on function internal_security.begin_process_output(uuid, text) from public, anon, authenticated;

create or replace function public.begin_process_output(
  requested_job_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.begin_process_output(requested_job_id, requested_language);
$$;

revoke all on function public.begin_process_output(uuid, text) from public, anon;
grant execute on function public.begin_process_output(uuid, text) to authenticated;

commit;
