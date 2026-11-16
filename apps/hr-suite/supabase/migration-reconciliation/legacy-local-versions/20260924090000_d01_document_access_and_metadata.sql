-- D01: scope Manager dossier access through the existing employee authorization helper.
insert into public.role_permissions (management_role_id, permission_id)
select manager.id, permission.id
from public.management_roles manager
join public.permissions permission on permission.code in ('document:read', 'document:write')
where manager.code = 'DIRECT_MANAGER'
  and manager.tenant_id is null
  and manager.is_active
  and manager.deleted_at is null
on conflict do nothing;

-- Keep the canonical JSON value column in employee_documents while preventing
-- authenticated PostgREST reads/writes from bypassing field-level access.
revoke all on table public.employee_documents from public, anon, authenticated;
grant select (
  id, tenant_id, administration_id, employee_id, category_id, storage_key,
  original_filename, content_type, file_size, checksum_sha256, title,
  description, tags, expires_on, added_by_user_id, expiry_reminder_id,
  deleted_at, deleted_by_user_id, delete_reason, created_at, updated_at
) on table public.employee_documents to authenticated;

-- Document metadata and audience changes must go through the atomic RPCs below.
revoke all on table public.document_audiences from public, anon, authenticated;
grant select (id, tenant_id, administration_id, document_id, target_type,
  target_employee_id, target_management_role_id, target_department_id, created_at)
on table public.document_audiences to authenticated;

drop policy if exists document_categories_insert on public.document_categories;
drop policy if exists document_categories_update on public.document_categories;
drop policy if exists document_categories_delete on public.document_categories;
create policy document_categories_insert
on public.document_categories for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'settings:write')));
create policy document_categories_update
on public.document_categories for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'settings:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'settings:write')));
create policy document_categories_delete
on public.document_categories for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'settings:write')));
create policy document_categories_self_document_read
on public.document_categories for select to authenticated
using (exists (
  select 1
  from public.employee_documents document
  where document.category_id = document_categories.id
    and document.employee_id = internal_security.current_employee_id()
    and internal_security.can_access_document(document.id, 'document:read')
));

create or replace function internal_security.can_access_document(requested_document_id uuid, requested_permission text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.employee_documents document
    join public.document_categories category on category.id = document.category_id
    where document.id = requested_document_id
      and document.deleted_at is null
      and internal_security.tenant_module_enabled(document.tenant_id, 'DOCUMENTS')
      and (
        internal_security.can_manage_employee(document.employee_id, requested_permission)
        or (
          document.employee_id = internal_security.current_employee_id()
          and internal_security.current_user_has_permission(document.tenant_id, document.administration_id, 'self:document:read')
        )
      )
      and internal_security.document_audience_matches(document.id)
      and (not category.requires_salary_permission or internal_security.can_manage_employee(document.employee_id, 'salary:read'))
  );
$function$;

