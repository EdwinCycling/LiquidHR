begin;

-- Stap 3 van het Luna-plan: leg de HR-groep als vaste database-eigenaarsgrens
-- vast. De bestaande administration_id-kolommen blijven in deze schema-slice
-- bestaan zolang de latere context/API-slices ze nog lezen; ze zijn niet meer
-- voldoende als scopecontrole.

create table public.hr_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  code text not null check (char_length(btrim(code)) between 1 and 80),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text check (description is null or char_length(description) <= 1000),
  is_active boolean not null default true,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint hr_groups_tenant_code_key unique (tenant_id, code),
  constraint hr_groups_tenant_id_id_key unique (tenant_id, id)
);

create trigger set_hr_groups_updated_at
before update on public.hr_groups
for each row execute function internal_security.set_updated_at();

create trigger audit_hr_groups
after insert or update or delete on public.hr_groups
for each row execute function internal_security.audit_configuration_change('hr_group');

-- De bestaande synthetische tenants krijgen een reproduceerbare defaultgroep.
-- Nieuwe groepen worden later door de Control Plane als eigen records toegevoegd.
insert into public.hr_groups (tenant_id, code, name, description)
select tenant.id,
       'DEFAULT',
       tenant.name || ' HR-groep',
       'Gemigreerde HR-groep voor de bestaande synthetische testdata.'
from public.tenants tenant
on conflict (tenant_id, code) do update
set name = excluded.name,
    description = excluded.description,
    updated_at = timezone('utc', now());

alter table public.administrations
  add column if not exists hr_group_id uuid,
  add column if not exists administration_number text;

update public.administrations administration
set hr_group_id = group_row.id,
    administration_number = coalesce(administration.administration_number, administration.code)
from public.hr_groups group_row
where group_row.tenant_id = administration.tenant_id
  and group_row.code = 'DEFAULT'
  and (administration.hr_group_id is null or administration.administration_number is null);

alter table public.administrations
  alter column hr_group_id set not null,
  alter column administration_number set not null,
  drop constraint if exists administrations_hr_group_fkey,
  add constraint administrations_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict,
  add constraint administrations_tenant_group_id_key
    unique (tenant_id, hr_group_id, id),
  add constraint administrations_number_check
    check (char_length(btrim(administration_number)) between 1 and 80),
  add constraint administrations_tenant_number_key
    unique (tenant_id, administration_number);

create index if not exists administrations_tenant_hr_group_idx
  on public.administrations (tenant_id, hr_group_id, is_active);

comment on column public.administrations.administration_number is
  'Beheerbaar administratienummer; het interne id blijft de technische sleutel.';

create or replace function internal_security.prevent_hr_group_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.hr_group_id is distinct from old.hr_group_id then
    raise exception 'HR_GROUP_IMMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function internal_security.prevent_hr_group_change() from public, anon, authenticated;

create or replace function internal_security.prevent_administration_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'ADMINISTRATION_IMMUTABLE' using errcode = 'P0001';
  return old;
end;
$$;

revoke all on function internal_security.prevent_administration_delete() from public, anon, authenticated;

drop trigger if exists prevent_administration_hr_group_change on public.administrations;
create trigger prevent_administration_hr_group_change
before update of hr_group_id on public.administrations
for each row execute function internal_security.prevent_hr_group_change();

drop trigger if exists prevent_administration_delete on public.administrations;
create trigger prevent_administration_delete
before delete on public.administrations
for each row execute function internal_security.prevent_administration_delete();

create or replace function internal_security.enforce_labor_condition_set_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  active_count integer;
begin
  if new.is_active then
    select count(*)
    into active_count
    from public.labor_condition_sets condition_set
    where condition_set.tenant_id = new.tenant_id
      and condition_set.administration_id = new.administration_id
      and condition_set.is_active
      and condition_set.id <> new.id;

    if active_count >= 3 then
      raise exception 'ACTIVE_CAO_LIMIT_EXCEEDED' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create or replace function internal_security.prevent_employment_cao_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.labor_condition_set_id is distinct from old.labor_condition_set_id then
    raise exception 'EMPLOYMENT_CAO_IMMUTABLE' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.employment_contracts contract
    where contract.tenant_id = new.tenant_id
      and contract.employment_id = new.employment_id
      and contract.id <> new.id
      and contract.labor_condition_set_id is distinct from new.labor_condition_set_id
  ) then
    raise exception 'EMPLOYMENT_CAO_IMMUTABLE' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function internal_security.enforce_labor_condition_set_limit() from public, anon, authenticated;
