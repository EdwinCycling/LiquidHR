begin;

-- APIAI-01 stores limiter state in the private security schema.  The rows are
-- never exposed through PostgREST; only the narrow authenticated RPC below
-- can consume a bucket.  The default policies are deliberately disabled until
-- Product/Operations/Security approve real quotas.
create table internal_security.api_rate_limit_policies (
  resource_key text primary key,
  burst_capacity integer not null,
  refill_per_second numeric(20, 6) not null,
  is_active boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint api_rate_limit_policies_resource_key_check
    check (resource_key in ('workforce-summary', 'team-skills', 'development-plans')),
  constraint api_rate_limit_policies_burst_capacity_check
    check (burst_capacity between 1 and 1000000),
  constraint api_rate_limit_policies_refill_check
    check (refill_per_second > 0 and refill_per_second <= 1000000)
);

create table internal_security.api_client_registrations (
  issuer text not null,
  audience text not null,
  client_id text not null,
  allowed_resource_keys text[] not null,
  is_active boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (issuer, audience, client_id),
  constraint api_client_registrations_issuer_check
    check (length(btrim(issuer)) between 1 and 512 and issuer = btrim(issuer)),
  constraint api_client_registrations_audience_check
    check (length(btrim(audience)) between 1 and 256 and audience = btrim(audience)),
  constraint api_client_registrations_client_id_check
    check (
      length(btrim(client_id)) between 1 and 128
      and client_id = btrim(client_id)
      and client_id !~ '[[:cntrl:]]'
    ),
  constraint api_client_registrations_resources_check
    check (
      cardinality(allowed_resource_keys) > 0
      and allowed_resource_keys <@ array['workforce-summary', 'team-skills', 'development-plans']::text[]
    )
);

create table internal_security.api_rate_limit_buckets (
  tenant_id uuid not null,
  hr_group_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  oauth_client_id text not null,
  resource_key text not null,
  tokens numeric(20, 6) not null,
  last_refill_at timestamptz not null,
  primary key (tenant_id, hr_group_id, actor_user_id, oauth_client_id, resource_key),
  constraint api_rate_limit_buckets_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete cascade,
  constraint api_rate_limit_buckets_client_check
    check (
      length(btrim(oauth_client_id)) between 1 and 128
      and oauth_client_id = btrim(oauth_client_id)
      and oauth_client_id !~ '[[:cntrl:]]'
    ),
  constraint api_rate_limit_buckets_resource_check
    check (resource_key in ('workforce-summary', 'team-skills', 'development-plans')),
  constraint api_rate_limit_buckets_tokens_check
    check (tokens >= 0 and tokens <= 1000000)
);

create index api_rate_limit_buckets_refill_idx
  on internal_security.api_rate_limit_buckets (tenant_id, hr_group_id, last_refill_at);

-- Private storage is deny-by-default even if a future grant is accidentally
-- added.  The SECURITY DEFINER RPCs below are owned by the migration owner and
-- still perform their own auth.uid()/claim/membership checks.
alter table internal_security.api_rate_limit_policies enable row level security;
alter table internal_security.api_client_registrations enable row level security;
alter table internal_security.api_rate_limit_buckets enable row level security;

create policy api_rate_limit_policies_no_direct_access
on internal_security.api_rate_limit_policies for all to authenticated
using (false)
with check (false);

create policy api_client_registrations_no_direct_access
on internal_security.api_client_registrations for all to authenticated
using (false)
with check (false);

create policy api_rate_limit_buckets_no_direct_access
on internal_security.api_rate_limit_buckets for all to authenticated
using (false)
with check (false);

revoke all on table internal_security.api_rate_limit_policies from public, anon, authenticated;
revoke all on table internal_security.api_client_registrations from public, anon, authenticated;
revoke all on table internal_security.api_rate_limit_buckets from public, anon, authenticated;

