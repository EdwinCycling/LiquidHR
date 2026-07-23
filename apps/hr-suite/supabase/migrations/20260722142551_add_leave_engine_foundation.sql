-- Verlofopbouw-engine: databasefundament voor de dienstverbandgebonden engine.
-- De engine, API en UI worden in latere migraties/services toegevoegd.

create type public.leave_accrual_basis as enum ('CONTRACT_HOURS', 'WORKED_HOURS');
create type public.leave_accrual_frequency as enum ('PAYROLL_PERIOD', 'YEARLY');
create type public.leave_accrual_timing as enum ('UPFRONT', 'ARREARS');
create type public.leave_type_scope as enum ('STATUTORY', 'NON_STATUTORY', 'ADV', 'OTHER');
create type public.leave_type_entitlement_mode as enum (
  'ACCRUAL', 'UNLIMITED', 'ANNUAL_HOURS_CAP', 'WEEKLY_HOURS_FACTOR_CAP'
);
create type public.leave_transaction_type as enum (
  'ACCRUAL', 'OPENING_BALANCE', 'MANUAL_ADJUSTMENT', 'TAKEN', 'EXPIRED_DEDUCTION'
);
create type public.leave_year_control_status as enum ('LOCKED', 'ACTIVE', 'OPEN_FOR_FUTURE_REQUESTS');
create type public.work_hour_type_category as enum ('REGULAR_WORK', 'OVERTIME', 'INFORMATIONAL');
create type public.leave_bonus_trigger_type as enum ('AGE', 'SENIORITY');
create type public.leave_bonus_award_timing as enum ('START_OF_YEAR', 'ON_TRIGGER_DATE');
create type public.leave_work_hour_entry_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

create table public.leave_year_controls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  year smallint not null check (year between 2000 and 2200),
  status public.leave_year_control_status not null default 'ACTIVE',
  locked_at timestamptz,
  locked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint leave_year_controls_administration_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete cascade,
  constraint leave_year_controls_lock_state_valid check (
    (status = 'LOCKED' and locked_at is not null)
    or (status <> 'LOCKED' and locked_at is null)
  ),
  unique (tenant_id, administration_id, year),
  unique (tenant_id, administration_id, id)
);

create table public.leave_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 160),
  color_code text not null default 'default' check (length(btrim(color_code)) between 1 and 32),
  scope public.leave_type_scope not null,
  is_system boolean not null default false,
  is_active boolean not null default true,
  is_self_service boolean not null default true,
  entitlement_mode public.leave_type_entitlement_mode not null default 'ACCRUAL',
  annual_hours_cap numeric(12,4),
  weekly_hours_cap_factor numeric(12,6),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint leave_types_administration_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete cascade,
  constraint leave_types_entitlement_values_valid check (
    (entitlement_mode = 'ACCRUAL' and annual_hours_cap is null and weekly_hours_cap_factor is null)
    or (entitlement_mode = 'UNLIMITED' and annual_hours_cap is null and weekly_hours_cap_factor is null)
    or (entitlement_mode = 'ANNUAL_HOURS_CAP' and annual_hours_cap is not null and annual_hours_cap >= 0 and weekly_hours_cap_factor is null)
    or (entitlement_mode = 'WEEKLY_HOURS_FACTOR_CAP' and annual_hours_cap is null and weekly_hours_cap_factor is not null and weekly_hours_cap_factor >= 0)
  ),
  unique (tenant_id, administration_id, name),
  unique (tenant_id, administration_id, id)
);

create table public.work_hour_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 160),
  category public.work_hour_type_category not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint work_hour_types_administration_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete cascade,
  unique (tenant_id, administration_id, name),
  unique (tenant_id, administration_id, id)
);

create table public.leave_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 160),
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint leave_profiles_administration_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete cascade,
  unique (tenant_id, administration_id, name),
  unique (tenant_id, administration_id, id)
);

create table public.employment_leave_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  leave_profile_id uuid not null,
  valid_from date not null,
  valid_until date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employment_leave_profiles_period_valid
    check (valid_until is null or valid_until > valid_from),
  constraint employment_leave_profiles_employment_fkey
    foreign key (tenant_id, administration_id, employee_id, employment_id)
    references public.employments(tenant_id, administration_id, employee_id, id) on delete cascade,
  constraint employment_leave_profiles_profile_fkey
    foreign key (tenant_id, administration_id, leave_profile_id)
    references public.leave_profiles(tenant_id, administration_id, id) on delete restrict,
  constraint employment_leave_profiles_no_overlap
    exclude using gist (
      tenant_id with =, employment_id with =,
      daterange(valid_from, valid_until, '[)') with &&
    )
);

