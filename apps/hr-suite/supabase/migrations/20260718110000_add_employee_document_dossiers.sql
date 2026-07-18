create type public.document_target_type as enum ('EMPLOYEE', 'MANAGEMENT_ROLE', 'DEPARTMENT_BRANCH');

insert into public.permissions (code, name, category, description) values
  ('document:read', 'Documentdossiers bekijken', 'Documenten', 'Bekijkt documenten binnen medewerker- en doelgroepscope.'),
  ('document:write', 'Documentdossiers beheren', 'Documenten', 'Uploadt en wijzigt documenten binnen medewerker- en doelgroepscope.'),
  ('document:delete', 'Documenten verwijderen en herstellen', 'Documenten', 'Verwijdert of herstelt documenten met auditreden.')
on conflict (code) do update set name = excluded.name, category = excluded.category, description = excluded.description;
insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id from public.management_roles role cross join public.permissions permission
where role.code in ('TENANT_ADMIN', 'HR_ADMIN') and permission.code in ('document:read', 'document:write', 'document:delete') on conflict do nothing;

create table public.document_categories (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, administration_id uuid not null,
  code text not null check (char_length(btrim(code)) between 1 and 40), name text not null check (char_length(btrim(name)) between 1 and 160),
  description text, requires_salary_permission boolean not null default false, is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  foreign key (tenant_id, administration_id) references public.administrations(tenant_id, id) on delete cascade,
  unique (tenant_id, administration_id, code), unique (tenant_id, administration_id, id)
);

create table public.employee_documents (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, administration_id uuid not null, employee_id uuid not null,
  category_id uuid not null, storage_key text not null, original_filename text not null, content_type text not null,
  file_size bigint not null check (file_size between 1 and 26214400), checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  title text not null check (char_length(btrim(title)) between 1 and 160), description text check (description is null or char_length(description) <= 2000),
  tags text[] not null default '{}', expires_on date, added_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  expiry_reminder_id uuid, deleted_at timestamptz, deleted_by_user_id uuid references auth.users(id) on delete restrict, delete_reason text,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  foreign key (tenant_id, administration_id) references public.administrations(tenant_id, id) on delete cascade,
  foreign key (tenant_id, employee_id) references public.employees(tenant_id, id) on delete restrict,
  foreign key (tenant_id, administration_id, category_id) references public.document_categories(tenant_id, administration_id, id) on delete restrict,
  unique (tenant_id, storage_key), unique (tenant_id, administration_id, id),
  check ((deleted_at is null and deleted_by_user_id is null and delete_reason is null) or (deleted_at is not null and deleted_by_user_id is not null and char_length(btrim(delete_reason)) between 1 and 500))
);

create table public.document_audiences (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, administration_id uuid not null, document_id uuid not null,
  target_type public.document_target_type not null, target_employee_id uuid, target_management_role_id uuid, target_department_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (tenant_id, administration_id, document_id) references public.employee_documents(tenant_id, administration_id, id) on delete cascade,
  foreign key (tenant_id, target_employee_id) references public.employees(tenant_id, id) on delete cascade,
  foreign key (target_management_role_id) references public.management_roles(id) on delete cascade,
  foreign key (tenant_id, administration_id, target_department_id) references public.departments(tenant_id, administration_id, id) on delete cascade,
  check ((target_employee_id is not null)::int + (target_management_role_id is not null)::int + (target_department_id is not null)::int = 1),
  check ((target_type = 'EMPLOYEE' and target_employee_id is not null) or (target_type = 'MANAGEMENT_ROLE' and target_management_role_id is not null) or (target_type = 'DEPARTMENT_BRANCH' and target_department_id is not null)),
  unique nulls not distinct (document_id, target_type, target_employee_id, target_management_role_id, target_department_id)
);

