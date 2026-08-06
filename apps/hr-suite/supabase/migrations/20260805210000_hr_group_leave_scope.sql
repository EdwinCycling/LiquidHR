begin;

-- Stap 7 maakt de inrichting groepsbreed. administration_id blijft alleen als
-- nullable technische herkomstmetadata bestaan op catalogi; de scope wordt
-- uitsluitend door tenant_id + hr_group_id afgedwongen.
alter table public.leave_profiles
  add column if not exists is_group_default boolean not null default false;

with ranked_profiles as (
  select id,
         row_number() over (
           partition by tenant_id, hr_group_id
           order by is_active desc, created_at, id
         ) as profile_rank
  from public.leave_profiles
)
update public.leave_profiles profile
set is_group_default = true
from ranked_profiles ranked
where ranked.id = profile.id
  and ranked.profile_rank = 1
  and not exists (
    select 1
    from public.leave_profiles existing
    where existing.tenant_id = profile.tenant_id
      and existing.hr_group_id = profile.hr_group_id
      and existing.is_group_default
  );

create unique index if not exists leave_profiles_one_group_default_key
  on public.leave_profiles (tenant_id, hr_group_id)
  where is_group_default;

-- Group-owned parents need a composite key before child FKs can stop using
-- administration_id.
create unique index if not exists leave_settings_tenant_hr_group_id_key
  on public.leave_settings (tenant_id, hr_group_id, id);
create unique index if not exists leave_year_controls_tenant_hr_group_id_key
  on public.leave_year_controls (tenant_id, hr_group_id, id);
create unique index if not exists leave_types_tenant_hr_group_id_key
  on public.leave_types (tenant_id, hr_group_id, id);
create unique index if not exists work_hour_types_tenant_hr_group_id_key
  on public.work_hour_types (tenant_id, hr_group_id, id);
create unique index if not exists leave_profiles_tenant_hr_group_id_key
  on public.leave_profiles (tenant_id, hr_group_id, id);
create unique index if not exists leave_accrual_rules_tenant_hr_group_id_key
  on public.leave_accrual_rules (tenant_id, hr_group_id, id);
create unique index if not exists leave_bonus_rules_tenant_hr_group_id_key
  on public.leave_bonus_rules (tenant_id, hr_group_id, id);
create unique index if not exists leave_priority_rules_tenant_hr_group_id_key
  on public.leave_priority_rules (tenant_id, hr_group_id, id);
create unique index if not exists leave_year_rollovers_tenant_hr_group_id_key
  on public.leave_year_rollovers (tenant_id, hr_group_id, id);
create unique index if not exists leave_requests_tenant_hr_group_id_key
  on public.leave_requests (tenant_id, hr_group_id, id);

-- Group-owned tables no longer require an administration identity. Existing
-- values are retained as historical metadata; new group writes may leave them
-- null and never use them for authorization or lookup.
alter table public.leave_settings alter column administration_id drop not null;
alter table public.leave_year_controls alter column administration_id drop not null;
alter table public.leave_types alter column administration_id drop not null;
alter table public.work_hour_types alter column administration_id drop not null;
alter table public.leave_profiles alter column administration_id drop not null;
alter table public.leave_accrual_rules alter column administration_id drop not null;
alter table public.leave_accrual_rule_work_hour_types alter column administration_id drop not null;
alter table public.leave_accrual_rule_pause_types alter column administration_id drop not null;
alter table public.leave_bonus_rules alter column administration_id drop not null;
alter table public.leave_bonus_tiers alter column administration_id drop not null;
alter table public.leave_priority_rules alter column administration_id drop not null;
alter table public.leave_priority_rule_items alter column administration_id drop not null;
alter table public.leave_year_rollovers alter column administration_id drop not null;
alter table public.leave_year_rollover_items alter column administration_id drop not null;

