begin;

-- Published Studio versions wrap the compiled definition in `content`, while
-- legacy P7 recipes keep the definition at the top level. Normalize both
-- paths at the shared output boundary so every compiled process can enqueue
-- and render its configured document output.
create or replace function internal_security.enqueue_process_workflow_jobs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  instance_row public.process_instances%rowtype;
  version_json jsonb;
  output_json jsonb;
begin
  if TG_TABLE_NAME = 'process_step_instances' then
    if new.status = 'ACTIVE'::public.process_step_instance_status and new.deadline_at is not null then
      select instance.*
        into instance_row
      from public.process_instances instance
      where instance.tenant_id = new.tenant_id
        and instance.hr_group_id = new.hr_group_id
        and instance.id = new.process_instance_id;

      insert into public.workflow_jobs (
        tenant_id,
        hr_group_id,
        administration_id,
        process_instance_id,
        step_instance_id,
        job_type,
        available_at,
        idempotency_key,
        correlation_id,
        payload
      )
      values (
        new.tenant_id,
        new.hr_group_id,
        instance_row.administration_id,
        new.process_instance_id,
        new.id,
        'PROCESS_REMINDER'::public.workflow_job_type,
        new.deadline_at,
        'process-reminder:' || new.id::text,
        instance_row.correlation_id,
        jsonb_build_object('processInstanceId', new.process_instance_id, 'stepInstanceId', new.id)
      )
      on conflict (tenant_id, hr_group_id, idempotency_key) do nothing;
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
        tenant_id,
        hr_group_id,
        administration_id,
        process_instance_id,
        job_type,
        available_at,
        idempotency_key,
        correlation_id,
        payload
      )
      values (
        new.tenant_id,
        new.hr_group_id,
        new.administration_id,
        new.id,
        'PROCESS_DOCUMENT_OUTPUT'::public.workflow_job_type,
        timezone('utc', now()),
        'process-output:' || new.id::text || ':' || (output_json ->> 'key'),
        new.correlation_id,
        jsonb_build_object('processInstanceId', new.id)
      )
      on conflict (tenant_id, hr_group_id, idempotency_key) do nothing;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function internal_security.enqueue_process_workflow_jobs() from public, anon, authenticated;

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
  version_content jsonb;
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
  select instance.*
    into instance_row
  from public.process_instances instance
  where instance.id = requested_process_instance_id;

  if instance_row.id is null then
    raise exception 'PROCESS_INSTANCE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select coalesce(direct_subject.employee_id, employment.employee_id)
    into subject_employee_id
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

  select version.definition_json
    into version_json
  from public.process_versions version
  where version.tenant_id = instance_row.tenant_id
    and version.hr_group_id = instance_row.hr_group_id
    and version.id = instance_row.process_version_id;

  version_content := internal_security.process_definition_content(version_json);
  output_json := version_content -> 'output';
  if jsonb_typeof(output_json) <> 'object' then
    raise exception 'PROCESS_OUTPUT_NOT_CONFIGURED' using errcode = 'P0001';
  end if;
  if coalesce(output_json ->> 'format', '') <> 'PDF' then
    raise exception 'PROCESS_OUTPUT_FORMAT_UNSUPPORTED' using errcode = 'P0001';
  end if;

  output_administration_id := instance_row.administration_id;
  if output_administration_id is null then
    select employment_subject.administration_id
      into output_administration_id
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
    select field.value
      into field_json
    from jsonb_array_elements(coalesce(version_content -> 'forms', '[]'::jsonb)) as form(value)
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
