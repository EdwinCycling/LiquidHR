begin;

set local search_path = public, extensions;
select plan(36);

select has_table(
  'internal_security',
  'api_rate_limit_policies',
  'limiter policies are stored in the private security schema'
);
select has_table(
  'internal_security',
  'api_client_registrations',
  'API clients have a database-side registration boundary'
);
select has_table(
  'internal_security',
  'api_rate_limit_buckets',
  'limiter buckets are stored in the private security schema'
);
select has_column('public', 'audit_logs', 'hr_group_id', 'API audit rows carry their HR-group scope');
select has_column('public', 'audit_logs', 'api_resource_key', 'API audit rows carry the fixed resource key');
select has_column('public', 'audit_logs', 'api_client_id', 'API audit rows carry the verified client id');
select has_column('public', 'audit_logs', 'api_outcome', 'API audit rows carry a bounded outcome');
select has_column('public', 'audit_logs', 'api_status_code', 'API audit rows carry a bounded HTTP status');
select has_function(
  'public',
  'consume_api_rate_limit',
  array['uuid', 'uuid', 'text', 'text'],
  'authenticated callers have a narrow limiter RPC'
);
select has_function(
  'public',
  'record_api_read_audit',
  array['uuid', 'uuid', 'uuid', 'text', 'text', 'uuid', 'text', 'integer'],
  'authenticated callers have a narrow read-audit RPC'
);

select ok(
  not has_table_privilege('authenticated', 'internal_security.api_rate_limit_policies', 'select'),
  'authenticated cannot read limiter policy storage directly'
);
select ok(
  not has_table_privilege('authenticated', 'internal_security.api_client_registrations', 'select'),
  'authenticated cannot read client registration storage directly'
);
select ok(
  not has_table_privilege('authenticated', 'internal_security.api_rate_limit_buckets', 'select'),
  'authenticated cannot read limiter bucket storage directly'
);
select ok(
  not has_function_privilege('anon', 'public.consume_api_rate_limit(uuid,uuid,text,text)', 'execute'),
  'anon cannot call the limiter RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.consume_api_rate_limit(uuid,uuid,text,text)', 'execute'),
  'authenticated can call the limiter RPC'
);
select ok(
  not has_function_privilege('anon', 'public.record_api_read_audit(uuid,uuid,uuid,text,text,uuid,text,integer)', 'execute'),
  'anon cannot call the read-audit RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.record_api_read_audit(uuid,uuid,uuid,text,text,uuid,text,integer)', 'execute'),
  'authenticated can call the read-audit RPC'
);
select ok(
  exists (
    select 1
    from pg_policy
    where polrelid = 'internal_security.api_rate_limit_buckets'::regclass
      and polname = 'api_rate_limit_buckets_no_direct_access'
      and pg_get_expr(polqual, polrelid) = 'false'
  ),
  'limiter bucket RLS is deny-by-default'
);
select ok(
  exists (
    select 1
    from pg_proc
    where oid = 'internal_security.consume_api_rate_limit_internal(uuid,uuid,text,text)'::regprocedure
      and prosecdef
      and proconfig @> array['search_path=""']::text[]
      and prosrc like '%pg_advisory_xact_lock%'
  ),
  'limiter RPC uses a security-definer database lock for atomic bucket consumption'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.audit_logs'::regclass
      and conname = 'audit_logs_api_read_entity_contract'
      and pg_get_constraintdef(oid) like '%entity_id IS NULL%'
  ),
  'only the API resource READ contract permits a nullable entity id'
);
select ok(
  exists (
    select 1
    from pg_policy
    where polrelid = 'public.audit_logs'::regclass
      and polname = 'audit_logs_insert_api_read'
      and pg_get_expr(polwithcheck, polrelid) like '%api_client_claim_is_registered%'
  ),
  'API READ insert policy binds client claims and scope'
);
select ok(
  exists (
    select 1
    from pg_policy
    where polrelid = 'public.audit_logs'::regclass
      and polname = 'audit_logs_select_scoped'
      and pg_get_expr(polqual, polrelid) like '%has_hr_group_access%'
  ),
  'audit SELECT policy enforces HR-group isolation'
);

do $fixture$
declare
  hr_user_id uuid;
  tenant_id_value uuid;
  hr_group_id_value uuid;
  administration_id_value uuid;
  inaccessible_administration_id_value uuid;
  employee_user_id uuid;
  issuer_value text := 'https://issuer.apiai01.test';
  audience_value text := 'liquidhr-api';
  client_id_value text := 'client-liquidhr-test';
  correlation_id_value uuid := '33333333-3333-4333-8333-333333333333';
