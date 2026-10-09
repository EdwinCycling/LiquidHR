begin;

-- GREATEST and LEAST are PostgreSQL conditional expressions, not functions
-- addressable through pg_catalog. Keep the limiter logic unchanged while
-- removing the invalid schema qualification that made every consume fail.
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

  -- Lock the deterministic bucket key before the insert/select pair. This
  -- makes first-use creation and subsequent refills serialize under load.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.concat_ws(':', requested_tenant_id::text, requested_hr_group_id::text,
        actor_user_id_value::text, requested_oauth_client_id, requested_resource_key),
      31042026
    )
  );

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

  elapsed_seconds := greatest(
    extract(epoch from (now_value - current_refill_at)),
    0
  );
  replenished_tokens := least(
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
  retry_after_seconds := least(
    900,
    greatest(
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

commit;
