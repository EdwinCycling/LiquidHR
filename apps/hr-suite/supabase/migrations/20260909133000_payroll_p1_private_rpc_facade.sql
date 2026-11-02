begin;

-- payroll_private is intentionally not a PostgREST-exposed schema. These
-- narrowly scoped RPCs are the only server-side bridge for the P1 credential
-- and OAuth-state operations; they never grant access to the private tables.
create function public.payroll_private_insert_oauth_state(
  requested_state_hash text,
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_provider_id uuid,
  requested_connection_id uuid,
  requested_initiated_by_user_id uuid,
  requested_redirect_uri text,
  requested_requested_scopes text[],
  requested_expires_at timestamptz
)
returns void
language sql
security definer
set search_path = pg_catalog
as $$
  insert into payroll_private.payroll_oauth_states (
    state_hash,
    tenant_id,
    hr_group_id,
    provider_id,
    connection_id,
    initiated_by_user_id,
    redirect_uri,
    requested_scopes,
    expires_at
  )
  values (
    requested_state_hash,
    requested_tenant_id,
    requested_hr_group_id,
    requested_provider_id,
    requested_connection_id,
    requested_initiated_by_user_id,
    requested_redirect_uri,
    requested_requested_scopes,
    requested_expires_at
  );
$$;

create function public.payroll_private_consume_oauth_state(
  requested_state_hash text,
  requested_consumed_at timestamptz
)
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $$
  update payroll_private.payroll_oauth_states
  set consumed_at = requested_consumed_at
  where state_hash = requested_state_hash
    and consumed_at is null
    and expires_at > requested_consumed_at
  returning jsonb_build_object(
    'state_hash', state_hash,
    'tenant_id', tenant_id,
    'hr_group_id', hr_group_id,
    'provider_id', provider_id,
    'connection_id', connection_id,
    'initiated_by_user_id', initiated_by_user_id,
    'redirect_uri', redirect_uri,
    'requested_scopes', requested_scopes,
    'expires_at', expires_at,
    'consumed_at', consumed_at,
    'created_at', created_at
  );
$$;

create function public.payroll_private_latest_credential(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_connection_id uuid
)
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'tenant_id', tenant_id,
    'hr_group_id', hr_group_id,
    'connection_id', connection_id,
    'credential_version', credential_version,
    'encrypted_access_token', encrypted_access_token,
    'encrypted_refresh_token', encrypted_refresh_token,
    'expires_at', expires_at,
    'provider_metadata', provider_metadata,
    'created_at', created_at,
    'updated_at', updated_at
  )
  from payroll_private.payroll_connection_credentials
  where tenant_id = requested_tenant_id
    and hr_group_id = requested_hr_group_id
    and connection_id = requested_connection_id
  order by credential_version desc
  limit 1;
$$;

create function public.payroll_private_insert_credential(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_connection_id uuid,
  requested_credential_version integer,
  requested_encrypted_access_token text,
  requested_encrypted_refresh_token text,
  requested_expires_at timestamptz,
  requested_provider_metadata jsonb
)
returns void
language sql
security definer
set search_path = pg_catalog
as $$
  insert into payroll_private.payroll_connection_credentials (
    tenant_id,
    hr_group_id,
    connection_id,
    credential_version,
    encrypted_access_token,
    encrypted_refresh_token,
    expires_at,
    provider_metadata
  )
  values (
    requested_tenant_id,
    requested_hr_group_id,
    requested_connection_id,
    requested_credential_version,
    requested_encrypted_access_token,
    requested_encrypted_refresh_token,
    requested_expires_at,
    requested_provider_metadata
  );
$$;

create function public.payroll_private_delete_credentials(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_connection_id uuid
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  deleted_count integer;
begin
  delete from payroll_private.payroll_connection_credentials
  where tenant_id = requested_tenant_id
    and hr_group_id = requested_hr_group_id
    and connection_id = requested_connection_id;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.payroll_private_insert_oauth_state(text, uuid, uuid, uuid, uuid, uuid, text, text[], timestamptz) from public, anon, authenticated;
revoke all on function public.payroll_private_consume_oauth_state(text, timestamptz) from public, anon, authenticated;
revoke all on function public.payroll_private_latest_credential(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.payroll_private_insert_credential(uuid, uuid, uuid, integer, text, text, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.payroll_private_delete_credentials(uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function public.payroll_private_insert_oauth_state(text, uuid, uuid, uuid, uuid, uuid, text, text[], timestamptz) to service_role;
grant execute on function public.payroll_private_consume_oauth_state(text, timestamptz) to service_role;
grant execute on function public.payroll_private_latest_credential(uuid, uuid, uuid) to service_role;
grant execute on function public.payroll_private_insert_credential(uuid, uuid, uuid, integer, text, text, timestamptz, jsonb) to service_role;
grant execute on function public.payroll_private_delete_credentials(uuid, uuid, uuid) to service_role;

comment on function public.payroll_private_insert_oauth_state(text, uuid, uuid, uuid, uuid, uuid, text, text[], timestamptz) is 'Server-only Payroll OAuth state insert bridge; callable only by service_role.';
comment on function public.payroll_private_consume_oauth_state(text, timestamptz) is 'Atomic one-time Payroll OAuth state consume bridge; callable only by service_role.';
comment on function public.payroll_private_latest_credential(uuid, uuid, uuid) is 'Server-only latest Payroll credential read bridge; callable only by service_role.';
comment on function public.payroll_private_insert_credential(uuid, uuid, uuid, integer, text, text, timestamptz, jsonb) is 'Server-only encrypted Payroll credential insert bridge; callable only by service_role.';
comment on function public.payroll_private_delete_credentials(uuid, uuid, uuid) is 'Server-only Payroll credential delete bridge; callable only by service_role.';

commit;
