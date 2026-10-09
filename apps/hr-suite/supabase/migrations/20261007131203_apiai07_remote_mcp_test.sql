begin;

-- TEST-only extension for APIAI-07. The APIAI-01 tables and RPCs already exist
-- on the authorized synthetic TEST project; this migration adds one fixed
-- resource, one bounded active policy, a narrow consent-time registration
-- RPC, and a custom token hook that binds registered MCP tokens to the exact
-- TEST resource while preserving the authenticated audience used by Supabase.
-- It creates no new table and exposes no direct table access.
alter table internal_security.api_rate_limit_policies
  drop constraint if exists api_rate_limit_policies_resource_key_check;
alter table internal_security.api_rate_limit_policies
  add constraint api_rate_limit_policies_resource_key_check
  check (resource_key in ('workforce-summary', 'team-skills', 'development-plans', 'employee-self-service'));

alter table internal_security.api_client_registrations
  drop constraint if exists api_client_registrations_resources_check;
alter table internal_security.api_client_registrations
  add constraint api_client_registrations_resources_check
  check (
    cardinality(allowed_resource_keys) > 0
    and allowed_resource_keys <@ array[
      'workforce-summary', 'team-skills', 'development-plans', 'employee-self-service'
    ]::text[]
  );

alter table internal_security.api_rate_limit_buckets
  drop constraint if exists api_rate_limit_buckets_resource_check;
alter table internal_security.api_rate_limit_buckets
  add constraint api_rate_limit_buckets_resource_check
  check (resource_key in ('workforce-summary', 'team-skills', 'development-plans', 'employee-self-service'));

insert into internal_security.api_rate_limit_policies (
  resource_key, burst_capacity, refill_per_second, is_active
) values (
  'employee-self-service', 5, 0.1, true
)
on conflict (resource_key) do update
set burst_capacity = excluded.burst_capacity,
    refill_per_second = excluded.refill_per_second,
    is_active = true,
    updated_at = timezone('utc', now());

create or replace function internal_security.api_client_claim_is_registered(
  requested_client_id text,
  requested_resource_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and requested_client_id is not null
    and requested_resource_key in ('workforce-summary', 'team-skills', 'development-plans', 'employee-self-service')
    and requested_client_id = nullif((select auth.jwt() ->> 'client_id'), '')
    and exists (
      select 1
      from internal_security.api_client_registrations registration
      where registration.issuer = nullif((select auth.jwt() ->> 'iss'), '')
        and registration.client_id = requested_client_id
        and registration.is_active
        and requested_resource_key = any(registration.allowed_resource_keys)
        and (
          registration.audience = (select auth.jwt() ->> 'aud')
          or (
            jsonb_typeof((select auth.jwt() -> 'aud')) = 'array'
            and exists (
              select 1
              from jsonb_array_elements_text(
                case
                  when jsonb_typeof((select auth.jwt() -> 'aud')) = 'array'
                    then (select auth.jwt() -> 'aud')
                  else '[]'::jsonb
                end
              ) claim_audience(value)
              where claim_audience.value = registration.audience
            )
          )
        )
    );
$$;

revoke all on function internal_security.api_client_claim_is_registered(text, text)
  from public, anon;
grant execute on function internal_security.api_client_claim_is_registered(text, text)
  to authenticated;

-- Client registration is fixed to the confirmed TEST Auth issuer, audience,
-- and self-service resource. Only the trusted server-side consent action can
-- call this function; the caller cannot select a tenant or widen tool scope.
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
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
    or requested_client_id is null
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

revoke all on function public.register_apiai07_mcp_client(text)
  from public, anon, authenticated, service_role;
grant execute on function public.register_apiai07_mcp_client(text)
  to service_role;

-- Supabase's OAuth server currently issues aud=authenticated and validates but
-- does not bind RFC 8707 resource indicators into access tokens. This hook
-- adds the MCP URL only for clients explicitly allowlisted after the user's
-- consent; retaining authenticated keeps the bearer valid for the existing
-- Supabase RLS/PostgREST path. Other token types and clients remain unchanged.
create or replace function public.apiai07_custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  requested_client_id text := nullif(event ->> 'client_id', '');
begin
  if jsonb_typeof(claims) <> 'object' then
    raise exception 'APIAI07_TOKEN_HOOK_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if requested_client_id is not null and exists (
    select 1
    from internal_security.api_client_registrations registration
    where registration.issuer = 'https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1'
      and registration.audience = 'authenticated'
      and registration.client_id = requested_client_id
      and registration.is_active
      and 'employee-self-service' = any(registration.allowed_resource_keys)
  ) then
    claims := jsonb_set(
      claims,
      '{aud}',
      jsonb_build_array('https://liquid-hr-hr-suite.vercel.app/mcp', 'authenticated'),
      true
    );
  end if;

  return jsonb_build_object('claims', claims);
