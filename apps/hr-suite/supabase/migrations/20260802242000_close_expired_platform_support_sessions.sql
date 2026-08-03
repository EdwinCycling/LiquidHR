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

  with expired_sessions as (
    update public.platform_support_sessions support_session
    set status = 'ENDED',
        ended_at = timezone('utc', now())
    where support_session.operator_user_id = auth.uid()
      and support_session.status = 'ACTIVE'
      and support_session.expires_at <= timezone('utc', now())
    returning support_session.id, support_session.tenant_id
  )
  insert into public.platform_audit_logs (
    tenant_id,
    actor_user_id,
    action,
    reason,
    after_state
  )
  select
    expired_session.tenant_id,
    auth.uid(),
    'SUPPORT_SESSION_ENDED',
    'Alleen-lezen supportmodus verliep automatisch.',
    jsonb_build_object('sessionId', expired_session.id, 'reasonCode', 'EXPIRED')
  from expired_sessions expired_session;

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
