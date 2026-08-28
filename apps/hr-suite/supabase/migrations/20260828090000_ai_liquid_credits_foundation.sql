begin;

-- Wave 1B keeps credit accounting separate from AI execution state. The
-- allocation and reservation rows form a small accounting ledger: allocations
-- are immutable batches and reservation links preserve deterministic
-- consumption across lifecycle transitions.
create table public.ai_credit_group_policies (
  tenant_id uuid not null,
  hr_group_id uuid not null,
  monthly_allowance_credits integer not null check (monthly_allowance_credits > 0),
  time_zone text not null default 'Europe/Amsterdam',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_credit_group_policies_pkey primary key (tenant_id, hr_group_id),
  constraint ai_credit_group_policies_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict
);

create table public.ai_credit_role_quotas (
  role_code text primary key check (char_length(btrim(role_code)) between 1 and 80),
  quality_profile text not null check (quality_profile in ('EFFICIENT', 'BALANCED', 'IN_DEPTH')),
  monthly_quota_credits integer not null check (monthly_quota_credits > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.ai_credit_charge_catalog (
  feature_code text not null check (char_length(btrim(feature_code)) between 1 and 120),
  quality_profile text not null check (quality_profile in ('EFFICIENT', 'BALANCED', 'IN_DEPTH')),
  charge_reference text not null check (char_length(btrim(charge_reference)) between 1 and 200),
  credit_amount integer not null check (credit_amount > 0),
  config_version text not null check (char_length(btrim(config_version)) between 1 and 160),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_credit_charge_catalog_pkey primary key (feature_code, quality_profile),
  constraint ai_credit_charge_catalog_reference_key unique (charge_reference)
);

insert into public.ai_credit_role_quotas (role_code, quality_profile, monthly_quota_credits)
values
  ('EMPLOYEE', 'EFFICIENT', 10),
  ('DIRECT_MANAGER', 'BALANCED', 25),
  ('TEAM_LEAD', 'BALANCED', 25),
  ('HR_ADVISOR', 'BALANCED', 50),
  ('PAYROLL_SPECIALIST', 'BALANCED', 50),
  ('HR_ADMIN', 'IN_DEPTH', 100),
  ('TENANT_ADMIN', 'IN_DEPTH', 100)
on conflict (role_code) do update
set quality_profile = excluded.quality_profile,
    monthly_quota_credits = excluded.monthly_quota_credits,
    is_active = true,
    updated_at = timezone('utc', now());

insert into public.ai_credit_charge_catalog (
  feature_code, quality_profile, charge_reference, credit_amount, config_version
)
values
  ('improve-existing-hr-text', 'EFFICIENT', 'ai.improve-existing-hr-text.efficient', 1, 'ai-foundation-1b.20260828.1'),
  ('improve-existing-hr-text', 'BALANCED', 'ai.improve-existing-hr-text.balanced', 2, 'ai-foundation-1b.20260828.1'),
  ('improve-existing-hr-text', 'IN_DEPTH', 'ai.improve-existing-hr-text.in-depth', 3, 'ai-foundation-1b.20260828.1')
on conflict (feature_code, quality_profile) do update
set charge_reference = excluded.charge_reference,
    credit_amount = excluded.credit_amount,
    config_version = excluded.config_version,
    is_active = true,
    updated_at = timezone('utc', now());

create table public.ai_credit_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  allocation_type text not null check (allocation_type in ('MONTHLY_ALLOWANCE', 'PURCHASED_EXTRA', 'TEST_GRANT')),
  credit_amount integer not null check (credit_amount > 0),
  period_month date check (period_month is null or period_month = date_trunc('month', period_month)::date),
  period_timezone text not null,
  granted_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  source text not null check (source in ('MONTHLY_ALLOWANCE', 'BILLING', 'CONTROLLED_TEST')),
  source_reference text not null check (char_length(btrim(source_reference)) between 1 and 240),
  reserved_credits integer not null default 0 check (reserved_credits >= 0),
  settled_credits integer not null default 0 check (settled_credits >= 0),
  released_credits integer not null default 0 check (released_credits >= 0),
  expired_credits integer not null default 0 check (expired_credits >= 0),
  available_credits integer generated always as
    (credit_amount - reserved_credits - settled_credits - expired_credits) stored,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_credit_allocations_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict,
  constraint ai_credit_allocations_scope_key
    unique (tenant_id, hr_group_id, id),
  constraint ai_credit_allocations_period_key
    unique (tenant_id, hr_group_id, allocation_type, period_month),
  constraint ai_credit_allocations_expiry_check
    check (expires_at is null or expires_at > granted_at),
  constraint ai_credit_allocations_available_check
    check (credit_amount - reserved_credits - settled_credits - expired_credits >= 0),
  constraint ai_credit_allocations_kind_check
    check (
      (allocation_type = 'MONTHLY_ALLOWANCE'
        and period_month is not null
        and source = 'MONTHLY_ALLOWANCE'
        and source_reference like 'MONTHLY:%'
        and expires_at is not null)
      or (allocation_type = 'PURCHASED_EXTRA'
        and period_month is null
        and source = 'BILLING'
        and source_reference like 'BILLING:%'
        and expires_at is not null)
      or (allocation_type = 'TEST_GRANT'
        and period_month is null
        and source = 'CONTROLLED_TEST'
        and source_reference like 'CONTROLLED_TEST:%'
        and expires_at is not null)
    )
);

create table public.ai_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  invocation_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  feature_code text not null check (char_length(btrim(feature_code)) between 1 and 120),
  charge_reference text not null check (char_length(btrim(charge_reference)) between 1 and 200),
  period_month date not null check (period_month = date_trunc('month', period_month)::date),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 1 and 200),
  reserved_credits integer not null check (reserved_credits > 0),
  settled_credits integer not null default 0 check (settled_credits >= 0),
  released_credits integer not null default 0 check (released_credits >= 0),
  status text not null default 'RESERVED' check (status in ('RESERVED', 'SETTLED', 'RELEASED')),
  release_reason text check (release_reason is null or release_reason in ('CONTEXT_FAILED', 'PROVIDER_UNAVAILABLE', 'PROVIDER_FAILED', 'INVALID_RESULT', 'INTERNAL_FAILURE')),
  created_at timestamptz not null default timezone('utc', now()),
  reserved_at timestamptz not null default timezone('utc', now()),
  settled_at timestamptz,
  released_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_credit_reservations_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict,
  constraint ai_credit_reservations_invocation_scope_fkey
    foreign key (tenant_id, hr_group_id, invocation_id)
    references public.ai_invocations(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint ai_credit_reservations_invocation_key
    unique (tenant_id, hr_group_id, invocation_id),
  constraint ai_credit_reservations_scope_key
    unique (tenant_id, hr_group_id, id),
  constraint ai_credit_reservations_idempotency_key
    unique (tenant_id, hr_group_id, actor_user_id, idempotency_key),
  constraint ai_credit_reservations_lifecycle_check
    check (
      (status = 'RESERVED' and settled_credits = 0 and released_credits = 0 and settled_at is null and released_at is null and release_reason is null)
      or (status = 'SETTLED' and settled_credits = reserved_credits and released_credits = 0 and settled_at is not null and released_at is null and release_reason is null)
      or (status = 'RELEASED' and settled_credits = 0 and released_credits = reserved_credits and settled_at is null and released_at is not null and release_reason is not null)
    )
);

