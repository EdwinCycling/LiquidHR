begin;

-- Keep APIAI-07 client registration service-role-only while supporting both
-- legacy single-claim JWTs and the current JSON request.jwt.claims envelope.
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
  if coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      ''
    ) <> 'service_role'
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

revoke all on function public.register_apiai07_mcp_client(text)
  from public, anon, authenticated, service_role;
grant execute on function public.register_apiai07_mcp_client(text)
  to service_role;

comment on function public.register_apiai07_mcp_client(text) is
  'APIAI-07 TEST-only client registration. Accepts a Supabase role claim in either legacy or JSON request format and remains executable only by service_role.';

commit;