create table public.leave_accrual_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  leave_profile_id uuid not null,
  leave_type_id uuid not null,
  predecessor_rule_id uuid references public.leave_accrual_rules(id) on delete restrict,
  valid_from date not null,
  valid_until date,
  accrual_basis public.leave_accrual_basis not null,
  accrual_frequency public.leave_accrual_frequency not null,
  accrual_timing public.leave_accrual_timing not null,
  accrual_amount numeric(12,4),
  accrual_rate numeric(12,6),
  expiration_months smallint not null check (expiration_months >= 0 and expiration_months <= 120),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint leave_accrual_rules_period_valid
    check (valid_until is null or valid_until > valid_from),
  constraint leave_accrual_rules_amount_valid check (
    (accrual_basis = 'CONTRACT_HOURS' and accrual_amount is not null and accrual_amount >= 0 and accrual_rate is null)
    or (accrual_basis = 'WORKED_HOURS' and accrual_amount is null and accrual_rate is not null and accrual_rate >= 0)
  ),
  constraint leave_accrual_rules_profile_fkey
    foreign key (tenant_id, administration_id, leave_profile_id)
    references public.leave_profiles(tenant_id, administration_id, id) on delete cascade,
  constraint leave_accrual_rules_type_fkey
    foreign key (tenant_id, administration_id, leave_type_id)
    references public.leave_types(tenant_id, administration_id, id) on delete restrict,
  constraint leave_accrual_rules_no_overlap
    exclude using gist (
      tenant_id with =, leave_profile_id with =, leave_type_id with =,
      daterange(valid_from, valid_until, '[)') with &&
    ),
  unique (tenant_id, administration_id, id)
);

create table public.leave_accrual_rule_work_hour_types (
  tenant_id uuid not null,
  administration_id uuid not null,
  accrual_rule_id uuid not null,
  work_hour_type_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (accrual_rule_id, work_hour_type_id),
  constraint leave_accrual_rule_work_hour_types_rule_fkey
    foreign key (tenant_id, administration_id, accrual_rule_id)
    references public.leave_accrual_rules(tenant_id, administration_id, id) on delete cascade,
  constraint leave_accrual_rule_work_hour_types_type_fkey
    foreign key (tenant_id, administration_id, work_hour_type_id)
    references public.work_hour_types(tenant_id, administration_id, id) on delete restrict
);

create table public.leave_accrual_rule_pause_types (
  tenant_id uuid not null,
  administration_id uuid not null,
  accrual_rule_id uuid not null,
  pause_leave_type_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (accrual_rule_id, pause_leave_type_id),
  constraint leave_accrual_rule_pause_types_rule_fkey
    foreign key (tenant_id, administration_id, accrual_rule_id)
    references public.leave_accrual_rules(tenant_id, administration_id, id) on delete cascade,
  constraint leave_accrual_rule_pause_types_type_fkey
    foreign key (tenant_id, administration_id, pause_leave_type_id)
    references public.leave_types(tenant_id, administration_id, id) on delete restrict
);

create table public.leave_accrual_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  leave_type_id uuid not null,
  valid_from date not null,
  valid_until date,
  no_accrual boolean not null default false,
  accrual_amount numeric(12,4),
  expiration_months smallint,
  reason text not null check (length(btrim(reason)) between 1 and 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint leave_accrual_exceptions_period_valid
    check (valid_until is null or valid_until > valid_from),
  constraint leave_accrual_exceptions_values_valid check (
    (
      (no_accrual and accrual_amount is null)
      or (not no_accrual and (accrual_amount is null or accrual_amount >= 0))
    )
    and (expiration_months is null or expiration_months between 0 and 120)
  ),
  constraint leave_accrual_exceptions_employment_fkey
    foreign key (tenant_id, administration_id, employee_id, employment_id)
    references public.employments(tenant_id, administration_id, employee_id, id) on delete cascade,
  constraint leave_accrual_exceptions_type_fkey
    foreign key (tenant_id, administration_id, leave_type_id)
    references public.leave_types(tenant_id, administration_id, id) on delete restrict,
  constraint leave_accrual_exceptions_no_overlap
    exclude using gist (
      tenant_id with =, employment_id with =, leave_type_id with =,
      daterange(valid_from, valid_until, '[)') with &&
    )
);

create table public.leave_bonus_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  leave_profile_id uuid not null,
  leave_type_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 160),
  trigger_type public.leave_bonus_trigger_type not null,
  award_timing public.leave_bonus_award_timing not null,
  pro_rate_first_year boolean not null default true,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint leave_bonus_rules_profile_fkey
    foreign key (tenant_id, administration_id, leave_profile_id)
    references public.leave_profiles(tenant_id, administration_id, id) on delete cascade,
  constraint leave_bonus_rules_type_fkey
    foreign key (tenant_id, administration_id, leave_type_id)
    references public.leave_types(tenant_id, administration_id, id) on delete restrict,
  unique (tenant_id, administration_id, leave_profile_id, leave_type_id, name),
  unique (tenant_id, administration_id, id)
);

create table public.leave_bonus_tiers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  bonus_rule_id uuid not null,
  threshold_years smallint not null check (threshold_years >= 0 and threshold_years <= 100),
  bonus_amount numeric(12,4) not null check (bonus_amount >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint leave_bonus_tiers_rule_fkey
    foreign key (tenant_id, administration_id, bonus_rule_id)
    references public.leave_bonus_rules(tenant_id, administration_id, id) on delete cascade,
  unique (bonus_rule_id, threshold_years)
);

