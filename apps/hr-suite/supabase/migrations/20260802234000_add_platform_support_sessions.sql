create type public.platform_support_session_status as enum ('ACTIVE', 'ENDED');

create table public.platform_support_sessions (
  id uuid primary key default gen_random_uuid(),
  operator_user_id uuid not null references auth.users(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  mode text not null default 'READ_ONLY',
  reason text not null,
  status public.platform_support_session_status not null default 'ACTIVE',
  started_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint platform_support_sessions_mode_read_only check (mode = 'READ_ONLY'),
  constraint platform_support_sessions_reason_not_blank check (btrim(reason) <> ''),
  constraint platform_support_sessions_expiry_after_start check (expires_at > started_at),
  constraint platform_support_sessions_end_state_consistent check (
    (status = 'ACTIVE' and ended_at is null)
    or (status = 'ENDED' and ended_at is not null)
  )
);

create index platform_support_sessions_operator_idx
  on public.platform_support_sessions (operator_user_id, started_at desc);
create index platform_support_sessions_tenant_idx
  on public.platform_support_sessions (tenant_id, started_at desc);
create unique index platform_support_sessions_one_active_per_operator_idx
  on public.platform_support_sessions (operator_user_id)
  where status = 'ACTIVE';

alter table public.platform_support_sessions enable row level security;
revoke all on table public.platform_support_sessions from public, anon, authenticated;

create or replace function internal_security.start_platform_support_session(
  requested_tenant_id uuid,
  requested_reason text,
  requested_duration_minutes integer
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, internal_security, auth, pg_temp
as $$
declare
  new_session_id uuid;
  session_expires_at timestamptz;
begin
  if not internal_security.is_platform_operator(array[
    'OWNER'::public.platform_operator_role,
    'OPERATOR'::public.platform_operator_role
  ]) then
    raise exception 'PLATFORM_SUPPORT_ACCESS_DENIED' using errcode = '42501';
  end if;

  if length(btrim(requested_reason)) < 5 or length(btrim(requested_reason)) > 500 then
    raise exception 'PLATFORM_SUPPORT_REASON_REQUIRED' using errcode = '22023';
  end if;

  if requested_duration_minutes not in (15, 30, 60) then
    raise exception 'PLATFORM_SUPPORT_DURATION_INVALID' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.tenants tenant
    where tenant.id = requested_tenant_id
      and tenant.is_active
  ) then
    raise exception 'PLATFORM_SUPPORT_TENANT_NOT_ACTIVE' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.platform_support_sessions support_session
    where support_session.operator_user_id = auth.uid()
      and support_session.status = 'ACTIVE'
  ) then
    raise exception 'PLATFORM_SUPPORT_SESSION_ALREADY_ACTIVE' using errcode = '55000';
  end if;

  session_expires_at := timezone('utc', now()) + make_interval(mins => requested_duration_minutes);

  insert into public.platform_support_sessions (
    operator_user_id,
    tenant_id,
    reason,
    expires_at
  )
  values (
    auth.uid(),
    requested_tenant_id,
    btrim(requested_reason),
    session_expires_at
  )
  returning id into new_session_id;

  insert into public.platform_audit_logs (
    tenant_id,
    actor_user_id,
    action,
    reason,
    after_state
  )
  values (
    requested_tenant_id,
    auth.uid(),
    'SUPPORT_SESSION_STARTED',
    btrim(requested_reason),
    jsonb_build_object(
      'sessionId', new_session_id,
      'mode', 'READ_ONLY',
      'expiresAt', session_expires_at
    )
  );

  return new_session_id;
end;
$$;