alter table public.leave_settings drop constraint if exists leave_settings_administration_fkey;
alter table public.leave_year_controls drop constraint if exists leave_year_controls_administration_fkey;
alter table public.leave_types drop constraint if exists leave_types_administration_fkey;
alter table public.work_hour_types drop constraint if exists work_hour_types_administration_fkey;
alter table public.leave_profiles drop constraint if exists leave_profiles_administration_fkey;
alter table public.leave_year_rollovers drop constraint if exists leave_year_rollovers_administration_fkey;

-- Overtime settings belong to the same group-wide work-hour catalog. An
-- overtime exception remains employee-specific, but is group-bound as well.
alter table public.overtime_type_settings add column if not exists hr_group_id uuid;
update public.overtime_type_settings setting
set hr_group_id = type.hr_group_id
from public.work_hour_types type
where type.tenant_id = setting.tenant_id
  and type.id = setting.work_hour_type_id
  and setting.hr_group_id is null;
alter table public.overtime_type_settings alter column hr_group_id set not null;
alter table public.overtime_type_settings drop constraint if exists overtime_type_settings_scope_fkey;
alter table public.overtime_type_settings alter column administration_id drop not null;
alter table public.overtime_type_exceptions add column if not exists hr_group_id uuid;
update public.overtime_type_exceptions exception_row
set hr_group_id = employee.hr_group_id
from public.employees employee
where employee.tenant_id = exception_row.tenant_id
  and employee.id = exception_row.employee_id
  and exception_row.hr_group_id is null;
alter table public.overtime_type_exceptions alter column hr_group_id set not null;
alter table public.overtime_type_exceptions alter column administration_id drop not null;
alter table public.overtime_type_exceptions drop constraint if exists overtime_type_exceptions_scope_fkey;

create unique index if not exists overtime_type_settings_tenant_hr_group_id_key
  on public.overtime_type_settings (tenant_id, hr_group_id, id);
create unique index if not exists overtime_type_settings_group_type_key
  on public.overtime_type_settings (tenant_id, hr_group_id, work_hour_type_id);
create unique index if not exists overtime_type_exceptions_tenant_hr_group_id_key
  on public.overtime_type_exceptions (tenant_id, hr_group_id, id);

create table if not exists public.employee_sets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hr_group_id uuid not null,
  leave_profile_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text check (description is null or char_length(description) <= 500),
  priority smallint not null default 100 check (priority between 1 and 32767),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employee_sets_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete restrict,
  constraint employee_sets_profile_fkey
    foreign key (tenant_id, hr_group_id, leave_profile_id)
    references public.leave_profiles(tenant_id, hr_group_id, id) on delete restrict,
  unique (tenant_id, hr_group_id, id),
  unique (tenant_id, hr_group_id, name)
);

create table if not exists public.employee_set_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hr_group_id uuid not null,
  employee_set_id uuid not null,
  employee_id uuid not null,
  valid_from date not null default current_date,
  valid_until date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint employee_set_members_period_valid
    check (valid_until is null or valid_until > valid_from),
  constraint employee_set_members_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete restrict,
  constraint employee_set_members_set_fkey
    foreign key (tenant_id, hr_group_id, employee_set_id)
    references public.employee_sets(tenant_id, hr_group_id, id) on delete cascade,
  constraint employee_set_members_employee_fkey
    foreign key (tenant_id, hr_group_id, employee_id)
    references public.employees(tenant_id, hr_group_id, id) on delete cascade,
  unique (tenant_id, hr_group_id, employee_set_id, employee_id, valid_from)
);

create index if not exists employee_sets_group_active_idx
  on public.employee_sets (tenant_id, hr_group_id, is_active, priority, name);
create index if not exists employee_set_members_employee_period_idx
  on public.employee_set_members (tenant_id, hr_group_id, employee_id, valid_from, valid_until);
create index if not exists employee_set_members_set_period_idx
  on public.employee_set_members (tenant_id, hr_group_id, employee_set_id, valid_from, valid_until);