end;
$$;

revoke all on function public.apiai07_custom_access_token_hook(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.apiai07_custom_access_token_hook(jsonb)
  to supabase_auth_admin;

alter table public.audit_logs
  drop constraint if exists audit_logs_api_resource_key_check,
  drop constraint if exists audit_logs_api_outcome_check,
  drop constraint if exists audit_logs_api_read_metadata_contract;

alter table public.audit_logs
  add constraint audit_logs_api_resource_key_check
  check (
    api_resource_key is null
    or api_resource_key in ('workforce-summary', 'team-skills', 'development-plans', 'employee-self-service')
  ),
  add constraint audit_logs_api_outcome_check
  check (api_outcome is null or api_outcome in ('ALLOWED', 'DENIED', 'RATE_LIMITED', 'FAILED')),
  add constraint audit_logs_api_read_metadata_contract
  check (
    action <> 'READ'
    or entity_name <> 'api_resource'
    or (api_outcome = 'ALLOWED' and api_status_code between 200 and 299)
    or (api_outcome = 'DENIED' and api_status_code in (403, 404))
    or (api_outcome = 'RATE_LIMITED' and api_status_code = 429)
    or (api_outcome = 'FAILED' and api_status_code between 500 and 599)
  );

drop policy if exists audit_logs_insert_api_read on public.audit_logs;
create policy audit_logs_insert_api_read
on public.audit_logs for insert to service_role
with check (
  coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  and entity_name = 'api_resource'
  and entity_id is null
  and action = 'READ'
  and changes = '{}'::jsonb
  and subject_employee_id is null
  and employment_id is null
  and change_set_id is null
  and hr_group_id is not null
  and actor_user_id is not null
  and correlation_id is not null
  and correlation_id <> '00000000-0000-0000-0000-000000000000'::uuid
  and (
    (api_outcome = 'ALLOWED' and api_status_code between 200 and 299)
    or (api_outcome = 'DENIED' and api_status_code in (403, 404))
    or (api_outcome = 'RATE_LIMITED' and api_status_code = 429)
    or (api_outcome = 'FAILED' and api_status_code between 500 and 599)
  )
);

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
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
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

revoke all on function public.record_api_read_audit(uuid, uuid, uuid, uuid, text, text, uuid, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.record_api_read_audit(uuid, uuid, uuid, uuid, text, text, uuid, text, integer)
  to service_role;

comment on function public.register_apiai07_mcp_client(text) is
  'APIAI-07 TEST-only consent-time allowlist registration; fixed to the LiquidHR TEST issuer and employee-self-service resource.';
comment on function public.apiai07_custom_access_token_hook(jsonb) is
  'Adds the exact LiquidHR TEST MCP audience only to active, consent-registered APIAI-07 OAuth clients; preserves the authenticated Supabase audience.';
comment on function public.record_api_read_audit(uuid, uuid, uuid, uuid, text, text, uuid, text, integer) is
  'Canonical APIAI-01/APIAI-07 READ audit sink. FAILED outcomes are limited to HTTP 5xx and remain service_role-only.';

commit;
