-- Forward-only CONTROL02 TEST fix: qualify plan columns that collide with RETURNS TABLE output variables.
create or replace function public.invalidate_payroll_import_finalization_plan(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_batch_id uuid,
  requested_plan_hash text,
  requested_actor_user_id uuid,
  requested_reason text
)
returns table (
  plan_id uuid,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_plan record;
begin
  if requested_plan_hash !~ '^[0-9a-f]{64}$'
    or requested_reason !~ '^[A-Z][A-Z0-9_.:-]{0,63}$' then
    raise exception using
      errcode = '22023',
      message = 'PAYROLL_FINALIZATION_PLAN_INVALIDATION_INPUT_INVALID';
  end if;

  select plan.id, plan.status, plan.administration_id, plan.source_hash, plan.analysis_hash, plan.core_state_hash
  into current_plan
  from public.payroll_import_finalization_plans as plan
  where plan.tenant_id = requested_tenant_id
    and plan.hr_group_id = requested_hr_group_id
    and plan.batch_id = requested_batch_id
    and plan.plan_hash = requested_plan_hash
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'PAYROLL_FINALIZATION_PLAN_NOT_FOUND';
  end if;

  if current_plan.status = 'COMPLETED' then
    raise exception using
      errcode = '40901',
      message = 'PAYROLL_FINALIZATION_PLAN_ALREADY_COMPLETED';
  end if;

  if current_plan.status <> 'INVALIDATED' then
    update public.payroll_import_finalization_plans
    set status = 'INVALIDATED',
        invalidated_by_user_id = requested_actor_user_id,
        invalidation_reason = requested_reason,
        invalidated_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    where id = current_plan.id;

    insert into public.payroll_import_finalization_plan_events (
      tenant_id,
      hr_group_id,
      administration_id,
      batch_id,
      plan_id,
      event_key,
      event_type,
      actor_user_id,
      reason,
      source_hash,
      analysis_hash,
      core_state_hash
    ) values (
      requested_tenant_id,
      requested_hr_group_id,
      current_plan.administration_id,
      requested_batch_id,
      current_plan.id,
      'invalidate:' || requested_plan_hash,
      'INVALIDATED',
      requested_actor_user_id,
      requested_reason,
      current_plan.source_hash,
      current_plan.analysis_hash,
      current_plan.core_state_hash
    );
  end if;

  return query
  select current_plan.id, 'INVALIDATED'::text;
end;
$$;

revoke all on function public.invalidate_payroll_import_finalization_plan(uuid, uuid, uuid, text, uuid, text)
from public, anon, authenticated;
grant execute on function public.invalidate_payroll_import_finalization_plan(uuid, uuid, uuid, text, uuid, text)
to service_role;