-- Switch all catalog FKs from the old administration composite to the group
-- composite. Employment-scoped tables retain their employment/admin FK.
alter table public.employment_leave_profiles drop constraint if exists employment_leave_profiles_profile_fkey;
alter table public.leave_accrual_rules drop constraint if exists leave_accrual_rules_profile_fkey;
alter table public.leave_accrual_rules drop constraint if exists leave_accrual_rules_type_fkey;
alter table public.leave_accrual_rule_work_hour_types drop constraint if exists leave_accrual_rule_work_hour_types_rule_fkey;
alter table public.leave_accrual_rule_work_hour_types drop constraint if exists leave_accrual_rule_work_hour_types_type_fkey;
alter table public.leave_accrual_rule_pause_types drop constraint if exists leave_accrual_rule_pause_types_rule_fkey;
alter table public.leave_accrual_rule_pause_types drop constraint if exists leave_accrual_rule_pause_types_type_fkey;
alter table public.leave_accrual_exceptions drop constraint if exists leave_accrual_exceptions_type_fkey;
alter table public.leave_bonus_rules drop constraint if exists leave_bonus_rules_profile_fkey;
alter table public.leave_bonus_rules drop constraint if exists leave_bonus_rules_type_fkey;
alter table public.leave_bonus_tiers drop constraint if exists leave_bonus_tiers_rule_fkey;
alter table public.leave_priority_rules drop constraint if exists leave_priority_rules_profile_fkey;
alter table public.leave_priority_rule_items drop constraint if exists leave_priority_rule_items_rule_fkey;
alter table public.leave_priority_rule_items drop constraint if exists leave_priority_rule_items_type_fkey;
alter table public.employment_work_hour_entries drop constraint if exists employment_work_hour_entries_type_fkey;
alter table public.leave_balance_buckets drop constraint if exists leave_balance_buckets_type_fkey;
alter table public.leave_year_rollover_items drop constraint if exists leave_year_rollover_items_rollover_fkey;
alter table public.leave_year_rollover_items drop constraint if exists leave_year_rollover_items_type_fkey;
alter table public.leave_year_rollover_items drop constraint if exists leave_year_rollover_items_bucket_fkey;
alter table public.leave_year_rollover_items drop constraint if exists leave_year_rollover_items_employment_fkey;
alter table public.leave_requests drop constraint if exists leave_requests_priority_rule_fkey;
alter table public.leave_requests drop constraint if exists leave_requests_leave_type_fkey;
alter table public.leave_request_allocations drop constraint if exists leave_request_allocations_request_fkey;
alter table public.leave_request_allocations drop constraint if exists leave_request_allocations_type_fkey;
alter table public.leave_request_allocations drop constraint if exists leave_request_allocations_bucket_fkey;
alter table public.overtime_type_settings drop constraint if exists overtime_type_settings_scope_fkey;
alter table public.overtime_type_exceptions drop constraint if exists overtime_type_exceptions_scope_fkey;

create unique index if not exists leave_balance_buckets_tenant_hr_group_employment_type_id_key
  on public.leave_balance_buckets (tenant_id, hr_group_id, employment_id, leave_type_id, id);

alter table public.employment_leave_profiles
  add constraint employment_leave_profiles_profile_group_fkey
  foreign key (tenant_id, hr_group_id, leave_profile_id)
  references public.leave_profiles(tenant_id, hr_group_id, id) on delete restrict;
alter table public.leave_accrual_rules
  add constraint leave_accrual_rules_profile_group_fkey
  foreign key (tenant_id, hr_group_id, leave_profile_id)
  references public.leave_profiles(tenant_id, hr_group_id, id) on delete cascade;
alter table public.leave_accrual_rules
  add constraint leave_accrual_rules_type_group_fkey
  foreign key (tenant_id, hr_group_id, leave_type_id)
  references public.leave_types(tenant_id, hr_group_id, id) on delete restrict;
alter table public.leave_accrual_rule_work_hour_types
  add constraint leave_accrual_rule_work_hour_types_rule_group_fkey
  foreign key (tenant_id, hr_group_id, accrual_rule_id)
  references public.leave_accrual_rules(tenant_id, hr_group_id, id) on delete cascade;