create table public.leave_priority_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  leave_profile_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 160),
  valid_from date not null,
  valid_until date,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint leave_priority_rules_period_valid check (valid_until is null or valid_until > valid_from),
  constraint leave_priority_rules_profile_fkey
    foreign key (tenant_id, administration_id, leave_profile_id)
    references public.leave_profiles(tenant_id, administration_id, id) on delete cascade,
  unique (tenant_id, administration_id, leave_profile_id, name, valid_from),
  unique (tenant_id, administration_id, id)
);

create table public.leave_priority_rule_items (
  tenant_id uuid not null,
  administration_id uuid not null,
  priority_rule_id uuid not null,
  leave_type_id uuid not null,
  sort_order smallint not null check (sort_order > 0),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (priority_rule_id, leave_type_id),
  constraint leave_priority_rule_items_rule_fkey
    foreign key (tenant_id, administration_id, priority_rule_id)
    references public.leave_priority_rules(tenant_id, administration_id, id) on delete cascade,
  constraint leave_priority_rule_items_type_fkey
    foreign key (tenant_id, administration_id, leave_type_id)
    references public.leave_types(tenant_id, administration_id, id) on delete restrict,
  unique (priority_rule_id, sort_order)
);

create table public.employment_work_hour_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  work_hour_type_id uuid not null,
  work_date date not null,
  hours numeric(12,4) not null check (hours > 0),
  status public.leave_work_hour_entry_status not null default 'PENDING',
  source_type text not null default 'MANUAL' check (length(btrim(source_type)) between 1 and 64),
  source_key text,
  note text,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employment_work_hour_entries_employment_fkey
    foreign key (tenant_id, administration_id, employee_id, employment_id)
    references public.employments(tenant_id, administration_id, employee_id, id) on delete cascade,
  constraint employment_work_hour_entries_type_fkey
    foreign key (tenant_id, administration_id, work_hour_type_id)
    references public.work_hour_types(tenant_id, administration_id, id) on delete restrict,
  constraint employment_work_hour_entries_approval_state_valid check (
    (status = 'APPROVED' and approved_at is not null and approved_by is not null)
    or (status <> 'APPROVED')
  ),
  unique (tenant_id, administration_id, source_type, source_key)
);

create table public.leave_balance_buckets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  leave_type_id uuid not null,
  accrual_year smallint not null check (accrual_year between 2000 and 2200),
  accrual_reference_date date not null,
  total_accrued numeric(12,4) not null default 0 check (total_accrued >= 0),
  total_taken numeric(12,4) not null default 0 check (total_taken >= 0),
  total_expired numeric(12,4) not null default 0 check (total_expired >= 0),
  expiration_date date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint leave_balance_buckets_employment_fkey
    foreign key (tenant_id, administration_id, employee_id, employment_id)
    references public.employments(tenant_id, administration_id, employee_id, id) on delete cascade,
  constraint leave_balance_buckets_type_fkey
    foreign key (tenant_id, administration_id, leave_type_id)
    references public.leave_types(tenant_id, administration_id, id) on delete restrict,
  constraint leave_balance_buckets_year_matches_reference check (extract(year from accrual_reference_date) = accrual_year),
  constraint leave_balance_buckets_balance_non_negative check (total_accrued >= total_taken + total_expired),
  unique (tenant_id, administration_id, employment_id, leave_type_id, accrual_year),
  unique (tenant_id, administration_id, employment_id, leave_type_id, id),
  unique (tenant_id, administration_id, employee_id, employment_id, leave_type_id, id),
  unique (tenant_id, administration_id, id)
);

create table public.leave_accrual_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  leave_type_id uuid not null,
  bucket_id uuid not null,
  transaction_type public.leave_transaction_type not null,
  amount numeric(12,4) not null check (amount <> 0),
  reason text,
  actor_user_id uuid references auth.users(id) on delete set null,
  source_type text not null check (length(btrim(source_type)) between 1 and 64),
  source_id uuid,
  source_key text,
  transaction_date date not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint leave_accrual_transactions_bucket_fkey
    foreign key (tenant_id, administration_id, employee_id, employment_id, leave_type_id, bucket_id)
    references public.leave_balance_buckets(tenant_id, administration_id, employee_id, employment_id, leave_type_id, id)
    on delete restrict,
  constraint leave_accrual_transactions_reason_valid check (
    (transaction_type = 'MANUAL_ADJUSTMENT' and length(btrim(coalesce(reason, ''))) between 1 and 500)
    or (transaction_type <> 'MANUAL_ADJUSTMENT')
  ),
  constraint leave_accrual_transactions_actor_valid check (
    (transaction_type = 'MANUAL_ADJUSTMENT' and actor_user_id is not null)
    or (transaction_type <> 'MANUAL_ADJUSTMENT')
  ),
  unique (tenant_id, administration_id, id)
);

create unique index leave_accrual_transactions_source_key
  on public.leave_accrual_transactions (bucket_id, source_key)
  where source_key is not null;

