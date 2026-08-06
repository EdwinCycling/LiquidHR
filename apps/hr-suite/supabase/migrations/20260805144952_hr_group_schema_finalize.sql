begin;

-- Herstel de append-only triggers direct na de eenmalige groepsscope-backfill.
create trigger leave_transactions_append_only
before update or delete on public.leave_accrual_transactions
for each row execute function internal_security.prevent_leave_transaction_mutation();
create trigger leave_rollover_items_append_only
before update or delete on public.leave_year_rollover_items
for each row execute function internal_security.prevent_leave_transaction_mutation();

-- De groep is onderdeel van iedere nieuwe employment-scoped record. De
-- bestaande records worden eerst volledig gevuld, daarna worden de kolommen
-- verplicht en immutable gemaakt.
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
    execute format('alter table public.%I alter column hr_group_id set not null', table_name);
  end loop;
end;
$$;

drop index if exists public.employees_tenant_auth_user_idx;

create unique index employees_tenant_hr_group_auth_user_idx
  on public.employees (tenant_id, hr_group_id, auth_user_id)
  where auth_user_id is not null and deleted_at is null;

create unique index employees_tenant_hr_group_id_key
  on public.employees (tenant_id, hr_group_id, id);
create unique index departments_tenant_hr_group_id_key
  on public.departments (tenant_id, hr_group_id, id);
create unique index employments_tenant_hr_group_id_key
  on public.employments (tenant_id, hr_group_id, id);
create unique index absence_cases_tenant_hr_group_id_key
  on public.absence_cases (tenant_id, hr_group_id, id);
create unique index absence_spells_tenant_hr_group_id_key
  on public.absence_spells (tenant_id, hr_group_id, id);
create unique index administration_locations_tenant_hr_group_id_key
  on public.administration_locations (tenant_id, hr_group_id, id);
create unique index labor_condition_sets_tenant_hr_group_id_key
  on public.labor_condition_sets (tenant_id, hr_group_id, id);
create unique index employment_contracts_tenant_hr_group_employment_id_key
  on public.employment_contracts (tenant_id, hr_group_id, employment_id, id);
create unique index employment_labor_conditions_tenant_hr_group_id_key
  on public.employment_labor_conditions (tenant_id, hr_group_id, id);

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
      'alter table public.%I add constraint %I foreign key (tenant_id, hr_group_id)
       references public.hr_groups(tenant_id, id) on delete restrict',
      table_name,
      left(table_name || '_hr_group_fkey', 63)
    );
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create index %I on public.%I (tenant_id, hr_group_id)',
      left(table_name || '_tenant_hr_group_idx', 63),
      table_name
    );
    execute format(
      'drop trigger if exists %I on public.%I',
      left('prevent_' || table_name || '_hr_group_change', 63),
      table_name
    );
    execute format(
      'create trigger %I before update of hr_group_id on public.%I
       for each row execute function internal_security.prevent_hr_group_change()',
      left('prevent_' || table_name || '_hr_group_change', 63),
      table_name
    );
  end loop;
end;
$$;

-- Bestaande personen, dienstverbanden, organisatieplaatsingen en
-- verzuimcasussen kunnen niet naar een andere HR-groep wijzen.
alter table public.employments
  add constraint employments_administration_hr_group_fkey
    foreign key (tenant_id, hr_group_id, administration_id)
    references public.administrations(tenant_id, hr_group_id, id)
    on delete restrict;

alter table public.labor_condition_sets
  add constraint labor_condition_sets_administration_hr_group_fkey
    foreign key (tenant_id, hr_group_id, administration_id)
    references public.administrations(tenant_id, hr_group_id, id)
    on delete restrict;

alter table public.employment_contracts
  add constraint employment_contracts_administration_hr_group_fkey
    foreign key (tenant_id, hr_group_id, administration_id)
    references public.administrations(tenant_id, hr_group_id, id)
    on delete restrict,
  add constraint employment_contracts_employment_hr_group_fkey
    foreign key (tenant_id, hr_group_id, employment_id)
    references public.employments(tenant_id, hr_group_id, id)
    on delete cascade,
  add constraint employment_contracts_labor_condition_hr_group_fkey
    foreign key (tenant_id, hr_group_id, labor_condition_set_id)
    references public.labor_condition_sets(tenant_id, hr_group_id, id)
    on delete restrict;