alter table public.leave_accrual_rule_work_hour_types
  add constraint leave_accrual_rule_work_hour_types_type_group_fkey
  foreign key (tenant_id, hr_group_id, work_hour_type_id)
  references public.work_hour_types(tenant_id, hr_group_id, id) on delete restrict;
alter table public.leave_accrual_rule_pause_types
  add constraint leave_accrual_rule_pause_types_rule_group_fkey
  foreign key (tenant_id, hr_group_id, accrual_rule_id)
  references public.leave_accrual_rules(tenant_id, hr_group_id, id) on delete cascade;
alter table public.leave_accrual_rule_pause_types
  add constraint leave_accrual_rule_pause_types_type_group_fkey
  foreign key (tenant_id, hr_group_id, pause_leave_type_id)
  references public.leave_types(tenant_id, hr_group_id, id) on delete restrict;
alter table public.leave_accrual_exceptions
  add constraint leave_accrual_exceptions_type_group_fkey
  foreign key (tenant_id, hr_group_id, leave_type_id)
  references public.leave_types(tenant_id, hr_group_id, id) on delete restrict;
alter table public.leave_bonus_rules
  add constraint leave_bonus_rules_profile_group_fkey
  foreign key (tenant_id, hr_group_id, leave_profile_id)
  references public.leave_profiles(tenant_id, hr_group_id, id) on delete cascade;
alter table public.leave_bonus_rules
  add constraint leave_bonus_rules_type_group_fkey
  foreign key (tenant_id, hr_group_id, leave_type_id)
  references public.leave_types(tenant_id, hr_group_id, id) on delete restrict;
alter table public.leave_bonus_tiers
  add constraint leave_bonus_tiers_rule_group_fkey
  foreign key (tenant_id, hr_group_id, bonus_rule_id)
  references public.leave_bonus_rules(tenant_id, hr_group_id, id) on delete cascade;
alter table public.leave_priority_rules
  add constraint leave_priority_rules_profile_group_fkey
  foreign key (tenant_id, hr_group_id, leave_profile_id)
  references public.leave_profiles(tenant_id, hr_group_id, id) on delete cascade;
alter table public.leave_priority_rule_items
  add constraint leave_priority_rule_items_rule_group_fkey
  foreign key (tenant_id, hr_group_id, priority_rule_id)
  references public.leave_priority_rules(tenant_id, hr_group_id, id) on delete cascade;
alter table public.leave_priority_rule_items
  add constraint leave_priority_rule_items_type_group_fkey
  foreign key (tenant_id, hr_group_id, leave_type_id)
  references public.leave_types(tenant_id, hr_group_id, id) on delete restrict;
alter table public.employment_work_hour_entries
  add constraint employment_work_hour_entries_type_group_fkey
  foreign key (tenant_id, hr_group_id, work_hour_type_id)
  references public.work_hour_types(tenant_id, hr_group_id, id) on delete restrict;
alter table public.leave_balance_buckets
  add constraint leave_balance_buckets_type_group_fkey
  foreign key (tenant_id, hr_group_id, leave_type_id)
  references public.leave_types(tenant_id, hr_group_id, id) on delete restrict;
alter table public.leave_year_rollover_items
  add constraint leave_year_rollover_items_rollover_group_fkey
  foreign key (tenant_id, hr_group_id, rollover_id)
  references public.leave_year_rollovers(tenant_id, hr_group_id, id) on delete cascade;
alter table public.leave_year_rollover_items
  add constraint leave_year_rollover_items_employment_group_fkey
  foreign key (tenant_id, hr_group_id, employment_id)
  references public.employments(tenant_id, hr_group_id, id) on delete cascade;
alter table public.leave_year_rollover_items
  add constraint leave_year_rollover_items_type_group_fkey
  foreign key (tenant_id, hr_group_id, leave_type_id)
  references public.leave_types(tenant_id, hr_group_id, id) on delete restrict;