insert into internal_security.api_rate_limit_policies (
  resource_key, burst_capacity, refill_per_second, is_active
)
values
  ('workforce-summary', 10, 1, false),
  ('team-skills', 10, 1, false),
  ('development-plans', 10, 1, false)
on conflict (resource_key) do nothing;

-- The API adapter has already validated the provider token.  This database
-- helper binds the supplied client id to the same JWT claim, issuer, audience,
-- active registration and resource allowlist.  It deliberately has no
-- service-role, cookie or caller-supplied actor fallback.
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
    and requested_resource_key in ('workforce-summary', 'team-skills', 'development-plans')
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

create or replace function internal_security.api_read_administration_is_valid(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select requested_administration_id is null
    or (
      (select internal_security.has_administration_access(
        requested_tenant_id,
        requested_administration_id
      ))
      and exists (
        select 1
        from public.administrations administration
        where administration.tenant_id = requested_tenant_id
          and administration.hr_group_id = requested_hr_group_id
          and administration.id = requested_administration_id
          and administration.is_active
      )
    );
$$;

revoke all on function internal_security.api_read_administration_is_valid(uuid, uuid, uuid)
  from public, anon;
grant execute on function internal_security.api_read_administration_is_valid(uuid, uuid, uuid)
  to authenticated;

-- The existing audit table is canonical.  Only API resource READs may omit an
-- entity id; all historical mutation/reveal/export events keep their entity.
alter table public.audit_logs enable row level security;

alter table public.audit_logs
  alter column entity_id drop not null;

alter table public.audit_logs
  add column if not exists hr_group_id uuid,
  add column if not exists api_resource_key text,
  add column if not exists api_client_id text,
  add column if not exists api_outcome text,
  add column if not exists api_status_code integer,
  add column if not exists correlation_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.audit_logs'::regclass
      and conname = 'audit_logs_hr_group_scope_fkey'
  ) then
    alter table public.audit_logs
      add constraint audit_logs_hr_group_scope_fkey
      foreign key (tenant_id, hr_group_id)
      references public.hr_groups(tenant_id, id)
      on delete restrict;
  end if;
end;
$$;

alter table public.audit_logs
  drop constraint if exists audit_logs_action_check;

alter table public.audit_logs
  add constraint audit_logs_action_check
  check (action in ('CREATE', 'UPDATE', 'ARCHIVE', 'DELETE', 'REVEAL', 'EXPORT', 'START', 'STOP', 'READ'));

alter table public.audit_logs
  drop constraint if exists audit_logs_api_resource_key_check,
  drop constraint if exists audit_logs_api_client_id_check,
  drop constraint if exists audit_logs_api_outcome_check,
  drop constraint if exists audit_logs_api_status_code_check,
  drop constraint if exists audit_logs_api_read_entity_contract,
  drop constraint if exists audit_logs_api_read_metadata_contract;

alter table public.audit_logs
  add constraint audit_logs_api_resource_key_check
  check (
    api_resource_key is null
    or api_resource_key in ('workforce-summary', 'team-skills', 'development-plans')
  ),
  add constraint audit_logs_api_client_id_check
  check (
    api_client_id is null
    or (
      length(btrim(api_client_id)) between 1 and 128
      and api_client_id = btrim(api_client_id)
      and api_client_id !~ '[[:cntrl:]]'
    )
  ),
  add constraint audit_logs_api_outcome_check
  check (api_outcome is null or api_outcome in ('ALLOWED', 'DENIED', 'RATE_LIMITED')),
  add constraint audit_logs_api_status_code_check
  check (api_status_code is null or api_status_code between 100 and 599),
  add constraint audit_logs_api_read_entity_contract
  check (
    (
      action = 'READ'
      and entity_name = 'api_resource'
      and entity_id is null
      and actor_user_id is not null
      and hr_group_id is not null
      and api_resource_key is not null
      and api_client_id is not null
      and api_outcome is not null
      and api_status_code is not null
      and correlation_id is not null
      and correlation_id <> '00000000-0000-0000-0000-000000000000'::uuid
      and changes = '{}'::jsonb
      and subject_employee_id is null
      and employment_id is null
      and change_set_id is null
    )
    or (
      action = 'READ'
      and entity_name <> 'api_resource'
      and entity_id is not null
      and hr_group_id is null
      and api_resource_key is null
      and api_client_id is null
      and api_outcome is null
      and api_status_code is null
    )
    or (
      action <> 'READ'
      and entity_id is not null
      and hr_group_id is null
      and api_resource_key is null
      and api_client_id is null
      and api_outcome is null
      and api_status_code is null
    )
  ),
  add constraint audit_logs_api_read_metadata_contract
  check (
    action <> 'READ'
    or entity_name <> 'api_resource'
    or (
      api_outcome = 'ALLOWED' and api_status_code between 200 and 299
    )
    or (
      api_outcome = 'DENIED' and api_status_code in (403, 404)
    )
    or (
      api_outcome = 'RATE_LIMITED' and api_status_code = 429
    )
  );