create table public.leave_year_rollovers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  from_year smallint not null check (from_year between 2000 and 2199),
  to_year smallint not null check (to_year = from_year + 1),
  completed_at timestamptz not null default timezone('utc', now()),
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint leave_year_rollovers_administration_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete cascade,
  unique (tenant_id, administration_id, from_year),
  unique (tenant_id, administration_id, id)
);

create table public.leave_year_rollover_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  rollover_id uuid not null,
  employment_id uuid not null,
  leave_type_id uuid not null,
  source_bucket_id uuid not null,
  carried_hours numeric(12,4) not null check (carried_hours > 0),
  original_expiration_date date not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint leave_year_rollover_items_rollover_fkey
    foreign key (tenant_id, administration_id, rollover_id)
    references public.leave_year_rollovers(tenant_id, administration_id, id) on delete cascade,
  constraint leave_year_rollover_items_employment_fkey
    foreign key (tenant_id, administration_id, employment_id)
    references public.employments(tenant_id, administration_id, id) on delete cascade,
  constraint leave_year_rollover_items_bucket_fkey
    foreign key (tenant_id, administration_id, employment_id, leave_type_id, source_bucket_id)
    references public.leave_balance_buckets(tenant_id, administration_id, employment_id, leave_type_id, id) on delete restrict,
  constraint leave_year_rollover_items_type_fkey
    foreign key (tenant_id, administration_id, leave_type_id)
    references public.leave_types(tenant_id, administration_id, id) on delete restrict,
  unique (rollover_id, source_bucket_id)
);

create index leave_profiles_scope_idx on public.leave_profiles (tenant_id, administration_id, is_active, name);
create index leave_types_scope_idx on public.leave_types (tenant_id, administration_id, is_active, name);
create index work_hour_types_scope_idx on public.work_hour_types (tenant_id, administration_id, category, is_active, name);
create index employment_leave_profiles_employment_idx on public.employment_leave_profiles (tenant_id, administration_id, employment_id, valid_from);
create index employment_leave_profiles_profile_idx on public.employment_leave_profiles (tenant_id, administration_id, leave_profile_id, valid_from);
create index leave_accrual_rules_profile_type_idx on public.leave_accrual_rules (tenant_id, administration_id, leave_profile_id, leave_type_id, valid_from);
create index leave_accrual_rules_predecessor_idx on public.leave_accrual_rules (predecessor_rule_id);
create index leave_accrual_rule_work_hour_types_type_idx on public.leave_accrual_rule_work_hour_types (tenant_id, administration_id, work_hour_type_id);
create index leave_accrual_rule_pause_types_type_idx on public.leave_accrual_rule_pause_types (tenant_id, administration_id, pause_leave_type_id);
create index leave_accrual_exceptions_employment_idx on public.leave_accrual_exceptions (tenant_id, administration_id, employment_id, leave_type_id, valid_from);
create index leave_bonus_rules_profile_type_idx on public.leave_bonus_rules (tenant_id, administration_id, leave_profile_id, leave_type_id);
create index leave_priority_rule_items_type_idx on public.leave_priority_rule_items (tenant_id, administration_id, leave_type_id);
create index employment_work_hour_entries_engine_idx on public.employment_work_hour_entries (tenant_id, administration_id, employment_id, work_date, status);
create index employment_work_hour_entries_type_idx on public.employment_work_hour_entries (tenant_id, administration_id, work_hour_type_id, work_date);
create index leave_balance_buckets_report_idx on public.leave_balance_buckets (tenant_id, administration_id, employment_id, leave_type_id, expiration_date);
create index leave_accrual_transactions_report_idx on public.leave_accrual_transactions (tenant_id, administration_id, employment_id, leave_type_id, transaction_date);
create index leave_year_rollover_items_report_idx on public.leave_year_rollover_items (tenant_id, administration_id, employment_id, leave_type_id);
create index leave_year_rollover_items_bucket_idx on public.leave_year_rollover_items (tenant_id, administration_id, source_bucket_id);

create or replace function internal_security.validate_leave_accrual_rule_chain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare predecessor public.leave_accrual_rules; entitlement public.leave_type_entitlement_mode;
begin
  select entitlement_mode into entitlement
  from public.leave_types
  where tenant_id = new.tenant_id
    and administration_id = new.administration_id
    and id = new.leave_type_id;
  if entitlement <> 'ACCRUAL' then
    raise exception using errcode = '23514', message = 'LEAVE_RULE_TYPE_NOT_ACCRUAL';
  end if;

  if new.predecessor_rule_id is not null then
    select * into predecessor from public.leave_accrual_rules where id = new.predecessor_rule_id;
    if predecessor.id is null
      or predecessor.tenant_id <> new.tenant_id
      or predecessor.administration_id <> new.administration_id
      or predecessor.leave_profile_id <> new.leave_profile_id
      or predecessor.leave_type_id <> new.leave_type_id
      or predecessor.valid_until is distinct from new.valid_from then
      raise exception using errcode = '23514', message = 'LEAVE_RULE_CHAIN_NOT_CONTIGUOUS';
    end if;
  end if;

  if exists (
    select 1 from public.leave_accrual_rules successor
    where successor.predecessor_rule_id = new.id
      and successor.valid_from is distinct from new.valid_until
  ) then
    raise exception using errcode = '23514', message = 'LEAVE_RULE_CHAIN_NOT_CONTIGUOUS';
  end if;
  return new;