alter table public.leave_year_rollover_items
  add constraint leave_year_rollover_items_bucket_group_fkey
  foreign key (tenant_id, hr_group_id, employment_id, leave_type_id, source_bucket_id)
  references public.leave_balance_buckets(tenant_id, hr_group_id, employment_id, leave_type_id, id) on delete restrict;
alter table public.leave_requests
  add constraint leave_requests_priority_rule_group_fkey
  foreign key (tenant_id, hr_group_id, priority_rule_id)
  references public.leave_priority_rules(tenant_id, hr_group_id, id) on delete restrict;
alter table public.leave_requests
  add constraint leave_requests_leave_type_group_fkey
  foreign key (tenant_id, hr_group_id, leave_type_id)
  references public.leave_types(tenant_id, hr_group_id, id) on delete restrict;
alter table public.leave_request_allocations
  add constraint leave_request_allocations_request_group_fkey
  foreign key (tenant_id, hr_group_id, request_id)
  references public.leave_requests(tenant_id, hr_group_id, id) on delete cascade;
alter table public.leave_request_allocations
  add constraint leave_request_allocations_type_group_fkey
  foreign key (tenant_id, hr_group_id, leave_type_id)
  references public.leave_types(tenant_id, hr_group_id, id) on delete restrict;
alter table public.leave_request_allocations
  add constraint leave_request_allocations_bucket_group_fkey
  foreign key (tenant_id, hr_group_id, employment_id, leave_type_id, bucket_id)
  references public.leave_balance_buckets(tenant_id, hr_group_id, employment_id, leave_type_id, id) on delete restrict;
alter table public.overtime_type_settings
  add constraint overtime_type_settings_scope_group_fkey
  foreign key (tenant_id, hr_group_id, work_hour_type_id)
  references public.work_hour_types(tenant_id, hr_group_id, id) on delete cascade;
alter table public.overtime_type_exceptions
  add constraint overtime_type_exceptions_scope_group_fkey
  foreign key (tenant_id, hr_group_id, work_hour_type_id)
  references public.work_hour_types(tenant_id, hr_group_id, id) on delete cascade;

create index if not exists leave_types_group_active_name_idx
  on public.leave_types (tenant_id, hr_group_id, is_active, name);
create index if not exists work_hour_types_group_active_name_idx
  on public.work_hour_types (tenant_id, hr_group_id, category, is_active, name);
create index if not exists leave_profiles_group_active_name_idx
  on public.leave_profiles (tenant_id, hr_group_id, is_active, name);
create index if not exists leave_accrual_rules_group_profile_type_idx
  on public.leave_accrual_rules (tenant_id, hr_group_id, leave_profile_id, leave_type_id, valid_from);
create index if not exists leave_accrual_exceptions_group_employment_idx
  on public.leave_accrual_exceptions (tenant_id, hr_group_id, employment_id, leave_type_id, valid_from);
create index if not exists leave_balance_buckets_group_employment_idx
  on public.leave_balance_buckets (tenant_id, hr_group_id, employment_id, leave_type_id, expiration_date);
create index if not exists leave_accrual_transactions_group_employment_idx
  on public.leave_accrual_transactions (tenant_id, hr_group_id, employment_id, leave_type_id, transaction_date);
create index if not exists leave_requests_group_employment_idx
  on public.leave_requests (tenant_id, hr_group_id, employment_id, start_date, end_date);
create index if not exists overtime_type_exceptions_group_employee_idx
  on public.overtime_type_exceptions (tenant_id, hr_group_id, employee_id, work_hour_type_id);

-- Group-aware employee-set profile resolution implements the documented
-- precedence: employment assignment, employee set, group default.
create or replace function public.resolve_leave_profile_for_employment(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_employment_id uuid,
  requested_as_of_date date
)
returns uuid
language plpgsql
stable
security definer
set search_path = public, internal_security, auth
as $$
declare
  resolved_profile_id uuid;
  target_employee_id uuid;