create table public.reminder_target_rules (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, administration_id uuid, reminder_id uuid not null,
  target_type public.document_target_type not null, target_employee_id uuid, target_management_role_id uuid, target_department_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (tenant_id, reminder_id) references public.reminders(tenant_id, id) on delete cascade,
  foreign key (tenant_id, target_employee_id) references public.employees(tenant_id, id) on delete cascade,
  foreign key (target_management_role_id) references public.management_roles(id) on delete cascade,
  foreign key (tenant_id, administration_id, target_department_id) references public.departments(tenant_id, administration_id, id) on delete cascade,
  check ((target_employee_id is not null)::int + (target_management_role_id is not null)::int + (target_department_id is not null)::int = 1),
  unique nulls not distinct (reminder_id, target_type, target_employee_id, target_management_role_id, target_department_id)
);
alter table public.employee_documents add constraint employee_documents_expiry_reminder_fkey foreign key (tenant_id, expiry_reminder_id) references public.reminders(tenant_id, id) on delete set null;

create function internal_security.document_audience_matches(requested_document_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  with recursive actor as (
    select employee.id from public.employees employee where employee.auth_user_id = auth.uid() and employee.deleted_at is null
  ), role_ids as (
    select access.management_role_id from public.user_access access where access.user_id = auth.uid() and access.is_active
    union select management.management_role_id from public.department_management management join actor on actor.id = management.employee_id
      where management.effective_from <= current_date and (management.effective_to is null or management.effective_to >= current_date)
  ), branch_departments as (
    select audience.target_department_id as id from public.document_audiences audience where audience.document_id = requested_document_id and audience.target_type = 'DEPARTMENT_BRANCH'
    union all select department.id from public.departments department join branch_departments parent on department.parent_id = parent.id
  )
  select exists (
    select 1 from public.document_audiences audience
    where audience.document_id = requested_document_id and (
      (audience.target_type = 'EMPLOYEE' and audience.target_employee_id in (select id from actor))
      or (audience.target_type = 'MANAGEMENT_ROLE' and audience.target_management_role_id in (select management_role_id from role_ids))
      or (audience.target_type = 'DEPARTMENT_BRANCH' and exists (
        select 1 from public.employee_organizations organization join actor on actor.id = organization.employee_id
        where organization.department_id in (select id from branch_departments)
          and organization.effective_from <= current_date and (organization.effective_to is null or organization.effective_to >= current_date)
      ))
    )
  );
$$;
revoke all on function internal_security.document_audience_matches(uuid) from public, anon;
grant execute on function internal_security.document_audience_matches(uuid) to authenticated;

create function internal_security.can_access_document(requested_document_id uuid, requested_permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.employee_documents document join public.document_categories category on category.id = document.category_id
    where document.id = requested_document_id
      and internal_security.can_manage_employee(document.employee_id, requested_permission)
      and internal_security.document_audience_matches(document.id)
      and (not category.requires_salary_permission or internal_security.can_manage_employee(document.employee_id, 'salary:read'))
  );
$$;
revoke all on function internal_security.can_access_document(uuid, text) from public, anon;
grant execute on function internal_security.can_access_document(uuid, text) to authenticated;

alter table public.document_categories enable row level security; alter table public.employee_documents enable row level security;
alter table public.document_audiences enable row level security; alter table public.reminder_target_rules enable row level security;
create policy document_categories_read on public.document_categories for select to authenticated using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'document:read')));
create policy document_categories_write on public.document_categories for all to authenticated using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'document:write'))) with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'document:write')));
create policy employee_documents_read on public.employee_documents for select to authenticated using ((select internal_security.can_access_document(id, 'document:read')));
create policy employee_documents_insert on public.employee_documents for insert to authenticated with check ((select internal_security.can_manage_employee(employee_id, 'document:write')));
create policy employee_documents_update on public.employee_documents for update to authenticated using ((select internal_security.can_manage_employee(employee_id, 'document:write'))) with check ((select internal_security.can_manage_employee(employee_id, 'document:write')));
create policy document_audiences_read on public.document_audiences for select to authenticated using ((select internal_security.can_access_document(document_id, 'document:read')));
create policy document_audiences_write on public.document_audiences for all to authenticated using (exists (select 1 from public.employee_documents document where document.id = document_id and internal_security.can_manage_employee(document.employee_id, 'document:write'))) with check (exists (select 1 from public.employee_documents document where document.id = document_id and internal_security.can_manage_employee(document.employee_id, 'document:write')));
create policy reminder_target_rules_read on public.reminder_target_rules for select to authenticated using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'reminder:read')));
create policy reminder_target_rules_write on public.reminder_target_rules for all to authenticated using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'reminder:write'))) with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'reminder:write')));

