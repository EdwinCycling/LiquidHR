begin;

-- Wave 1B corrective migration only: keep the public service-role wrappers
-- invoker-facing and grant their server-side implementation reachability.
grant usage on schema internal_security to service_role;
grant execute on function internal_security.ensure_ai_monthly_allowance(uuid, uuid, text) to service_role;
grant execute on function internal_security.reserve_ai_credits(uuid, uuid, uuid, uuid, text, text, text, text) to service_role;
grant execute on function internal_security.settle_ai_credits(uuid, uuid) to service_role;
grant execute on function internal_security.release_ai_credits(uuid, uuid, text) to service_role;
grant execute on function internal_security.get_ai_group_credit_balance(uuid, uuid) to service_role;
grant execute on function internal_security.get_ai_actor_quota(uuid, uuid, uuid, text) to service_role;
grant execute on function internal_security.get_ai_reservation_allocations(uuid, uuid) to service_role;

-- The historical Wave 1B function declared timestamptz but returned the
-- timestamp-without-time-zone result of timezone('utc', now()). Keep the
-- contract and logic unchanged; return now() directly for timestamptz.
create or replace function internal_security.get_ai_group_credit_balance(
  requested_tenant_id uuid,
  requested_hr_group_id uuid
)
returns table (
  total_credits integer,
  monthly_allowance_credits integer,
  purchased_extra_credits integer,
  test_grant_credits integer,
  reserved_credits integer,
  settled_credits integer,
  expired_credits integer,
  available_credits integer,
  as_of timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.ai_credit_group_policies policy
    where policy.tenant_id = requested_tenant_id
      and policy.hr_group_id = requested_hr_group_id
      and policy.is_active
  ) then
    raise exception 'AI_CREDITS_UNAVAILABLE' using errcode = 'P0001';
  end if;

  perform internal_security.expire_ai_credit_allocations(requested_tenant_id, requested_hr_group_id);

  return query
  select coalesce(sum(allocation.credit_amount), 0)::integer,
    coalesce(sum(allocation.credit_amount) filter (where allocation.allocation_type = 'MONTHLY_ALLOWANCE'), 0)::integer,
    coalesce(sum(allocation.credit_amount) filter (where allocation.allocation_type = 'PURCHASED_EXTRA'), 0)::integer,
    coalesce(sum(allocation.credit_amount) filter (where allocation.allocation_type = 'TEST_GRANT'), 0)::integer,
    coalesce(sum(allocation.reserved_credits), 0)::integer,
    coalesce(sum(allocation.settled_credits), 0)::integer,
    coalesce(sum(allocation.expired_credits), 0)::integer,
    coalesce(sum(allocation.available_credits), 0)::integer,
    now()
  from public.ai_credit_allocations allocation
  where allocation.tenant_id = requested_tenant_id
    and allocation.hr_group_id = requested_hr_group_id;
end;
$$;

commit;
