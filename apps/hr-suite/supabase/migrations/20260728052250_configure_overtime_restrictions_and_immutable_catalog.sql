-- Overwerkbeheer: immutable catalogus, globale beperking en medewerkeruitzonderingen.

create type public.overtime_limit_mode as enum (
  'UNLIMITED',
  'MONTHLY_HOURS',
  'YEARLY_HOURS',
  'CONTRACT_HOURS_FACTOR'
);

create table public.overtime_type_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  work_hour_type_id uuid not null,
  notify_manager_on_entry boolean not null default false,
  is_self_service boolean not null default true,
  limit_mode public.overtime_limit_mode not null default 'UNLIMITED',
  limit_hours numeric(12,4),
  contract_hours_factor numeric(12,6),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint overtime_type_settings_scope_fkey
    foreign key (tenant_id, administration_id, work_hour_type_id)
    references public.work_hour_types(tenant_id, administration_id, id) on delete cascade,
  constraint overtime_type_settings_type_check
    check (limit_mode in ('UNLIMITED', 'MONTHLY_HOURS', 'YEARLY_HOURS', 'CONTRACT_HOURS_FACTOR')),
  constraint overtime_type_settings_limit_values_check check (
    ((limit_mode = 'UNLIMITED' or limit_mode = 'CONTRACT_HOURS_FACTOR') and limit_hours is null)
    or ((limit_mode = 'MONTHLY_HOURS' or limit_mode = 'YEARLY_HOURS') and limit_hours is not null and limit_hours >= 0)
  ),
  constraint overtime_type_settings_factor_values_check check (
    (limit_mode = 'CONTRACT_HOURS_FACTOR' and contract_hours_factor is not null and contract_hours_factor >= 0)
    or (limit_mode <> 'CONTRACT_HOURS_FACTOR' and contract_hours_factor is null)
  ),
  unique (tenant_id, administration_id, work_hour_type_id),
  unique (tenant_id, administration_id, id)
);

create table public.overtime_type_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  work_hour_type_id uuid not null,
  employee_id uuid not null,
  allow_overtime_entry boolean not null default true,
  is_self_service boolean not null default true,
  limit_mode public.overtime_limit_mode not null default 'UNLIMITED',
  limit_hours numeric(12,4),
  contract_hours_factor numeric(12,6),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint overtime_type_exceptions_scope_fkey
    foreign key (tenant_id, administration_id, work_hour_type_id)
    references public.work_hour_types(tenant_id, administration_id, id) on delete cascade,
  constraint overtime_type_exceptions_employee_fkey
    foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id) on delete cascade,
  constraint overtime_type_exceptions_limit_values_check check (
    ((limit_mode = 'UNLIMITED' or limit_mode = 'CONTRACT_HOURS_FACTOR') and limit_hours is null)
    or ((limit_mode = 'MONTHLY_HOURS' or limit_mode = 'YEARLY_HOURS') and limit_hours is not null and limit_hours >= 0)
  ),
  constraint overtime_type_exceptions_factor_values_check check (
    (limit_mode = 'CONTRACT_HOURS_FACTOR' and contract_hours_factor is not null and contract_hours_factor >= 0)
    or (limit_mode <> 'CONTRACT_HOURS_FACTOR' and contract_hours_factor is null)
  ),
  unique (tenant_id, administration_id, work_hour_type_id, employee_id),
  unique (tenant_id, administration_id, id)
);

create index overtime_type_exceptions_employee_idx
  on public.overtime_type_exceptions (tenant_id, administration_id, employee_id, work_hour_type_id);

create or replace function internal_security.prevent_leave_catalog_identity_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op <> 'UPDATE' then
    raise exception using errcode = '55000', message = 'LEAVE_CATALOG_IMMUTABLE';
  end if;

  if tg_table_name = 'leave_types' then
    if old.tenant_id is distinct from new.tenant_id
      or old.administration_id is distinct from new.administration_id
      or old.name is distinct from new.name
      or old.color_code is distinct from new.color_code
      or old.scope is distinct from new.scope
      or old.is_system is distinct from new.is_system
      or old.is_self_service is distinct from new.is_self_service
      or old.entitlement_mode is distinct from new.entitlement_mode
      or old.annual_hours_cap is distinct from new.annual_hours_cap
      or old.weekly_hours_cap_factor is distinct from new.weekly_hours_cap_factor then
      raise exception using errcode = '55000', message = 'LEAVE_CATALOG_IMMUTABLE';
    end if;
  else
    if old.tenant_id is distinct from new.tenant_id
      or old.administration_id is distinct from new.administration_id
      or old.name is distinct from new.name
      or old.color_code is distinct from new.color_code
      or old.category is distinct from new.category then
      raise exception using errcode = '55000', message = 'LEAVE_CATALOG_IMMUTABLE';
    end if;
  end if;
  return new;