create or replace function internal_security.get_platform_support_read_model(
  requested_session_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, internal_security, auth, pg_temp
as $$
  with support_scope as (
    select
      support_session.id,
      support_session.expires_at,
      platform_operator.display_name as operator_display_name,
      platform_operator.role as operator_role,
      tenant.id as tenant_id,
      tenant.name as tenant_name,
      tenant.slug as tenant_slug,
      tenant.administration_mode
    from public.platform_support_sessions support_session
    join public.platform_operators platform_operator
      on platform_operator.user_id = support_session.operator_user_id
     and platform_operator.is_active
    join public.tenants tenant on tenant.id = support_session.tenant_id
    where support_session.id = requested_session_id
      and support_session.operator_user_id = auth.uid()
      and support_session.status = 'ACTIVE'
      and support_session.expires_at > timezone('utc', now())
  ),
  tenant_metrics as (
    select
      support_scope.*,
      (select count(*)::integer
       from public.administrations administration
       where administration.tenant_id = support_scope.tenant_id) as administration_count,
      (select count(*)::integer
       from public.employees employee
       where employee.tenant_id = support_scope.tenant_id
         and employee.deleted_at is null) as employee_count,
      (select count(*)::integer
       from public.employments employment
       where employment.tenant_id = support_scope.tenant_id
         and employment.deleted_at is null
         and employment.record_status = 'CONFIRMED'
         and employment.starts_on <= current_date
         and (employment.ends_on is null or employment.ends_on >= current_date)) as active_employment_count
    from support_scope
  )
  select case when metrics.tenant_id is null then null else jsonb_build_object(
    'sessionId', metrics.id,
    'operator', jsonb_build_object(
      'displayName', metrics.operator_display_name,
      'role', metrics.operator_role
    ),
    'expiresAt', metrics.expires_at,
    'tenant', jsonb_build_object(
      'id', metrics.tenant_id,
      'name', metrics.tenant_name,
      'slug', metrics.tenant_slug,
      'administrationMode', metrics.administration_mode
    ),
    'summary', jsonb_build_object(
      'administrationCount', metrics.administration_count,
      'employeeCount', metrics.employee_count,
      'activeEmploymentCount', metrics.active_employment_count
    ),
    'administrations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', administration.id,
        'code', administration.code,
        'name', administration.name,
        'isActive', administration.is_active
      ) order by administration.name)
      from public.administrations administration
      where administration.tenant_id = metrics.tenant_id
    ), '[]'::jsonb),
    'employees', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', employee.id,
        'employeeNumber', employee.employee_number,
        'firstName', employee.first_name,
        'lastName', employee.birth_name
      ) order by employee.birth_name, employee.first_name, employee.employee_number)
      from (
        select employee.id, employee.employee_number, employee.first_name, employee.birth_name
        from public.employees employee
        where employee.tenant_id = metrics.tenant_id
          and employee.deleted_at is null
        order by employee.birth_name, employee.first_name, employee.employee_number
        limit 100
      ) employee
    ), '[]'::jsonb),
    'employeeListTruncated', metrics.employee_count > 100
  ) end
  from tenant_metrics metrics;
$$;

create or replace function internal_security.end_platform_support_session(
  requested_session_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, internal_security, auth, pg_temp
as $$
declare
  ended_tenant_id uuid;
begin
  if not internal_security.is_platform_operator(array[
    'OWNER'::public.platform_operator_role,
    'OPERATOR'::public.platform_operator_role
  ]) then
    raise exception 'PLATFORM_SUPPORT_ACCESS_DENIED' using errcode = '42501';
  end if;

  update public.platform_support_sessions support_session
  set status = 'ENDED',
      ended_at = timezone('utc', now())
  where support_session.id = requested_session_id
    and support_session.operator_user_id = auth.uid()
    and support_session.status = 'ACTIVE'
  returning support_session.tenant_id into ended_tenant_id;

  if ended_tenant_id is null then
    return false;
  end if;

  insert into public.platform_audit_logs (
    tenant_id,
    actor_user_id,
    action,
    reason,
    after_state
  )
  values (
    ended_tenant_id,
    auth.uid(),
    'SUPPORT_SESSION_ENDED',
    'Alleen-lezen supportmodus beëindigd.',
    jsonb_build_object('sessionId', requested_session_id)
  );

  return true;
end;
$$;

revoke all on function internal_security.start_platform_support_session(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function internal_security.get_platform_support_read_model(uuid)
  from public, anon, authenticated;
revoke all on function internal_security.end_platform_support_session(uuid)
  from public, anon, authenticated;
grant execute on function internal_security.start_platform_support_session(uuid, text, integer) to authenticated;
grant execute on function internal_security.get_platform_support_read_model(uuid) to authenticated;
grant execute on function internal_security.end_platform_support_session(uuid) to authenticated;

create or replace function public.start_platform_support_session(
  requested_tenant_id uuid,
  requested_reason text,
  requested_duration_minutes integer
)
returns uuid
language sql
volatile
security invoker
set search_path = pg_catalog, public, internal_security, auth, pg_temp
as $$
  select internal_security.start_platform_support_session(
    requested_tenant_id,
    requested_reason,
    requested_duration_minutes
  );
$$;

create or replace function public.get_platform_support_read_model(requested_session_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public, internal_security, auth, pg_temp
as $$
  select internal_security.get_platform_support_read_model(requested_session_id);
$$;

create or replace function public.end_platform_support_session(requested_session_id uuid)
returns boolean
language sql
volatile
security invoker
set search_path = pg_catalog, public, internal_security, auth, pg_temp
as $$
  select internal_security.end_platform_support_session(requested_session_id);
$$;

revoke all on function public.start_platform_support_session(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.get_platform_support_read_model(uuid)
  from public, anon, authenticated;
revoke all on function public.end_platform_support_session(uuid)
  from public, anon, authenticated;
grant execute on function public.start_platform_support_session(uuid, text, integer) to authenticated;
grant execute on function public.get_platform_support_read_model(uuid) to authenticated;
grant execute on function public.end_platform_support_session(uuid) to authenticated;