revoke all on function internal_security.prevent_employment_cao_change() from public, anon, authenticated;

drop trigger if exists enforce_labor_condition_set_limit on public.labor_condition_sets;
create trigger enforce_labor_condition_set_limit
before insert or update of tenant_id, administration_id, is_active on public.labor_condition_sets
for each row execute function internal_security.enforce_labor_condition_set_limit();

drop trigger if exists prevent_employment_cao_change on public.employment_contracts;
create trigger prevent_employment_cao_change
before insert or update of labor_condition_set_id, employment_id on public.employment_contracts
for each row execute function internal_security.prevent_employment_cao_change();

-- Alle domeintabellen die in de eerste schema-slice een expliciete
-- HR-groepgrens dragen. De lijst is bewust versioneerbaar en niet gebaseerd op
-- een brede runtime-reflectie van willekeurige public-tabellen.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'employees',
    'departments',
    'department_management',
    'employee_organizations',
    'employee_administration_assignments',
    'employments',
    'labor_condition_sets',
    'employment_contracts',
    'employment_labor_conditions',
    'job_groups',
    'jobs',
    'job_revisions',
    'job_group_jobs',
    'administration_company_data',
    'administration_locations',
    'labor_condition_sets',
    'employment_contracts',
    'employment_labor_conditions',
    'absence_settings',
    'absence_cases',
    'absence_spells',
    'absence_capacity_changes',
    'absence_mutations',
    'absence_task_templates',
    'leave_settings',
    'leave_types',
    'work_hour_types',
    'leave_profiles',
    'leave_accrual_rules',
    'leave_accrual_exceptions',
    'leave_accrual_rule_pause_types',
    'leave_accrual_rule_work_hour_types',
    'leave_bonus_rules',
    'leave_bonus_tiers',
    'leave_priority_rules',
    'leave_priority_rule_items',
    'leave_year_controls',
    'leave_year_rollovers',
    'leave_year_rollover_items',
    'leave_balance_buckets',
    'leave_accrual_transactions',
    'leave_requests',
    'leave_request_allocations',
    'employment_leave_profiles',
    'employment_work_hour_entries'
  ] loop
    execute format(
      'alter table public.%I add column if not exists hr_group_id uuid',
      table_name
    );
  end loop;
end;
$$;

-- Kernrelaties worden vanuit de bestaande, gecontroleerde administratie- en
-- dienstverbandkoppelingen gevuld. Configuratie blijft groepsbreed; transacties
-- behouden daarnaast hun employment_id.
update public.employees employee
set hr_group_id = coalesce(
  (
    select administration.hr_group_id
    from public.employee_administration_assignments assignment
    join public.administrations administration
      on administration.tenant_id = assignment.tenant_id
     and administration.id = assignment.administration_id
    where assignment.tenant_id = employee.tenant_id
      and assignment.employee_id = employee.id
    order by assignment.effective_from, assignment.id
    limit 1
  ),
  (
    select group_row.id
    from public.hr_groups group_row
    where group_row.tenant_id = employee.tenant_id
      and group_row.code = 'DEFAULT'
  )
)
where employee.hr_group_id is null;

update public.departments department
set hr_group_id = coalesce(
  (
    select administration.hr_group_id
    from public.administrations administration
    where administration.tenant_id = department.tenant_id
      and administration.id = department.administration_id
  ),
  (
    select group_row.id
    from public.hr_groups group_row
    where group_row.tenant_id = department.tenant_id
      and group_row.code = 'DEFAULT'
  )
)
where department.hr_group_id is null;

update public.employments employment
set hr_group_id = administration.hr_group_id
from public.administrations administration
where administration.tenant_id = employment.tenant_id
  and administration.id = employment.administration_id
  and employment.hr_group_id is null;

update public.employee_administration_assignments assignment
set hr_group_id = administration.hr_group_id
from public.administrations administration
where administration.tenant_id = assignment.tenant_id
  and administration.id = assignment.administration_id
  and assignment.hr_group_id is null;

update public.department_management assignment
set hr_group_id = department.hr_group_id
from public.departments department
where department.tenant_id = assignment.tenant_id
  and department.id = assignment.department_id
  and assignment.hr_group_id is null;

