begin;

set local search_path = public, extensions;
select plan(18);

select ok(
  has_function_privilege('service_role', 'public.register_apiai07_mcp_client(text)', 'execute'),
  'service_role can call the consent-time registration RPC'
);
select ok(
  not has_function_privilege('anon', 'public.register_apiai07_mcp_client(text)', 'execute'),
  'anon cannot call the consent-time registration RPC'
);
select ok(
  not has_function_privilege('authenticated', 'public.register_apiai07_mcp_client(text)', 'execute'),
  'authenticated cannot call the consent-time registration RPC'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc function_row
    cross join lateral pg_catalog.aclexplode(function_row.proacl) privilege
    where function_row.oid = 'public.register_apiai07_mcp_client(text)'::regprocedure
      and privilege.privilege_type = 'EXECUTE'
      and (
        privilege.grantee = 0
        or privilege.grantee in (
          select role_row.oid from pg_catalog.pg_roles role_row
          where role_row.rolname in ('anon', 'authenticated')
        )
      )
  ),
  'PUBLIC, anon and authenticated have no direct EXECUTE grant'
);
select ok(
  not has_table_privilege('authenticated', 'internal_security.api_client_registrations', 'select'),
  'authenticated cannot read the registration table directly'
);
select ok(
  not has_table_privilege('anon', 'internal_security.api_client_registrations', 'select'),
  'anon cannot read the registration table directly'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '', true);
select is(
  public.register_apiai07_mcp_client('00000000-0000-4000-8000-000000000007') ->> 'registered',
  'true',
  'legacy single role claim is accepted'
);

select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(
  public.register_apiai07_mcp_client('00000000-0000-4000-8000-000000000007') ->> 'registered',
  'true',
  'modern JSON role claim is accepted'
);

reset role;
select is(
  (
    select count(*)::integer
    from internal_security.api_client_registrations
    where issuer = 'https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1'
      and audience = 'authenticated'
      and client_id = '00000000-0000-4000-8000-000000000007'
  ),
  1,
  'repeat registration upserts exactly one row'
);
select is(
  (
    select issuer
    from internal_security.api_client_registrations
    where client_id = '00000000-0000-4000-8000-000000000007'
  ),
  'https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1',
  'registration binds the confirmed TEST issuer'
);
select is(
  (
    select audience
    from internal_security.api_client_registrations
    where client_id = '00000000-0000-4000-8000-000000000007'
  ),
  'authenticated',
  'registration keeps the Supabase authenticated audience'
);
select is(
  (
    select allowed_resource_keys
    from internal_security.api_client_registrations
    where client_id = '00000000-0000-4000-8000-000000000007'
  ),
  array['employee-self-service']::text[],
  'registration grants only the Employee self-service resource'
);
select ok(
  (
    select is_active
    from internal_security.api_client_registrations
    where client_id = '00000000-0000-4000-8000-000000000007'
  ),
  'registration is active'
);

set local role service_role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select throws_ok(
  $$select public.register_apiai07_mcp_client('not-a-uuid')$$,
  '42501',
  'APIAI07_CLIENT_REGISTRATION_UNAVAILABLE',
  'malformed OAuth client identifiers are rejected'
);
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$select public.register_apiai07_mcp_client('00000000-0000-4000-8000-000000000007')$$,
  '42501',
  'APIAI07_CLIENT_REGISTRATION_UNAVAILABLE',
  'a service-role connection without a service-role claim is denied'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000008","iss":"https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1","aud":["https://liquid-hr-hr-suite.vercel.app/mcp","authenticated"],"client_id":"00000000-0000-4000-8000-000000000007"}',
  true
);
select ok(
  internal_security.api_client_claim_is_registered(
    '00000000-0000-4000-8000-000000000007',
    'employee-self-service'
  ),
  'authenticated bearer remains bound to its active registered client and Employee resource'
);
select ok(
  not internal_security.api_client_claim_is_registered(
    '00000000-0000-4000-8000-000000000009',
    'employee-self-service'
  ),
  'a substituted OAuth client id remains rejected'
);
select ok(
  not internal_security.api_client_claim_is_registered(
    '00000000-0000-4000-8000-000000000007',
    'team-skills'
  ),
  'the registered bearer does not gain a different resource scope'
);

reset role;
select * from finish();
rollback;