end;
$$;

create or replace function internal_security.prevent_locked_leave_rule_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare candidate public.leave_accrual_rules;
begin
  if tg_op = 'DELETE' then
    candidate := old;
  else
    candidate := new;
  end if;
  if exists (
    select 1
    from public.leave_year_controls control
    where control.tenant_id = candidate.tenant_id
      and control.administration_id = candidate.administration_id
      and control.status = 'LOCKED'
      and daterange(candidate.valid_from, candidate.valid_until, '[)')
          && daterange(make_date(control.year::integer, 1, 1), make_date(control.year::integer + 1, 1, 1), '[)')
  ) then
    raise exception using errcode = '55000', message = 'LEAVE_RULE_YEAR_LOCKED';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function internal_security.validate_leave_rule_work_hour_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare rule_basis public.leave_accrual_basis; type_category public.work_hour_type_category;
begin
  select accrual_basis into rule_basis from public.leave_accrual_rules where id = new.accrual_rule_id;
  select category into type_category from public.work_hour_types where id = new.work_hour_type_id;
  if rule_basis <> 'WORKED_HOURS' or type_category = 'INFORMATIONAL' then
    raise exception using errcode = '23514', message = 'LEAVE_WORK_HOUR_TYPE_NOT_ELIGIBLE';
  end if;
  return new;
end;
$$;

create or replace function internal_security.validate_leave_pause_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare rule_type uuid;
begin
  select leave_type_id into rule_type from public.leave_accrual_rules where id = new.accrual_rule_id;
  if rule_type = new.pause_leave_type_id then
    raise exception using errcode = '23514', message = 'LEAVE_RULE_CANNOT_PAUSE_ITSELF';
  end if;
  return new;
end;
$$;

create or replace function internal_security.validate_leave_bonus_tiers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare rule_id uuid;
begin
  if tg_table_name = 'leave_bonus_tiers' then
    if tg_op = 'DELETE' then rule_id := old.bonus_rule_id; else rule_id := new.bonus_rule_id; end if;
  else
    if tg_op = 'DELETE' then rule_id := old.id; else rule_id := new.id; end if;
  end if;
  if exists (
    select 1
    from public.leave_bonus_rules rule
    join public.leave_types type on type.id = rule.leave_type_id
    where rule.id = rule_id
      and type.entitlement_mode <> 'ACCRUAL'
  ) then
    raise exception using errcode = '23514', message = 'LEAVE_BONUS_TYPE_NOT_ACCRUAL';
  end if;
  if exists (select 1 from public.leave_bonus_rules where id = rule_id)
     and not exists (select 1 from public.leave_bonus_tiers where bonus_rule_id = rule_id) then
    raise exception using errcode = '23514', message = 'LEAVE_BONUS_RULE_REQUIRES_TIER';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function internal_security.prevent_leave_transaction_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'LEAVE_LEDGER_APPEND_ONLY';
end;
$$;

create or replace function internal_security.prevent_locked_leave_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.leave_year_controls control
    where control.tenant_id = new.tenant_id
      and control.administration_id = new.administration_id
      and control.year = extract(year from new.transaction_date)::smallint
      and control.status = 'LOCKED'
  ) then
    raise exception using errcode = '55000', message = 'LEAVE_TRANSACTION_YEAR_LOCKED';
  end if;
  return new;
end;
$$;

create or replace function internal_security.prevent_locked_leave_year_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'LOCKED' and (new.status <> old.status or new.year <> old.year or new.administration_id <> old.administration_id) then
    raise exception using errcode = '55000', message = 'LEAVE_YEAR_LOCKED';
  end if;
  return new;
end;
$$;

create or replace function internal_security.prevent_leave_type_system_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_system then
    raise exception using errcode = '55000', message = 'LEAVE_SYSTEM_TYPE_IMMUTABLE';
  end if;
  return old;
end;
$$;

create trigger leave_year_controls_updated before update on public.leave_year_controls
for each row execute function internal_security.set_updated_at();
create trigger leave_types_updated before update on public.leave_types
for each row execute function internal_security.set_updated_at();
create trigger work_hour_types_updated before update on public.work_hour_types
for each row execute function internal_security.set_updated_at();
create trigger leave_profiles_updated before update on public.leave_profiles
for each row execute function internal_security.set_updated_at();
create trigger employment_leave_profiles_updated before update on public.employment_leave_profiles
for each row execute function internal_security.set_updated_at();
create trigger leave_accrual_rules_updated before update on public.leave_accrual_rules
for each row execute function internal_security.set_updated_at();
create trigger leave_accrual_exceptions_updated before update on public.leave_accrual_exceptions
for each row execute function internal_security.set_updated_at();
create trigger leave_bonus_rules_updated before update on public.leave_bonus_rules
for each row execute function internal_security.set_updated_at();
create trigger leave_bonus_tiers_updated before update on public.leave_bonus_tiers
for each row execute function internal_security.set_updated_at();
create trigger leave_priority_rules_updated before update on public.leave_priority_rules
for each row execute function internal_security.set_updated_at();
create trigger employment_work_hour_entries_updated before update on public.employment_work_hour_entries
for each row execute function internal_security.set_updated_at();
create trigger leave_balance_buckets_updated before update on public.leave_balance_buckets
for each row execute function internal_security.set_updated_at();

