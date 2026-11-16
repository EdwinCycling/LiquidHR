-- Resolve the local reminder ID separately from reminder_target_rules.reminder_id.
create or replace function public.create_employee_document_metadata_atomic(
  requested_employee_id uuid,
  requested_administration_id uuid,
  requested_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  employee_tenant uuid;
  employee_group uuid;
  administration_tenant uuid;
  administration_group uuid;
  category_row public.document_categories%rowtype;
  storage_metadata jsonb;
  content_type text;
  original_filename text;
  file_size bigint;
  created_document_id uuid;
  document_reminder_id uuid;
begin
  if auth.uid() is null or jsonb_typeof(requested_payload) <> 'object' then
    raise exception 'DOCUMENT_INPUT_INVALID' using errcode = '22023';
  end if;
  if jsonb_typeof(requested_payload->'audiences') is distinct from 'array' then
    raise exception 'DOCUMENT_AUDIENCE_REQUIRED' using errcode = '22023';
  end if;
  if jsonb_array_length(requested_payload->'audiences') not between 1 and 100
    or jsonb_typeof(requested_payload->'tags') is distinct from 'array'
    or jsonb_array_length(requested_payload->'tags') > 30
    or exists (
      select 1 from jsonb_array_elements(requested_payload->'tags') as tag(value)
      where jsonb_typeof(tag.value) <> 'string'
        or length(btrim(tag.value #>> '{}')) not between 1 and 50
    )
    or jsonb_typeof(coalesce(requested_payload->'customFields', '{}'::jsonb)) is distinct from 'object'
    or coalesce(length(btrim(requested_payload->>'title')), 0) not between 1 and 160
    or coalesce(length(requested_payload->>'description'), 0) > 2000 then
    raise exception 'DOCUMENT_INPUT_INVALID' using errcode = '22023';
  end if;
  if not internal_security.can_manage_employee(requested_employee_id, 'document:write') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select employee.tenant_id, employee.hr_group_id
  into employee_tenant, employee_group
  from public.employees employee
  where employee.id = requested_employee_id
    and employee.deleted_at is null;
  select administration.tenant_id, administration.hr_group_id
  into administration_tenant, administration_group
  from public.administrations administration
  where administration.id = requested_administration_id;
  if employee_tenant is null
    or administration_tenant is distinct from employee_tenant
    or administration_group is distinct from employee_group then
    raise exception 'DOCUMENT_EMPLOYEE_SCOPE_INVALID' using errcode = '42501';
  end if;

  select category.* into category_row
  from public.document_categories category
  where category.id = (requested_payload->>'categoryId')::uuid
    and category.tenant_id = employee_tenant
    and category.administration_id = requested_administration_id
    and category.is_active;
  if category_row.id is null then
    raise exception 'DOCUMENT_CATEGORY_INVALID' using errcode = '22023';
  end if;
  if category_row.requires_salary_permission
    and not internal_security.can_manage_employee(requested_employee_id, 'salary:read') then
    raise exception 'DOCUMENT_SALARY_PERMISSION_REQUIRED' using errcode = '42501';
  end if;
  if not internal_security.tenant_module_enabled(employee_tenant, 'DOCUMENTS') then
    raise exception 'DOCUMENT_MODULE_DISABLED' using errcode = '42501';
  end if;

  original_filename := requested_payload->>'originalFilename';
  content_type := requested_payload->>'contentType';
  file_size := nullif(requested_payload->>'fileSize', '')::bigint;
  if coalesce(requested_payload->>'storageKey', '') !~ ('^' || employee_tenant::text || '/' || requested_administration_id::text || '/' || requested_employee_id::text || '/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,180}$')
    or coalesce(original_filename, '') = ''
    or length(original_filename) > 255
    or position('/' in original_filename) > 0
    or position(chr(92) in original_filename) > 0
    or coalesce(file_size, 0) not between 1 and 26214400
    or coalesce(requested_payload->>'checksumSha256', '') !~ '^[0-9a-f]{64}$'
    or not (
      (lower(original_filename) like '%.pdf' and content_type = 'application/pdf')
      or (lower(original_filename) like '%.txt' and content_type = 'text/plain')
      or (lower(original_filename) like '%.md' and content_type = 'text/markdown')
      or (lower(original_filename) like '%.csv' and content_type = 'text/csv')
      or (lower(original_filename) like '%.doc' and content_type = 'application/msword')
      or (lower(original_filename) like '%.docx' and content_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      or (lower(original_filename) like '%.xls' and content_type = 'application/vnd.ms-excel')
      or (lower(original_filename) like '%.xlsx' and content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      or ((lower(original_filename) like '%.jpg' or lower(original_filename) like '%.jpeg') and content_type = 'image/jpeg')
      or (lower(original_filename) like '%.png' and content_type = 'image/png')
      or (lower(original_filename) like '%.webp' and content_type = 'image/webp')
      or (lower(original_filename) like '%.bmp' and content_type = 'image/bmp')
    ) then
    raise exception 'DOCUMENT_INPUT_INVALID' using errcode = '22023';
  end if;

  select object.metadata into storage_metadata
  from storage.objects object
  where object.bucket_id = 'employee-documents'
    and object.name = requested_payload->>'storageKey';
  if storage_metadata is null
    or coalesce(storage_metadata->>'mimetype', '') <> content_type
    or coalesce(nullif(storage_metadata->>'size', ''), storage_metadata->>'contentLength')::bigint is distinct from file_size then
    raise exception 'DOCUMENT_STORAGE_OBJECT_REQUIRED' using errcode = '22023';
  end if;

  created_document_id := public.create_employee_document_metadata(requested_employee_id, requested_administration_id, requested_payload);

  if exists (
    select 1 from public.document_audiences audience
    where audience.document_id = created_document_id
      and not internal_security.document_audience_target_in_scope(audience.document_id, audience.target_type, audience.target_employee_id, audience.target_management_role_id, audience.target_department_id)
  ) then
    raise exception 'DOCUMENT_AUDIENCE_SCOPE_INVALID' using errcode = '42501';
  end if;

  select document.expiry_reminder_id into document_reminder_id
  from public.employee_documents document
  where document.id = created_document_id;
  if document_reminder_id is not null and exists (
    select 1 from public.reminder_target_rules target
    where target.reminder_id = document_reminder_id
      and not internal_security.document_audience_target_in_scope(created_document_id, target.target_type, target.target_employee_id, target.target_management_role_id, target.target_department_id)
  ) then
    raise exception 'REMINDER_TARGET_SCOPE_INVALID' using errcode = '42501';
  end if;

  perform internal_security.apply_employee_document_custom_fields(created_document_id, coalesce(requested_payload->'customFields', '{}'::jsonb), true);
  return created_document_id;
end;
$function$;