begin
  select id into hr_user_id
  from auth.users
  where lower(email) = 'hradmin.fixture@liquidhr.test'
  limit 1;

  select access.tenant_id, access.hr_group_id
  into tenant_id_value, hr_group_id_value
  from public.user_hr_group_access access
  where access.user_id = hr_user_id
    and access.is_active
  order by access.tenant_id, access.hr_group_id
  limit 1;

  select id into employee_user_id
  from auth.users
  where lower(email) = 'employee.fixture@liquidhr.test'
  limit 1;

  if hr_user_id is null or tenant_id_value is null or hr_group_id_value is null then
    raise exception 'APIAI01_DB_FIXTURE_MISSING';
  end if;

  -- Find a real administration-scoped actor and a second active administration
  -- in the same HR group.  The negative below must exercise the existing
  -- administration access helper rather than rely on a fabricated id.
  select accessible.id, inaccessible.id
  into administration_id_value, inaccessible_administration_id_value
  from public.user_access access
  join public.administrations accessible
    on accessible.tenant_id = access.tenant_id
   and accessible.id = access.administration_id
   and accessible.hr_group_id = hr_group_id_value
   and accessible.is_active
  join public.administrations inaccessible
    on inaccessible.tenant_id = access.tenant_id
   and inaccessible.hr_group_id = hr_group_id_value
   and inaccessible.is_active
   and inaccessible.id <> accessible.id
  where access.user_id = hr_user_id
    and access.tenant_id = tenant_id_value
    and access.scope_type = 'ADMINISTRATION'
    and access.is_active
    and not exists (
      select 1
      from public.user_access tenant_access
      where tenant_access.user_id = hr_user_id
        and tenant_access.tenant_id = tenant_id_value
        and tenant_access.scope_type = 'TENANT'
        and tenant_access.is_active
    )
    and not exists (
      select 1
      from public.user_access denied_access
      where denied_access.user_id = hr_user_id
        and denied_access.tenant_id = tenant_id_value
        and denied_access.scope_type = 'ADMINISTRATION'
        and denied_access.administration_id = inaccessible.id
        and denied_access.is_active
    )
  order by accessible.id, inaccessible.id
  limit 1;

  if inaccessible_administration_id_value is null then
    raise exception 'APIAI01_ADMIN_SCOPE_FIXTURE_MISSING';
  end if;

  insert into internal_security.api_client_registrations (
    issuer, audience, client_id, allowed_resource_keys, is_active
  ) values (
    issuer_value,
    audience_value,
    client_id_value,
    array['development-plans', 'workforce-summary', 'team-skills']::text[],
    true
  );

  update internal_security.api_rate_limit_policies
  set burst_capacity = 2,
      refill_per_second = 0.000001,
      is_active = true
  where resource_key in ('development-plans', 'workforce-summary');

  update internal_security.api_rate_limit_policies
  set burst_capacity = 1,
      refill_per_second = 0.000001,
      is_active = true
  where resource_key = 'team-skills';

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', hr_user_id,
      'role', 'authenticated',
      'iss', issuer_value,
      'aud', audience_value,
      'client_id', client_id_value
    )::text,
    true
  );
  perform set_config('app.apiai01_tenant_id', tenant_id_value::text, true);
  perform set_config('app.apiai01_hr_group_id', hr_group_id_value::text, true);
  perform set_config('app.apiai01_administration_id', administration_id_value::text, true);
  perform set_config(
    'app.apiai01_inaccessible_administration_id',
    inaccessible_administration_id_value::text,
    true
  );
  perform set_config('app.apiai01_hr_user_id', hr_user_id::text, true);
  perform set_config('app.apiai01_employee_user_id', coalesce(employee_user_id, hr_user_id)::text, true);
  perform set_config('app.apiai01_issuer', issuer_value, true);
  perform set_config('app.apiai01_audience', audience_value, true);
  perform set_config('app.apiai01_client_id', client_id_value, true);
  perform set_config('app.apiai01_correlation_id', correlation_id_value::text, true);
end;
$fixture$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('app.apiai01_hr_user_id'),
    'role', 'authenticated',
    'iss', current_setting('app.apiai01_issuer'),
    'aud', current_setting('app.apiai01_audience'),
    'client_id', current_setting('app.apiai01_client_id')
  )::text,
  true
);

select is(
  public.consume_api_rate_limit(
    current_setting('app.apiai01_tenant_id')::uuid,
    current_setting('app.apiai01_hr_group_id')::uuid,
    'development-plans',
    current_setting('app.apiai01_client_id')
  ),
  '{"allowed": true, "remaining": 1}'::jsonb,
  'first request consumes one token from the actor/client/resource bucket'
);

select is(
  public.consume_api_rate_limit(
    current_setting('app.apiai01_tenant_id')::uuid,
    current_setting('app.apiai01_hr_group_id')::uuid,
    'development-plans',
    current_setting('app.apiai01_client_id')
  ),
  '{"allowed": true, "remaining": 0}'::jsonb,
  'second request consumes the final burst token'
);