begin
  select employment.employee_id
    into target_employee_id
  from public.employments employment
  where employment.tenant_id = requested_tenant_id
    and employment.hr_group_id = requested_hr_group_id
    and employment.id = requested_employment_id
    and employment.record_status = 'CONFIRMED'
    and employment.deleted_at is null;

  if target_employee_id is null then
    raise exception using errcode = '23503', message = 'LEAVE_EMPLOYMENT_NOT_FOUND';
  end if;

  select assignment.leave_profile_id
    into resolved_profile_id
  from public.employment_leave_profiles assignment
  where assignment.tenant_id = requested_tenant_id
    and assignment.hr_group_id = requested_hr_group_id
    and assignment.employment_id = requested_employment_id
    and assignment.valid_from <= requested_as_of_date
    and (assignment.valid_until is null or assignment.valid_until > requested_as_of_date)
  order by assignment.valid_from desc
  limit 1;

  if resolved_profile_id is null then
    select employee_set.leave_profile_id
      into resolved_profile_id
    from public.employee_set_members member
    join public.employee_sets employee_set
      on employee_set.tenant_id = member.tenant_id
     and employee_set.hr_group_id = member.hr_group_id
     and employee_set.id = member.employee_set_id
     and employee_set.is_active
    where member.tenant_id = requested_tenant_id
      and member.hr_group_id = requested_hr_group_id
      and member.employee_id = target_employee_id
      and member.valid_from <= requested_as_of_date
      and (member.valid_until is null or member.valid_until > requested_as_of_date)
    order by employee_set.priority, employee_set.name, employee_set.id
    limit 1;
  end if;

  if resolved_profile_id is null then
    select profile.id
      into resolved_profile_id
    from public.leave_profiles profile
    where profile.tenant_id = requested_tenant_id
      and profile.hr_group_id = requested_hr_group_id
      and profile.is_active
      and profile.is_group_default
    limit 1;
  end if;

  return resolved_profile_id;
end;
$$;

revoke all on function public.resolve_leave_profile_for_employment(uuid, uuid, uuid, date) from public, anon;
grant execute on function public.resolve_leave_profile_for_employment(uuid, uuid, uuid, date) to authenticated;

-- Rebuild leave policies. Keeping the old administration policies would make
-- them OR together with the new policies and leak group-wide rows.
do $$
declare
  relation_name text;
  policy_row record;
begin
  foreach relation_name in array array[
    'leave_settings', 'leave_year_controls', 'leave_types', 'work_hour_types',
    'leave_profiles', 'leave_accrual_rules', 'leave_accrual_rule_work_hour_types',
    'leave_accrual_rule_pause_types', 'leave_bonus_rules', 'leave_bonus_tiers',
    'leave_priority_rules', 'leave_priority_rule_items', 'leave_year_rollovers',
    'leave_year_rollover_items', 'employment_leave_profiles', 'leave_accrual_exceptions',
    'employment_work_hour_entries', 'leave_balance_buckets', 'leave_accrual_transactions',
    'leave_requests', 'leave_request_allocations', 'overtime_type_settings',
    'overtime_type_exceptions', 'employee_sets', 'employee_set_members'
  ]::text[] loop
    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = relation_name
    loop
      execute format('drop policy if exists %I on public.%I', policy_row.policyname, relation_name);
    end loop;
  end loop;
end;
$$;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'leave_settings', 'leave_year_controls', 'leave_types', 'work_hour_types',
    'leave_profiles', 'leave_accrual_rules', 'leave_accrual_rule_work_hour_types',
    'leave_accrual_rule_pause_types', 'leave_bonus_rules', 'leave_bonus_tiers',
    'leave_priority_rules', 'leave_priority_rule_items', 'employee_sets',
    'employee_set_members', 'overtime_type_settings'
  ]::text[] loop
    execute format('create policy %I_group_read on public.%I for select to authenticated using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''leave:read'')))', relation_name, relation_name);
    execute format('create policy %I_group_insert on public.%I for insert to authenticated with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''leave:write'')))', relation_name, relation_name);
    execute format('create policy %I_group_update on public.%I for update to authenticated using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''leave:write''))) with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''leave:write'')))', relation_name, relation_name);
    execute format('create policy %I_group_delete on public.%I for delete to authenticated using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''leave:write'')))', relation_name, relation_name);
  end loop;