alter table public.employment_labor_conditions
  add constraint employment_labor_conditions_employment_hr_group_fkey
    foreign key (tenant_id, hr_group_id, employment_id)
    references public.employments(tenant_id, hr_group_id, id)
    on delete cascade,
  add constraint employment_labor_conditions_contract_hr_group_fkey
    foreign key (tenant_id, hr_group_id, employment_id, employment_contract_id)
    references public.employment_contracts(tenant_id, hr_group_id, employment_id, id)
    on delete cascade;

alter table public.employee_organizations
  add constraint employee_organizations_employment_hr_group_fkey
    foreign key (tenant_id, hr_group_id, employment_id)
    references public.employments(tenant_id, hr_group_id, id)
    on delete restrict;

alter table public.absence_cases
  add constraint absence_cases_employment_hr_group_fkey
    foreign key (tenant_id, hr_group_id, employment_id)
    references public.employments(tenant_id, hr_group_id, id)
    on delete restrict;

alter table public.absence_spells
  add constraint absence_spells_case_hr_group_fkey
    foreign key (tenant_id, hr_group_id, case_id)
    references public.absence_cases(tenant_id, hr_group_id, id)
    on delete cascade;

alter table public.absence_capacity_changes
  add constraint absence_capacity_case_hr_group_fkey
    foreign key (tenant_id, hr_group_id, case_id)
    references public.absence_cases(tenant_id, hr_group_id, id)
    on delete cascade,
  add constraint absence_capacity_spell_hr_group_fkey
    foreign key (tenant_id, hr_group_id, spell_id)
    references public.absence_spells(tenant_id, hr_group_id, id)
    on delete cascade;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'leave_accrual_exceptions',
    'leave_accrual_transactions',
    'leave_balance_buckets',
    'leave_requests',
    'leave_request_allocations',
    'leave_year_rollover_items',
    'employment_leave_profiles',
    'employment_work_hour_entries'
  ] loop
    execute format(
      'alter table public.%I add constraint %I foreign key (tenant_id, hr_group_id, employment_id)
       references public.employments(tenant_id, hr_group_id, id) on delete restrict',
      table_name,
      left(table_name || '_employment_hr_group_fkey', 63)
    );
  end loop;
end;
$$;

-- De accountrelatie is de basis voor de komende contextslice. Een tenant-scope
-- blijft in user_access bestaan als bestaand autorisatiebegrip; de expliciete
-- groepsrelatie wordt daarnaast vastgelegd in de nieuwe koppeltabel.
alter table public.user_access
  add column if not exists hr_group_id uuid;

update public.user_access access
set hr_group_id = administration.hr_group_id
from public.administrations administration
where access.scope_type = 'ADMINISTRATION'
  and administration.tenant_id = access.tenant_id
  and administration.id = access.administration_id
  and access.hr_group_id is null;

alter table public.user_access
  add constraint user_access_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict,
  add constraint user_access_hr_group_scope_check
    check (
      (scope_type = 'TENANT' and hr_group_id is null)
      or (scope_type = 'ADMINISTRATION' and hr_group_id is not null)
    );

create table public.user_hr_group_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null,
  hr_group_id uuid not null,
  management_role_id uuid not null references public.management_roles(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_hr_group_access_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict,
  constraint user_hr_group_access_scope_key
    unique (user_id, tenant_id, hr_group_id, management_role_id)
);

create index user_hr_group_access_user_tenant_idx
  on public.user_hr_group_access (user_id, tenant_id, is_active);

create trigger set_user_hr_group_access_updated_at
before update on public.user_hr_group_access
for each row execute function internal_security.set_updated_at();

create trigger audit_user_hr_group_access
after insert or update or delete on public.user_hr_group_access
for each row execute function internal_security.audit_configuration_change('user_hr_group_access');

insert into public.user_hr_group_access (user_id, tenant_id, hr_group_id, management_role_id)
select distinct
  access.user_id,
  access.tenant_id,
  group_row.id,
  access.management_role_id
from public.user_access access
join public.hr_groups group_row
  on group_row.tenant_id = access.tenant_id
left join public.administrations administration
  on administration.tenant_id = access.tenant_id
 and administration.id = access.administration_id
where access.is_active
  and (
    access.scope_type = 'TENANT'
    or administration.hr_group_id = group_row.id
  )
on conflict (user_id, tenant_id, hr_group_id, management_role_id) do update
set is_active = true,
    updated_at = timezone('utc', now());

create or replace function internal_security.has_hr_group_access(
  requested_tenant_id uuid,
  requested_hr_group_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.user_hr_group_access access
      join public.hr_groups group_row
        on group_row.tenant_id = access.tenant_id
       and group_row.id = access.hr_group_id
      where access.user_id = (select auth.uid())
        and access.tenant_id = requested_tenant_id
        and access.hr_group_id = requested_hr_group_id
        and access.is_active
        and group_row.is_active
    );