create constraint trigger leave_accrual_rules_chain_check
after insert or update on public.leave_accrual_rules
deferrable initially deferred
for each row execute function internal_security.validate_leave_accrual_rule_chain();
create constraint trigger leave_bonus_rules_tier_check
after insert or update on public.leave_bonus_rules
deferrable initially deferred
for each row execute function internal_security.validate_leave_bonus_tiers();
create constraint trigger leave_bonus_tiers_rule_check
after insert or update or delete on public.leave_bonus_tiers
deferrable initially deferred
for each row execute function internal_security.validate_leave_bonus_tiers();
create trigger leave_accrual_rules_locked_check
before insert or update or delete on public.leave_accrual_rules
for each row execute function internal_security.prevent_locked_leave_rule_mutation();
create trigger leave_rule_work_hour_type_check
before insert or update on public.leave_accrual_rule_work_hour_types
for each row execute function internal_security.validate_leave_rule_work_hour_type();
create trigger leave_rule_pause_type_check
before insert or update on public.leave_accrual_rule_pause_types
for each row execute function internal_security.validate_leave_pause_type();
create trigger leave_year_locked_check
before update on public.leave_year_controls
for each row execute function internal_security.prevent_locked_leave_year_change();
create trigger leave_type_system_delete_check
before delete on public.leave_types
for each row execute function internal_security.prevent_leave_type_system_delete();
create trigger leave_transactions_append_only
before update or delete on public.leave_accrual_transactions
for each row execute function internal_security.prevent_leave_transaction_mutation();
create trigger leave_transactions_locked_check
before insert on public.leave_accrual_transactions
for each row execute function internal_security.prevent_locked_leave_transaction();
create trigger leave_rollover_items_append_only
before update or delete on public.leave_year_rollover_items
for each row execute function internal_security.prevent_leave_transaction_mutation();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'leave_year_controls', 'leave_types', 'work_hour_types', 'leave_profiles',
    'employment_leave_profiles', 'leave_accrual_rules', 'leave_accrual_rule_work_hour_types',
    'leave_accrual_rule_pause_types', 'leave_accrual_exceptions', 'leave_bonus_rules',
    'leave_bonus_tiers', 'leave_priority_rules', 'leave_priority_rule_items',
    'employment_work_hour_entries', 'leave_balance_buckets', 'leave_accrual_transactions',
    'leave_year_rollovers', 'leave_year_rollover_items'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;

create policy leave_year_controls_read on public.leave_year_controls for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:read')));
create policy leave_year_controls_write on public.leave_year_controls for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:year-close')));
create policy leave_year_controls_update on public.leave_year_controls for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:year-close')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:year-close')));

create policy leave_types_read on public.leave_types for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:read')));
create policy leave_types_insert on public.leave_types for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_types_update on public.leave_types for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_types_delete on public.leave_types for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy work_hour_types_read on public.work_hour_types for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:read')));
create policy work_hour_types_insert on public.work_hour_types for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy work_hour_types_update on public.work_hour_types for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy work_hour_types_delete on public.work_hour_types for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_profiles_read on public.leave_profiles for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:read')));
create policy leave_profiles_insert on public.leave_profiles for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_profiles_update on public.leave_profiles for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_profiles_delete on public.leave_profiles for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));

create policy employment_leave_profiles_read on public.employment_leave_profiles for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:read'))
  or (employee_id = (select internal_security.current_employee_id())
      and (select internal_security.current_user_has_permission(tenant_id, administration_id, 'self:leave:read')))
);
create policy employment_leave_profiles_insert on public.employment_leave_profiles for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy employment_leave_profiles_update on public.employment_leave_profiles for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy employment_leave_profiles_delete on public.employment_leave_profiles for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));