select ok(
  (
    select (request.decision ->> 'allowed')::boolean = false
      and (request.decision ->> 'remaining')::integer = 0
    from (
      select public.consume_api_rate_limit(
        current_setting('app.apiai01_tenant_id')::uuid,
        current_setting('app.apiai01_hr_group_id')::uuid,
        'development-plans',
        current_setting('app.apiai01_client_id')
      ) as decision
    ) request
  ),
  'third request is denied with zero remaining capacity'
);

select ok(
  (
    select (public.consume_api_rate_limit(
      current_setting('app.apiai01_tenant_id')::uuid,
      current_setting('app.apiai01_hr_group_id')::uuid,
      'workforce-summary',
      current_setting('app.apiai01_client_id')
    ) ->> 'allowed')::boolean
  ),
  'a different resource receives an independent bucket'
);

select is(
  public.consume_api_rate_limit(
    current_setting('app.apiai01_tenant_id')::uuid,
    current_setting('app.apiai01_hr_group_id')::uuid,
    'team-skills',
    current_setting('app.apiai01_client_id')
  ),
  '{"allowed": true, "remaining": 0}'::jsonb,
  'a fresh capacity-one bucket consumes exactly one token on its first request'
);

select ok(
  (
    select (request.decision ->> 'allowed')::boolean = false
      and (request.decision ->> 'remaining')::integer = 0
    from (
      select public.consume_api_rate_limit(
        current_setting('app.apiai01_tenant_id')::uuid,
        current_setting('app.apiai01_hr_group_id')::uuid,
        'team-skills',
        current_setting('app.apiai01_client_id')
      ) as decision
    ) request
  ),
  'a capacity-one bucket denies the next request without double-consuming the first one'
);

select throws_ok(
  format(
    $sql$select public.consume_api_rate_limit(%L::uuid,%L::uuid,'development-plans','forged-client')$sql$,
    current_setting('app.apiai01_tenant_id'),
    current_setting('app.apiai01_hr_group_id')
  ),
  'P0001',
  'API_RATE_LIMIT_UNAVAILABLE',
  'a caller cannot substitute an OAuth client id for the JWT client claim'
);

select throws_ok(
  format(
    $sql$select public.consume_api_rate_limit(%L::uuid,'00000000-0000-0000-0000-000000000000'::uuid,'workforce-summary',%L)$sql$,
    current_setting('app.apiai01_tenant_id'),
    current_setting('app.apiai01_client_id')
  ),
  'P0001',
  'API_RATE_LIMIT_UNAVAILABLE',
  'a caller cannot consume a bucket for an HR group it cannot access'
);

select is(
  public.record_api_read_audit(
    current_setting('app.apiai01_tenant_id')::uuid,
    current_setting('app.apiai01_hr_group_id')::uuid,
    null,
    'development-plans',
    current_setting('app.apiai01_client_id'),
    current_setting('app.apiai01_correlation_id')::uuid,
    'ALLOWED',
    200
  ),
  '{"recorded": true}'::jsonb,
  'a typed API read is persisted through the canonical audit RPC'
);

select throws_ok(
  format(
    $sql$select public.record_api_read_audit(%L::uuid,%L::uuid,%L::uuid,'development-plans',%L,%L::uuid,'ALLOWED',200)$sql$,
    current_setting('app.apiai01_tenant_id'),
    current_setting('app.apiai01_hr_group_id'),
    current_setting('app.apiai01_inaccessible_administration_id'),
    current_setting('app.apiai01_client_id'),
    '55555555-5555-4555-8555-555555555555'
  ),
  '42501',
  NULL,
  'an actor scoped to one administration cannot write a READ audit for another active administration'
);

select ok(
  not exists (
    select 1
    from public.audit_logs
    where entity_name = 'api_resource'
      and action = 'READ'
      and entity_id is not null
      and correlation_id = current_setting('app.apiai01_correlation_id')::uuid
  ),
  'the API read audit never invents an entity id'
);

select is(
  (select changes from public.audit_logs
   where entity_name = 'api_resource'
     and action = 'READ'
     and correlation_id = current_setting('app.apiai01_correlation_id')::uuid
   limit 1),
  '{}'::jsonb,
  'the API read audit stores no request payload'
);

select throws_ok(
  format(
    $sql$select public.record_api_read_audit(%L::uuid,%L::uuid,null,'development-plans','forged-client',%L::uuid,'ALLOWED',200)$sql$,
    current_setting('app.apiai01_tenant_id'),
    current_setting('app.apiai01_hr_group_id'),
    '44444444-4444-4444-8444-444444444444'
  ),
  '42501',
  NULL,
  'the audit RPC rejects a client id that is not bound to the bearer claim'
);

reset role;

select ok(
  not has_table_privilege('authenticated', 'public.audit_logs', 'update')
  and not has_table_privilege('authenticated', 'public.audit_logs', 'delete'),
  'authenticated cannot update or delete API audit rows'
);

select * from finish();
rollback;