create trigger set_document_categories_updated_at before update on public.document_categories for each row execute function internal_security.set_updated_at();
create trigger set_employee_documents_updated_at before update on public.employee_documents for each row execute function internal_security.set_updated_at();
create index employee_documents_employee_idx on public.employee_documents(tenant_id, administration_id, employee_id, created_at desc);
create index employee_documents_category_idx on public.employee_documents(tenant_id, administration_id, category_id);
create index employee_documents_expiry_reminder_idx on public.employee_documents(tenant_id, expiry_reminder_id) where expiry_reminder_id is not null;
create index document_audiences_document_idx on public.document_audiences(tenant_id, administration_id, document_id);
create index document_audiences_employee_idx on public.document_audiences(tenant_id, target_employee_id) where target_employee_id is not null;
create index document_audiences_role_idx on public.document_audiences(target_management_role_id) where target_management_role_id is not null;
create index document_audiences_department_idx on public.document_audiences(tenant_id, administration_id, target_department_id) where target_department_id is not null;
create index reminder_target_rules_reminder_idx on public.reminder_target_rules(tenant_id, reminder_id);
create index reminder_target_rules_employee_idx on public.reminder_target_rules(tenant_id, target_employee_id) where target_employee_id is not null;
create index reminder_target_rules_role_idx on public.reminder_target_rules(target_management_role_id) where target_management_role_id is not null;
create index reminder_target_rules_department_idx on public.reminder_target_rules(tenant_id, administration_id, target_department_id) where target_department_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (
  'employee-documents', 'employee-documents', false, 26214400,
  array['application/pdf','image/png','image/jpeg','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
) on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy employee_document_objects_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'employee-documents' and internal_security.can_manage_employee(((storage.foldername(name))[3])::uuid, 'document:write')
);
create policy employee_document_objects_read on storage.objects for select to authenticated using (
  bucket_id = 'employee-documents' and exists (select 1 from public.employee_documents document where document.storage_key = name and internal_security.can_access_document(document.id, 'document:read'))
);

grant select, insert, update, delete on public.document_categories, public.employee_documents, public.document_audiences, public.reminder_target_rules to authenticated;

insert into public.document_categories (tenant_id, administration_id, code, name, description)
select administration.tenant_id, administration.id, 'GENERAL', 'Algemeen', 'Algemene medewerkersdocumenten'
from public.administrations administration on conflict (tenant_id, administration_id, code) do nothing;

