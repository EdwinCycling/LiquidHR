begin;

create or replace function internal_security.attach_process_output_document(
  requested_output_id uuid,
  requested_storage_key text,
  requested_original_filename text,
  requested_content_type text,
  requested_file_size bigint,
  requested_checksum_sha256 text,
  requested_title text,
  requested_category_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  output_row public.process_outputs%rowtype;
  category_id uuid;
  created_document_id uuid;
  expected_storage_key text;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  select output.* into output_row
  from public.process_outputs output
  where output.id = requested_output_id
  for update;
  if output_row.id is null then
    raise exception 'PROCESS_OUTPUT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not internal_security.process_scope_has_permission(
    output_row.tenant_id,
    output_row.hr_group_id,
    (select instance.scope_type from public.process_instances instance where instance.id = output_row.process_instance_id),
    output_row.administration_id,
    'process-operations:write'
  ) or not internal_security.can_manage_employee(output_row.subject_employee_id, 'document:write') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if output_row.document_id is not null then
    return jsonb_build_object('outputId', output_row.id, 'documentId', output_row.document_id, 'created', false);
  end if;
  if requested_content_type is null
    or requested_original_filename is null
    or requested_title is null
    or char_length(btrim(requested_title)) not between 1 and 160
    or requested_content_type <> 'application/pdf'
    or requested_file_size is null
    or requested_file_size < 1
    or requested_file_size > 26214400
    or requested_checksum_sha256 is null
    or requested_checksum_sha256 !~ '^[a-f0-9]{64}$'
    or requested_original_filename !~ '^[a-zA-Z0-9._-]{1,160}\.pdf$' then
    raise exception 'PROCESS_OUTPUT_DOCUMENT_INVALID' using errcode = '22023';
  end if;

  expected_storage_key := output_row.tenant_id::text || '/' || output_row.administration_id::text || '/' ||
    output_row.subject_employee_id::text || '/process-output/' || output_row.id::text || '.pdf';
  if requested_storage_key <> expected_storage_key then
    raise exception 'PROCESS_OUTPUT_STORAGE_KEY_INVALID' using errcode = '22023';
  end if;

  select category.id into category_id
  from public.document_categories category
  where category.tenant_id = output_row.tenant_id
    and category.administration_id = output_row.administration_id
    and category.is_active
    and category.code in (requested_category_key, upper(requested_category_key))
  order by case when category.code = requested_category_key then 0 else 1 end
  limit 1;
  if category_id is null then
    raise exception 'PROCESS_OUTPUT_CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.employee_documents (
    tenant_id, administration_id, employee_id, category_id, storage_key,
    original_filename, content_type, file_size, checksum_sha256, title,
    description, tags, added_by_user_id
  ) values (
    output_row.tenant_id, output_row.administration_id, output_row.subject_employee_id,
    category_id, requested_storage_key, requested_original_filename, requested_content_type,
    requested_file_size, requested_checksum_sha256, requested_title,
    'Automatisch gegenereerde procesuitvoer', array['PROCESS_OUTPUT'], auth.uid()
  ) returning id into created_document_id;

  insert into public.document_audiences (
    tenant_id, administration_id, document_id, target_type, target_employee_id
  ) values (
    output_row.tenant_id, output_row.administration_id, created_document_id,
    'EMPLOYEE'::public.document_target_type, output_row.subject_employee_id
  ) on conflict do nothing;

  update public.process_outputs
  set document_id = created_document_id
  where id = output_row.id;

  return jsonb_build_object('outputId', output_row.id, 'documentId', created_document_id, 'created', true);
end;
$$;

revoke all on function internal_security.attach_process_output_document(uuid, text, text, text, bigint, text, text, text) from public, anon, authenticated;

create or replace function public.attach_process_output_document(
  requested_output_id uuid,
  requested_storage_key text,
  requested_original_filename text,
  requested_content_type text,
  requested_file_size bigint,
  requested_checksum_sha256 text,
  requested_title text,
  requested_category_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.attach_process_output_document(
    requested_output_id, requested_storage_key, requested_original_filename,
    requested_content_type, requested_file_size, requested_checksum_sha256,
    requested_title, requested_category_key
  );
$$;

revoke all on function public.attach_process_output_document(uuid, text, text, text, bigint, text, text, text) from public, anon;
grant execute on function public.attach_process_output_document(uuid, text, text, text, bigint, text, text, text) to authenticated;

create or replace function internal_security.complete_process_output(
  requested_output_id uuid,
  requested_html_summary text,
  requested_document_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  output_row public.process_outputs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  select output.* into output_row
  from public.process_outputs output
  where output.id = requested_output_id
  for update;
  if output_row.id is null then
    raise exception 'PROCESS_OUTPUT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not internal_security.process_scope_has_permission(
    output_row.tenant_id,
    output_row.hr_group_id,
    (select instance.scope_type from public.process_instances instance where instance.id = output_row.process_instance_id),
    output_row.administration_id,
    'process-operations:write'
  ) or not internal_security.can_manage_employee(output_row.subject_employee_id, 'document:write') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if requested_document_id is null or char_length(coalesce(requested_html_summary, '')) > 500000 then
    raise exception 'PROCESS_OUTPUT_NOT_READY' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.employee_documents document
    where document.tenant_id = output_row.tenant_id
      and document.administration_id = output_row.administration_id
      and document.id = requested_document_id
      and document.employee_id = output_row.subject_employee_id
      and document.deleted_at is null
  ) then
    raise exception 'PROCESS_OUTPUT_DOCUMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.process_outputs
  set status = 'AVAILABLE'::public.process_output_status,
      html_summary = requested_html_summary,
      document_id = requested_document_id,
      last_error_code = null,
      generated_at = timezone('utc', now())
  where id = output_row.id;
  return jsonb_build_object('outputId', output_row.id, 'status', 'AVAILABLE', 'documentId', requested_document_id);