create table public.ai_credit_reservation_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  reservation_id uuid not null,
  allocation_id uuid not null,
  allocated_credits integer not null check (allocated_credits > 0),
  reserved_credits integer not null check (reserved_credits >= 0),
  settled_credits integer not null default 0 check (settled_credits >= 0),
  released_credits integer not null default 0 check (released_credits >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_credit_reservation_allocations_reservation_scope_fkey
    foreign key (tenant_id, hr_group_id, reservation_id)
    references public.ai_credit_reservations(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint ai_credit_reservation_allocations_allocation_scope_fkey
    foreign key (tenant_id, hr_group_id, allocation_id)
    references public.ai_credit_allocations(tenant_id, hr_group_id, id)
    on delete restrict,
  constraint ai_credit_reservation_allocations_key
    unique (reservation_id, allocation_id),
  constraint ai_credit_reservation_allocations_lifecycle_check
    check (reserved_credits + settled_credits + released_credits = allocated_credits)
);

create table public.ai_credit_actor_usage (
  tenant_id uuid not null,
  hr_group_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  period_month date not null check (period_month = date_trunc('month', period_month)::date),
  reserved_credits integer not null default 0 check (reserved_credits >= 0),
  settled_credits integer not null default 0 check (settled_credits >= 0),
  released_credits integer not null default 0 check (released_credits >= 0),
  used_credits integer generated always as (reserved_credits + settled_credits) stored,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_credit_actor_usage_pkey primary key (tenant_id, hr_group_id, actor_user_id, period_month),
  constraint ai_credit_actor_usage_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict
);

create index ai_credit_allocations_scope_expiry_idx
  on public.ai_credit_allocations (tenant_id, hr_group_id, expires_at, granted_at, id);
create index ai_credit_allocations_scope_type_idx
  on public.ai_credit_allocations (tenant_id, hr_group_id, allocation_type, period_month);
create index ai_credit_reservations_scope_status_idx
  on public.ai_credit_reservations (tenant_id, hr_group_id, status, created_at desc);
create index ai_credit_reservations_actor_period_idx
  on public.ai_credit_reservations (tenant_id, hr_group_id, actor_user_id, period_month, created_at desc);
create index ai_credit_reservation_allocations_reservation_idx
  on public.ai_credit_reservation_allocations (tenant_id, hr_group_id, reservation_id);
create index ai_credit_reservation_allocations_allocation_idx
  on public.ai_credit_reservation_allocations (tenant_id, hr_group_id, allocation_id);

create trigger ai_credit_group_policies_updated_at
before update on public.ai_credit_group_policies
for each row execute function internal_security.set_updated_at();
create trigger ai_credit_role_quotas_updated_at
before update on public.ai_credit_role_quotas
for each row execute function internal_security.set_updated_at();
create trigger ai_credit_charge_catalog_updated_at
before update on public.ai_credit_charge_catalog
for each row execute function internal_security.set_updated_at();
create trigger ai_credit_allocations_updated_at
before update on public.ai_credit_allocations
for each row execute function internal_security.set_updated_at();
create trigger ai_credit_reservations_updated_at
before update on public.ai_credit_reservations
for each row execute function internal_security.set_updated_at();
create trigger ai_credit_reservation_allocations_updated_at
before update on public.ai_credit_reservation_allocations
for each row execute function internal_security.set_updated_at();
create trigger ai_credit_actor_usage_updated_at
before update on public.ai_credit_actor_usage
for each row execute function internal_security.set_updated_at();

create or replace function internal_security.prevent_ai_credit_allocation_rewrite()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'AI_CREDIT_ALLOCATION_IMMUTABLE' using errcode = 'P0001';
  end if;

  if new.tenant_id is distinct from old.tenant_id
     or new.hr_group_id is distinct from old.hr_group_id
     or new.allocation_type is distinct from old.allocation_type
     or new.credit_amount is distinct from old.credit_amount
     or new.period_month is distinct from old.period_month
     or new.period_timezone is distinct from old.period_timezone
     or new.granted_at is distinct from old.granted_at
     or new.expires_at is distinct from old.expires_at
     or new.source is distinct from old.source
     or new.source_reference is distinct from old.source_reference
     or new.created_by_user_id is distinct from old.created_by_user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'AI_CREDIT_ALLOCATION_IMMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger ai_credit_allocations_immutable
before update or delete on public.ai_credit_allocations
for each row execute function internal_security.prevent_ai_credit_allocation_rewrite();

revoke all on function internal_security.prevent_ai_credit_allocation_rewrite() from public, anon, authenticated;

-- The current product contract has one canonical fallback timezone. Persisting
-- it per group makes every allowance auditable and leaves a single seam for a
-- future HR-group timezone source.
insert into public.ai_credit_group_policies (tenant_id, hr_group_id, monthly_allowance_credits, time_zone)
select group_row.tenant_id, group_row.id, 100, 'Europe/Amsterdam'
from public.hr_groups group_row
where group_row.is_active
on conflict (tenant_id, hr_group_id) do nothing;

create or replace function internal_security.seed_ai_credit_group_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ai_credit_group_policies (tenant_id, hr_group_id, monthly_allowance_credits, time_zone)
  values (new.tenant_id, new.id, 100, 'Europe/Amsterdam')
  on conflict (tenant_id, hr_group_id) do nothing;
  return new;
end;
$$;

drop trigger if exists seed_ai_credit_group_policy_after_insert on public.hr_groups;
create trigger seed_ai_credit_group_policy_after_insert
after insert on public.hr_groups
for each row execute function internal_security.seed_ai_credit_group_policy();

revoke all on function internal_security.seed_ai_credit_group_policy() from public, anon, authenticated;

create or replace function internal_security.ai_credit_month_start(requested_month text)
returns date
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if requested_month is null or requested_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'AI_CREDIT_MONTH_INVALID' using errcode = '22023';
  end if;
  return to_date(requested_month || '-01', 'YYYY-MM-DD');
end;
$$;

revoke all on function internal_security.ai_credit_month_start(text) from public, anon, authenticated;

create or replace function internal_security.resolve_ai_actor_quota(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_actor_user_id uuid
)
returns table (
  quality_profile text,
  monthly_quota_credits integer,
  role_codes text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with active_roles as (
    select distinct role.code
    from public.user_hr_group_access access
    join public.management_roles role
      on role.id = access.management_role_id
     and (role.tenant_id is null or role.tenant_id = requested_tenant_id)
     and role.is_active
     and role.deleted_at is null
    where access.user_id = requested_actor_user_id
      and access.tenant_id = requested_tenant_id
      and access.hr_group_id = requested_hr_group_id
      and access.is_active
    union
    select distinct role.code
    from public.employees employee
    join public.department_management assignment
      on assignment.employee_id = employee.id
     and assignment.tenant_id = requested_tenant_id
     and assignment.hr_group_id = requested_hr_group_id
     and assignment.effective_from <= current_date
     and (assignment.effective_to is null or assignment.effective_to >= current_date)
    join public.management_roles role
      on role.id = assignment.management_role_id
     and (role.tenant_id is null or role.tenant_id = requested_tenant_id)
     and role.is_active
     and role.deleted_at is null
    where employee.auth_user_id = requested_actor_user_id
      and employee.tenant_id = requested_tenant_id
      and employee.hr_group_id = requested_hr_group_id
      and employee.deleted_at is null
  ), eligible_roles as (
    select active_roles.code,
           quota.quality_profile,
           quota.monthly_quota_credits
    from active_roles
    join public.ai_credit_role_quotas quota
      on quota.role_code = active_roles.code
     and quota.is_active
  ), selected_quota as (
    select eligible_roles.quality_profile,
           eligible_roles.monthly_quota_credits
    from eligible_roles
    group by eligible_roles.quality_profile, eligible_roles.monthly_quota_credits
    order by eligible_roles.monthly_quota_credits desc,
      case eligible_roles.quality_profile when 'IN_DEPTH' then 3 when 'BALANCED' then 2 else 1 end desc
    limit 1
  )
  select selected_quota.quality_profile,
         selected_quota.monthly_quota_credits,
         (select array_agg(eligible_roles.code order by eligible_roles.code) from eligible_roles)
  from selected_quota;
$$;

revoke all on function internal_security.resolve_ai_actor_quota(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function internal_security.expire_ai_credit_allocations(
  requested_tenant_id uuid,
  requested_hr_group_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  expired_count integer;
begin
  update public.ai_credit_allocations allocation
  set expired_credits = allocation.credit_amount - allocation.reserved_credits - allocation.settled_credits,
      updated_at = timezone('utc', now())
  where allocation.tenant_id = requested_tenant_id
    and allocation.hr_group_id = requested_hr_group_id
    and allocation.expires_at is not null
    and allocation.expires_at <= timezone('utc', now())
    and allocation.credit_amount - allocation.reserved_credits - allocation.settled_credits - allocation.expired_credits > 0;

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

revoke all on function internal_security.expire_ai_credit_allocations(uuid, uuid) from public, anon, authenticated;

create or replace function internal_security.ensure_ai_monthly_allowance(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_month text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  period_start date;
  policy_row public.ai_credit_group_policies%rowtype;
begin
  period_start := internal_security.ai_credit_month_start(requested_month);

  select policy.*
  into policy_row
  from public.ai_credit_group_policies policy
  join public.hr_groups group_row
    on group_row.tenant_id = policy.tenant_id
   and group_row.id = policy.hr_group_id
   and group_row.is_active
  where policy.tenant_id = requested_tenant_id
    and policy.hr_group_id = requested_hr_group_id
    and policy.is_active
  for update;

  if not found then
    raise exception 'AI_CREDITS_UNAVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.ai_credit_allocations (
    tenant_id, hr_group_id, allocation_type, credit_amount, period_month,
    period_timezone, granted_at, expires_at, source, source_reference
  )
  values (
    requested_tenant_id,
    requested_hr_group_id,
    'MONTHLY_ALLOWANCE',
    policy_row.monthly_allowance_credits,
    period_start,
    policy_row.time_zone,
    period_start::timestamp at time zone policy_row.time_zone,
    (period_start + interval '1 month')::date::timestamp at time zone policy_row.time_zone,
    'MONTHLY_ALLOWANCE',
    'MONTHLY:' || requested_month
  )
  on conflict (tenant_id, hr_group_id, allocation_type, period_month) do nothing;
end;
$$;

revoke all on function internal_security.ensure_ai_monthly_allowance(uuid, uuid, text) from public, anon, authenticated;

create or replace function internal_security.reserve_ai_credits(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_invocation_id uuid,
  requested_actor_user_id uuid,
  requested_feature_code text,
  requested_charge_reference text,
  requested_month text,
  requested_idempotency_key text
)
returns table (
  reservation_id uuid,
  invocation_id uuid,
  charge_reference text,
  units integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  period_start date;
  charge_units integer;
  group_available integer;
  remaining integer;
  allocation_units integer;
  new_reservation_id uuid;
  policy_row public.ai_credit_group_policies%rowtype;
  existing_reservation public.ai_credit_reservations%rowtype;
  usage_row public.ai_credit_actor_usage%rowtype;
  quota_row record;
  allocation_row record;
begin
  period_start := internal_security.ai_credit_month_start(requested_month);

  select policy.*
  into policy_row
  from public.ai_credit_group_policies policy
  join public.hr_groups group_row
    on group_row.tenant_id = policy.tenant_id
   and group_row.id = policy.hr_group_id
   and group_row.is_active
  where policy.tenant_id = requested_tenant_id
    and policy.hr_group_id = requested_hr_group_id
    and policy.is_active
  for update;
  if not found then
    raise exception 'AI_CREDITS_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.ai_invocations invocation
    where invocation.tenant_id = requested_tenant_id
      and invocation.hr_group_id = requested_hr_group_id
      and invocation.id = requested_invocation_id
      and invocation.actor_user_id = requested_actor_user_id
      and invocation.feature_code = requested_feature_code
      and invocation.idempotency_key = requested_idempotency_key
  ) then
    raise exception 'AI_CREDIT_INVOCATION_SCOPE_INVALID' using errcode = '42501';
  end if;

  select reservation.*
  into existing_reservation
  from public.ai_credit_reservations reservation
  where reservation.tenant_id = requested_tenant_id
    and reservation.hr_group_id = requested_hr_group_id
    and reservation.actor_user_id = requested_actor_user_id
    and reservation.idempotency_key = requested_idempotency_key
  for update;

  if found then
    if existing_reservation.invocation_id <> requested_invocation_id
       or existing_reservation.feature_code <> requested_feature_code
       or existing_reservation.charge_reference <> requested_charge_reference
       or existing_reservation.period_month <> period_start then
      raise exception 'AI_CREDIT_IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    if existing_reservation.status = 'RELEASED' then
      raise exception 'AI_CREDIT_RESERVATION_RELEASED' using errcode = 'P0001';
    end if;
    return query select existing_reservation.id, existing_reservation.invocation_id,
      existing_reservation.charge_reference, existing_reservation.reserved_credits;
    return;
  end if;

  select catalog.credit_amount
  into charge_units
  from public.ai_credit_charge_catalog catalog
  where catalog.feature_code = requested_feature_code
    and catalog.charge_reference = requested_charge_reference
    and catalog.is_active;
  if charge_units is null then
    raise exception 'AI_CREDIT_CHARGE_NOT_CONFIGURED' using errcode = 'P0001';
  end if;

  perform internal_security.ensure_ai_monthly_allowance(
    requested_tenant_id, requested_hr_group_id, requested_month
  );
  perform internal_security.expire_ai_credit_allocations(
    requested_tenant_id, requested_hr_group_id
  );

  select *
  into quota_row
  from internal_security.resolve_ai_actor_quota(
    requested_tenant_id, requested_hr_group_id, requested_actor_user_id
  )
  limit 1;
  if not found then
    raise exception 'AI_CREDIT_QUOTA_UNAVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.ai_credit_actor_usage (
    tenant_id, hr_group_id, actor_user_id, period_month
  )
  values (requested_tenant_id, requested_hr_group_id, requested_actor_user_id, period_start)
  on conflict (tenant_id, hr_group_id, actor_user_id, period_month) do nothing;

  select usage.*
  into usage_row
  from public.ai_credit_actor_usage usage
  where usage.tenant_id = requested_tenant_id
    and usage.hr_group_id = requested_hr_group_id
    and usage.actor_user_id = requested_actor_user_id
    and usage.period_month = period_start
  for update;

  if usage_row.used_credits + charge_units > quota_row.monthly_quota_credits then
    raise exception 'AI_CREDIT_QUOTA_EXHAUSTED' using errcode = 'P0001';
  end if;

  select coalesce(sum(allocation.available_credits), 0)::integer
  into group_available
  from public.ai_credit_allocations allocation
  where allocation.tenant_id = requested_tenant_id
    and allocation.hr_group_id = requested_hr_group_id
    and (allocation.expires_at is null or allocation.expires_at > timezone('utc', now()));

  if group_available < charge_units then
    raise exception 'AI_CREDITS_EXHAUSTED' using errcode = 'P0001';
  end if;

  insert into public.ai_credit_reservations (
    tenant_id, hr_group_id, invocation_id, actor_user_id, feature_code,
    charge_reference, period_month, idempotency_key, reserved_credits
  )
  values (
    requested_tenant_id, requested_hr_group_id, requested_invocation_id,
    requested_actor_user_id, requested_feature_code, requested_charge_reference,
    period_start, requested_idempotency_key, charge_units
  )
  returning id into new_reservation_id;

  remaining := charge_units;
  for allocation_row in
    select allocation.id, allocation.available_credits
    from public.ai_credit_allocations allocation
    where allocation.tenant_id = requested_tenant_id
      and allocation.hr_group_id = requested_hr_group_id
      and (allocation.expires_at is null or allocation.expires_at > timezone('utc', now()))
      and allocation.available_credits > 0
    order by allocation.expires_at is null asc,
      allocation.expires_at asc nulls last,
      allocation.granted_at asc,
      allocation.id asc
    for update
  loop
    exit when remaining = 0;
    allocation_units := least(remaining, allocation_row.available_credits);
    update public.ai_credit_allocations allocation
    set reserved_credits = allocation.reserved_credits + allocation_units,
        updated_at = timezone('utc', now())
    where allocation.id = allocation_row.id
      and allocation.tenant_id = requested_tenant_id
      and allocation.hr_group_id = requested_hr_group_id;

    insert into public.ai_credit_reservation_allocations (
      tenant_id, hr_group_id, reservation_id, allocation_id,
      allocated_credits, reserved_credits
    )
    values (
      requested_tenant_id, requested_hr_group_id, new_reservation_id,
      allocation_row.id, allocation_units, allocation_units
    );
    remaining := remaining - allocation_units;
  end loop;

  if remaining <> 0 then
    raise exception 'AI_CREDITS_UNAVAILABLE' using errcode = 'P0001';
  end if;

  update public.ai_credit_actor_usage usage
  set reserved_credits = usage.reserved_credits + charge_units,
      updated_at = timezone('utc', now())
  where usage.tenant_id = requested_tenant_id
    and usage.hr_group_id = requested_hr_group_id
    and usage.actor_user_id = requested_actor_user_id
    and usage.period_month = period_start;

  return query select new_reservation_id, requested_invocation_id,
    requested_charge_reference, charge_units;
end;
$$;

revoke all on function internal_security.reserve_ai_credits(uuid, uuid, uuid, uuid, text, text, text, text) from public, anon, authenticated;

create or replace function internal_security.settle_ai_credits(
  requested_reservation_id uuid,
  requested_invocation_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  reservation_scope record;
  reservation_row public.ai_credit_reservations%rowtype;
  usage_row public.ai_credit_actor_usage%rowtype;
  link_row record;
  link_total integer := 0;
begin
  select reservation.tenant_id, reservation.hr_group_id
  into reservation_scope
  from public.ai_credit_reservations reservation
  where reservation.id = requested_reservation_id;
  if not found then
    raise exception 'AI_CREDIT_RESERVATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform 1
  from public.ai_credit_group_policies policy
  where policy.tenant_id = reservation_scope.tenant_id
    and policy.hr_group_id = reservation_scope.hr_group_id
    and policy.is_active
  for update;

  select reservation.*
  into reservation_row
  from public.ai_credit_reservations reservation
  where reservation.id = requested_reservation_id
    and reservation.invocation_id = requested_invocation_id
  for update;
  if not found then
    raise exception 'AI_CREDIT_RESERVATION_SCOPE_INVALID' using errcode = '42501';
  end if;
  if reservation_row.status = 'SETTLED' then
    return;
  end if;
  if reservation_row.status <> 'RESERVED' then
    raise exception 'AI_CREDIT_RESERVATION_RELEASED' using errcode = 'P0001';
  end if;

  select usage.*
  into usage_row
  from public.ai_credit_actor_usage usage
  where usage.tenant_id = reservation_row.tenant_id
    and usage.hr_group_id = reservation_row.hr_group_id
    and usage.actor_user_id = reservation_row.actor_user_id
    and usage.period_month = reservation_row.period_month
  for update;
  if not found or usage_row.reserved_credits < reservation_row.reserved_credits then
    raise exception 'AI_CREDIT_USAGE_STATE_INVALID' using errcode = 'P0001';
  end if;

  for link_row in
    select link.*
    from public.ai_credit_reservation_allocations link
    where link.tenant_id = reservation_row.tenant_id
      and link.hr_group_id = reservation_row.hr_group_id
      and link.reservation_id = reservation_row.id
    order by link.allocation_id
    for update
  loop
    link_total := link_total + link_row.allocated_credits;
    if link_row.reserved_credits <> link_row.allocated_credits
       or link_row.settled_credits <> 0
       or link_row.released_credits <> 0 then
      raise exception 'AI_CREDIT_RESERVATION_STATE_INVALID' using errcode = 'P0001';
    end if;

    update public.ai_credit_allocations allocation
    set reserved_credits = allocation.reserved_credits - link_row.allocated_credits,
        settled_credits = allocation.settled_credits + link_row.allocated_credits,
        updated_at = timezone('utc', now())
    where allocation.id = link_row.allocation_id
      and allocation.tenant_id = reservation_row.tenant_id
      and allocation.hr_group_id = reservation_row.hr_group_id
      and allocation.reserved_credits >= link_row.allocated_credits;
    if not found then
      raise exception 'AI_CREDIT_ALLOCATION_STATE_INVALID' using errcode = 'P0001';
    end if;

    update public.ai_credit_reservation_allocations link
    set reserved_credits = 0,
        settled_credits = link.allocated_credits,
        updated_at = timezone('utc', now())
    where link.id = link_row.id;
  end loop;

  if link_total <> reservation_row.reserved_credits then
    raise exception 'AI_CREDIT_RESERVATION_TOTAL_INVALID' using errcode = 'P0001';
  end if;

  update public.ai_credit_actor_usage usage
  set reserved_credits = usage.reserved_credits - reservation_row.reserved_credits,
      settled_credits = usage.settled_credits + reservation_row.reserved_credits,
      updated_at = timezone('utc', now())
  where usage.tenant_id = reservation_row.tenant_id
    and usage.hr_group_id = reservation_row.hr_group_id
    and usage.actor_user_id = reservation_row.actor_user_id
    and usage.period_month = reservation_row.period_month;

  update public.ai_credit_reservations reservation
  set status = 'SETTLED',
      settled_credits = reservation.reserved_credits,
      settled_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where reservation.id = reservation_row.id;
end;
$$;

revoke all on function internal_security.settle_ai_credits(uuid, uuid) from public, anon, authenticated;

create or replace function internal_security.release_ai_credits(
  requested_reservation_id uuid,
  requested_invocation_id uuid,
  requested_reason text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  reservation_scope record;
  reservation_row public.ai_credit_reservations%rowtype;
  usage_row public.ai_credit_actor_usage%rowtype;
  link_row record;
  link_total integer := 0;
begin
  if requested_reason not in ('CONTEXT_FAILED', 'PROVIDER_UNAVAILABLE', 'PROVIDER_FAILED', 'INVALID_RESULT', 'INTERNAL_FAILURE') then
    raise exception 'AI_CREDIT_RELEASE_REASON_INVALID' using errcode = '22023';
  end if;

  select reservation.tenant_id, reservation.hr_group_id
  into reservation_scope
  from public.ai_credit_reservations reservation
  where reservation.id = requested_reservation_id;
  if not found then
    raise exception 'AI_CREDIT_RESERVATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform 1
  from public.ai_credit_group_policies policy
  where policy.tenant_id = reservation_scope.tenant_id
    and policy.hr_group_id = reservation_scope.hr_group_id
    and policy.is_active
  for update;

  -- A reservation may outlive its allocation. Release after the expiry
  -- boundary must keep those credits expired instead of returning them to
  -- the available balance.
  perform internal_security.expire_ai_credit_allocations(
    reservation_scope.tenant_id, reservation_scope.hr_group_id
  );

  select reservation.*
  into reservation_row
  from public.ai_credit_reservations reservation
  where reservation.id = requested_reservation_id
    and reservation.invocation_id = requested_invocation_id
  for update;
  if not found then
    raise exception 'AI_CREDIT_RESERVATION_SCOPE_INVALID' using errcode = '42501';
  end if;
  if reservation_row.status = 'RELEASED' then
    return;
  end if;
  if reservation_row.status = 'SETTLED' then
    raise exception 'AI_CREDIT_RESERVATION_SETTLED' using errcode = 'P0001';
  end if;

  select usage.*
  into usage_row
  from public.ai_credit_actor_usage usage
  where usage.tenant_id = reservation_row.tenant_id
    and usage.hr_group_id = reservation_row.hr_group_id
    and usage.actor_user_id = reservation_row.actor_user_id
    and usage.period_month = reservation_row.period_month
  for update;
  if not found or usage_row.reserved_credits < reservation_row.reserved_credits then
    raise exception 'AI_CREDIT_USAGE_STATE_INVALID' using errcode = 'P0001';
  end if;

  for link_row in
    select link.*
    from public.ai_credit_reservation_allocations link
    where link.tenant_id = reservation_row.tenant_id
      and link.hr_group_id = reservation_row.hr_group_id
      and link.reservation_id = reservation_row.id
    order by link.allocation_id
    for update
  loop
    link_total := link_total + link_row.allocated_credits;
    if link_row.reserved_credits <> link_row.allocated_credits
       or link_row.settled_credits <> 0
       or link_row.released_credits <> 0 then
      raise exception 'AI_CREDIT_RESERVATION_STATE_INVALID' using errcode = 'P0001';
    end if;

    update public.ai_credit_allocations allocation
    set reserved_credits = allocation.reserved_credits - link_row.allocated_credits,
        released_credits = allocation.released_credits + link_row.allocated_credits,
        expired_credits = allocation.expired_credits
          + case when allocation.expires_at <= timezone('utc', now())
                 then link_row.allocated_credits else 0 end,
        updated_at = timezone('utc', now())
    where allocation.id = link_row.allocation_id
      and allocation.tenant_id = reservation_row.tenant_id
      and allocation.hr_group_id = reservation_row.hr_group_id
      and allocation.reserved_credits >= link_row.allocated_credits;
    if not found then
      raise exception 'AI_CREDIT_ALLOCATION_STATE_INVALID' using errcode = 'P0001';
    end if;

    update public.ai_credit_reservation_allocations link
    set reserved_credits = 0,
        released_credits = link.allocated_credits,
        updated_at = timezone('utc', now())
    where link.id = link_row.id;
  end loop;

  if link_total <> reservation_row.reserved_credits then
    raise exception 'AI_CREDIT_RESERVATION_TOTAL_INVALID' using errcode = 'P0001';
  end if;

  update public.ai_credit_actor_usage usage
  set reserved_credits = usage.reserved_credits - reservation_row.reserved_credits,
      released_credits = usage.released_credits + reservation_row.reserved_credits,
      updated_at = timezone('utc', now())
  where usage.tenant_id = reservation_row.tenant_id
    and usage.hr_group_id = reservation_row.hr_group_id
    and usage.actor_user_id = reservation_row.actor_user_id
    and usage.period_month = reservation_row.period_month;

  update public.ai_credit_reservations reservation
  set status = 'RELEASED',
      released_credits = reservation.reserved_credits,
      released_at = timezone('utc', now()),
      release_reason = requested_reason,
      updated_at = timezone('utc', now())
  where reservation.id = reservation_row.id;
end;
$$;

revoke all on function internal_security.release_ai_credits(uuid, uuid, text) from public, anon, authenticated;

create or replace function internal_security.get_ai_group_credit_balance(
  requested_tenant_id uuid,
  requested_hr_group_id uuid
)
returns table (
  total_credits integer,
  monthly_allowance_credits integer,
  purchased_extra_credits integer,
  test_grant_credits integer,
  reserved_credits integer,
  settled_credits integer,
  expired_credits integer,
  available_credits integer,
  as_of timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.ai_credit_group_policies policy
    where policy.tenant_id = requested_tenant_id
      and policy.hr_group_id = requested_hr_group_id
      and policy.is_active
  ) then
    raise exception 'AI_CREDITS_UNAVAILABLE' using errcode = 'P0001';
  end if;

  perform internal_security.expire_ai_credit_allocations(requested_tenant_id, requested_hr_group_id);

  return query
  select coalesce(sum(allocation.credit_amount), 0)::integer,
    coalesce(sum(allocation.credit_amount) filter (where allocation.allocation_type = 'MONTHLY_ALLOWANCE'), 0)::integer,
    coalesce(sum(allocation.credit_amount) filter (where allocation.allocation_type = 'PURCHASED_EXTRA'), 0)::integer,
    coalesce(sum(allocation.credit_amount) filter (where allocation.allocation_type = 'TEST_GRANT'), 0)::integer,
    coalesce(sum(allocation.reserved_credits), 0)::integer,
    coalesce(sum(allocation.settled_credits), 0)::integer,
    coalesce(sum(allocation.expired_credits), 0)::integer,
    coalesce(sum(allocation.available_credits), 0)::integer,
    now()
  from public.ai_credit_allocations allocation
  where allocation.tenant_id = requested_tenant_id
    and allocation.hr_group_id = requested_hr_group_id;
end;
$$;

revoke all on function internal_security.get_ai_group_credit_balance(uuid, uuid) from public, anon, authenticated;

create or replace function internal_security.get_ai_actor_quota(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_actor_user_id uuid,
  requested_month text
)
returns table (
  period_month date,
  quality_profile text,
  monthly_quota_credits integer,
  reserved_credits integer,
  settled_credits integer,
  released_credits integer,
  used_credits integer,
  remaining_credits integer,
  role_codes text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  period_start date;
begin
  period_start := internal_security.ai_credit_month_start(requested_month);
  return query
  with quota as (
    select resolved.quality_profile, resolved.monthly_quota_credits, resolved.role_codes
    from internal_security.resolve_ai_actor_quota(
      requested_tenant_id, requested_hr_group_id, requested_actor_user_id
    ) resolved
    limit 1
  ), usage as (
    select actor_usage.reserved_credits, actor_usage.settled_credits, actor_usage.released_credits
    from public.ai_credit_actor_usage actor_usage
    where actor_usage.tenant_id = requested_tenant_id
      and actor_usage.hr_group_id = requested_hr_group_id
      and actor_usage.actor_user_id = requested_actor_user_id
      and actor_usage.period_month = period_start
  )
  select period_start,
    quota.quality_profile,
    quota.monthly_quota_credits,
    coalesce(usage.reserved_credits, 0),
    coalesce(usage.settled_credits, 0),
    coalesce(usage.released_credits, 0),
    coalesce(usage.reserved_credits, 0) + coalesce(usage.settled_credits, 0),
    greatest(0, quota.monthly_quota_credits - coalesce(usage.reserved_credits, 0) - coalesce(usage.settled_credits, 0)),
    quota.role_codes
  from quota
  left join usage on true;
end;
$$;

revoke all on function internal_security.get_ai_actor_quota(uuid, uuid, uuid, text) from public, anon, authenticated;

create or replace function internal_security.get_ai_reservation_allocations(
  requested_reservation_id uuid,
  requested_invocation_id uuid
)
returns table (
  reservation_id uuid,
  allocation_id uuid,
  allocation_type text,
  period_month date,
  expires_at timestamptz,
  allocated_credits integer,
  reserved_credits integer,
  settled_credits integer,
  released_credits integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select link.reservation_id,
    link.allocation_id,
    allocation.allocation_type,
    allocation.period_month,
    allocation.expires_at,
    link.allocated_credits,
    link.reserved_credits,
    link.settled_credits,
    link.released_credits,
    link.created_at
  from public.ai_credit_reservation_allocations link
  join public.ai_credit_allocations allocation
    on allocation.tenant_id = link.tenant_id
   and allocation.hr_group_id = link.hr_group_id
   and allocation.id = link.allocation_id
  join public.ai_credit_reservations reservation
    on reservation.tenant_id = link.tenant_id
   and reservation.hr_group_id = link.hr_group_id
   and reservation.id = link.reservation_id
   and reservation.invocation_id = requested_invocation_id
  where link.reservation_id = requested_reservation_id
  order by allocation.expires_at is null asc,
    allocation.expires_at asc nulls last,
    allocation.granted_at asc,
    allocation.id asc;
$$;

revoke all on function internal_security.get_ai_reservation_allocations(uuid, uuid) from public, anon, authenticated;

-- Public RPC wrappers are deliberately executable only with service_role. No
-- customer or authenticated client can fabricate balances or mutate ledger
-- state through the Data API.
create function public.ensure_ai_monthly_allowance(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_month text
)
returns void
language sql
volatile
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
  select internal_security.ensure_ai_monthly_allowance(
    requested_tenant_id, requested_hr_group_id, requested_month
  );
$$;

create function public.reserve_ai_credits(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_invocation_id uuid,
  requested_actor_user_id uuid,
  requested_feature_code text,
  requested_charge_reference text,
  requested_month text,
  requested_idempotency_key text
)
returns table (reservation_id uuid, invocation_id uuid, charge_reference text, units integer)
language sql
volatile
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
  select * from internal_security.reserve_ai_credits(
    requested_tenant_id, requested_hr_group_id, requested_invocation_id,
    requested_actor_user_id, requested_feature_code, requested_charge_reference,
    requested_month, requested_idempotency_key
  );
$$;

create function public.settle_ai_credits(
  requested_reservation_id uuid,
  requested_invocation_id uuid
)
returns void
language sql
volatile
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
  select internal_security.settle_ai_credits(requested_reservation_id, requested_invocation_id);
$$;

create function public.release_ai_credits(
  requested_reservation_id uuid,
  requested_invocation_id uuid,
  requested_reason text
)
returns void
language sql
volatile
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
  select internal_security.release_ai_credits(
    requested_reservation_id, requested_invocation_id, requested_reason
  );
$$;

create function public.get_ai_group_credit_balance(
  requested_tenant_id uuid,
  requested_hr_group_id uuid
)
returns table (
  total_credits integer,
  monthly_allowance_credits integer,
  purchased_extra_credits integer,
  test_grant_credits integer,
  reserved_credits integer,
  settled_credits integer,
  expired_credits integer,
  available_credits integer,
  as_of timestamptz
)
language sql
volatile
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
  select * from internal_security.get_ai_group_credit_balance(
    requested_tenant_id, requested_hr_group_id
  );
$$;

create function public.get_ai_actor_quota(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_actor_user_id uuid,
  requested_month text
)
returns table (
  period_month date,
  quality_profile text,
  monthly_quota_credits integer,
  reserved_credits integer,
  settled_credits integer,
  released_credits integer,
  used_credits integer,
  remaining_credits integer,
  role_codes text[]
)
language sql
stable
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
  select * from internal_security.get_ai_actor_quota(
    requested_tenant_id, requested_hr_group_id, requested_actor_user_id, requested_month
  );
$$;

create function public.get_ai_reservation_allocations(
  requested_reservation_id uuid,
  requested_invocation_id uuid
)
returns table (
  reservation_id uuid,
  allocation_id uuid,
  allocation_type text,
  period_month date,
  expires_at timestamptz,
  allocated_credits integer,
  reserved_credits integer,
  settled_credits integer,
  released_credits integer,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
  select * from internal_security.get_ai_reservation_allocations(
    requested_reservation_id, requested_invocation_id
  );
$$;

revoke all on function public.ensure_ai_monthly_allowance(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.reserve_ai_credits(uuid, uuid, uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.settle_ai_credits(uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_ai_credits(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.get_ai_group_credit_balance(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_ai_actor_quota(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.get_ai_reservation_allocations(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ensure_ai_monthly_allowance(uuid, uuid, text) to service_role;
grant execute on function public.reserve_ai_credits(uuid, uuid, uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.settle_ai_credits(uuid, uuid) to service_role;
grant execute on function public.release_ai_credits(uuid, uuid, text) to service_role;
grant execute on function public.get_ai_group_credit_balance(uuid, uuid) to service_role;
grant execute on function public.get_ai_actor_quota(uuid, uuid, uuid, text) to service_role;
grant execute on function public.get_ai_reservation_allocations(uuid, uuid) to service_role;

-- Public wrappers remain security-invoker endpoints. The server role must
-- explicitly be able to reach their security-definer implementation.
grant usage on schema internal_security to service_role;
grant execute on function internal_security.ensure_ai_monthly_allowance(uuid, uuid, text) to service_role;
grant execute on function internal_security.reserve_ai_credits(uuid, uuid, uuid, uuid, text, text, text, text) to service_role;
grant execute on function internal_security.settle_ai_credits(uuid, uuid) to service_role;
grant execute on function internal_security.release_ai_credits(uuid, uuid, text) to service_role;
grant execute on function internal_security.get_ai_group_credit_balance(uuid, uuid) to service_role;
grant execute on function internal_security.get_ai_actor_quota(uuid, uuid, uuid, text) to service_role;
grant execute on function internal_security.get_ai_reservation_allocations(uuid, uuid) to service_role;

-- The only synthetic allocation seam is explicitly non-production and cannot
-- be called by a customer. It requires a transaction-local test-mode setting;
-- production has no setting for this function and therefore fails closed.
create function public.grant_ai_controlled_test_credits(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_credit_amount integer,
  requested_source_reference text
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
declare
  allocation_id uuid;
begin
  if coalesce(current_setting('app.environment', true), '') not in ('test', 'development')
     or coalesce(current_setting('app.ai_credits_test_mode', true), '') <> 'true' then
    raise exception 'AI_CREDIT_TEST_MODE_DISABLED' using errcode = '42501';
  end if;
  if requested_credit_amount is null or requested_credit_amount <= 0
     or requested_source_reference is null
     or requested_source_reference not like 'CONTROLLED_TEST:%' then
    raise exception 'AI_CREDIT_TEST_INPUT_INVALID' using errcode = '22023';
  end if;

  insert into public.ai_credit_allocations (
    tenant_id, hr_group_id, allocation_type, credit_amount, period_timezone,
    granted_at, expires_at, source, source_reference
  )
  select requested_tenant_id, requested_hr_group_id, 'TEST_GRANT', requested_credit_amount,
    policy.time_zone, timezone('utc', now()), timezone('utc', now()) + interval '12 months',
    'CONTROLLED_TEST', requested_source_reference
  from public.ai_credit_group_policies policy
  where policy.tenant_id = requested_tenant_id
    and policy.hr_group_id = requested_hr_group_id
    and policy.is_active
  returning id into allocation_id;

  if allocation_id is null then
    raise exception 'AI_CREDITS_UNAVAILABLE' using errcode = 'P0001';
  end if;
  return allocation_id;
end;
$$;

revoke all on function public.grant_ai_controlled_test_credits(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.grant_ai_controlled_test_credits(uuid, uuid, integer, text) to service_role;

alter table public.ai_credit_group_policies enable row level security;
alter table public.ai_credit_role_quotas enable row level security;
alter table public.ai_credit_charge_catalog enable row level security;
alter table public.ai_credit_allocations enable row level security;
alter table public.ai_credit_reservations enable row level security;
alter table public.ai_credit_reservation_allocations enable row level security;
alter table public.ai_credit_actor_usage enable row level security;

create policy ai_credit_group_policies_select_scoped
on public.ai_credit_group_policies for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'ai:credits-manage')));

create policy ai_credit_allocations_select_scoped
on public.ai_credit_allocations for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'ai:credits-manage')));

create policy ai_credit_reservations_select_scoped
on public.ai_credit_reservations for select to authenticated
using (
  (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (
    actor_user_id = (select auth.uid())
    or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'ai:credits-manage'))
  )
);

create policy ai_credit_reservation_allocations_select_scoped
on public.ai_credit_reservation_allocations for select to authenticated
using (
  (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and exists (
    select 1
    from public.ai_credit_reservations reservation
    where reservation.tenant_id = ai_credit_reservation_allocations.tenant_id
      and reservation.hr_group_id = ai_credit_reservation_allocations.hr_group_id
      and reservation.id = ai_credit_reservation_allocations.reservation_id
      and (
        reservation.actor_user_id = (select auth.uid())
        or (select internal_security.current_user_has_hr_group_permission(reservation.tenant_id, reservation.hr_group_id, 'ai:credits-manage'))
      )
  )
);

create policy ai_credit_actor_usage_select_scoped
on public.ai_credit_actor_usage for select to authenticated
using (
  (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (
    actor_user_id = (select auth.uid())
    or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'ai:credits-manage'))
  )
);

revoke all on table
  public.ai_credit_group_policies,
  public.ai_credit_role_quotas,
  public.ai_credit_charge_catalog,
  public.ai_credit_allocations,
  public.ai_credit_reservations,
  public.ai_credit_reservation_allocations,
  public.ai_credit_actor_usage
from public, anon, authenticated;

grant select on table
  public.ai_credit_group_policies,
  public.ai_credit_allocations,
  public.ai_credit_reservations,
  public.ai_credit_reservation_allocations,
  public.ai_credit_actor_usage
to authenticated;

grant all on table
  public.ai_credit_group_policies,
  public.ai_credit_role_quotas,
  public.ai_credit_charge_catalog,
  public.ai_credit_allocations,
  public.ai_credit_reservations,
  public.ai_credit_reservation_allocations,
  public.ai_credit_actor_usage
to service_role;

comment on table public.ai_credit_group_policies is
  'HR-groepgebonden Liquid Credits allowance policy; wijzigingen raken historische allocations niet.';
comment on table public.ai_credit_role_quotas is
  'Globale role-based monthly quota catalogus; individuele overrides bestaan niet in Wave 1B.';
comment on table public.ai_credit_charge_catalog is
  'Server-side vaste Liquid Credit charge per feature en kwaliteitsprofiel; provider tokens staan hier niet in.';
comment on table public.ai_credit_allocations is
  'Traceerbare Liquid Credits batches met historische expiry- en accountingcounters.';
comment on table public.ai_credit_reservations is
  'Atomische Liquid Credits reservation per AI-invocation met idempotency en lifecycle.';
comment on table public.ai_credit_reservation_allocations is
  'Deterministische batchconsumptie per reservation; elke creditbeweging blijft herleidbaar.';
comment on table public.ai_credit_actor_usage is
  'Actorgebruik per HR-groep en kalendermaand voor role-based quota enforcement.';

commit;
