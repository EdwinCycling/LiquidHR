-- CONTROL01 CONVERGENCE_REQUIRED
-- Static migration only. Do not apply to a shared or remote Supabase project in
-- this run. No raw XML or plaintext BSN is stored by this staging contract.

begin;

insert into public.permissions (code, name, category, description)
values
  ('payroll-import:read', 'Loonimport lezen', 'Payroll', 'Bekijkt importbatches en validatieresultaten binnen de HR-groep.'),
  ('payroll-import:write', 'Loonimport uitvoeren', 'Payroll', 'Analyseert, bevestigt en verwerkt loonimporten binnen de HR-groep.')
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.tenant_id is null
  and role.code in ('TENANT_ADMIN', 'HR_ADMIN', 'PAYROLL_SPECIALIST')
  and permission.code in ('payroll-import:read', 'payroll-import:write')
on conflict do nothing;

create table public.administration_payroll_tax_numbers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hr_group_id uuid not null,
  administration_id uuid not null,
  payroll_tax_number text not null,
  is_primary boolean not null default false,
  valid_from date not null default current_date,
  valid_until date,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint administration_payroll_tax_numbers_admin_scope_fkey
    foreign key (tenant_id, hr_group_id, administration_id)
    references public.administrations(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint administration_payroll_tax_numbers_format_check
    check (payroll_tax_number ~ '^[0-9]{9}L(0[1-9]|[1-9][0-9])$'),
  constraint administration_payroll_tax_numbers_dates_check
    check (valid_until is null or valid_until >= valid_from),
  constraint administration_payroll_tax_numbers_number_scope_key
    unique (tenant_id, administration_id, payroll_tax_number, valid_from)
);

create unique index administration_payroll_tax_numbers_primary_active_key
  on public.administration_payroll_tax_numbers (tenant_id, administration_id)
  where is_primary and valid_until is null;

create index administration_payroll_tax_numbers_group_idx
  on public.administration_payroll_tax_numbers (tenant_id, hr_group_id, administration_id, valid_from desc);

create trigger set_administration_payroll_tax_numbers_updated_at
before update on public.administration_payroll_tax_numbers
for each row execute function internal_security.set_updated_at();