create index if not exists audit_logs_api_read_scope_idx
  on public.audit_logs (tenant_id, hr_group_id, api_resource_key, created_at desc)
  where entity_name = 'api_resource' and action = 'READ';

create index if not exists audit_logs_api_client_idx
  on public.audit_logs (tenant_id, api_client_id, created_at desc)
  where api_client_id is not null;

-- Existing audit readers keep their permission gate and gain a separate
-- HR-group membership check for rows carrying the new API scope.
drop policy if exists audit_logs_select_scoped on public.audit_logs;
create policy audit_logs_select_scoped
on public.audit_logs for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'audit:read'))
  and (
    hr_group_id is null
    or (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  )
  and (
    entity_name <> 'employment_salary'
    or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:read'))
  )
);

-- API READs are written only by the trusted server audit sink.  The regular
-- authenticated audit insert policies remain available for their existing,
-- explicitly approved event families, but they do not admit action = READ.
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
  )
);

grant insert on public.audit_logs to authenticated;
revoke update, delete on public.audit_logs from authenticated;

create or replace function internal_security.consume_api_rate_limit_internal(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_resource_key text,
  requested_oauth_client_id text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_user_id_value uuid := (select auth.uid());
  policy_capacity integer;
  policy_refill numeric(20, 6);
  policy_is_active boolean;
  now_value timestamptz;
  current_tokens numeric(20, 6);
  current_refill_at timestamptz;
  replenished_tokens numeric(30, 12);
  updated_tokens numeric(30, 12);
  elapsed_seconds numeric(30, 12);
  retry_after_seconds integer;
begin
  if actor_user_id_value is null
    or requested_tenant_id is null
    or requested_hr_group_id is null
    or requested_resource_key is null
    or requested_oauth_client_id is null
  then
    raise exception 'API_RATE_LIMIT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if not (select internal_security.has_hr_group_access(requested_tenant_id, requested_hr_group_id))
    or not (select internal_security.api_client_claim_is_registered(requested_oauth_client_id, requested_resource_key))
  then
    raise exception 'API_RATE_LIMIT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select policy.burst_capacity, policy.refill_per_second, policy.is_active
  into policy_capacity, policy_refill, policy_is_active
  from internal_security.api_rate_limit_policies policy
  where policy.resource_key = requested_resource_key;

  if not found or not policy_is_active then
    raise exception 'API_RATE_LIMIT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Lock the deterministic bucket key before the insert/select pair.  This
  -- makes first-use creation and subsequent refills serialize under load.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.concat_ws(':', requested_tenant_id::text, requested_hr_group_id::text,
        actor_user_id_value::text, requested_oauth_client_id, requested_resource_key),
      31042026
    )
  );

  -- Read the database clock after waiting for the key lock so refill time is
  -- measured at the serialized consume point, not at request entry.
  now_value := pg_catalog.clock_timestamp();

  insert into internal_security.api_rate_limit_buckets (
    tenant_id, hr_group_id, actor_user_id, oauth_client_id, resource_key,
    tokens, last_refill_at
  ) values (
    requested_tenant_id,
    requested_hr_group_id,
    actor_user_id_value,
    requested_oauth_client_id,
    requested_resource_key,
    policy_capacity,
    now_value
  )
  on conflict (tenant_id, hr_group_id, actor_user_id, oauth_client_id, resource_key)
  do nothing;

  select bucket.tokens, bucket.last_refill_at
  into current_tokens, current_refill_at
  from internal_security.api_rate_limit_buckets bucket
  where bucket.tenant_id = requested_tenant_id
    and bucket.hr_group_id = requested_hr_group_id
    and bucket.actor_user_id = actor_user_id_value
    and bucket.oauth_client_id = requested_oauth_client_id
    and bucket.resource_key = requested_resource_key
  for update;

  if not found then
    raise exception 'API_RATE_LIMIT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  elapsed_seconds := pg_catalog.greatest(
    extract(epoch from (now_value - current_refill_at)),
    0
  );
  replenished_tokens := pg_catalog.least(
    policy_capacity::numeric,
    current_tokens + elapsed_seconds * policy_refill
  );

  if replenished_tokens >= 1 then
    updated_tokens := replenished_tokens - 1;
    update internal_security.api_rate_limit_buckets
    set tokens = updated_tokens,
        last_refill_at = now_value
    where tenant_id = requested_tenant_id
      and hr_group_id = requested_hr_group_id
      and actor_user_id = actor_user_id_value
      and oauth_client_id = requested_oauth_client_id
      and resource_key = requested_resource_key;

    return jsonb_build_object(
      'allowed', true,
      'remaining', pg_catalog.floor(updated_tokens)::integer
    );
  end if;

  updated_tokens := replenished_tokens;
  retry_after_seconds := pg_catalog.least(
    900,
    pg_catalog.greatest(
      1,
      pg_catalog.ceil((1 - replenished_tokens) / policy_refill)::integer
    )
  );

  update internal_security.api_rate_limit_buckets
  set tokens = updated_tokens,
      last_refill_at = now_value
  where tenant_id = requested_tenant_id
    and hr_group_id = requested_hr_group_id
    and actor_user_id = actor_user_id_value
    and oauth_client_id = requested_oauth_client_id
    and resource_key = requested_resource_key;

  return jsonb_build_object(
    'allowed', false,
    'remaining', 0,
    'retryAfterSeconds', retry_after_seconds
  );
