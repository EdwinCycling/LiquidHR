-- APIAI-07 forward-only repair: Supabase places OAuth client_id in event.claims.
create or replace function public.apiai07_custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  requested_client_id text := nullif(claims ->> 'client_id', '');
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

comment on function public.apiai07_custom_access_token_hook(jsonb) is
  'Adds the exact LiquidHR TEST MCP audience only to active, consent-registered APIAI-07 OAuth clients; reads OAuth client_id from the Custom Access Token hook claims and preserves the authenticated Supabase audience.';