end;
$$;

create or replace function internal_security.prevent_leave_accrual_rule_identity_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'LEAVE_ACCRUAL_RULE_IMMUTABLE';
  end if;
  if old.tenant_id is distinct from new.tenant_id
    or old.administration_id is distinct from new.administration_id
    or old.leave_profile_id is distinct from new.leave_profile_id
    or old.leave_type_id is distinct from new.leave_type_id
    or old.predecessor_rule_id is distinct from new.predecessor_rule_id
    or old.valid_from is distinct from new.valid_from
    or old.accrual_basis is distinct from new.accrual_basis
    or old.accrual_frequency is distinct from new.accrual_frequency
    or old.accrual_timing is distinct from new.accrual_timing
    or old.accrual_amount is distinct from new.accrual_amount
    or old.accrual_rate is distinct from new.accrual_rate
    or old.expiration_months is distinct from new.expiration_months
    or (old.valid_until is not null and old.valid_until is distinct from new.valid_until)
    or (new.valid_until is not null and new.valid_until <= old.valid_from) then
    raise exception using errcode = '55000', message = 'LEAVE_ACCRUAL_RULE_IMMUTABLE';
  end if;
  return new;
end;
$$;

create or replace function internal_security.validate_overtime_exception_employee()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not exists (
    select 1
    from public.employee_administration_assignments assignment
    where assignment.tenant_id = new.tenant_id
      and assignment.administration_id = new.administration_id
      and assignment.employee_id = new.employee_id
      and assignment.effective_from <= current_date
      and (assignment.effective_to is null or assignment.effective_to >= current_date)
  ) then
    raise exception using errcode = '23514', message = 'OVERTIME_EXCEPTION_EMPLOYEE_NOT_IN_ADMINISTRATION';
  end if;
  return new;
end;
$$;

create trigger leave_types_identity_immutable
before update on public.leave_types
for each row execute function internal_security.prevent_leave_catalog_identity_mutation();
create trigger work_hour_types_identity_immutable
before update on public.work_hour_types
for each row execute function internal_security.prevent_leave_catalog_identity_mutation();
create trigger leave_accrual_rules_identity_immutable
before update or delete on public.leave_accrual_rules
for each row execute function internal_security.prevent_leave_accrual_rule_identity_mutation();
create trigger overtime_type_settings_updated
before update on public.overtime_type_settings
for each row execute function internal_security.set_updated_at();
create trigger overtime_type_exceptions_updated
before update on public.overtime_type_exceptions
for each row execute function internal_security.set_updated_at();
create trigger overtime_type_exceptions_employee_valid
before insert or update on public.overtime_type_exceptions
for each row execute function internal_security.validate_overtime_exception_employee();

create trigger audit_overtime_type_settings after insert or update or delete on public.overtime_type_settings
for each row execute function internal_security.audit_configuration_change('overtime_type_settings');
create trigger audit_overtime_type_exceptions after insert or update or delete on public.overtime_type_exceptions
for each row execute function internal_security.audit_configuration_change('overtime_type_exception');

alter table public.overtime_type_settings enable row level security;
alter table public.overtime_type_exceptions enable row level security;

create policy overtime_type_settings_read on public.overtime_type_settings for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:read')));
create policy overtime_type_settings_write on public.overtime_type_settings for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy overtime_type_settings_update on public.overtime_type_settings for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));

create policy overtime_type_exceptions_read on public.overtime_type_exceptions for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:read')));
create policy overtime_type_exceptions_write on public.overtime_type_exceptions for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy overtime_type_exceptions_update on public.overtime_type_exceptions for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy overtime_type_exceptions_delete on public.overtime_type_exceptions for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));

grant select, insert, update on table public.overtime_type_settings to authenticated;
grant select, insert, update, delete on table public.overtime_type_exceptions to authenticated;
revoke all on function internal_security.prevent_leave_catalog_identity_mutation() from public, anon, authenticated;
revoke all on function internal_security.prevent_leave_accrual_rule_identity_mutation() from public, anon, authenticated;
revoke all on function internal_security.validate_overtime_exception_employee() from public, anon, authenticated;

insert into public.overtime_type_settings (tenant_id, administration_id, work_hour_type_id)
select tenant_id, administration_id, id
from public.work_hour_types
where category = 'OVERTIME'
on conflict (tenant_id, administration_id, work_hour_type_id) do nothing;
