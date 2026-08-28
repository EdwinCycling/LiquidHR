begin;

-- Provider safety is technical governance only. No prompt, response, or HR content is stored.
alter table public.ai_invocations
  drop constraint if exists ai_invocations_failure_code_check;
alter table public.ai_invocations
  add constraint ai_invocations_failure_code_check
  check (failure_code is null or failure_code in (
    'UNAUTHORIZED', 'FEATURE_UNAVAILABLE', 'FEATURE_NOT_ENTITLED', 'AI_DISABLED',
    'QUOTA_REACHED', 'CREDITS_EXHAUSTED', 'CREDITS_UNAVAILABLE',
    'DUPLICATE_IN_FLIGHT', 'DUPLICATE_COMPLETED', 'IDEMPOTENCY_KEY_REUSED',
    'PROVIDER_UNAVAILABLE', 'PROVIDER_FAILED', 'AI_PROVIDER_DISABLED',
    'AI_PROVIDER_HOURLY_LIMIT', 'AI_PROVIDER_DAILY_LIMIT',
    'AI_PROVIDER_CONCURRENCY_LIMIT', 'AI_PROVIDER_INVOCATION_LIMIT',
    'AI_PROVIDER_INPUT_TOO_LARGE', 'AI_PROVIDER_OUTPUT_TOO_LARGE',
    'AI_PROVIDER_SAFETY_UNAVAILABLE', 'INVALID_RESULT',
    'INTERNAL_CONFIGURATION_ERROR'
  ));

alter table public.ai_business_audit
  drop constraint if exists ai_business_audit_failure_code_check;
alter table public.ai_business_audit
  add constraint ai_business_audit_failure_code_check
  check (failure_code is null or failure_code in (
    'UNAUTHORIZED', 'FEATURE_UNAVAILABLE', 'FEATURE_NOT_ENTITLED', 'AI_DISABLED',
    'QUOTA_REACHED', 'CREDITS_EXHAUSTED', 'CREDITS_UNAVAILABLE',
    'DUPLICATE_IN_FLIGHT', 'DUPLICATE_COMPLETED', 'IDEMPOTENCY_KEY_REUSED',
    'PROVIDER_UNAVAILABLE', 'PROVIDER_FAILED', 'AI_PROVIDER_DISABLED',
    'AI_PROVIDER_HOURLY_LIMIT', 'AI_PROVIDER_DAILY_LIMIT',
    'AI_PROVIDER_CONCURRENCY_LIMIT', 'AI_PROVIDER_INVOCATION_LIMIT',
    'AI_PROVIDER_INPUT_TOO_LARGE', 'AI_PROVIDER_OUTPUT_TOO_LARGE',
    'AI_PROVIDER_SAFETY_UNAVAILABLE', 'INVALID_RESULT',
    'INTERNAL_CONFIGURATION_ERROR'
  ));

create table public.ai_provider_safety_environments (
  environment text primary key check (environment in ('test', 'development', 'production')),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.ai_provider_execution_leases (
  id uuid primary key default gen_random_uuid(),
  environment text not null references public.ai_provider_safety_environments(environment) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  hr_group_id uuid not null,
  invocation_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  reserved_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'COMPLETED')),
  completed_at timestamptz,
  constraint ai_provider_execution_leases_invocation_scope_fkey
    foreign key (tenant_id, hr_group_id, invocation_id)
    references public.ai_invocations(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint ai_provider_execution_leases_invocation_key unique (invocation_id),
  constraint ai_provider_execution_leases_expiry_check check (expires_at > reserved_at),
  constraint ai_provider_execution_leases_completed_check check (
    (status = 'ACTIVE' and completed_at is null) or
    (status = 'COMPLETED' and completed_at is not null)
  )
);

create index ai_provider_execution_leases_environment_reserved_idx
  on public.ai_provider_execution_leases (environment, reserved_at desc);
create index ai_provider_execution_leases_environment_active_idx
  on public.ai_provider_execution_leases (environment, status, expires_at);

insert into public.ai_provider_safety_environments (environment)
values ('test'), ('development'), ('production')
on conflict (environment) do nothing;

alter table public.ai_provider_safety_environments enable row level security;
alter table public.ai_provider_execution_leases enable row level security;
revoke all on table public.ai_provider_safety_environments, public.ai_provider_execution_leases from public, anon, authenticated;
grant select, insert on table public.ai_provider_safety_environments to service_role;
grant select, insert, update on table public.ai_provider_execution_leases to service_role;