end;
$$;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'employment_leave_profiles', 'leave_accrual_exceptions',
    'employment_work_hour_entries', 'overtime_type_exceptions'
  ]::text[] loop
    execute format('create policy %I_group_read on public.%I for select to authenticated using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''leave:read'')) or (employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id)) and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''self:leave:read''))))', relation_name, relation_name);
    execute format('create policy %I_group_insert on public.%I for insert to authenticated with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''leave:write'')))', relation_name, relation_name);
    execute format('create policy %I_group_update on public.%I for update to authenticated using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''leave:write''))) with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''leave:write'')))', relation_name, relation_name);
    execute format('create policy %I_group_delete on public.%I for delete to authenticated using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''leave:write'')))', relation_name, relation_name);
  end loop;
end;
$$;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'leave_year_rollovers'
  ]::text[] loop
    execute format('create policy %I_group_read on public.%I for select to authenticated using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''leave:read'')))', relation_name, relation_name);
  end loop;
end;
$$;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'leave_balance_buckets',
    'leave_accrual_transactions', 'leave_request_allocations'
  ]::text[] loop
    execute format('create policy %I_group_read on public.%I for select to authenticated using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''leave:read'')) or (employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id)) and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''self:leave:read''))))', relation_name, relation_name);
  end loop;
end;
$$;

create policy leave_year_rollover_items_group_read on public.leave_year_rollover_items
  for select to authenticated
  using (
    (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:read'))
    or exists (
      select 1
      from public.employments employment
      where employment.tenant_id = leave_year_rollover_items.tenant_id
        and employment.hr_group_id = leave_year_rollover_items.hr_group_id
        and employment.id = leave_year_rollover_items.employment_id
        and employment.employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
        and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'self:leave:read'))
    )
  );

do $$
begin
  create policy leave_requests_group_read on public.leave_requests
    for select to authenticated
    using (
      (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:read'))
      or (employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
          and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'self:leave:read')))
      or actor_user_id = (select auth.uid())
    );
end;
$$;

-- The new tables require the same RLS/grants/audit guarantees as every other
-- exposed HR-group table.
alter table public.employee_sets enable row level security;
alter table public.employee_set_members enable row level security;
alter table public.overtime_type_settings enable row level security;
alter table public.overtime_type_exceptions enable row level security;

create trigger employee_sets_updated
before update on public.employee_sets
for each row execute function internal_security.set_updated_at();
create trigger prevent_employee_sets_hr_group_change
before update of hr_group_id on public.employee_sets
for each row execute function internal_security.prevent_hr_group_change();
create trigger audit_employee_sets
after insert or update or delete on public.employee_sets
for each row execute function internal_security.audit_configuration_change('employee_set');
create trigger prevent_employee_set_members_hr_group_change
before update of hr_group_id on public.employee_set_members
for each row execute function internal_security.prevent_hr_group_change();
create trigger audit_employee_set_members
after insert or update or delete on public.employee_set_members
for each row execute function internal_security.audit_configuration_change('employee_set_member');

grant select, insert, update, delete on table public.employee_sets to authenticated;
grant select, insert, update, delete on table public.employee_set_members to authenticated;
grant select, insert, update, delete on table public.overtime_type_exceptions to authenticated;
grant select, insert, update on table public.overtime_type_settings to authenticated;