end;
$$;

revoke all on function internal_security.complete_process_output(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.complete_process_output(
  requested_output_id uuid,
  requested_html_summary text,
  requested_document_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.complete_process_output(requested_output_id, requested_html_summary, requested_document_id);
$$;

revoke all on function public.complete_process_output(uuid, text, uuid) from public, anon;
grant execute on function public.complete_process_output(uuid, text, uuid) to authenticated;

create or replace function internal_security.requeue_workflow_job(requested_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_row public.workflow_jobs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  select job.* into job_row from public.workflow_jobs job where job.id = requested_job_id for update;
  if job_row.id is null then raise exception 'WORKFLOW_JOB_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.process_scope_has_permission(
    job_row.tenant_id,
    job_row.hr_group_id,
    (select instance.scope_type from public.process_instances instance where instance.id = job_row.process_instance_id),
    job_row.administration_id,
    'process-operations:write'
  ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if job_row.status not in ('DEAD_LETTER'::public.workflow_job_status, 'RETRY'::public.workflow_job_status) then
    raise exception 'WORKFLOW_JOB_NOT_RECOVERABLE' using errcode = 'P0001';
  end if;
  update public.workflow_jobs
  set status = 'READY'::public.workflow_job_status,
      attempts = 0,
      available_at = timezone('utc', now()),
      locked_at = null,
      locked_by = null,
      last_error_code = null,
      last_error_at = null
  where id = job_row.id;
  return jsonb_build_object('id', job_row.id, 'status', 'READY');
end;
$$;

revoke all on function internal_security.requeue_workflow_job(uuid) from public, anon, authenticated;

create or replace function public.requeue_workflow_job(requested_job_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.requeue_workflow_job(requested_job_id);
$$;

revoke all on function public.requeue_workflow_job(uuid) from public, anon;
grant execute on function public.requeue_workflow_job(uuid) to authenticated;

create or replace function internal_security.get_process_output_projection(
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
  can_read boolean;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  select instance.* into instance_row
  from public.process_instances instance
  where instance.id = requested_process_instance_id;
  if instance_row.id is null then
    raise exception 'PROCESS_INSTANCE_NOT_FOUND' using errcode = 'P0002';
  end if;
  can_read := internal_security.process_instance_can_read(instance_row.tenant_id, instance_row.hr_group_id, instance_row.id)
    or internal_security.process_scope_has_permission(
      instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type,
      instance_row.administration_id, 'process-operations:read'
    );
  if not can_read then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  return jsonb_build_object(
    'processInstanceId', instance_row.id,
    'outputs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', output.id,
        'outputKey', output.output_key,
        'title', coalesce(output.title ->> case when requested_language = 'en' then 'en' else 'nl' end, output.title ->> 'nl', output.output_key),
        'outputFormat', output.output_format,
        'status', output.status,
        'documentId', output.document_id,
        'htmlSummary', output.html_summary,
        'lastErrorCode', output.last_error_code,
        'generatedAt', output.generated_at
      ) order by output.created_at desc)
      from public.process_outputs output
      where output.tenant_id = instance_row.tenant_id
        and output.hr_group_id = instance_row.hr_group_id
        and output.process_instance_id = instance_row.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function internal_security.get_process_output_projection(uuid, text) from public, anon, authenticated;

create or replace function public.get_process_output_projection(
  requested_process_instance_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.get_process_output_projection(requested_process_instance_id, requested_language);
$$;

revoke all on function public.get_process_output_projection(uuid, text) from public, anon;
grant execute on function public.get_process_output_projection(uuid, text) to authenticated;

create or replace function internal_security.get_process_automation_operations(requested_process_instance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  instance_row public.process_instances%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select instance.* into instance_row from public.process_instances instance where instance.id = requested_process_instance_id;
  if instance_row.id is null then raise exception 'PROCESS_INSTANCE_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.process_scope_has_permission(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type,
    instance_row.administration_id, 'process-operations:read'
  ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  return jsonb_build_object(
    'processInstanceId', instance_row.id,
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', job.id,
        'jobType', job.job_type,
        'status', job.status,
        'attempts', job.attempts,
        'maxAttempts', job.max_attempts,
        'availableAt', job.available_at,
        'lastAttemptAt', job.last_attempt_at,
        'lastErrorCode', job.last_error_code,
        'lastErrorAt', job.last_error_at,
        'canRecover', job.status in ('RETRY'::public.workflow_job_status, 'DEAD_LETTER'::public.workflow_job_status)
      ) order by job.created_at desc)
      from public.workflow_jobs job
      where job.tenant_id = instance_row.tenant_id
        and job.hr_group_id = instance_row.hr_group_id
        and job.process_instance_id = instance_row.id
    ), '[]'::jsonb),
    'outputs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', output.id,
        'outputKey', output.output_key,
        'status', output.status,
        'documentId', output.document_id,
        'lastErrorCode', output.last_error_code,
        'generatedAt', output.generated_at
      ) order by output.created_at desc)
      from public.process_outputs output
      where output.tenant_id = instance_row.tenant_id
        and output.hr_group_id = instance_row.hr_group_id
        and output.process_instance_id = instance_row.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function internal_security.get_process_automation_operations(uuid) from public, anon, authenticated;

create or replace function public.get_process_automation_operations(requested_process_instance_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.get_process_automation_operations(requested_process_instance_id);
$$;

revoke all on function public.get_process_automation_operations(uuid) from public, anon;
grant execute on function public.get_process_automation_operations(uuid) to authenticated;

commit;