create table public.payroll_import_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hr_group_id uuid not null,
  administration_id uuid not null,
  source_type text not null,
  source_filename text not null,
  source_hash text not null,
  tax_year integer not null,
  period_start date,
  period_end date,
  payroll_tax_number text,
  status text not null default 'ANALYZED',
  idempotency_key text not null,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  preview_confirmed_at timestamptz,
  finalized_at timestamptz,
  source_deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payroll_import_batches_scope_fkey
    foreign key (tenant_id, hr_group_id, administration_id)
    references public.administrations(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint payroll_import_batches_source_type_check
    check (source_type in ('LOONAANGIFTE_XML', 'INTERNAL_REPRESENTATIVE')),
  constraint payroll_import_batches_status_check
    check (status in ('ANALYZED', 'STAGED', 'READY', 'FINALIZING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'EXPIRED')),
  constraint payroll_import_batches_source_hash_check
    check (source_hash ~ '^[0-9a-f]{64}$'),
  constraint payroll_import_batches_tax_year_check
    check (tax_year between 2000 and 2200),
  constraint payroll_import_batches_period_check
    check (period_end is null or period_start is null or period_end >= period_start),
  constraint payroll_import_batches_batch_scope_key
    unique (tenant_id, hr_group_id, id),
  constraint payroll_import_batches_idempotency_key_check
    check (btrim(idempotency_key) <> '')
);

create unique index payroll_import_batches_idempotency_key
  on public.payroll_import_batches (tenant_id, hr_group_id, idempotency_key);
create index payroll_import_batches_scope_created_idx
  on public.payroll_import_batches (tenant_id, hr_group_id, created_at desc);

create table public.payroll_import_persons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  batch_id uuid not null,
  source_row_number integer not null,
  external_employee_number text,
  bsn_fingerprint text,
  initials text,
  prefix text,
  first_name text,
  birth_name text,
  birth_date date,
  gender text,
  nationality text,
  address jsonb,
  status text not null default 'BLOCKING',
  match_status text not null default 'UNMATCHED',
  matched_employee_id uuid,
  validation_codes jsonb not null default '[]'::jsonb,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payroll_import_persons_batch_scope_fkey
    foreign key (tenant_id, hr_group_id, batch_id)
    references public.payroll_import_batches(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint payroll_import_persons_employee_scope_fkey
    foreign key (tenant_id, matched_employee_id)
    references public.employees(tenant_id, id)
    on delete restrict,
  constraint payroll_import_persons_row_number_check
    check (source_row_number > 0),
  constraint payroll_import_persons_status_check
    check (status in ('GREEN', 'WARNING', 'BLOCKING')),
  constraint payroll_import_persons_match_status_check
    check (match_status in ('UNMATCHED', 'EXACT', 'PROPOSED', 'MANUAL_REVIEW', 'NEW')),
  constraint payroll_import_persons_batch_row_key
    unique (batch_id, source_row_number),
  constraint payroll_import_persons_id_key
    unique (tenant_id, hr_group_id, id)
);

create index payroll_import_persons_batch_status_idx
  on public.payroll_import_persons (tenant_id, hr_group_id, batch_id, status);
create index payroll_import_persons_bsn_fingerprint_idx
  on public.payroll_import_persons (tenant_id, hr_group_id, bsn_fingerprint)
  where bsn_fingerprint is not null;

create table public.payroll_import_income_relationships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  batch_id uuid not null,
  import_person_id uuid not null,
  administration_id uuid not null,
  payroll_tax_number text not null,
  ikv_number integer not null,
  income_code text,
  employment_relation_code text,
  cao_code text,
  flags jsonb not null default '{}'::jsonb,
  hours_per_week numeric(8,2),
  salary_amount numeric(14,2),
  starts_on date,
  ends_on date,
  status text not null default 'BLOCKING',
  matched_income_relationship_id uuid,
  validation_codes jsonb not null default '[]'::jsonb,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payroll_import_income_batch_scope_fkey
    foreign key (tenant_id, hr_group_id, batch_id)
    references public.payroll_import_batches(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint payroll_import_income_person_scope_fkey
    foreign key (tenant_id, hr_group_id, import_person_id)
    references public.payroll_import_persons(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint payroll_import_income_relationship_scope_fkey
    foreign key (tenant_id, administration_id, matched_income_relationship_id)
    references public.income_relationships(tenant_id, administration_id, id)
    on delete restrict,
  constraint payroll_import_income_tax_number_check
    check (payroll_tax_number ~ '^[0-9]{9}L(0[1-9]|[1-9][0-9])$'),
  constraint payroll_import_income_ikv_check
    check (ikv_number > 0),
  constraint payroll_import_income_dates_check
    check (ends_on is null or starts_on is null or ends_on >= starts_on),
  constraint payroll_import_income_status_check
    check (status in ('GREEN', 'WARNING', 'BLOCKING', 'MANUAL_REVIEW', 'IMPORTED')),
  constraint payroll_import_income_hours_check
    check (hours_per_week is null or hours_per_week >= 0),
  constraint payroll_import_income_salary_check
    check (salary_amount is null or salary_amount >= 0),
  constraint payroll_import_income_ikv_key
    unique (batch_id, import_person_id, payroll_tax_number, ikv_number)
);

alter table public.payroll_import_income_relationships
  add constraint payroll_import_income_administration_scope_fkey
    foreign key (tenant_id, hr_group_id, administration_id)
    references public.administrations(tenant_id, hr_group_id, id)
    on delete cascade;

create index payroll_import_income_batch_status_idx
  on public.payroll_import_income_relationships (tenant_id, hr_group_id, batch_id, status);
create index payroll_import_income_ikv_lookup_idx
  on public.payroll_import_income_relationships (tenant_id, hr_group_id, payroll_tax_number, ikv_number);

create trigger set_payroll_import_batches_updated_at
before update on public.payroll_import_batches
for each row execute function internal_security.set_updated_at();
create trigger set_payroll_import_persons_updated_at
before update on public.payroll_import_persons
for each row execute function internal_security.set_updated_at();
create trigger set_payroll_import_income_relationships_updated_at
before update on public.payroll_import_income_relationships
for each row execute function internal_security.set_updated_at();

alter table public.administration_payroll_tax_numbers enable row level security;
alter table public.payroll_import_batches enable row level security;
alter table public.payroll_import_persons enable row level security;
alter table public.payroll_import_income_relationships enable row level security;

create policy administration_payroll_tax_numbers_select_group
on public.administration_payroll_tax_numbers for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:read')));
create policy administration_payroll_tax_numbers_insert_group
on public.administration_payroll_tax_numbers for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:write')));
create policy administration_payroll_tax_numbers_update_group
on public.administration_payroll_tax_numbers for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:write')));

create policy payroll_import_batches_select_group
on public.payroll_import_batches for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:read')));
create policy payroll_import_batches_insert_group
on public.payroll_import_batches for insert to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:write'))
);
create policy payroll_import_batches_update_group
on public.payroll_import_batches for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:write')));

create policy payroll_import_persons_select_group
on public.payroll_import_persons for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:read')));
create policy payroll_import_persons_insert_group
on public.payroll_import_persons for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:write')));
create policy payroll_import_persons_update_group
on public.payroll_import_persons for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:write')));

create policy payroll_import_income_relationships_select_group
on public.payroll_import_income_relationships for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:read')));
create policy payroll_import_income_relationships_insert_group
on public.payroll_import_income_relationships for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:write')));
create policy payroll_import_income_relationships_update_group
on public.payroll_import_income_relationships for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:write')));

create or replace function public.match_payroll_import_employee_bsn_fingerprint(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_bsn_fingerprint text
)
returns table (employee_id uuid)
language sql
stable
security definer
set search_path = public, internal_security, pg_temp
as $$
  select employee.id
  from public.employee_secure_identifiers identifier
  join public.employees employee
    on employee.tenant_id = identifier.tenant_id
   and employee.id = identifier.employee_id
  where requested_bsn_fingerprint ~ '^[0-9a-f]{64}$'
    and identifier.tenant_id = requested_tenant_id
    and identifier.bsn_fingerprint = requested_bsn_fingerprint
    and employee.tenant_id = requested_tenant_id
    and employee.hr_group_id = requested_hr_group_id
    and employee.deleted_at is null
    and (select internal_security.current_user_has_hr_group_permission(
      requested_tenant_id, requested_hr_group_id, 'payroll-import:write'
    ))
  limit 5;
$$;

revoke all on function public.match_payroll_import_employee_bsn_fingerprint(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.match_payroll_import_employee_bsn_fingerprint(uuid, uuid, text)
to authenticated;

revoke all on table public.administration_payroll_tax_numbers from public, anon;
revoke all on table public.payroll_import_batches from public, anon;
revoke all on table public.payroll_import_persons from public, anon;
revoke all on table public.payroll_import_income_relationships from public, anon;
grant select, insert, update on table public.administration_payroll_tax_numbers to authenticated;
grant select, insert, update on table public.payroll_import_batches to authenticated;
grant select, insert, update on table public.payroll_import_persons to authenticated;
grant select, insert, update on table public.payroll_import_income_relationships to authenticated;

comment on table public.administration_payroll_tax_numbers is
  'Loonheffingennummers per tenant, HR-groep en administratie; geen globale unieke claim.';
comment on table public.payroll_import_batches is
  'Stagingmetadata voor payrollimports. Ruwe XML wordt niet opgeslagen.';
comment on column public.payroll_import_persons.bsn_fingerprint is
  'Alleen de bestaande beveiligde BSN-fingerprint; nooit plaintext BSN.';
comment on table public.payroll_import_income_relationships is
  'Canonical staging van IKV-voorstellen; definitieve writes lopen via bestaande payrollservices.';

commit;