create policy leave_accrual_rules_read on public.leave_accrual_rules for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:read')));
create policy leave_accrual_rules_insert on public.leave_accrual_rules for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_accrual_rules_update on public.leave_accrual_rules for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_accrual_rules_delete on public.leave_accrual_rules for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_accrual_rule_work_hour_types_read on public.leave_accrual_rule_work_hour_types for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:read')));
create policy leave_accrual_rule_work_hour_types_insert on public.leave_accrual_rule_work_hour_types for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_accrual_rule_work_hour_types_update on public.leave_accrual_rule_work_hour_types for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_accrual_rule_work_hour_types_delete on public.leave_accrual_rule_work_hour_types for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_accrual_rule_pause_types_read on public.leave_accrual_rule_pause_types for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:read')));
create policy leave_accrual_rule_pause_types_insert on public.leave_accrual_rule_pause_types for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_accrual_rule_pause_types_update on public.leave_accrual_rule_pause_types for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_accrual_rule_pause_types_delete on public.leave_accrual_rule_pause_types for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_accrual_exceptions_read on public.leave_accrual_exceptions for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:read')));
create policy leave_accrual_exceptions_insert on public.leave_accrual_exceptions for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_accrual_exceptions_update on public.leave_accrual_exceptions for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_accrual_exceptions_delete on public.leave_accrual_exceptions for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_bonus_rules_read on public.leave_bonus_rules for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:read')));
create policy leave_bonus_rules_insert on public.leave_bonus_rules for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_bonus_rules_update on public.leave_bonus_rules for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_bonus_rules_delete on public.leave_bonus_rules for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_bonus_tiers_read on public.leave_bonus_tiers for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:read')));
create policy leave_bonus_tiers_insert on public.leave_bonus_tiers for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_bonus_tiers_update on public.leave_bonus_tiers for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_bonus_tiers_delete on public.leave_bonus_tiers for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_priority_rules_read on public.leave_priority_rules for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:read')));
create policy leave_priority_rules_insert on public.leave_priority_rules for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_priority_rules_update on public.leave_priority_rules for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_priority_rules_delete on public.leave_priority_rules for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_priority_rule_items_read on public.leave_priority_rule_items for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:read')));
create policy leave_priority_rule_items_insert on public.leave_priority_rule_items for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_priority_rule_items_update on public.leave_priority_rule_items for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy leave_priority_rule_items_delete on public.leave_priority_rule_items for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));

create policy employment_work_hour_entries_read on public.employment_work_hour_entries for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:read'))
  or (employee_id = (select internal_security.current_employee_id())
      and (select internal_security.current_user_has_permission(tenant_id, administration_id, 'self:leave:read')))
);
create policy employment_work_hour_entries_insert on public.employment_work_hour_entries for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy employment_work_hour_entries_update on public.employment_work_hour_entries for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));
create policy employment_work_hour_entries_delete on public.employment_work_hour_entries for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:write')));

create policy leave_balance_buckets_read on public.leave_balance_buckets for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:read'))
  or (employee_id = (select internal_security.current_employee_id())
      and (select internal_security.current_user_has_permission(tenant_id, administration_id, 'self:leave:read')))
);
create policy leave_accrual_transactions_read on public.leave_accrual_transactions for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:audit-read'))
  or (employee_id = (select internal_security.current_employee_id())
      and (select internal_security.current_user_has_permission(tenant_id, administration_id, 'self:leave:read')))
);
create policy leave_year_rollovers_read on public.leave_year_rollovers for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:read')));
create policy leave_year_rollovers_write on public.leave_year_rollovers for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:year-close')));
create policy leave_year_rollover_items_read on public.leave_year_rollover_items for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'leave:read'))
  or exists (
    select 1 from public.employments employment
    where employment.tenant_id = leave_year_rollover_items.tenant_id
      and employment.administration_id = leave_year_rollover_items.administration_id
      and employment.id = leave_year_rollover_items.employment_id
      and employment.employee_id = (select internal_security.current_employee_id())
      and (select internal_security.current_user_has_permission(
        leave_year_rollover_items.tenant_id,
        leave_year_rollover_items.administration_id,
        'self:leave:read'
      ))
  )
);

grant select, insert, update, delete on table public.leave_year_controls to authenticated;
grant select, insert, update, delete on table public.leave_types to authenticated;
grant select, insert, update, delete on table public.work_hour_types to authenticated;
grant select, insert, update, delete on table public.leave_profiles to authenticated;
grant select, insert, update, delete on table public.employment_leave_profiles to authenticated;
grant select, insert, update, delete on table public.leave_accrual_rules to authenticated;
grant select, insert, update, delete on table public.leave_accrual_rule_work_hour_types to authenticated;
grant select, insert, update, delete on table public.leave_accrual_rule_pause_types to authenticated;
grant select, insert, update, delete on table public.leave_accrual_exceptions to authenticated;
grant select, insert, update, delete on table public.leave_bonus_rules to authenticated;
grant select, insert, update, delete on table public.leave_bonus_tiers to authenticated;
grant select, insert, update, delete on table public.leave_priority_rules to authenticated;
grant select, insert, update, delete on table public.leave_priority_rule_items to authenticated;
grant select, insert, update, delete on table public.employment_work_hour_entries to authenticated;
grant select on table public.leave_balance_buckets to authenticated;
grant select on table public.leave_accrual_transactions to authenticated;
grant select, insert on table public.leave_year_rollovers to authenticated;
grant select on table public.leave_year_rollover_items to authenticated;

revoke update, delete on table public.leave_balance_buckets from authenticated;
revoke insert, update, delete on table public.leave_accrual_transactions from authenticated;
revoke update, delete on table public.leave_year_rollover_items from authenticated;

