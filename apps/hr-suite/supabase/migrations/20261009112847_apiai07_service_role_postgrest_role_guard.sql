begin;

-- Secret API keys are mapped to PostgREST's service_role without adding a JWT
-- role claim. Check the effective PostgREST role instead of request JWT claims.
create or replace function public.register_apiai07_mcp_client(
  requested_client_id text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce(nullif(current_setting('role', true), ''), '') <> 'service_role'
    or requested_client_id is null
    or requested_client_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or length(btrim(requested_client_id)) not between 1 and 128
    or requested_client_id <> btrim(requested_client_id)
    or requested_client_id ~ '[[:cntrl:]]'
  then
    raise exception 'APIAI07_CLIENT_REGISTRATION_UNAVAILABLE' using errcode = '42501';
  end if;

  insert into internal_security.api_client_registrations (
    issuer, audience, client_id, allowed_resource_keys, is_active
  ) values (
    'https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1',
    'authenticated',
    requested_client_id,
    array['employee-self-service']::text[],
    true
  )
  on conflict (issuer, audience, client_id) do update
  set allowed_resource_keys = excluded.allowed_resource_keys,
      is_active = true,
      updated_at = timezone('utc', now());

  return jsonb_build_object('registered', true);
end;
$$;

create or replace function public.record_api_read_audit(
  requested_tenant_id uuid,
  requested_actor_user_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_resource_key text,
  requested_oauth_client_id text,
  requested_correlation_id uuid,
  requested_outcome text,
  requested_status_code integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce(nullif(current_setting('role', true), ''), '') <> 'service_role' then
    raise exception 'API_READ_AUDIT_UNAVAILABLE' using errcode = '42501';
  end if;

  if requested_tenant_id is null
    or requested_actor_user_id is null
    or requested_hr_group_id is null
    or requested_resource_key not in ('workforce-summary', 'team-skills', 'development-plans', 'employee-self-service')
    or requested_oauth_client_id is null
    or length(btrim(requested_oauth_client_id)) not between 1 and 128
    or requested_oauth_client_id <> btrim(requested_oauth_client_id)
    or requested_oauth_client_id ~ '[[:cntrl:]]'
    or requested_correlation_id is null
    or requested_correlation_id = '00000000-0000-0000-0000-000000000000'::uuid
    or requested_outcome not in ('ALLOWED', 'DENIED', 'RATE_LIMITED', 'FAILED')
    or requested_status_code is null
    or requested_status_code not between 100 and 599
    or not (
      (requested_outcome = 'ALLOWED' and requested_status_code between 200 and 299)
      or (requested_outcome = 'DENIED' and requested_status_code in (403, 404))
      or (requested_outcome = 'RATE_LIMITED' and requested_status_code = 429)
      or (requested_outcome = 'FAILED' and requested_status_code between 500 and 599)
    )
  then
    raise exception 'API_READ_AUDIT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if not exists (select 1 from auth.users user_row where user_row.id = requested_actor_user_id) then
    raise exception 'API_READ_AUDIT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.hr_groups group_row
    where group_row.tenant_id = requested_tenant_id
      and group_row.id = requested_hr_group_id
      and group_row.is_active
  ) then
    raise exception 'API_READ_AUDIT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if requested_administration_id is not null and not exists (
    select 1 from public.administrations administration
    where administration.tenant_id = requested_tenant_id
      and administration.hr_group_id = requested_hr_group_id
      and administration.id = requested_administration_id
      and administration.is_active
  ) then
    raise exception 'API_READ_AUDIT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.user_hr_group_access access
    where access.user_id = requested_actor_user_id
      and access.tenant_id = requested_tenant_id
      and access.hr_group_id = requested_hr_group_id
      and access.is_active
  ) then
    raise exception 'API_READ_AUDIT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if requested_administration_id is not null and not exists (
    select 1 from public.user_access access
    where access.user_id = requested_actor_user_id
      and access.tenant_id = requested_tenant_id
      and access.is_active
      and (
        (access.scope_type = 'TENANT' and access.administration_id is null)
        or (access.scope_type = 'ADMINISTRATION' and access.administration_id = requested_administration_id)
      )
  ) then
    raise exception 'API_READ_AUDIT_UNAVAILABLE' using errcode = '42501';
  end if;

  insert into public.audit_logs (
    tenant_id, administration_id, entity_name, entity_id, actor_user_id,
    action, changes, hr_group_id, api_resource_key, api_client_id,
    api_outcome, api_status_code, correlation_id
  ) values (
    requested_tenant_id, requested_administration_id, 'api_resource', null,
    requested_actor_user_id, 'READ', '{}'::jsonb, requested_hr_group_id,
    requested_resource_key, requested_oauth_client_id, requested_outcome,
    requested_status_code, requested_correlation_id
  );

  return jsonb_build_object('recorded', true);
end;
$$;

commit;