create function public.create_employee_document_metadata(requested_employee_id uuid, requested_administration_id uuid, requested_payload jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare tenant uuid; created_document_id uuid; created_reminder_id uuid; audience jsonb; target jsonb; actor_employee uuid;
begin
  select administration.tenant_id into tenant from public.administrations administration where administration.id = requested_administration_id;
  if tenant is null or not internal_security.can_manage_employee(requested_employee_id, 'document:write') then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  insert into public.employee_documents (tenant_id, administration_id, employee_id, category_id, storage_key, original_filename, content_type, file_size, checksum_sha256, title, description, tags, expires_on)
  values (tenant, requested_administration_id, requested_employee_id, (requested_payload->>'categoryId')::uuid, requested_payload->>'storageKey', requested_payload->>'originalFilename', requested_payload->>'contentType', (requested_payload->>'fileSize')::bigint, requested_payload->>'checksumSha256', requested_payload->>'title', nullif(requested_payload->>'description',''), array(select jsonb_array_elements_text(requested_payload->'tags')), nullif(requested_payload->>'expiresOn','')::date)
  returning id into created_document_id;
  for audience in select value from jsonb_array_elements(requested_payload->'audiences') loop
    insert into public.document_audiences (tenant_id, administration_id, document_id, target_type, target_employee_id, target_management_role_id, target_department_id)
    values (tenant, requested_administration_id, created_document_id, (audience->>'type')::public.document_target_type,
      case when audience->>'type'='EMPLOYEE' then (audience->>'targetId')::uuid end,
      case when audience->>'type'='MANAGEMENT_ROLE' then (audience->>'targetId')::uuid end,
      case when audience->>'type'='DEPARTMENT_BRANCH' then (audience->>'targetId')::uuid end) on conflict do nothing;
  end loop;
  select id into actor_employee from public.employees where tenant_id = tenant and auth_user_id = auth.uid() and deleted_at is null limit 1;
  if actor_employee is not null then insert into public.document_audiences (tenant_id, administration_id, document_id, target_type, target_employee_id) values (tenant, requested_administration_id, created_document_id, 'EMPLOYEE', actor_employee) on conflict do nothing; end if;
  if requested_payload->'reminder' is not null and requested_payload->'reminder' <> 'null'::jsonb then
    if not internal_security.current_user_has_permission(tenant, requested_administration_id, 'reminder:write') then raise exception 'REMINDER_FORBIDDEN' using errcode = 'P0001'; end if;
    insert into public.reminders (tenant_id, administration_id, created_by_user_id, reminder_type, target_type, title, description, remind_at, status, published_at)
    values (tenant, requested_administration_id, auth.uid(), 'HR', 'EMPLOYEES', requested_payload->>'title', 'Document verloopt op ' || (requested_payload->>'expiresOn'), (requested_payload#>>'{reminder,remindAt}')::timestamptz, 'PUBLISHED', timezone('utc', now())) returning id into created_reminder_id;
    for target in select value from jsonb_array_elements(requested_payload#>'{reminder,targets}') loop
      insert into public.reminder_target_rules (tenant_id, administration_id, reminder_id, target_type, target_employee_id, target_management_role_id, target_department_id)
      values (tenant, requested_administration_id, created_reminder_id, (target->>'type')::public.document_target_type,
        case when target->>'type'='EMPLOYEE' then (target->>'targetId')::uuid end,
        case when target->>'type'='MANAGEMENT_ROLE' then (target->>'targetId')::uuid end,
        case when target->>'type'='DEPARTMENT_BRANCH' then (target->>'targetId')::uuid end);
    end loop;
    insert into public.reminder_recipients (tenant_id, reminder_id, user_id, employee_id, effective_remind_at)
    select distinct tenant, created_reminder_id, employee.auth_user_id, employee.id, (requested_payload#>>'{reminder,remindAt}')::timestamptz
    from public.employees employee where employee.tenant_id = tenant and employee.auth_user_id is not null and employee.deleted_at is null and (
      exists (select 1 from public.reminder_target_rules rule where rule.reminder_id = created_reminder_id and rule.target_type='EMPLOYEE' and rule.target_employee_id=employee.id)
      or exists (select 1 from public.reminder_target_rules rule join public.user_access access on access.management_role_id=rule.target_management_role_id and access.user_id=employee.auth_user_id and access.is_active where rule.reminder_id=created_reminder_id and rule.target_type='MANAGEMENT_ROLE')
      or exists (with recursive branch as (select rule.target_department_id id from public.reminder_target_rules rule where rule.reminder_id=created_reminder_id and rule.target_type='DEPARTMENT_BRANCH' union all select department.id from public.departments department join branch on department.parent_id=branch.id) select 1 from public.employee_organizations organization where organization.employee_id=employee.id and organization.department_id in (select id from branch) and organization.effective_from<=current_date and (organization.effective_to is null or organization.effective_to>=current_date))
    ) on conflict (reminder_id, user_id) do nothing;
    update public.employee_documents set expiry_reminder_id = created_reminder_id where id = created_document_id;
  end if;
  return created_document_id;
end; $$;
revoke all on function public.create_employee_document_metadata(uuid, uuid, jsonb) from public, anon;
grant execute on function public.create_employee_document_metadata(uuid, uuid, jsonb) to authenticated;