create or replace function internal_security.reserve_ai_provider_execution(
  requested_environment text,
  requested_invocation_id uuid,
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_actor_user_id uuid,
  requested_input_size_characters integer,
  requested_feature_max_input_characters integer,
  requested_output_tokens integer,
  requested_max_calls_per_hour integer,
  requested_max_calls_per_day integer,
  requested_max_concurrent integer,
  requested_global_max_output_tokens integer,
  requested_global_max_input_characters integer,
  requested_lease_seconds integer,
  requested_enabled boolean
)
returns table (
  allowed boolean,
  block_reason text,
  lease_id uuid,
  invocation_id uuid,
  environment text,
  counted_at timestamptz,
  expires_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  now_value timestamptz := clock_timestamp();
  hour_start timestamptz := date_trunc('hour', now_value at time zone 'UTC') at time zone 'UTC';
  day_start timestamptz := date_trunc('day', now_value at time zone 'UTC') at time zone 'UTC';
  hourly_count integer;
  daily_count integer;
  concurrent_count integer;
  new_lease public.ai_provider_execution_leases%rowtype;
begin
  if requested_environment not in ('test', 'development', 'production')
     or requested_input_size_characters < 0
     or requested_feature_max_input_characters <= 0
     or requested_output_tokens <= 0
     or requested_max_calls_per_hour <= 0
     or requested_max_calls_per_day <= 0
     or requested_max_calls_per_hour > requested_max_calls_per_day
     or requested_max_concurrent <= 0
     or requested_global_max_output_tokens <= 0
     or requested_global_max_input_characters <= 0
     or requested_lease_seconds <= 0
     or requested_lease_seconds > 1000000 then
    raise exception 'AI_PROVIDER_SAFETY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.ai_invocations invocation
    where invocation.id = requested_invocation_id
      and invocation.tenant_id = requested_tenant_id
      and invocation.hr_group_id = requested_hr_group_id
      and invocation.actor_user_id = requested_actor_user_id
  ) then
    raise exception 'AI_PROVIDER_SAFETY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  perform 1
  from public.ai_provider_safety_environments safety_environment
  where safety_environment.environment = requested_environment
  for update;
  if not found then
    raise exception 'AI_PROVIDER_SAFETY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if not requested_enabled then
    return query select false, 'AI_PROVIDER_DISABLED', null::uuid, requested_invocation_id, requested_environment, null::timestamptz, null::timestamptz;
    return;
  end if;

  if requested_input_size_characters > requested_global_max_input_characters
     or requested_input_size_characters > requested_feature_max_input_characters then
    return query select false, 'AI_PROVIDER_INPUT_TOO_LARGE', null::uuid, requested_invocation_id, requested_environment, null::timestamptz, null::timestamptz;
    return;
  end if;
  if requested_output_tokens > requested_global_max_output_tokens then
    return query select false, 'AI_PROVIDER_OUTPUT_TOO_LARGE', null::uuid, requested_invocation_id, requested_environment, null::timestamptz, null::timestamptz;
    return;
  end if;
  if exists (
    select 1 from public.ai_provider_execution_leases lease
    where lease.invocation_id = requested_invocation_id
  ) then
    return query select false, 'AI_PROVIDER_INVOCATION_LIMIT', null::uuid, requested_invocation_id, requested_environment, null::timestamptz, null::timestamptz;
    return;
  end if;

  select count(*)::integer into hourly_count
  from public.ai_provider_execution_leases lease
  where lease.environment = requested_environment and lease.reserved_at >= hour_start;
  if hourly_count >= requested_max_calls_per_hour then
    return query select false, 'AI_PROVIDER_HOURLY_LIMIT', null::uuid, requested_invocation_id, requested_environment, null::timestamptz, null::timestamptz;
    return;
  end if;

  select count(*)::integer into daily_count
  from public.ai_provider_execution_leases lease
  where lease.environment = requested_environment and lease.reserved_at >= day_start;
  if daily_count >= requested_max_calls_per_day then
    return query select false, 'AI_PROVIDER_DAILY_LIMIT', null::uuid, requested_invocation_id, requested_environment, null::timestamptz, null::timestamptz;
    return;
  end if;

  select count(*)::integer into concurrent_count
  from public.ai_provider_execution_leases lease
  where lease.environment = requested_environment
    and lease.status = 'ACTIVE'
    and lease.expires_at > now_value;
  if concurrent_count >= requested_max_concurrent then
    return query select false, 'AI_PROVIDER_CONCURRENCY_LIMIT', null::uuid, requested_invocation_id, requested_environment, null::timestamptz, null::timestamptz;
    return;
  end if;

  insert into public.ai_provider_execution_leases (
    environment, tenant_id, hr_group_id, invocation_id, actor_user_id,
    reserved_at, expires_at
  )
  values (
    requested_environment, requested_tenant_id, requested_hr_group_id, requested_invocation_id, requested_actor_user_id,
    now_value, now_value + make_interval(secs => requested_lease_seconds)
  )
  returning * into new_lease;

  return query select true, null::text, new_lease.id, new_lease.invocation_id,
    new_lease.environment, new_lease.reserved_at, new_lease.expires_at;
