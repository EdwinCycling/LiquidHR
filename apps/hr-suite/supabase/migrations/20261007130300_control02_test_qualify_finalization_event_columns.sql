-- Forward-only CONTROL02 TEST fix: qualify columns that collide with RETURNS TABLE output variables.
create or replace function public.record_payroll_import_finalization_event(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_batch_id uuid,
  requested_action_id text,
  requested_event_key text,
  requested_event_type text,
  requested_actor_user_id uuid,
  requested_attempt_number integer,
  requested_source_hash text,
  requested_analysis_hash text,
  requested_core_state_hash text,
  requested_checkpoint jsonb default '{}'::jsonb,
  requested_error_code text default null,
  requested_lease_until timestamptz default null,
  requested_lease_owner uuid default null,
  requested_lease_token_hash text default null
)
returns table (
  action_id text,
  status text,
  attempt_count integer,
  event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_action record;
  current_plan record;
  existing_event record;
  next_status text;
  next_plan_status text;
  next_attempt_count integer;
  next_lease_until timestamptz;
  next_lease_owner uuid;
  next_lease_token_hash text;
  next_completed_at timestamptz;
  next_error_code text;
  plan_total_count bigint;
  plan_completed_count bigint;
  next_event_id uuid;
begin
  if requested_event_key !~ '^[A-Za-z0-9_.:-]{1,160}$'
    or requested_event_type not in ('PLANNED', 'CLAIMED', 'CHECKPOINT', 'COMPLETED', 'FAILED', 'RETRY', 'RECOVERED', 'BLOCKED')
    or requested_attempt_number < 0
    or requested_source_hash !~ '^[0-9a-f]{64}$'
    or requested_analysis_hash !~ '^[0-9a-f]{64}$'
    or requested_core_state_hash !~ '^[0-9a-f]{64}$'
    or requested_checkpoint is null
    or jsonb_typeof(requested_checkpoint) <> 'object'
    or (requested_lease_token_hash is not null and requested_lease_token_hash !~ '^[0-9a-f]{64}$')
    or ((requested_lease_owner is null) <> (requested_lease_token_hash is null))
    or ((requested_event_type in ('CLAIMED', 'CHECKPOINT', 'COMPLETED', 'FAILED')) <> (requested_lease_owner is not null))
    or (requested_event_type = 'COMPLETED' and (
      jsonb_typeof(requested_checkpoint -> 'completionProof') <> 'object'
      or requested_checkpoint -> 'completionProof' ->> 'readbackVerified' <> 'true'
      or btrim(coalesce(requested_checkpoint -> 'completionProof' ->> 'executionId', '')) = ''
      or coalesce(requested_checkpoint -> 'completionProof' ->> 'readbackHash', '') !~ '^[0-9a-f]{64}$'
      or coalesce(requested_checkpoint -> 'completionProof' ->> 'sourceHash', '') <> requested_source_hash
      or coalesce(requested_checkpoint -> 'completionProof' ->> 'analysisHash', '') <> requested_analysis_hash
      or coalesce(requested_checkpoint -> 'completionProof' ->> 'coreStateHash', '') <> requested_core_state_hash
    ))
    or (requested_error_code is not null and requested_error_code !~ '^[A-Z][A-Z0-9_.:-]{0,63}$') then
    raise exception using
      errcode = '22023',
      message = 'PAYROLL_FINALIZATION_EVENT_INPUT_INVALID';
  end if;

  select *
  into current_action
  from public.payroll_import_finalization_actions
  where tenant_id = requested_tenant_id
    and hr_group_id = requested_hr_group_id
    and batch_id = requested_batch_id
    and payroll_import_finalization_actions.action_id = requested_action_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'PAYROLL_FINALIZATION_ACTION_NOT_FOUND';
  end if;

  select *
  into current_plan
  from public.payroll_import_finalization_plans
  where id = current_action.plan_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'PAYROLL_FINALIZATION_PLAN_NOT_FOUND';
  end if;

  if current_plan.status = 'INVALIDATED' then
    raise exception using
      errcode = '40901',
      message = 'PAYROLL_FINALIZATION_PLAN_INVALIDATED';
  end if;

  if current_action.source_hash <> requested_source_hash
    or current_action.analysis_hash <> requested_analysis_hash
    or current_action.core_state_hash <> requested_core_state_hash then
    raise exception using
      errcode = '23514',
      message = 'PAYROLL_FINALIZATION_STATE_HASH_MISMATCH';
  end if;

  if current_plan.source_hash <> requested_source_hash
    or current_plan.analysis_hash <> requested_analysis_hash
    or current_plan.core_state_hash <> requested_core_state_hash then
    raise exception using
      errcode = '23514',
      message = 'PAYROLL_FINALIZATION_PLAN_STATE_HASH_MISMATCH';
  end if;

  if current_action.plan_hash <> current_plan.plan_hash then
    raise exception using
      errcode = '23514',
      message = 'PAYROLL_FINALIZATION_PLAN_IDENTITY_MISMATCH';
  end if;

  select count(*)::bigint,
    count(*) filter (where payroll_import_finalization_actions.status = 'COMPLETED')::bigint
  into plan_total_count, plan_completed_count
  from public.payroll_import_finalization_actions
  where plan_id = current_plan.id;

  if plan_total_count > current_plan.expected_action_count
    or plan_completed_count > current_plan.expected_action_count then
    raise exception using
      errcode = '23514',
      message = 'PAYROLL_FINALIZATION_PLAN_ACTION_COUNT_INVALID';
  end if;

  select *
  into existing_event
  from public.payroll_import_finalization_action_events
  where tenant_id = requested_tenant_id
    and hr_group_id = requested_hr_group_id
    and batch_id = requested_batch_id
    and payroll_import_finalization_action_events.action_id = requested_action_id
    and event_key = requested_event_key;

  if found then
    if existing_event.event_type <> requested_event_type
      or existing_event.actor_user_id <> requested_actor_user_id
      or existing_event.attempt_number <> requested_attempt_number
      or existing_event.lease_owner is distinct from requested_lease_owner
      or existing_event.lease_until is distinct from requested_lease_until
      or existing_event.source_hash <> requested_source_hash
      or existing_event.analysis_hash <> requested_analysis_hash
      or existing_event.core_state_hash <> requested_core_state_hash
      or existing_event.checkpoint is distinct from requested_checkpoint
      or existing_event.error_code is distinct from requested_error_code then
      raise exception using
        errcode = '23505',
        message = 'PAYROLL_FINALIZATION_EVENT_KEY_REUSED';
    end if;

    if requested_event_type = 'CLAIMED'
      and (current_action.status <> 'IN_PROGRESS'
        or current_action.attempt_count <> requested_attempt_number
        or current_action.lease_owner is distinct from requested_lease_owner
        or current_action.lease_token_hash is distinct from requested_lease_token_hash
        or current_action.lease_until is distinct from requested_lease_until
        or current_action.lease_until <= timezone('utc', now())) then
      raise exception using
        errcode = '40901',
        message = 'PAYROLL_FINALIZATION_ACTION_NOT_CLAIMABLE';
    end if;

    return query
    select current_action.action_id, current_action.status, current_action.attempt_count, existing_event.id;
    return;
  end if;

  next_status := current_action.status;
  next_attempt_count := current_action.attempt_count;
  next_lease_until := current_action.lease_until;
  next_lease_owner := current_action.lease_owner;
  next_lease_token_hash := current_action.lease_token_hash;
  next_completed_at := current_action.completed_at;
  next_error_code := current_action.last_error_code;

  if requested_event_type = 'PLANNED' then
    if current_action.status <> 'PENDING'
      or current_plan.status <> 'PENDING'
      or plan_total_count <> current_plan.expected_action_count
      or requested_attempt_number <> 0
      or requested_lease_until is not null
      or requested_lease_owner is not null
      or requested_lease_token_hash is not null then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_EVENT_STATE_CONFLICT';
    end if;
    next_status := 'PENDING';
    next_lease_until := null;
    next_lease_owner := null;
    next_lease_token_hash := null;
    next_completed_at := null;
    next_error_code := null;
  elsif requested_event_type = 'CLAIMED' then
    if current_action.status <> 'PENDING'
      or current_plan.status not in ('PENDING', 'IN_PROGRESS')
      or plan_total_count <> current_plan.expected_action_count
      or requested_attempt_number <> current_action.attempt_count + 1
      or requested_lease_until is null
      or requested_lease_owner is null
      or requested_lease_token_hash is null
      or requested_lease_until <= timezone('utc', now()) then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_ACTION_NOT_CLAIMABLE';
    end if;

    if cardinality(current_action.depends_on_action_ids) <> (
      select count(*)::integer
      from public.payroll_import_finalization_actions as dependency
      where dependency.tenant_id = current_action.tenant_id
        and dependency.hr_group_id = current_action.hr_group_id
        and dependency.batch_id = current_action.batch_id
        and dependency.plan_id = current_action.plan_id
        and dependency.import_person_id = current_action.import_person_id
        and dependency.action_id = any(current_action.depends_on_action_ids)
        and dependency.sequence_no < current_action.sequence_no
        and dependency.status = 'COMPLETED'
    ) then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_ACTION_DEPENDENCIES_INCOMPLETE';
    end if;

    next_status := 'IN_PROGRESS';
    next_attempt_count := requested_attempt_number;
    next_lease_until := requested_lease_until;
    next_lease_owner := requested_lease_owner;
    next_lease_token_hash := requested_lease_token_hash;
    next_completed_at := null;
    next_error_code := null;
  elsif requested_event_type = 'CHECKPOINT' then
    if current_action.status <> 'IN_PROGRESS'
      or current_plan.status <> 'IN_PROGRESS'
      or requested_attempt_number <> current_action.attempt_count
      or requested_lease_until is null
      or requested_lease_until <= timezone('utc', now())
      or current_action.lease_until is null
      or current_action.lease_until <= timezone('utc', now())
      or requested_lease_owner is distinct from current_action.lease_owner
      or requested_lease_token_hash is distinct from current_action.lease_token_hash then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_CHECKPOINT_CONFLICT';
    end if;
    next_lease_until := requested_lease_until;
  elsif requested_event_type = 'COMPLETED' then
    if current_action.status <> 'IN_PROGRESS'
      or current_plan.status <> 'IN_PROGRESS'
      or plan_total_count <> current_plan.expected_action_count
      or requested_attempt_number <> current_action.attempt_count
      or current_action.lease_until is null
      or current_action.lease_until <= timezone('utc', now())
      or requested_lease_owner is distinct from current_action.lease_owner
      or requested_lease_token_hash is distinct from current_action.lease_token_hash then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_COMPLETION_CONFLICT';
    end if;
    next_status := 'COMPLETED';
    next_lease_until := null;
    next_lease_owner := null;
    next_lease_token_hash := null;
    next_completed_at := timezone('utc', now());
    next_error_code := null;
  elsif requested_event_type = 'FAILED' then
    if current_action.status <> 'IN_PROGRESS'
      or current_plan.status <> 'IN_PROGRESS'
      or requested_attempt_number <> current_action.attempt_count
      or requested_error_code is null
      or current_action.lease_until is null
      or current_action.lease_until <= timezone('utc', now())
      or requested_lease_owner is distinct from current_action.lease_owner
      or requested_lease_token_hash is distinct from current_action.lease_token_hash then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_FAILURE_CONFLICT';
    end if;
    next_status := 'FAILED';
    next_lease_until := null;
    next_lease_owner := null;
    next_lease_token_hash := null;
    next_completed_at := null;
    next_error_code := requested_error_code;
  elsif requested_event_type = 'RETRY' then
    if current_action.status <> 'FAILED'
      or current_plan.status in ('COMPLETED', 'INVALIDATED', 'BLOCKED')
      or requested_attempt_number <> current_action.attempt_count
      or requested_lease_owner is not null
      or requested_lease_token_hash is not null then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_RETRY_CONFLICT';
    end if;
    next_status := 'PENDING';
    next_lease_until := null;
    next_lease_owner := null;
    next_lease_token_hash := null;
    next_completed_at := null;
    next_error_code := null;
  elsif requested_event_type = 'RECOVERED' then
    if current_action.status <> 'IN_PROGRESS'
      or current_plan.status <> 'IN_PROGRESS'
      or current_action.lease_until is null
      or current_action.lease_owner is null
      or current_action.lease_token_hash is null
      or current_action.lease_until > timezone('utc', now())
      or requested_attempt_number <> current_action.attempt_count
      or requested_lease_owner is not null
      or requested_lease_token_hash is not null then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_RECOVERY_CONFLICT';
    end if;
    next_status := 'PENDING';
    next_lease_until := null;
    next_lease_owner := null;
    next_lease_token_hash := null;
    next_completed_at := null;
    next_error_code := coalesce(requested_error_code, 'LEASE_EXPIRED');
  elsif requested_event_type = 'BLOCKED' then
    if current_action.status not in ('PENDING', 'FAILED')
      or current_plan.status in ('COMPLETED', 'INVALIDATED')
      or requested_attempt_number <> current_action.attempt_count
      or requested_lease_owner is not null
      or requested_lease_token_hash is not null then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_BLOCK_CONFLICT';
    end if;
    next_status := 'BLOCKED';
    next_lease_until := null;
    next_lease_owner := null;
    next_lease_token_hash := null;
    next_completed_at := null;
    next_error_code := requested_error_code;
  end if;

  update public.payroll_import_finalization_actions
  set status = next_status,
      attempt_count = next_attempt_count,
      lease_until = next_lease_until,
      lease_owner = next_lease_owner,
      lease_token_hash = next_lease_token_hash,
      last_attempt_at = case when requested_event_type = 'CLAIMED' then timezone('utc', now()) else current_action.last_attempt_at end,
      completed_at = next_completed_at,
      last_error_code = next_error_code,
      checkpoint = requested_checkpoint,
      updated_at = timezone('utc', now())
  where id = current_action.id;

  select count(*)::bigint,
    count(*) filter (where payroll_import_finalization_actions.status = 'COMPLETED')::bigint
  into plan_total_count, plan_completed_count
  from public.payroll_import_finalization_actions
  where plan_id = current_plan.id;

  if plan_total_count <> current_plan.expected_action_count then
    raise exception using
      errcode = '23514',
      message = 'PAYROLL_FINALIZATION_PLAN_INCOMPLETE';
  end if;

  next_plan_status := current_plan.status;
  if requested_event_type = 'COMPLETED' then
    next_plan_status := case when plan_completed_count = current_plan.expected_action_count then 'COMPLETED' else 'IN_PROGRESS' end;
  elsif requested_event_type = 'CLAIMED' or requested_event_type = 'CHECKPOINT' then
    next_plan_status := 'IN_PROGRESS';
  elsif requested_event_type = 'FAILED' then
    next_plan_status := 'FAILED';
  elsif requested_event_type = 'RETRY' then
    next_plan_status := 'IN_PROGRESS';
  elsif requested_event_type = 'RECOVERED' then
    next_plan_status := 'IN_PROGRESS';
  elsif requested_event_type = 'BLOCKED' then
    next_plan_status := 'BLOCKED';
  end if;

  update public.payroll_import_finalization_plans
  set completed_action_count = plan_completed_count,
      status = next_plan_status,
      updated_at = timezone('utc', now())
  where id = current_plan.id;

  insert into public.payroll_import_finalization_action_events (
    tenant_id,
    hr_group_id,
    batch_id,
    action_id,
    event_key,
    event_type,
    actor_user_id,
    attempt_number,
    checkpoint,
    error_code,
    lease_until,
    lease_owner,
    source_hash,
    analysis_hash,
    core_state_hash
  ) values (
    requested_tenant_id,
    requested_hr_group_id,
    requested_batch_id,
    requested_action_id,
    requested_event_key,
    requested_event_type,
    requested_actor_user_id,
    requested_attempt_number,
    requested_checkpoint,
    requested_error_code,
    requested_lease_until,
    requested_lease_owner,
    requested_source_hash,
    requested_analysis_hash,
    requested_core_state_hash
  ) returning id into next_event_id;

  return query select current_action.action_id, next_status, next_attempt_count, next_event_id;
end;
$$;

revoke all on function public.record_payroll_import_finalization_event(
  uuid, uuid, uuid, text, text, text, uuid, integer, text, text, text, jsonb, text, timestamptz, uuid, text
) from public, anon, authenticated;
grant execute on function public.record_payroll_import_finalization_event(
  uuid, uuid, uuid, text, text, text, uuid, integer, text, text, text, jsonb, text, timestamptz, uuid, text
) to service_role;