update public.employee_organizations placement
set hr_group_id = coalesce(
  (
    select employment.hr_group_id
    from public.employments employment
    where employment.tenant_id = placement.tenant_id
      and employment.id = placement.employment_id
  ),
  (
    select department.hr_group_id
    from public.departments department
    where department.tenant_id = placement.tenant_id
      and department.id = placement.department_id
  ),
  (
    select employee.hr_group_id
    from public.employees employee
    where employee.tenant_id = placement.tenant_id
      and employee.id = placement.employee_id
  )
)
where placement.hr_group_id is null;

-- Functiecatalogi waren in de vorige slice tenant-owned. De nieuwe doelgrens
-- is HR-groep-owned; de bestaande testcatalogus krijgt de defaultgroep zonder
-- ids of relaties te vervangen.
update public.job_groups job_group
set hr_group_id = group_row.id
from public.hr_groups group_row
where group_row.tenant_id = job_group.tenant_id
  and group_row.code = 'DEFAULT'
  and job_group.hr_group_id is null;

update public.jobs job
set hr_group_id = job_group.hr_group_id
from public.job_groups job_group
where job_group.tenant_id = job.tenant_id
  and job_group.id = job.job_group_id
  and job.hr_group_id is null;

update public.job_revisions revision
set hr_group_id = job.hr_group_id
from public.jobs job
where job.tenant_id = revision.tenant_id
  and job.id = revision.job_id
  and revision.hr_group_id is null;

update public.job_group_jobs link
set hr_group_id = job_group.hr_group_id
from public.job_groups job_group
where job_group.tenant_id = link.tenant_id
  and job_group.id = link.job_group_id
  and link.hr_group_id is null;

-- De ledger en rollover-items zijn append-only voor runtime-mutaties. De
-- eenmalige scope-backfill is metadata-migratie en wordt daarom uitgevoerd
-- tussen het tijdelijk verwijderen en direct herstellen van die triggers.
drop trigger if exists leave_transactions_append_only on public.leave_accrual_transactions;
drop trigger if exists leave_rollover_items_append_only on public.leave_year_rollover_items;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'administration_company_data',
    'administration_locations',
    'labor_condition_sets',
    'employment_contracts',
    'employment_labor_conditions',
    'absence_settings',
    'absence_cases',
    'absence_task_templates',
    'leave_settings',
    'leave_types',
    'work_hour_types',
    'leave_profiles',
    'leave_accrual_rules',
    'leave_accrual_exceptions',
    'leave_accrual_rule_pause_types',
    'leave_accrual_rule_work_hour_types',
    'leave_bonus_rules',
    'leave_bonus_tiers',
    'leave_priority_rules',
    'leave_priority_rule_items',
    'leave_year_controls',
    'leave_year_rollovers',
    'leave_year_rollover_items',
    'leave_balance_buckets',
    'leave_accrual_transactions',
    'leave_requests',
    'leave_request_allocations',
    'employment_leave_profiles',
    'employment_work_hour_entries'
  ] loop
    execute format(
      'update public.%I target set hr_group_id = administration.hr_group_id
       from public.administrations administration
       where target.tenant_id = administration.tenant_id
         and target.administration_id = administration.id
         and target.hr_group_id is null',
      table_name
    );
  end loop;
end;
$$;

update public.absence_spells spell
set hr_group_id = absence_case.hr_group_id
from public.absence_cases absence_case
where absence_case.tenant_id = spell.tenant_id
  and absence_case.id = spell.case_id
  and spell.hr_group_id is null;

update public.absence_capacity_changes capacity_change
set hr_group_id = absence_case.hr_group_id
from public.absence_cases absence_case
where absence_case.tenant_id = capacity_change.tenant_id
  and absence_case.id = capacity_change.case_id
  and capacity_change.hr_group_id is null;

update public.absence_mutations mutation
set hr_group_id = coalesce(
  (
    select absence_case.hr_group_id
    from public.absence_cases absence_case
    where absence_case.tenant_id = mutation.tenant_id
      and absence_case.id = mutation.result_case_id
  ),
  (
    select group_row.id
    from public.hr_groups group_row
    where group_row.tenant_id = mutation.tenant_id
      and group_row.code = 'DEFAULT'
  )
)
where mutation.hr_group_id is null;

commit;
