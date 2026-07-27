insert into public.permissions (code, name, category, description)
values
  ('company-document:write', 'Bedrijfsdocumenten beheren', 'Documenten', 'Uploadt en wijzigt bedrijfsbrede documenten.'),
  ('company-document:delete', 'Bedrijfsdocumenten verwijderen', 'Documenten', 'Verwijdert bedrijfsbrede documenten.'),
  ('payslip:read', 'Loonstroken bekijken', 'Salaris', 'Bekijkt loonstroken binnen de toegestane medewerker- of salarisscope.'),
  ('payslip:write', 'Loonstroken beheren', 'Salaris', 'Beheert geïmporteerde loonstroken.'),
  ('payslip:delete', 'Loonstroken verwijderen', 'Salaris', 'Verwijdert geïmporteerde loonstroken.'),
  ('self:payslip:read', 'Eigen loonstroken bekijken', 'Salaris', 'Bekijkt uitsluitend eigen loonstroken.')
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code in ('TENANT_ADMIN', 'HR_ADMIN')
  and role.tenant_id is null
  and permission.code in ('company-document:write', 'company-document:delete', 'payslip:read', 'payslip:write', 'payslip:delete')
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code = 'self:payslip:read'
where role.code = 'EMPLOYEE'
  and role.tenant_id is null
on conflict do nothing;

create table public.company_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  original_filename text not null check (char_length(btrim(original_filename)) between 1 and 255),
  storage_key text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 26214400),
  content_type text not null check (char_length(btrim(content_type)) between 1 and 160),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  uploaded_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint company_documents_administration_fkey foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete cascade,
  constraint company_documents_scope_id_key unique (tenant_id, administration_id, id),
  constraint company_documents_storage_key_key unique (tenant_id, storage_key)
);

create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  period_label text not null check (char_length(btrim(period_label)) between 1 and 80),
  calendar_year integer not null check (calendar_year between 2000 and 2200),
  original_filename text not null check (char_length(btrim(original_filename)) between 1 and 255),
  storage_key text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  content_type text not null check (content_type = 'application/pdf'),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  import_source text not null check (import_source in ('NMBRS', 'LOKET', 'MANUAL_IMPORT')),
  imported_at timestamptz not null default timezone('utc', now()),
  imported_by_user_id uuid references auth.users(id) on delete restrict,
  constraint payslips_administration_fkey foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete cascade,
  constraint payslips_employee_fkey foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id) on delete restrict,
  constraint payslips_employment_fkey foreign key (tenant_id, administration_id, employee_id, employment_id)
    references public.employments(tenant_id, administration_id, employee_id, id) on delete restrict,
  constraint payslips_scope_id_key unique (tenant_id, administration_id, id),
  constraint payslips_storage_key_key unique (tenant_id, storage_key)
);

alter table public.company_documents enable row level security;
alter table public.payslips enable row level security;

create policy company_documents_read on public.company_documents
  for select to authenticated
  using ((select internal_security.has_tenant_access(tenant_id)) and deleted_at is null);
create policy company_documents_insert on public.company_documents
  for insert to authenticated
  with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-document:write')));
create policy company_documents_update on public.company_documents
  for update to authenticated
  using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-document:write')))
  with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-document:write')));
create policy company_documents_delete on public.company_documents
  for delete to authenticated
  using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-document:delete')));

create or replace function internal_security.can_access_payslip(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select internal_security.has_tenant_access(requested_tenant_id)
    and (
      (
        internal_security.current_employee_id() = requested_employee_id
        and internal_security.current_employee_has_permission('self:payslip:read')
      )
      or internal_security.can_manage_employee(requested_employee_id, 'payslip:read')
      or exists (
        select 1
        from public.user_access access
        join public.management_roles role on role.id = access.management_role_id
        where access.user_id = (select auth.uid())
          and access.tenant_id = requested_tenant_id
          and access.is_active
          and access.scope_type in ('TENANT', 'ADMINISTRATION')
          and (access.scope_type = 'TENANT' or access.administration_id = requested_administration_id)
          and role.tenant_id is null
          and role.code in ('TENANT_ADMIN', 'HR_ADMIN')
      )
    );
$$;

revoke all on function internal_security.can_access_payslip(uuid, uuid, uuid) from public, anon;
grant execute on function internal_security.can_access_payslip(uuid, uuid, uuid) to authenticated;

create policy payslips_read on public.payslips
  for select to authenticated
  using ((select internal_security.can_access_payslip(tenant_id, administration_id, employee_id)));
create policy payslips_write on public.payslips
  for all to authenticated
  using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'payslip:write')))
  with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'payslip:write')));