create or replace function public.can_access_employee_dossier(requested_employee_id uuid, requested_permission text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce((
    select internal_security.tenant_module_enabled(employee.tenant_id, 'DOCUMENTS')
      and case requested_permission
        when 'document:read' then
          internal_security.can_manage_employee(employee.id, requested_permission)
          or (
            employee.id = internal_security.current_employee_id(employee.tenant_id, employee.hr_group_id)
            and internal_security.current_employee_has_permission(employee.tenant_id, employee.hr_group_id, 'self:document:read')
          )
        when 'document:write' then internal_security.can_manage_employee(employee.id, requested_permission)
        when 'document:delete' then internal_security.can_manage_employee(employee.id, requested_permission)
        else false
      end
    from public.employees employee
    where auth.uid() is not null
      and requested_employee_id is not null
      and employee.id = requested_employee_id
      and employee.deleted_at is null
  ), false);
$function$;

create or replace function internal_security.document_audience_target_in_scope(
  requested_document_id uuid,
  requested_target_type public.document_target_type,
  requested_target_employee_id uuid,
  requested_target_management_role_id uuid,
  requested_target_department_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.employee_documents document
    join public.employees owner
      on owner.id = document.employee_id
     and owner.tenant_id = document.tenant_id
    where document.id = requested_document_id
      and (
        (
          requested_target_type = 'EMPLOYEE'
          and requested_target_employee_id is not null
          and requested_target_management_role_id is null
          and requested_target_department_id is null
          and exists (
            select 1
            from public.employees target
            where target.id = requested_target_employee_id
              and target.tenant_id = owner.tenant_id
              and target.hr_group_id = owner.hr_group_id
              and target.is_active
              and not target.is_archived
              and target.deleted_at is null
          )
        )
        or (
          requested_target_type = 'MANAGEMENT_ROLE'
          and requested_target_employee_id is null
          and requested_target_management_role_id is not null
          and requested_target_department_id is null
          and exists (
            select 1
            from public.management_roles target
            where target.id = requested_target_management_role_id
              and (target.tenant_id is null or target.tenant_id = owner.tenant_id)
              and target.is_active
              and target.deleted_at is null
          )
        )
        or (
          requested_target_type = 'DEPARTMENT_BRANCH'
          and requested_target_employee_id is null
          and requested_target_management_role_id is null
          and requested_target_department_id is not null
          and exists (
            select 1
            from public.departments target
            where target.id = requested_target_department_id
              and target.tenant_id = owner.tenant_id
              and target.hr_group_id = owner.hr_group_id
              and target.is_active
          )
        )
      )
  );
$function$;

create or replace function internal_security.enforce_document_audience_scope()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  document_tenant uuid;
  document_administration uuid;
begin
  select document.tenant_id, document.administration_id
  into document_tenant, document_administration
  from public.employee_documents document
  where document.id = new.document_id;

  if document_tenant is null
    or new.tenant_id <> document_tenant
    or new.administration_id <> document_administration
    or not internal_security.document_audience_target_in_scope(
      new.document_id,
      new.target_type,
      new.target_employee_id,
      new.target_management_role_id,
      new.target_department_id
    ) then
    raise exception 'DOCUMENT_AUDIENCE_SCOPE_INVALID' using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_document_audience_scope on public.document_audiences;
create trigger enforce_document_audience_scope
before insert or update on public.document_audiences
for each row execute function internal_security.enforce_document_audience_scope();

create policy employee_documents_salary_gate
on public.employee_documents
as restrictive
for all
to authenticated
using (
  not exists (
    select 1
    from public.document_categories category
    where category.id = employee_documents.category_id
      and category.requires_salary_permission
  )
  or internal_security.can_manage_employee(employee_documents.employee_id, 'salary:read')
)
with check (
  not exists (
    select 1
    from public.document_categories category
    where category.id = employee_documents.category_id
      and category.requires_salary_permission
  )
  or internal_security.can_manage_employee(employee_documents.employee_id, 'salary:read')
);

create or replace function internal_security.apply_employee_document_custom_fields(
  requested_document_id uuid,
  requested_custom_fields jsonb,
  creating_document boolean
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  document_row public.employee_documents%rowtype;
  employee_group uuid;
  actor_employee uuid;
  is_hr boolean;
  field_row record;
  field_value jsonb;
  merged_fields jsonb;
begin
  if auth.uid() is null or jsonb_typeof(coalesce(requested_custom_fields, '{}'::jsonb)) <> 'object' then
    raise exception 'DOCUMENT_CUSTOM_FIELDS_INVALID' using errcode = '22023';
  end if;

  select document.*
  into document_row
  from public.employee_documents document
  where document.id = requested_document_id
    and document.deleted_at is null;

  if not found then
    raise exception 'DOCUMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not internal_security.can_manage_employee(document_row.employee_id, 'document:write') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not internal_security.tenant_module_enabled(document_row.tenant_id, 'DOCUMENTS') then
    raise exception 'DOCUMENT_MODULE_DISABLED' using errcode = '42501';
  end if;

  select employee.hr_group_id
  into employee_group
  from public.employees employee
  where employee.id = document_row.employee_id
    and employee.tenant_id = document_row.tenant_id
    and employee.deleted_at is null;

  if employee_group is null then
    raise exception 'DOCUMENT_EMPLOYEE_SCOPE_INVALID' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.document_categories category
    where category.id = document_row.category_id
      and category.requires_salary_permission
  ) and not internal_security.can_manage_employee(document_row.employee_id, 'salary:read') then
    raise exception 'DOCUMENT_SALARY_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  actor_employee := internal_security.current_employee_id(document_row.tenant_id, employee_group);
  is_hr := internal_security.current_user_has_hr_group_permission(document_row.tenant_id, employee_group, 'custom-fields:write');
  merged_fields := coalesce(document_row.custom_fields, '{}'::jsonb) || coalesce(requested_custom_fields, '{}'::jsonb);

  for field_row in
    select definition.id, definition.key, definition.field_type, definition.is_required,
      case
        when actor_employee = document_row.employee_id then definition.employee_self_access
        when is_hr then definition.hr_access
        else definition.manager_access
      end as actor_access
    from public.custom_field_definitions definition
    where definition.tenant_id = document_row.tenant_id
      and definition.hr_group_id = employee_group
      and definition.entity_type = 'DOCUMENT'
      and definition.is_active
      and definition.deleted_at is null
  loop
    if requested_custom_fields ? field_row.key then
      if field_row.actor_access <> 'WRITE' then
        raise exception 'DOCUMENT_CUSTOM_FIELDS_INVALID' using errcode = '42501';
      end if;

      field_value := requested_custom_fields->field_row.key;
      if field_row.field_type in ('TEXT', 'TEXTAREA') then
        if jsonb_typeof(field_value) <> 'string' or length(field_value #>> '{}') > 5000 then
          raise exception 'DOCUMENT_CUSTOM_FIELDS_INVALID' using errcode = '22023';
        end if;
      elsif field_row.field_type = 'NUMBER' then
        if jsonb_typeof(field_value) <> 'number' then
          raise exception 'DOCUMENT_CUSTOM_FIELDS_INVALID' using errcode = '22023';
        end if;
      elsif field_row.field_type = 'DATE' then
        if jsonb_typeof(field_value) <> 'string' or field_value #>> '{}' !~ '^\d{4}-\d{2}-\d{2}$' then
          raise exception 'DOCUMENT_CUSTOM_FIELDS_INVALID' using errcode = '22023';
        end if;
        begin
          perform (field_value #>> '{}')::date;
        exception when others then
          raise exception 'DOCUMENT_CUSTOM_FIELDS_INVALID' using errcode = '22023';
        end;
      elsif field_row.field_type = 'BOOLEAN' then
        if jsonb_typeof(field_value) <> 'boolean' then
          raise exception 'DOCUMENT_CUSTOM_FIELDS_INVALID' using errcode = '22023';
        end if;
      elsif field_row.field_type = 'SELECT' then
        if jsonb_typeof(field_value) <> 'string' or not exists (
          select 1 from public.custom_field_select_options option
          where option.definition_id = field_row.id
            and option.tenant_id = document_row.tenant_id
            and option.hr_group_id = employee_group
            and option.is_active
            and option.value = field_value #>> '{}'
        ) then
          raise exception 'DOCUMENT_CUSTOM_FIELDS_INVALID' using errcode = '22023';
        end if;
      elsif field_row.field_type = 'MULTI_SELECT' then
        if jsonb_typeof(field_value) <> 'array'
          or exists (
            select 1 from jsonb_array_elements(field_value) as element(value)
            where jsonb_typeof(element.value) <> 'string'
              or not exists (
                select 1 from public.custom_field_select_options option
                where option.definition_id = field_row.id
                  and option.tenant_id = document_row.tenant_id
                  and option.hr_group_id = employee_group
                  and option.is_active
                  and option.value = element.value #>> '{}'
              )
          )
          or (select count(*) from jsonb_array_elements_text(field_value)) <> (select count(distinct value) from jsonb_array_elements_text(field_value) value) then
          raise exception 'DOCUMENT_CUSTOM_FIELDS_INVALID' using errcode = '22023';
        end if;
      elsif field_row.field_type = 'AUTO_INCREMENT' then
        raise exception 'DOCUMENT_CUSTOM_FIELDS_INVALID' using errcode = '42501';
      end if;
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_object_keys(coalesce(requested_custom_fields, '{}'::jsonb)) supplied(key)
    where not exists (
      select 1 from public.custom_field_definitions definition
      where definition.tenant_id = document_row.tenant_id
        and definition.hr_group_id = employee_group
        and definition.entity_type = 'DOCUMENT'
        and definition.key = supplied.key
        and definition.is_active
        and definition.deleted_at is null
    )
  ) then
    raise exception 'DOCUMENT_CUSTOM_FIELDS_INVALID' using errcode = '22023';
  end if;

  if creating_document then
    for field_row in
      select definition.id, definition.key
      from public.custom_field_definitions definition
      where definition.tenant_id = document_row.tenant_id
        and definition.hr_group_id = employee_group
        and definition.entity_type = 'DOCUMENT'
        and definition.field_type = 'AUTO_INCREMENT'
        and definition.is_active
        and definition.deleted_at is null
        and case
          when actor_employee = document_row.employee_id then definition.employee_self_access
          when is_hr then definition.hr_access
          else definition.manager_access
        end = 'WRITE'
        and not (merged_fields ? definition.key)
    loop
      merged_fields := jsonb_set(merged_fields, array[field_row.key], to_jsonb(public.next_custom_field_value(field_row.id)), true);
    end loop;
  end if;

  if exists (
    select 1
    from public.custom_field_definitions definition
    where definition.tenant_id = document_row.tenant_id
      and definition.hr_group_id = employee_group
      and definition.entity_type = 'DOCUMENT'
      and definition.is_active
      and definition.deleted_at is null
      and definition.is_required
      and case
        when actor_employee = document_row.employee_id then definition.employee_self_access
        when is_hr then definition.hr_access
        else definition.manager_access
      end = 'WRITE'
      and (
        not (merged_fields ? definition.key)
        or merged_fields->definition.key = 'null'::jsonb
        or merged_fields->definition.key = '""'::jsonb
        or merged_fields->definition.key = '[]'::jsonb
      )
  ) then
    raise exception 'DOCUMENT_CUSTOM_FIELDS_REQUIRED' using errcode = '22023';
  end if;

  update public.employee_documents
  set custom_fields = merged_fields
  where id = requested_document_id;
end;
$function$;

create or replace function public.get_accessible_employee_document_custom_fields(requested_document_ids uuid[])
returns table (document_id uuid, custom_fields jsonb, labels_nl jsonb, labels_en jsonb)
language sql
stable
security definer
set search_path to ''
as $function$
  select document.id,
    coalesce(jsonb_object_agg(definition.key, document.custom_fields->definition.key) filter (where document.custom_fields ? definition.key), '{}'::jsonb),
    coalesce(jsonb_object_agg(definition.key, definition.label_nl) filter (where document.custom_fields ? definition.key), '{}'::jsonb),
    coalesce(jsonb_object_agg(definition.key, definition.label_en) filter (where document.custom_fields ? definition.key), '{}'::jsonb)
  from public.employee_documents document
  join public.employees employee
    on employee.id = document.employee_id
   and employee.tenant_id = document.tenant_id
  join public.custom_field_definitions definition
    on definition.tenant_id = employee.tenant_id
   and definition.hr_group_id = employee.hr_group_id
   and definition.entity_type = 'DOCUMENT'
   and definition.is_active
   and definition.deleted_at is null
  where auth.uid() is not null
    and document.id = any(coalesce(requested_document_ids, array[]::uuid[]))
    and document.deleted_at is null
    and internal_security.can_access_document(document.id, 'document:read')
    and case
      when employee.auth_user_id = auth.uid() then definition.employee_self_access
      when internal_security.current_user_has_hr_group_permission(employee.tenant_id, employee.hr_group_id, 'custom-fields:write') then definition.hr_access
      else definition.manager_access
    end <> 'HIDDEN'
  group by document.id, document.custom_fields;
$function$;

create or replace function public.get_deleted_employee_documents_for_restore(requested_employee_id uuid)
returns table (
  id uuid,
  category_id uuid,
  title text,
  description text,
  tags text[],
  original_filename text,
  content_type text,
  file_size bigint,
  checksum_sha256 text,
  added_by_user_id uuid,
  expires_on date,
  created_at timestamptz,
  deleted_at timestamptz,
  deleted_by_user_id uuid,
  delete_reason text,
  expiry_reminder_id uuid,
  category_code text,
  category_name text,
  category_requires_salary_permission boolean
)
language sql
stable
security definer
set search_path to ''
as $function$
  select document.id, document.category_id, document.title, document.description,
    document.tags, document.original_filename, document.content_type,
    document.file_size, document.checksum_sha256, document.added_by_user_id,
    document.expires_on, document.created_at, document.deleted_at,
    document.deleted_by_user_id, document.delete_reason,
    document.expiry_reminder_id, category.code, category.name,
    category.requires_salary_permission
  from public.employee_documents document
  join public.document_categories category on category.id = document.category_id
  where auth.uid() is not null
    and document.employee_id = requested_employee_id
    and document.deleted_at is not null
    and internal_security.can_manage_employee(requested_employee_id, 'document:delete')
    and internal_security.tenant_module_enabled(document.tenant_id, 'DOCUMENTS')
    and (not category.requires_salary_permission or internal_security.can_manage_employee(requested_employee_id, 'salary:read'))
  order by document.created_at desc
  limit 500;
$function$;

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
  reminder_id uuid;
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

  select document.expiry_reminder_id into reminder_id
  from public.employee_documents document
  where document.id = created_document_id;
  if reminder_id is not null and exists (
    select 1 from public.reminder_target_rules target
    where target.reminder_id = reminder_id
      and not internal_security.document_audience_target_in_scope(created_document_id, target.target_type, target.target_employee_id, target.target_management_role_id, target.target_department_id)
  ) then
    raise exception 'REMINDER_TARGET_SCOPE_INVALID' using errcode = '42501';
  end if;

  perform internal_security.apply_employee_document_custom_fields(created_document_id, coalesce(requested_payload->'customFields', '{}'::jsonb), true);
  return created_document_id;
end;
$function$;

create or replace function public.update_employee_document_metadata_atomic(
  requested_employee_id uuid,
  requested_document_id uuid,
  requested_payload jsonb
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  document_row public.employee_documents%rowtype;
  category_row public.document_categories%rowtype;
  audience jsonb;
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

  select document.* into document_row
  from public.employee_documents document
  where document.id = requested_document_id
    and document.employee_id = requested_employee_id
    and document.deleted_at is null;
  if not found then
    raise exception 'DOCUMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not internal_security.tenant_module_enabled(document_row.tenant_id, 'DOCUMENTS') then
    raise exception 'DOCUMENT_MODULE_DISABLED' using errcode = '42501';
  end if;

  select category.* into category_row
  from public.document_categories category
  where category.id = (requested_payload->>'categoryId')::uuid
    and category.tenant_id = document_row.tenant_id
    and category.administration_id = document_row.administration_id
    and category.is_active;
  if category_row.id is null then
    raise exception 'DOCUMENT_CATEGORY_INVALID' using errcode = '22023';
  end if;
  if category_row.requires_salary_permission
    and not internal_security.can_manage_employee(requested_employee_id, 'salary:read') then
    raise exception 'DOCUMENT_SALARY_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  update public.employee_documents
  set category_id = category_row.id,
      title = requested_payload->>'title',
      description = nullif(requested_payload->>'description', ''),
      tags = array(
        select distinct lower(btrim(tag.value))
        from jsonb_array_elements_text(requested_payload->'tags') as tag(value)
        order by lower(btrim(tag.value))
      ),
      expires_on = nullif(requested_payload->>'expiresOn', '')::date
  where id = requested_document_id
    and employee_id = requested_employee_id;

  delete from public.document_audiences audience
  where audience.document_id = requested_document_id;
  for audience in select value from jsonb_array_elements(requested_payload->'audiences')
  loop
    insert into public.document_audiences (
      tenant_id, administration_id, document_id, target_type,
      target_employee_id, target_management_role_id, target_department_id
    ) values (
      document_row.tenant_id,
      document_row.administration_id,
      requested_document_id,
      (audience->>'type')::public.document_target_type,
      case when audience->>'type' = 'EMPLOYEE' then (audience->>'targetId')::uuid end,
      case when audience->>'type' = 'MANAGEMENT_ROLE' then (audience->>'targetId')::uuid end,
      case when audience->>'type' = 'DEPARTMENT_BRANCH' then (audience->>'targetId')::uuid end
    );
  end loop;

  if exists (
    select 1 from public.document_audiences audience
    where audience.document_id = requested_document_id
      and not internal_security.document_audience_target_in_scope(audience.document_id, audience.target_type, audience.target_employee_id, audience.target_management_role_id, audience.target_department_id)
  ) then
    raise exception 'DOCUMENT_AUDIENCE_SCOPE_INVALID' using errcode = '42501';
  end if;

  if document_row.expiry_reminder_id is not null then
    update public.reminders
    set description = case when requested_payload->>'expiresOn' is null or requested_payload->>'expiresOn' = ''
      then 'Document verloopt zonder ingestelde vervaldatum'
      else 'Document verloopt op ' || (requested_payload->>'expiresOn') end
    where id = document_row.expiry_reminder_id
      and tenant_id = document_row.tenant_id;
  end if;

  perform internal_security.apply_employee_document_custom_fields(requested_document_id, coalesce(requested_payload->'customFields', '{}'::jsonb), false);
end;
$function$;

create or replace function public.soft_delete_employee_document_atomic(
  requested_employee_id uuid,
  requested_document_id uuid,
  requested_delete_reason text
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  document_row public.employee_documents%rowtype;
begin
  if auth.uid() is null
    or coalesce(length(btrim(requested_delete_reason)), 0) not between 1 and 500
    or not internal_security.can_manage_employee(requested_employee_id, 'document:delete') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select document.* into document_row
  from public.employee_documents document
  where document.id = requested_document_id
    and document.employee_id = requested_employee_id
    and document.deleted_at is null;
  if not found then
    return false;
  end if;
  if not internal_security.tenant_module_enabled(document_row.tenant_id, 'DOCUMENTS') then
    raise exception 'DOCUMENT_MODULE_DISABLED' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.document_categories category
    where category.id = document_row.category_id
      and category.requires_salary_permission
  ) and not internal_security.can_manage_employee(requested_employee_id, 'salary:read') then
    raise exception 'DOCUMENT_SALARY_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  update public.employee_documents
  set deleted_at = timezone('utc', now()),
      deleted_by_user_id = auth.uid(),
      delete_reason = btrim(requested_delete_reason)
  where id = requested_document_id
    and employee_id = requested_employee_id
    and deleted_at is null;
  return found;
end;
$function$;

create or replace function public.restore_employee_document_atomic(
  requested_employee_id uuid,
  requested_document_id uuid
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  document_row public.employee_documents%rowtype;
begin
  if auth.uid() is null or not internal_security.can_manage_employee(requested_employee_id, 'document:delete') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select document.* into document_row
  from public.employee_documents document
  where document.id = requested_document_id
    and document.employee_id = requested_employee_id
    and document.deleted_at is not null;
  if not found then
    return false;
  end if;
  if not internal_security.tenant_module_enabled(document_row.tenant_id, 'DOCUMENTS') then
    raise exception 'DOCUMENT_MODULE_DISABLED' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.document_categories category
    where category.id = document_row.category_id
      and category.requires_salary_permission
  ) and not internal_security.can_manage_employee(requested_employee_id, 'salary:read') then
    raise exception 'DOCUMENT_SALARY_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  update public.employee_documents
  set deleted_at = null,
      deleted_by_user_id = null,
      delete_reason = null
  where id = requested_document_id
    and employee_id = requested_employee_id
    and deleted_at is not null;
  return found;
end;
$function$;

revoke all on function internal_security.document_audience_target_in_scope(uuid, public.document_target_type, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function internal_security.enforce_document_audience_scope() from public, anon, authenticated;
revoke all on function internal_security.apply_employee_document_custom_fields(uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.create_employee_document_metadata(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.get_accessible_employee_document_custom_fields(uuid[]) from public, anon;
revoke all on function public.get_deleted_employee_documents_for_restore(uuid) from public, anon;
revoke all on function public.create_employee_document_metadata_atomic(uuid, uuid, jsonb) from public, anon;
revoke all on function public.update_employee_document_metadata_atomic(uuid, uuid, jsonb) from public, anon;
revoke all on function public.can_access_employee_dossier(uuid, text) from public, anon;
revoke all on function public.soft_delete_employee_document_atomic(uuid, uuid, text) from public, anon;
revoke all on function public.restore_employee_document_atomic(uuid, uuid) from public, anon;
grant execute on function public.get_accessible_employee_document_custom_fields(uuid[]) to authenticated;
grant execute on function public.get_deleted_employee_documents_for_restore(uuid) to authenticated;
grant execute on function public.create_employee_document_metadata_atomic(uuid, uuid, jsonb) to authenticated;
grant execute on function public.update_employee_document_metadata_atomic(uuid, uuid, jsonb) to authenticated;
grant execute on function public.can_access_employee_dossier(uuid, text) to authenticated;
grant execute on function public.soft_delete_employee_document_atomic(uuid, uuid, text) to authenticated;
grant execute on function public.restore_employee_document_atomic(uuid, uuid) to authenticated;