end;
$$;

create or replace function public.reserve_ai_provider_execution(
  requested_environment text,
  requested_invocation_id uuid,
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_actor_user_id uuid,
  requested_input_size_characters integer,
  requested_feature_max_input_characters integer,
  requested_output_tokens integer,
  requested_max_calls_per_hour integer,
  requested_max_calls_per_day integer,
  requested_max_concurrent integer,
  requested_global_max_output_tokens integer,
  requested_global_max_input_characters integer,
  requested_lease_seconds integer,
  requested_enabled boolean
)
returns table (
  allowed boolean,
  block_reason text,
  lease_id uuid,
  invocation_id uuid,
  environment text,
  counted_at timestamptz,
  expires_at timestamptz
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from internal_security.reserve_ai_provider_execution(
    requested_environment, requested_invocation_id, requested_tenant_id, requested_hr_group_id,
    requested_actor_user_id, requested_input_size_characters, requested_feature_max_input_characters,
    requested_output_tokens, requested_max_calls_per_hour, requested_max_calls_per_day,
    requested_max_concurrent, requested_global_max_output_tokens, requested_global_max_input_characters,
    requested_lease_seconds, requested_enabled
  );
$$;

create or replace function internal_security.complete_ai_provider_execution(
  requested_lease_id uuid,
  requested_invocation_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.ai_provider_execution_leases lease
  set status = 'COMPLETED', completed_at = clock_timestamp()
  where lease.id = requested_lease_id
    and lease.invocation_id = requested_invocation_id
    and lease.status = 'ACTIVE';
  if found then return; end if;
  if exists (
    select 1 from public.ai_provider_execution_leases lease
    where lease.id = requested_lease_id and lease.invocation_id = requested_invocation_id and lease.status = 'COMPLETED'
  ) then return; end if;
  raise exception 'AI_PROVIDER_SAFETY_UNAVAILABLE' using errcode = 'P0001';
end;
$$;

create or replace function public.complete_ai_provider_execution(
  requested_lease_id uuid,
  requested_invocation_id uuid
)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select internal_security.complete_ai_provider_execution(requested_lease_id, requested_invocation_id);
$$;

revoke all on table public.ai_provider_safety_environments, public.ai_provider_execution_leases from public, anon, authenticated;
revoke all on function internal_security.reserve_ai_provider_execution(text, uuid, uuid, uuid, uuid, integer, integer, integer, integer, integer, integer, integer, integer, integer, boolean) from public, anon, authenticated;
revoke all on function internal_security.complete_ai_provider_execution(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reserve_ai_provider_execution(text, uuid, uuid, uuid, uuid, integer, integer, integer, integer, integer, integer, integer, integer, integer, boolean) from public, anon, authenticated;
revoke all on function public.complete_ai_provider_execution(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_ai_provider_execution(text, uuid, uuid, uuid, uuid, integer, integer, integer, integer, integer, integer, integer, integer, integer, boolean) to service_role;
grant execute on function public.complete_ai_provider_execution(uuid, uuid) to service_role;

comment on table public.ai_provider_execution_leases is 'Technical provider-call leases only; no prompts, responses, or HR content.';
comment on function public.reserve_ai_provider_execution(text, uuid, uuid, uuid, uuid, integer, integer, integer, integer, integer, integer, integer, integer, integer, boolean) is 'Atomic service-only provider safety reservation with UTC hour/day caps and expiring concurrency lease.';

commit;
