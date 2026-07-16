create extension if not exists btree_gist with schema extensions;

create type public.employment_type as enum (
  'EMPLOYEE',
  'INTERN',
  'APPRENTICE',
  'CONTRACTOR'
);
create type public.contract_type as enum (
  'INDEFINITE',
  'DEFINITE',
  'ON_CALL',
  'TEMPORARY_AGENCY',
  'EXTERNAL'
);
create type public.employment_record_status as enum ('DRAFT', 'CONFIRMED', 'CANCELLED');
create type public.income_relationship_type as enum ('EMPLOYMENT', 'SOCIAL_BENEFIT', 'OTHER');
create type public.payroll_reporting_status as enum ('DRAFT', 'READY', 'REPORTED', 'CLOSED');

create table public.employments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_number text not null,
  employment_type public.employment_type not null default 'EMPLOYEE',
  contract_type public.contract_type not null,
  record_status public.employment_record_status not null default 'DRAFT',
  starts_on date not null,
  ends_on date,
  probation_ends_on date,
  seniority_date date not null,
  original_hire_date date not null,
  is_primary boolean not null default false,
  reason_started text,
  contract_document_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint employments_dates_valid check (
    (ends_on is null or ends_on >= starts_on)
    and (probation_ends_on is null or probation_ends_on >= starts_on)
    and seniority_date <= starts_on
    and original_hire_date <= starts_on
  ),
  constraint employments_administration_same_tenant_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id)
    on delete restrict,
  constraint employments_employee_same_tenant_fkey
    foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id)
    on delete restrict,
  constraint employments_scope_id_key
    unique (tenant_id, administration_id, employee_id, id),
  constraint employments_administration_id_key
    unique (tenant_id, administration_id, id)
);

create unique index employments_number_active_key
  on public.employments (tenant_id, administration_id, employment_number)
  where deleted_at is null;
create index employments_employee_period_idx
  on public.employments (tenant_id, employee_id, starts_on, ends_on)
  where deleted_at is null;
create index employments_administration_period_idx
  on public.employments (tenant_id, administration_id, starts_on, ends_on)
  where deleted_at is null;

create table public.income_relationships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  employee_id uuid not null,
  payroll_tax_subnumber text not null,
  ikv_number integer not null check (ikv_number > 0),
  relationship_type public.income_relationship_type not null default 'EMPLOYMENT',
  starts_on date not null,
  ends_on date,
  reporting_status public.payroll_reporting_status not null default 'DRAFT',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint income_relationships_dates_valid check (ends_on is null or ends_on >= starts_on),
  constraint income_relationships_administration_same_tenant_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id)
    on delete restrict,
  constraint income_relationships_employee_same_tenant_fkey
    foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id)
    on delete restrict,
  constraint income_relationships_scope_id_key
    unique (tenant_id, administration_id, employee_id, id),
  constraint income_relationships_administration_id_key
    unique (tenant_id, administration_id, id)
);

create unique index income_relationships_ikv_active_key
  on public.income_relationships (
    tenant_id,
    administration_id,
    payroll_tax_subnumber,
    ikv_number
  )
  where deleted_at is null;
create index income_relationships_employee_period_idx
  on public.income_relationships (tenant_id, employee_id, starts_on, ends_on)
  where deleted_at is null;

create table public.employment_income_relationships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  income_relationship_id uuid not null,
  valid_from date not null,
  valid_until date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employment_income_relationships_period_valid
    check (valid_until is null or valid_until > valid_from),
  constraint employment_income_relationships_employment_scope_fkey
    foreign key (tenant_id, administration_id, employee_id, employment_id)
    references public.employments(tenant_id, administration_id, employee_id, id)
    on delete cascade,
  constraint employment_income_relationships_income_scope_fkey
    foreign key (tenant_id, administration_id, employee_id, income_relationship_id)
    references public.income_relationships(tenant_id, administration_id, employee_id, id)
    on delete cascade,
  constraint employment_income_relationships_no_overlap
    exclude using gist (
      tenant_id with =,
      employment_id with =,
      daterange(valid_from, valid_until, '[)') with &&
    )
);

create index employment_income_relationships_income_idx
  on public.employment_income_relationships (tenant_id, income_relationship_id, valid_from);

create trigger set_employments_updated_at before update on public.employments
for each row execute function internal_security.set_updated_at();
create trigger set_income_relationships_updated_at before update on public.income_relationships
for each row execute function internal_security.set_updated_at();
create trigger set_employment_income_relationships_updated_at
before update on public.employment_income_relationships
for each row execute function internal_security.set_updated_at();

create trigger prevent_employments_tenant_change before update of tenant_id on public.employments
for each row execute function internal_security.prevent_tenant_scope_change();
create trigger prevent_income_relationships_tenant_change before update of tenant_id on public.income_relationships
for each row execute function internal_security.prevent_tenant_scope_change();
create trigger prevent_employment_income_relationships_tenant_change
before update of tenant_id on public.employment_income_relationships
for each row execute function internal_security.prevent_tenant_scope_change();

alter table public.employments enable row level security;
alter table public.income_relationships enable row level security;
alter table public.employment_income_relationships enable row level security;

create policy employments_select_scoped on public.employments for select to authenticated
using (
  (
    exists (
      select 1 from public.employees employee
      where employee.id = employments.employee_id
        and employee.tenant_id = employments.tenant_id
        and employee.auth_user_id = (select auth.uid())
        and employee.deleted_at is null
    )
    and (select internal_security.current_employee_has_permission('self:contract:read'))
  )
  or (select internal_security.can_manage_employee(employee_id, 'contract:read'))
);
create policy employments_insert_scoped on public.employments for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy employments_update_scoped on public.employments for update to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write'))
  or (select internal_security.can_manage_employee(employee_id, 'contract:write'))
)
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));

create policy income_relationships_select_scoped on public.income_relationships for select to authenticated
using (
  (
    exists (
      select 1 from public.employees employee
      where employee.id = income_relationships.employee_id
        and employee.tenant_id = income_relationships.tenant_id
        and employee.auth_user_id = (select auth.uid())
        and employee.deleted_at is null
    )
    and (select internal_security.current_employee_has_permission('self:salary:read'))
  )
  or (select internal_security.can_manage_employee(employee_id, 'salary:read'))
);
create policy income_relationships_insert_scoped on public.income_relationships for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')));
create policy income_relationships_update_scoped on public.income_relationships for update to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write'))
  or (select internal_security.can_manage_employee(employee_id, 'salary:write'))
)
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')));

create policy employment_income_relationships_select_scoped
on public.employment_income_relationships for select to authenticated
using (
  (
    exists (
      select 1 from public.employees employee
      where employee.id = employment_income_relationships.employee_id
        and employee.tenant_id = employment_income_relationships.tenant_id
        and employee.auth_user_id = (select auth.uid())
        and employee.deleted_at is null
    )
    and (select internal_security.current_employee_has_permission('self:salary:read'))
  )
  or (select internal_security.can_manage_employee(employee_id, 'salary:read'))
);
create policy employment_income_relationships_insert_scoped
on public.employment_income_relationships for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')));
create policy employment_income_relationships_update_scoped
on public.employment_income_relationships for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')));

grant select, insert, update on public.employments to authenticated;
grant select, insert, update on public.income_relationships to authenticated;
grant select, insert, update on public.employment_income_relationships to authenticated;