$$;

create or replace function internal_security.current_user_has_hr_group_permission(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.user_hr_group_access access
      join public.management_roles role
        on role.id = access.management_role_id
      join public.role_permissions role_permission
        on role_permission.management_role_id = role.id
      join public.permissions permission
        on permission.id = role_permission.permission_id
      where access.user_id = (select auth.uid())
        and access.tenant_id = requested_tenant_id
        and access.hr_group_id = requested_hr_group_id
        and access.is_active
        and permission.code = requested_permission_code
        and (role.tenant_id is null or role.tenant_id = requested_tenant_id)
    );
$$;

revoke all on function internal_security.has_hr_group_access(uuid, uuid) from public, anon, authenticated;
revoke all on function internal_security.current_user_has_hr_group_permission(uuid, uuid, text) from public, anon, authenticated;
grant execute on function internal_security.has_hr_group_access(uuid, uuid) to authenticated;
grant execute on function internal_security.current_user_has_hr_group_permission(uuid, uuid, text) to authenticated;

insert into public.permissions (code, name, category, description)
values
  ('hr-group:read', 'HR-groepen lezen', 'HR-groepen', 'Leest toegestane HR-groepen binnen de tenant.'),
  ('hr-group:write', 'HR-groepen beheren', 'HR-groepen', 'Beheert HR-groepen via de bevoegde Control Plane.')
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.tenant_id is null
  and role.code = 'TENANT_ADMIN'
  and permission.code = 'hr-group:read'
on conflict do nothing;

alter table public.hr_groups enable row level security;
alter table public.user_hr_group_access enable row level security;

create policy hr_groups_select_scoped
on public.hr_groups for select to authenticated
using ((select internal_security.has_hr_group_access(tenant_id, id)));

create policy hr_groups_insert_authorized
on public.hr_groups for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'hr-group:write')));

create policy hr_groups_update_authorized
on public.hr_groups for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'hr-group:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'hr-group:write')));

create policy hr_groups_delete_authorized
on public.hr_groups for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'hr-group:write')));

create policy user_hr_group_access_select_own
on public.user_hr_group_access for select to authenticated
using ((select auth.uid()) = user_id and is_active);

grant select, insert, update, delete on public.hr_groups to authenticated;
grant select on public.user_hr_group_access to authenticated;

-- De nieuwe grens is restrictive zodat bestaande permissiepolicies niet per
-- ongeluk een cross-group rij kunnen openen of schrijven.
do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'administrations',
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
    policy_name := left(table_name || '_hr_group_boundary', 63);
    execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated
       using ((select internal_security.has_hr_group_access(tenant_id, hr_group_id)))
       with check ((select internal_security.has_hr_group_access(tenant_id, hr_group_id)))',
      policy_name,
      table_name
    );
  end loop;
end;
$$;

-- Bewijs dat de testmigratie geen ongeldige group-scope heeft achtergelaten.
do $$
begin
  if exists (
    select 1
    from public.administrations administration
    left join public.hr_groups group_row
      on group_row.tenant_id = administration.tenant_id
     and group_row.id = administration.hr_group_id
    where group_row.id is null
  ) then
    raise exception 'HR_GROUP_MIGRATION_ADMINISTRATION_SCOPE_INVALID';
  end if;

  if exists (
    select 1
    from public.employments employment
    join public.administrations administration
      on administration.tenant_id = employment.tenant_id
     and administration.id = employment.administration_id
    where employment.hr_group_id <> administration.hr_group_id
  ) then
    raise exception 'HR_GROUP_MIGRATION_EMPLOYMENT_SCOPE_INVALID';
  end if;

  if exists (
    select 1
    from public.absence_cases absence_case
    join public.employments employment
      on employment.tenant_id = absence_case.tenant_id
     and employment.id = absence_case.employment_id
    where absence_case.hr_group_id <> employment.hr_group_id
  ) then
    raise exception 'HR_GROUP_MIGRATION_ABSENCE_SCOPE_INVALID';
  end if;
end;
$$;

comment on table public.hr_groups is
  'Primaire HR-context en harde zichtbaarheid- en inrichtingsgrens binnen een tenant.';
comment on column public.employees.hr_group_id is
  'Persoonskaart bestaat precies eenmaal binnen deze HR-groep.';
comment on column public.employments.hr_group_id is
  'Dienstverband hoort bij dezelfde HR-groep als de administratie.';

commit;