exception
  when others then
    if sqlstate = 'P0001' then
      raise;
    end if;
    raise exception 'API_RATE_LIMIT_UNAVAILABLE' using errcode = 'P0001';
end;
$$;

revoke all on function internal_security.consume_api_rate_limit_internal(uuid, uuid, text, text)
  from public, anon, authenticated;

create or replace function public.consume_api_rate_limit(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_resource_key text,
  requested_oauth_client_id text
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select internal_security.consume_api_rate_limit_internal(
    $1, $2, $3, $4
  );
$$;

revoke all on function public.consume_api_rate_limit(uuid, uuid, text, text)
  from public, anon;
grant execute on function public.consume_api_rate_limit(uuid, uuid, text, text)
  to authenticated;

drop function if exists public.record_api_read_audit(uuid, uuid, uuid, text, text, uuid, text, integer);

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
  -- This function is an audit sink for the trusted server route.  An
  -- authenticated bearer may read through its own RLS client, but must never
  -- be able to register a fabricated successful read by calling this RPC.
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'API_READ_AUDIT_UNAVAILABLE' using errcode = '42501';
  end if;

  if requested_tenant_id is null
    or requested_actor_user_id is null
    or requested_hr_group_id is null
    or requested_resource_key not in ('workforce-summary', 'team-skills', 'development-plans')
    or requested_oauth_client_id is null
    or length(btrim(requested_oauth_client_id)) not between 1 and 128
    or requested_oauth_client_id <> btrim(requested_oauth_client_id)
    or requested_oauth_client_id ~ '[[:cntrl:]]'
    or requested_correlation_id is null
    or requested_correlation_id = '00000000-0000-0000-0000-000000000000'::uuid
    or requested_outcome not in ('ALLOWED', 'DENIED', 'RATE_LIMITED')
    or requested_status_code is null
    or requested_status_code not between 100 and 599
    or not (
      (requested_outcome = 'ALLOWED' and requested_status_code between 200 and 299)
      or (requested_outcome = 'DENIED' and requested_status_code in (403, 404))
      or (requested_outcome = 'RATE_LIMITED' and requested_status_code = 429)
    )
  then
    raise exception 'API_READ_AUDIT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from auth.users user_row
    where user_row.id = requested_actor_user_id
  ) then
    raise exception 'API_READ_AUDIT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.hr_groups group_row
    where group_row.tenant_id = requested_tenant_id
      and group_row.id = requested_hr_group_id
      and group_row.is_active
  ) then
    raise exception 'API_READ_AUDIT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if requested_administration_id is not null and not exists (
    select 1
    from public.administrations administration
    where administration.tenant_id = requested_tenant_id
      and administration.hr_group_id = requested_hr_group_id
      and administration.id = requested_administration_id
      and administration.is_active
  ) then
    raise exception 'API_READ_AUDIT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.user_hr_group_access access
    where access.user_id = requested_actor_user_id
      and access.tenant_id = requested_tenant_id
      and access.hr_group_id = requested_hr_group_id
      and access.is_active
  ) then
    raise exception 'API_READ_AUDIT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if requested_administration_id is not null and not exists (
    select 1
    from public.user_access access
    where access.user_id = requested_actor_user_id
      and access.tenant_id = requested_tenant_id
      and access.is_active
      and (
        (access.scope_type = 'TENANT' and access.administration_id is null)
        or (
          access.scope_type = 'ADMINISTRATION'
          and access.administration_id = requested_administration_id
        )
      )
  ) then
    raise exception 'API_READ_AUDIT_UNAVAILABLE' using errcode = '42501';
  end if;

  insert into public.audit_logs (
    tenant_id,
    administration_id,
    entity_name,
    entity_id,
    actor_user_id,
    action,
    changes,
    hr_group_id,
    api_resource_key,
    api_client_id,
    api_outcome,
    api_status_code,
    correlation_id
  ) values (
    requested_tenant_id,
    requested_administration_id,
    'api_resource',
    null,
    requested_actor_user_id,
    'READ',
    '{}'::jsonb,
    requested_hr_group_id,
    requested_resource_key,
    requested_oauth_client_id,
    requested_outcome,
    requested_status_code,
    requested_correlation_id
  );

  return jsonb_build_object('recorded', true);
end;
$$;

revoke all on function public.record_api_read_audit(uuid, uuid, uuid, uuid, text, text, uuid, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.record_api_read_audit(uuid, uuid, uuid, uuid, text, text, uuid, text, integer)
  to service_role;

comment on table internal_security.api_rate_limit_policies is
  'APIAI-01 lokale limiterpolicy; disabled defaults require Product/Operations/Security approval before activation.';
comment on table internal_security.api_client_registrations is
  'APIAI-01 provider client allowlist; rows are managed by a later approved registration flow.';
comment on table internal_security.api_rate_limit_buckets is
  'APIAI-01 actor/client/resource buckets; only the atomic authenticated RPC may mutate them.';
comment on column public.audit_logs.api_client_id is
  'APIAI-01 verified OAuth client id; never a token, header or raw provider payload.';
comment on column public.audit_logs.correlation_id is
  'APIAI-01 bounded correlation id for a resource read; request metadata is not persisted here.';

commit;