create trigger audit_leave_year_controls after insert or update or delete on public.leave_year_controls
for each row execute function internal_security.audit_configuration_change('leave_year_control');
create trigger audit_leave_types after insert or update or delete on public.leave_types
for each row execute function internal_security.audit_configuration_change('leave_type');
create trigger audit_work_hour_types after insert or update or delete on public.work_hour_types
for each row execute function internal_security.audit_configuration_change('work_hour_type');
create trigger audit_leave_profiles after insert or update or delete on public.leave_profiles
for each row execute function internal_security.audit_configuration_change('leave_profile');
create trigger audit_employment_leave_profiles after insert or update or delete on public.employment_leave_profiles
for each row execute function internal_security.audit_configuration_change('employment_leave_profile');
create trigger audit_leave_accrual_rules after insert or update or delete on public.leave_accrual_rules
for each row execute function internal_security.audit_configuration_change('leave_accrual_rule');
create trigger audit_leave_accrual_rule_work_hour_types after insert or update or delete on public.leave_accrual_rule_work_hour_types
for each row execute function internal_security.audit_configuration_change('leave_accrual_rule_work_hour_type');
create trigger audit_leave_accrual_rule_pause_types after insert or update or delete on public.leave_accrual_rule_pause_types
for each row execute function internal_security.audit_configuration_change('leave_accrual_rule_pause_type');
create trigger audit_leave_accrual_exceptions after insert or update or delete on public.leave_accrual_exceptions
for each row execute function internal_security.audit_configuration_change('leave_accrual_exception');
create trigger audit_leave_bonus_rules after insert or update or delete on public.leave_bonus_rules
for each row execute function internal_security.audit_configuration_change('leave_bonus_rule');
create trigger audit_leave_bonus_tiers after insert or update or delete on public.leave_bonus_tiers
for each row execute function internal_security.audit_configuration_change('leave_bonus_tier');
create trigger audit_leave_priority_rules after insert or update or delete on public.leave_priority_rules
for each row execute function internal_security.audit_configuration_change('leave_priority_rule');
create trigger audit_leave_priority_rule_items after insert or update or delete on public.leave_priority_rule_items
for each row execute function internal_security.audit_configuration_change('leave_priority_rule_item');
create trigger audit_employment_work_hour_entries after insert or update or delete on public.employment_work_hour_entries
for each row execute function internal_security.audit_configuration_change('employment_work_hour_entry');
create trigger audit_leave_balance_buckets after insert or update or delete on public.leave_balance_buckets
for each row execute function internal_security.audit_configuration_change('leave_balance_bucket');
create trigger audit_leave_accrual_transactions after insert on public.leave_accrual_transactions
for each row execute function internal_security.audit_configuration_change('leave_accrual_transaction');
create trigger audit_leave_year_rollovers after insert on public.leave_year_rollovers
for each row execute function internal_security.audit_configuration_change('leave_year_rollover');
create trigger audit_leave_year_rollover_items after insert on public.leave_year_rollover_items
for each row execute function internal_security.audit_configuration_change('leave_year_rollover_item');

revoke all on function internal_security.validate_leave_accrual_rule_chain() from public, anon, authenticated;
revoke all on function internal_security.prevent_locked_leave_rule_mutation() from public, anon, authenticated;
revoke all on function internal_security.validate_leave_rule_work_hour_type() from public, anon, authenticated;
revoke all on function internal_security.validate_leave_pause_type() from public, anon, authenticated;
revoke all on function internal_security.prevent_leave_transaction_mutation() from public, anon, authenticated;
revoke all on function internal_security.prevent_locked_leave_transaction() from public, anon, authenticated;
revoke all on function internal_security.prevent_locked_leave_year_change() from public, anon, authenticated;
revoke all on function internal_security.prevent_leave_type_system_delete() from public, anon, authenticated;

insert into public.permissions (code, name, category, description)
values
  ('leave:read', 'Verlofconfiguratie en saldo lezen', 'Verlof', 'Leest verloftypen, opbouwregels, buckets en saldo binnen de toegestane scope.'),
  ('leave:write', 'Verlofconfiguratie beheren', 'Verlof', 'Beheert verloftypen, werkurentypen, profielen, regels, uitzonderingen en voorrang.'),
  ('leave:year-close', 'Verlofjaar afsluiten', 'Verlof', 'Sluit een kalenderjaar af en maakt de onveranderlijke overhevelingssnapshot.'),
  ('leave:adjust', 'Verlofsaldo corrigeren', 'Verlof', 'Boekt een handmatige positieve of negatieve correctie met verplichte reden.'),
  ('leave:audit-read', 'Verlofgrootboek lezen', 'Verlof', 'Leest de immutable verlofmutaties en bronverwijzingen.'),
  ('self:leave:read', 'Eigen verlofsaldo lezen', 'Verlof', 'Leest het verlof- en werkurenrapport van het eigen dienstverband.')
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.tenant_id is null
  and role.code = 'TENANT_ADMIN'
  and permission.code in ('leave:read', 'leave:write', 'leave:year-close', 'leave:adjust', 'leave:audit-read')
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code in ('HR_ADVISOR', 'PAYROLL_SPECIALIST')
  and permission.code in ('leave:read', 'leave:write', 'leave:adjust', 'leave:audit-read')
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.tenant_id is null
  and role.code in ('EMPLOYEE', 'DIRECT_MANAGER')
  and permission.code = 'self:leave:read'
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.tenant_id is null
  and role.code = 'DIRECT_MANAGER'
  and permission.code = 'leave:read'
on conflict do nothing;