create policy payslips_delete on public.payslips
  for delete to authenticated
  using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'payslip:delete')));

create trigger set_company_documents_updated_at before update on public.company_documents
  for each row execute function internal_security.set_updated_at();

create index company_documents_tenant_created_idx
  on public.company_documents (tenant_id, administration_id, created_at desc)
  where deleted_at is null;
create index payslips_employee_period_idx
  on public.payslips (tenant_id, administration_id, employee_id, calendar_year desc, imported_at desc);
create index payslips_employment_idx
  on public.payslips (tenant_id, administration_id, employment_id, imported_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('company-documents', 'company-documents', false, 26214400,
    array['application/pdf','text/plain','text/csv','text/markdown','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/png','image/jpeg','image/webp']),
  ('payslips', 'payslips', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy company_document_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'company-documents'
    and (select internal_security.current_user_has_permission((storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid, 'company-document:write'))
  );
create policy company_document_objects_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'company-documents'
    and exists (select 1 from public.company_documents document where document.storage_key = name and document.deleted_at is null and internal_security.has_tenant_access(document.tenant_id))
  );
create policy company_document_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'company-documents'
    and (select internal_security.current_user_has_permission((storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid, 'company-document:delete'))
  );

create policy payslip_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payslips'
    and (select internal_security.current_user_has_permission((storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid, 'payslip:write'))
  );
create policy payslip_objects_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payslips'
    and exists (select 1 from public.payslips payslip where payslip.storage_key = name and internal_security.can_access_payslip(payslip.tenant_id, payslip.administration_id, payslip.employee_id))
  );
create policy payslip_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'payslips'
    and (select internal_security.current_user_has_permission((storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid, 'payslip:delete'))
  );

grant select, insert, update, delete on public.company_documents, public.payslips to authenticated;

update storage.buckets
set allowed_mime_types = array[
  'application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/pjpeg', 'image/png', 'image/webp', 'image/bmp', 'image/x-ms-bmp'
]
where id = 'employee-documents';

alter table public.personal_dashboard_widgets drop constraint if exists personal_dashboard_widgets_widget_type_check;
alter table public.personal_dashboard_widgets add constraint personal_dashboard_widgets_widget_type_check check (widget_type in (
  'WELCOME', 'MY_REMINDERS', 'ORGANIZATION_OVERVIEW', 'EMPLOYEE_OVERVIEW',
  'MY_PROFILE', 'PROFILE_COMPLETENESS', 'MY_EMERGENCY_CONTACTS', 'EMPLOYEE_DIRECTORY', 'UPCOMING_BIRTHDAYS', 'HEADCOUNT_BY_DEPARTMENT', 'GENDER_DISTRIBUTION', 'EDUCATION_MIX', 'NATIONALITY_DISTRIBUTION',
  'MY_CONTRACT_DETAILS', 'CONTRACT_TYPE_MIX', 'EXPIRING_CONTRACTS', 'PROBATION_ALERTS', 'UPCOMING_STARTS', 'CURRENT_MONTH_ENDS', 'AVERAGE_TENURE', 'EMPLOYMENT_STATUS_MIX', 'EMPLOYMENT_CHANGE_TIMELINE',
  'MY_RECENT_DOCUMENTS', 'EXPIRING_DOCUMENTS', 'DOCUMENTS_BY_CATEGORY', 'DOCUMENTS_PER_EMPLOYEE', 'DOCUMENT_REMINDER_STATUS', 'COMPANY_DOCUMENTS',
  'MY_SALARY_HISTORY', 'AVERAGE_SALARY_BY_DEPARTMENT', 'SALARY_SCALE_OCCUPANCY', 'PAYMENT_TYPE_MIX', 'COST_ALLOCATION_MIX', 'SALARY_CHANGE_TIMELINE',
  'MY_WEEKLY_ROSTER', 'WEEKDAY_HOURS', 'FTE_BY_DEPARTMENT', 'ROSTER_COVERAGE_BY_DEPARTMENT', 'UPCOMING_HOLIDAYS', 'ACTIVE_REMINDERS', 'ORGANIZATION_SUMMARY', 'WORK_PATTERNS_BY_DEPARTMENT'
));