-- Existing trigger functions must use group scope after catalog metadata loses
-- its administration identity.
create or replace function internal_security.prevent_locked_leave_rule_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare candidate public.leave_accrual_rules;
begin
  candidate := case when tg_op = 'DELETE' then old else new end;
  if exists (
    select 1 from public.leave_year_controls control
    where control.tenant_id = candidate.tenant_id
      and control.hr_group_id = candidate.hr_group_id
      and control.status = 'LOCKED'
      and daterange(candidate.valid_from, candidate.valid_until, '[)')
          && daterange(make_date(control.year::integer, 1, 1), make_date(control.year::integer + 1, 1, 1), '[)')
  ) then raise exception using errcode = '55000', message = 'LEAVE_RULE_YEAR_LOCKED'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function internal_security.prevent_locked_leave_transaction()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.transaction_type <> 'EXPIRED_DEDUCTION'
     and exists (
       select 1 from public.leave_year_controls control
       where control.tenant_id = new.tenant_id
         and control.hr_group_id = new.hr_group_id
         and control.year = extract(year from new.transaction_date)::smallint
         and control.status = 'LOCKED'
     ) then raise exception using errcode = '55000', message = 'LEAVE_TRANSACTION_YEAR_LOCKED'; end if;
  return new;
end;
$$;

create or replace function internal_security.prevent_locked_leave_year_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'LOCKED' and (new.status <> old.status or new.year <> old.year or new.hr_group_id <> old.hr_group_id) then
    raise exception using errcode = '55000', message = 'LEAVE_YEAR_LOCKED';
  end if;
  return new;
end;
$$;

create or replace function internal_security.validate_leave_accrual_rule_chain()
returns trigger language plpgsql security definer set search_path = '' as $$
declare predecessor public.leave_accrual_rules; entitlement public.leave_type_entitlement_mode;
begin
  select type.entitlement_mode into entitlement
  from public.leave_types type
  where type.tenant_id = new.tenant_id and type.hr_group_id = new.hr_group_id and type.id = new.leave_type_id;
  if entitlement <> 'ACCRUAL' then raise exception using errcode = '23514', message = 'LEAVE_RULE_TYPE_NOT_ACCRUAL'; end if;
  if new.predecessor_rule_id is not null then
    select * into predecessor from public.leave_accrual_rules rule where rule.id = new.predecessor_rule_id;
    if predecessor.id is null or predecessor.tenant_id <> new.tenant_id or predecessor.hr_group_id <> new.hr_group_id
       or predecessor.leave_profile_id <> new.leave_profile_id or predecessor.leave_type_id <> new.leave_type_id
       or predecessor.valid_until is distinct from new.valid_from then
      raise exception using errcode = '23514', message = 'LEAVE_RULE_CHAIN_NOT_CONTIGUOUS';
    end if;
  end if;
  if exists (select 1 from public.leave_accrual_rules successor where successor.predecessor_rule_id = new.id and successor.valid_from is distinct from new.valid_until) then
    raise exception using errcode = '23514', message = 'LEAVE_RULE_CHAIN_NOT_CONTIGUOUS';
  end if;
  return new;
end;
$$;

create or replace function internal_security.validate_overtime_exception_employee()
returns trigger language plpgsql security definer set search_path = 'public', 'pg_catalog' as $$
begin
  if not exists (
    select 1 from public.employments employment
    where employment.tenant_id = new.tenant_id and employment.hr_group_id = new.hr_group_id
      and employment.employee_id = new.employee_id and employment.record_status = 'CONFIRMED'
      and employment.deleted_at is null and employment.starts_on <= current_date
      and (employment.ends_on is null or employment.ends_on >= current_date)
  ) then raise exception using errcode = '23514', message = 'OVERTIME_EXCEPTION_EMPLOYEE_NOT_IN_HR_GROUP'; end if;
  return new;
end;
$$;

revoke all on function internal_security.prevent_locked_leave_rule_mutation() from public, anon, authenticated;
revoke all on function internal_security.prevent_locked_leave_transaction() from public, anon, authenticated;
revoke all on function internal_security.prevent_locked_leave_year_change() from public, anon, authenticated;
revoke all on function internal_security.validate_leave_accrual_rule_chain() from public, anon, authenticated;
revoke all on function internal_security.validate_overtime_exception_employee() from public, anon, authenticated;

commit;
