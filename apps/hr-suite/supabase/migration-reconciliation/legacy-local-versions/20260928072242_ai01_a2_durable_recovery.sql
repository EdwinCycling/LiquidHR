begin;

alter table public.ai_invocations
  add column business_audit_status text not null default 'PENDING';
alter table public.ai_invocations
  add constraint ai_invocations_business_audit_status_check
  check (business_audit_status in ('PENDING', 'RECORDED'));
alter table public.ai_invocations
  add column release_reason text
  check (release_reason is null or release_reason in (
    'CONTEXT_FAILED', 'PROVIDER_UNAVAILABLE', 'PROVIDER_FAILED',
    'INVALID_RESULT', 'INTERNAL_FAILURE'
  ));

update public.ai_invocations invocation
set business_audit_status = 'RECORDED'
where exists (
  select 1
  from public.ai_business_audit audit
  where audit.invocation_id = invocation.id
    and audit.tenant_id = invocation.tenant_id
    and audit.hr_group_id = invocation.hr_group_id
);

create index ai_invocations_business_audit_pending_idx
  on public.ai_invocations (tenant_id, hr_group_id, updated_at)
  where business_audit_status = 'PENDING'
    and execution_status in ('SUCCEEDED', 'FAILED', 'REJECTED');

alter table public.ai_voice_sessions
  add column max_duration_seconds integer;
update public.ai_voice_sessions session
set max_duration_seconds = coalesce(settings.max_voice_session_seconds, 900)
from public.ai_group_settings settings
where settings.tenant_id = session.tenant_id
  and settings.hr_group_id = session.hr_group_id;
update public.ai_voice_sessions
set max_duration_seconds = 900
where max_duration_seconds is null;
alter table public.ai_voice_sessions
  alter column max_duration_seconds set default 900,
  alter column max_duration_seconds set not null,
  add constraint ai_voice_sessions_max_duration_seconds_check
    check (max_duration_seconds between 30 and 3600),
  add column finalization_deadline_at timestamptz;
update public.ai_voice_sessions
set finalization_deadline_at = started_at + (max_duration_seconds * interval '1 second');
alter table public.ai_voice_sessions
  alter column finalization_deadline_at set not null;

alter table public.ai_team_sessions
  add column max_duration_seconds integer;
update public.ai_team_sessions session
set max_duration_seconds = coalesce(settings.max_voice_session_seconds, 900)
from public.ai_group_settings settings
where settings.tenant_id = session.tenant_id
  and settings.hr_group_id = session.hr_group_id;
update public.ai_team_sessions
set max_duration_seconds = 900
where max_duration_seconds is null;
alter table public.ai_team_sessions
  alter column max_duration_seconds set default 900,
  alter column max_duration_seconds set not null,
  add constraint ai_team_sessions_max_duration_seconds_check
    check (max_duration_seconds between 30 and 3600),
  add column finalization_deadline_at timestamptz;
update public.ai_team_sessions
set finalization_deadline_at = started_at + (max_duration_seconds * interval '1 second');
alter table public.ai_team_sessions
  alter column finalization_deadline_at set not null;

create or replace function internal_security.set_ai_voice_finalization_deadline()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.finalization_deadline_at := new.started_at + (new.max_duration_seconds * interval '1 second');
  return new;
end;
$$;

revoke all on function internal_security.set_ai_voice_finalization_deadline() from public, anon, authenticated;

create trigger set_ai_voice_sessions_finalization_deadline
before insert or update on public.ai_voice_sessions
for each row execute function internal_security.set_ai_voice_finalization_deadline();
create trigger set_ai_team_sessions_finalization_deadline
before insert or update on public.ai_team_sessions
for each row execute function internal_security.set_ai_voice_finalization_deadline();

create index ai_voice_sessions_expiry_idx
  on public.ai_voice_sessions (tenant_id, hr_group_id, finalization_deadline_at)
  where status = 'ACTIVE';
create index ai_team_sessions_expiry_idx
  on public.ai_team_sessions (tenant_id, hr_group_id, finalization_deadline_at)
  where status = 'ACTIVE' and conversation_type = 'VOICE';

create or replace function internal_security.settle_ai_invocation(
  requested_reservation_id uuid,
  requested_invocation_id uuid,
  requested_finished_at timestamptz
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  invocation_row public.ai_invocations%rowtype;
  reservation_row public.ai_credit_reservations%rowtype;
begin
  select invocation.*
  into invocation_row
  from public.ai_invocations invocation
  join public.ai_credit_reservations reservation
    on reservation.tenant_id = invocation.tenant_id
    and reservation.hr_group_id = invocation.hr_group_id
    and reservation.invocation_id = invocation.id
  where reservation.id = requested_reservation_id
    and reservation.invocation_id = requested_invocation_id
  for update of invocation;
  if not found then
    raise exception 'AI_INVOCATION_RESERVATION_SCOPE_INVALID' using errcode = '42501';
  end if;

  select reservation.*
  into reservation_row
  from public.ai_credit_reservations reservation
  where reservation.id = requested_reservation_id
    and reservation.tenant_id = invocation_row.tenant_id
    and reservation.hr_group_id = invocation_row.hr_group_id
    and reservation.invocation_id = invocation_row.id;
  if not found then
    raise exception 'AI_INVOCATION_RESERVATION_SCOPE_INVALID' using errcode = '42501';
  end if;

  if invocation_row.execution_status = 'SUCCEEDED'
     and reservation_row.status = 'SETTLED' then
    return;
  end if;
  if invocation_row.execution_status <> 'SETTLING' then
    raise exception 'AI_INVOCATION_NOT_SETTLING' using errcode = 'P0001';
  end if;
  if reservation_row.status = 'RELEASED' then
    raise exception 'AI_CREDIT_RESERVATION_RELEASED' using errcode = 'P0001';
  end if;

  perform internal_security.settle_ai_credits(
    requested_reservation_id,
    requested_invocation_id
  );

  update public.ai_invocations invocation
  set execution_status = 'SUCCEEDED',
      charged_credits = reservation_row.reserved_credits,
      business_audit_status = 'PENDING',
      failure_code = null,
      finished_at = coalesce(requested_finished_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  where invocation.tenant_id = invocation_row.tenant_id
    and invocation.hr_group_id = invocation_row.hr_group_id
    and invocation.id = invocation_row.id
    and invocation.execution_status = 'SETTLING';
  if not found then
    raise exception 'AI_INVOCATION_STATE_CONFLICT' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function internal_security.settle_ai_invocation(uuid, uuid, timestamptz)
  from public, anon, authenticated;

create or replace function internal_security.release_ai_invocation(
  requested_reservation_id uuid,
  requested_invocation_id uuid,
  requested_reason text,
  requested_finished_at timestamptz
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  invocation_row public.ai_invocations%rowtype;
  reservation_row public.ai_credit_reservations%rowtype;
begin
  if requested_reason is null or requested_reason not in (
    'CONTEXT_FAILED', 'PROVIDER_UNAVAILABLE', 'PROVIDER_FAILED',
    'INVALID_RESULT', 'INTERNAL_FAILURE'
  ) then
    raise exception 'AI_CREDIT_RELEASE_REASON_INVALID' using errcode = '22023';
  end if;

  select invocation.*
  into invocation_row
  from public.ai_invocations invocation
  join public.ai_credit_reservations reservation
    on reservation.tenant_id = invocation.tenant_id
    and reservation.hr_group_id = invocation.hr_group_id
    and reservation.invocation_id = invocation.id
  where reservation.id = requested_reservation_id
    and reservation.invocation_id = requested_invocation_id
  for update of invocation;
  if not found then
    raise exception 'AI_INVOCATION_RESERVATION_SCOPE_INVALID' using errcode = '42501';
  end if;

  select reservation.*
  into reservation_row
  from public.ai_credit_reservations reservation
  where reservation.id = requested_reservation_id
    and reservation.tenant_id = invocation_row.tenant_id
    and reservation.hr_group_id = invocation_row.hr_group_id
    and reservation.invocation_id = invocation_row.id;
  if not found then
    raise exception 'AI_INVOCATION_RESERVATION_SCOPE_INVALID' using errcode = '42501';
  end if;

  if invocation_row.execution_status not in ('RELEASING', 'FAILED') then
    raise exception 'AI_INVOCATION_NOT_RELEASING' using errcode = 'P0001';
  end if;
  if reservation_row.status = 'SETTLED' then
    raise exception 'AI_CREDIT_RESERVATION_SETTLED' using errcode = 'P0001';
  end if;
  if invocation_row.release_reason is not null
     and invocation_row.execution_status = 'RELEASING'
     and invocation_row.release_reason <> requested_reason then
    raise exception 'AI_CREDIT_RELEASE_REASON_MISMATCH' using errcode = 'P0001';
  end if;

  if reservation_row.status = 'RESERVED' then
    perform internal_security.release_ai_credits(
      requested_reservation_id,
      requested_invocation_id,
      requested_reason
    );
  elsif reservation_row.status <> 'RELEASED' then
    raise exception 'AI_CREDIT_RESERVATION_STATE_INVALID' using errcode = 'P0001';
  end if;

  update public.ai_invocations invocation
  set execution_status = 'FAILED',
      charged_credits = 0,
      release_reason = requested_reason,
      business_audit_status = 'PENDING',
      finished_at = coalesce(invocation.finished_at, requested_finished_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  where invocation.tenant_id = invocation_row.tenant_id
    and invocation.hr_group_id = invocation_row.hr_group_id
    and invocation.id = invocation_row.id
    and invocation.execution_status in ('RELEASING', 'FAILED');
end;
$$;

revoke all on function internal_security.release_ai_invocation(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;

create or replace function internal_security.record_ai_invocation_business_audit(
  requested_invocation_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  invocation_row public.ai_invocations%rowtype;
  audit_status_value text;
begin
  select invocation.*
  into invocation_row
  from public.ai_invocations invocation
  where invocation.id = requested_invocation_id
    and invocation.execution_status in ('SUCCEEDED', 'FAILED', 'REJECTED')
  for update;
  if not found then
    raise exception 'AI_INVOCATION_NOT_TERMINAL' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.ai_credit_reservations reservation
    where reservation.tenant_id = invocation_row.tenant_id
      and reservation.hr_group_id = invocation_row.hr_group_id
      and reservation.invocation_id = invocation_row.id
      and reservation.status = 'RESERVED'
  ) then
    raise exception 'AI_INVOCATION_FINANCIAL_RECOVERY_PENDING' using errcode = 'P0001';
  end if;

  if invocation_row.business_audit_status = 'RECORDED' then
    return;
  end if;

  audit_status_value := invocation_row.execution_status;
  insert into public.ai_business_audit (
    invocation_id, tenant_id, hr_group_id, administration_id,
    actor_user_id, actor_employee_id, feature_code,
    business_object_type, business_object_id, action,
    quality_profile, writing_style, reserved_credits, charged_credits,
    status, failure_code, correlation_id, config_version,
    prompt_template_version, recorded_at
  ) values (
    invocation_row.id, invocation_row.tenant_id, invocation_row.hr_group_id,
    invocation_row.administration_id, invocation_row.actor_user_id,
    invocation_row.actor_employee_id, invocation_row.feature_code,
    invocation_row.business_object_type, invocation_row.business_object_id,
    'AI_INVOCATION', invocation_row.quality_profile, invocation_row.writing_style,
    invocation_row.reserved_credits, invocation_row.charged_credits,
    audit_status_value, invocation_row.failure_code, invocation_row.correlation_id,
    invocation_row.config_version, invocation_row.prompt_template_version,
    timezone('utc', now())
  )
  on conflict (invocation_id) do nothing;

  if not exists (
    select 1
    from public.ai_business_audit audit
    where audit.invocation_id = invocation_row.id
      and audit.tenant_id = invocation_row.tenant_id
      and audit.hr_group_id = invocation_row.hr_group_id
  ) then
    raise exception 'AI_BUSINESS_AUDIT_SCOPE_CONFLICT' using errcode = '23505';
  end if;

  update public.ai_invocations invocation
  set business_audit_status = 'RECORDED',
      updated_at = timezone('utc', now())
  where invocation.tenant_id = invocation_row.tenant_id
    and invocation.hr_group_id = invocation_row.hr_group_id
    and invocation.id = invocation_row.id
    and invocation.business_audit_status = 'PENDING';
end;
$$;

revoke all on function internal_security.record_ai_invocation_business_audit(uuid)
  from public, anon, authenticated;

create or replace function internal_security.reconcile_ai_invocation_lifecycle(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_batch_size integer
)
returns table (releases_recovered integer, settlements_recovered integer, audits_recorded integer, retryable_count integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  candidate record;
  release_count integer := 0;
  settlement_count integer := 0;
  audit_count integer := 0;
  retry_count integer := 0;
  processed_count integer := 0;
begin
  if requested_tenant_id is null
     or requested_hr_group_id is null
     or requested_batch_size is null
     or requested_batch_size < 1
     or requested_batch_size > 100 then
    raise exception 'AI_RECOVERY_SCOPE_OR_BATCH_INVALID' using errcode = '22023';
  end if;

  for candidate in
    select invocation.id as invocation_id,
           reservation.id as reservation_id,
           coalesce(
             invocation.release_reason,
             case
               when invocation.result_status = 'INVALID' then 'INVALID_RESULT'
               when invocation.failure_code = 'PROVIDER_UNAVAILABLE' then 'PROVIDER_UNAVAILABLE'
               when invocation.failure_code = 'PROVIDER_FAILED' then 'PROVIDER_FAILED'
               else 'INTERNAL_FAILURE'
             end
           ) as release_reason
    from public.ai_invocations invocation
    join public.ai_credit_reservations reservation
      on reservation.tenant_id = invocation.tenant_id
      and reservation.hr_group_id = invocation.hr_group_id
      and reservation.invocation_id = invocation.id
    where invocation.tenant_id = requested_tenant_id
      and invocation.hr_group_id = requested_hr_group_id
      and (
        (invocation.execution_status in ('RELEASING', 'FAILED') and reservation.status = 'RESERVED')
        or (invocation.execution_status = 'RELEASING' and reservation.status = 'RELEASED')
      )
    order by invocation.updated_at, invocation.id
    limit requested_batch_size
    for update of invocation skip locked
  loop
    processed_count := processed_count + 1;
    begin
      perform internal_security.release_ai_invocation(
        candidate.reservation_id,
        candidate.invocation_id,
        candidate.release_reason,
        timezone('utc', now())
      );
      release_count := release_count + 1;
    exception when others then
      retry_count := retry_count + 1;
    end;
  end loop;

  for candidate in
    select invocation.id as invocation_id,
           reservation.reserved_credits,
           reservation.settled_at
    from public.ai_invocations invocation
    join public.ai_credit_reservations reservation
      on reservation.tenant_id = invocation.tenant_id
      and reservation.hr_group_id = invocation.hr_group_id
      and reservation.invocation_id = invocation.id
    where invocation.tenant_id = requested_tenant_id
      and invocation.hr_group_id = requested_hr_group_id
      and invocation.execution_status = 'SETTLING'
      and reservation.status = 'SETTLED'
    order by invocation.updated_at, invocation.id
    limit greatest(0, requested_batch_size - processed_count)
    for update of invocation skip locked
  loop
    processed_count := processed_count + 1;
    begin
      update public.ai_invocations invocation
      set execution_status = 'SUCCEEDED',
          charged_credits = candidate.reserved_credits,
          failure_code = null,
          business_audit_status = 'PENDING',
          finished_at = coalesce(invocation.finished_at, candidate.settled_at, timezone('utc', now())),
          updated_at = timezone('utc', now())
      where invocation.tenant_id = requested_tenant_id
        and invocation.hr_group_id = requested_hr_group_id
        and invocation.id = candidate.invocation_id
        and invocation.execution_status = 'SETTLING';
      if found then
        settlement_count := settlement_count + 1;
      else
        retry_count := retry_count + 1;
      end if;
    exception when others then
      retry_count := retry_count + 1;
    end;
  end loop;

  for candidate in
    select invocation.id as invocation_id
    from public.ai_invocations invocation
    where invocation.tenant_id = requested_tenant_id
      and invocation.hr_group_id = requested_hr_group_id
      and invocation.execution_status in ('SUCCEEDED', 'FAILED', 'REJECTED')
      and invocation.business_audit_status = 'PENDING'
      and not exists (
        select 1
        from public.ai_credit_reservations reservation
        where reservation.tenant_id = invocation.tenant_id
          and reservation.hr_group_id = invocation.hr_group_id
          and reservation.invocation_id = invocation.id
          and reservation.status = 'RESERVED'
      )
    order by invocation.updated_at, invocation.id
    limit greatest(0, requested_batch_size - processed_count)
    for update of invocation skip locked
  loop
    processed_count := processed_count + 1;
    begin
      perform internal_security.record_ai_invocation_business_audit(candidate.invocation_id);
      audit_count := audit_count + 1;
    exception when others then
      retry_count := retry_count + 1;
    end;
  end loop;

  return query select release_count, settlement_count, audit_count, retry_count;
end;
$$;

revoke all on function internal_security.reconcile_ai_invocation_lifecycle(uuid, uuid, integer)
  from public, anon, authenticated;

create or replace function public.settle_ai_invocation(
  requested_reservation_id uuid,
  requested_invocation_id uuid,
  requested_finished_at timestamptz
)
returns void
language sql
volatile
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
  select internal_security.settle_ai_invocation(
    requested_reservation_id, requested_invocation_id, requested_finished_at
  );
$$;

create or replace function public.release_ai_invocation(
  requested_reservation_id uuid,
  requested_invocation_id uuid,
  requested_reason text,
  requested_finished_at timestamptz
)
returns void
language sql
volatile
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
  select internal_security.release_ai_invocation(
    requested_reservation_id, requested_invocation_id, requested_reason, requested_finished_at
  );
$$;

create or replace function public.record_ai_invocation_business_audit(
  requested_invocation_id uuid
)
returns void
language sql
volatile
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
  select internal_security.record_ai_invocation_business_audit(requested_invocation_id);
$$;

create or replace function public.reconcile_ai_invocation_lifecycle(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_batch_size integer
)
returns table (releases_recovered integer, settlements_recovered integer, audits_recorded integer, retryable_count integer)
language sql
volatile
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
  select *
  from internal_security.reconcile_ai_invocation_lifecycle(
    requested_tenant_id, requested_hr_group_id, requested_batch_size
  );
$$;

create or replace function internal_security.reconcile_expired_ai_voice_sessions(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_batch_size integer
)
returns table (processed_count integer, finalized_count integer, retryable_count integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  policy_time_zone text;
  policy_is_active boolean;
  voice_row record;
  team_row record;
  was_finalized boolean;
  processed integer := 0;
  finalized integer := 0;
  retryable integer := 0;
begin
  if requested_tenant_id is null
     or requested_hr_group_id is null
     or requested_batch_size is null
     or requested_batch_size < 1
     or requested_batch_size > 100 then
    raise exception 'AI_VOICE_RECOVERY_SCOPE_OR_BATCH_INVALID' using errcode = '22023';
  end if;

  select policy.time_zone, policy.is_active
  into policy_time_zone, policy_is_active
  from public.ai_credit_group_policies policy
  where policy.tenant_id = requested_tenant_id
    and policy.hr_group_id = requested_hr_group_id
  for update skip locked;
  if not found or not coalesce(policy_is_active, false) then
    for voice_row in
      select session.*
      from public.ai_voice_sessions session
      where session.tenant_id = requested_tenant_id
        and session.hr_group_id = requested_hr_group_id
        and (
          (session.status = 'ACTIVE'
            and session.finalization_deadline_at <= timezone('utc', now()))
          or (session.status in ('ENDED', 'FAILED')
            and session.voice_credit_status = 'PENDING')
        )
      order by coalesce(session.ended_at, session.finalization_deadline_at), session.id
      limit requested_batch_size
      for update of session skip locked
    loop
      processed := processed + 1;
      retryable := retryable + 1;
      if voice_row.status = 'ACTIVE' then
        update public.ai_voice_sessions session
        set status = 'ENDED',
            ended_at = voice_row.finalization_deadline_at,
            termination_reason = 'TIMEOUT'
        where session.tenant_id = voice_row.tenant_id
          and session.hr_group_id = voice_row.hr_group_id
          and session.id = voice_row.id
          and session.status = 'ACTIVE';
      end if;
    end loop;

    if processed < requested_batch_size then
      for team_row in
        select session.*
        from public.ai_team_sessions session
        where session.tenant_id = requested_tenant_id
          and session.hr_group_id = requested_hr_group_id
          and session.conversation_type = 'VOICE'
          and (
            (session.status = 'ACTIVE'
              and session.finalization_deadline_at <= timezone('utc', now()))
            or (session.status in ('ENDED', 'FAILED')
              and session.voice_credit_status = 'PENDING')
          )
        order by coalesce(session.ended_at, session.finalization_deadline_at), session.id
        limit (requested_batch_size - processed)
        for update of session skip locked
      loop
        processed := processed + 1;
        retryable := retryable + 1;
        if team_row.status = 'ACTIVE' then
          update public.ai_team_sessions session
          set status = 'ENDED',
              ended_at = team_row.finalization_deadline_at,
              termination_reason = 'TIMEOUT'
          where session.tenant_id = team_row.tenant_id
            and session.hr_group_id = team_row.hr_group_id
            and session.id = team_row.id
            and session.status = 'ACTIVE';
        end if;
      end loop;
    end if;

    return query select processed, finalized, retryable;
    return;
  end if;

  for voice_row in
    select session.*
    from public.ai_voice_sessions session
    where session.tenant_id = requested_tenant_id
      and session.hr_group_id = requested_hr_group_id
      and (
        (session.status = 'ACTIVE'
          and session.finalization_deadline_at <= timezone('utc', now()))
        or (session.status in ('ENDED', 'FAILED')
          and session.voice_credit_status = 'PENDING')
      )
    order by coalesce(session.ended_at, session.finalization_deadline_at), session.id
    limit requested_batch_size
    for update of session skip locked
  loop
    processed := processed + 1;
    if voice_row.status = 'ACTIVE' then
      update public.ai_voice_sessions session
      set status = 'ENDED',
          ended_at = voice_row.finalization_deadline_at,
          termination_reason = 'TIMEOUT'
      where session.tenant_id = voice_row.tenant_id
        and session.hr_group_id = voice_row.hr_group_id
        and session.id = voice_row.id
        and session.status = 'ACTIVE'
      returning session.* into voice_row;
    end if;

    begin
      select result.finalized
      into was_finalized
      from internal_security.finalize_ai_voice_session(
        voice_row.tenant_id,
        voice_row.hr_group_id,
        voice_row.actor_user_id,
        'EMPLOYEE',
        voice_row.id,
        voice_row.status,
        voice_row.tool_call_count,
        voice_row.max_duration_seconds,
        to_char(timezone(policy_time_zone, coalesce(voice_row.ended_at, now())), 'YYYY-MM'),
        coalesce(voice_row.termination_reason, 'TIMEOUT')
      ) result;

      if coalesce(was_finalized, false) then
        finalized := finalized + 1;
      else
        update public.ai_voice_sessions session
        set status = charge.session_status,
            ended_at = charge.ended_at,
            duration_seconds = charge.duration_seconds,
            tool_call_count = greatest(session.tool_call_count, voice_row.tool_call_count),
            termination_reason = charge.termination_reason,
            billable_voice_units = charge.billable_voice_units,
            voice_credits = charge.credit_amount,
            voice_credit_status = 'SETTLED'
        from public.ai_voice_credit_charges charge
        where charge.tenant_id = voice_row.tenant_id
          and charge.hr_group_id = voice_row.hr_group_id
          and charge.context_type = 'EMPLOYEE'
          and charge.source_session_id = voice_row.id
          and session.tenant_id = voice_row.tenant_id
          and session.hr_group_id = voice_row.hr_group_id
          and session.id = voice_row.id
          and session.voice_credit_status = 'PENDING';
        if found then
          finalized := finalized + 1;
        else
          retryable := retryable + 1;
        end if;
      end if;
    exception when others then
      retryable := retryable + 1;
    end;
  end loop;

  if processed < requested_batch_size then
    for team_row in
      select session.*
      from public.ai_team_sessions session
      where session.tenant_id = requested_tenant_id
        and session.hr_group_id = requested_hr_group_id
        and session.conversation_type = 'VOICE'
        and (
          (session.status = 'ACTIVE'
            and session.finalization_deadline_at <= timezone('utc', now()))
          or (session.status in ('ENDED', 'FAILED')
            and session.voice_credit_status = 'PENDING')
        )
      order by coalesce(session.ended_at, session.finalization_deadline_at), session.id
      limit (requested_batch_size - processed)
      for update of session skip locked
    loop
      processed := processed + 1;
      if team_row.status = 'ACTIVE' then
        update public.ai_team_sessions session
        set status = 'ENDED',
            ended_at = team_row.finalization_deadline_at,
            termination_reason = 'TIMEOUT'
        where session.tenant_id = team_row.tenant_id
          and session.hr_group_id = team_row.hr_group_id
          and session.id = team_row.id
          and session.status = 'ACTIVE'
        returning session.* into team_row;
      end if;

      begin
        select result.finalized
        into was_finalized
        from internal_security.finalize_ai_voice_session(
          team_row.tenant_id,
          team_row.hr_group_id,
          team_row.actor_user_id,
          'TEAM',
          team_row.id,
          team_row.status,
          team_row.tool_call_count,
          team_row.max_duration_seconds,
          to_char(timezone(policy_time_zone, coalesce(team_row.ended_at, now())), 'YYYY-MM'),
          coalesce(team_row.termination_reason, 'TIMEOUT')
        ) result;

        if coalesce(was_finalized, false) then
          finalized := finalized + 1;
        else
          update public.ai_team_sessions session
          set status = charge.session_status,
              ended_at = charge.ended_at,
              duration_seconds = charge.duration_seconds,
              tool_call_count = greatest(session.tool_call_count, team_row.tool_call_count),
              termination_reason = charge.termination_reason,
              billable_voice_units = charge.billable_voice_units,
              voice_credits = charge.credit_amount,
              voice_credit_status = 'SETTLED'
          from public.ai_voice_credit_charges charge
          where charge.tenant_id = team_row.tenant_id
            and charge.hr_group_id = team_row.hr_group_id
            and charge.context_type = 'TEAM'
            and charge.source_session_id = team_row.id
            and session.tenant_id = team_row.tenant_id
            and session.hr_group_id = team_row.hr_group_id
            and session.id = team_row.id
            and session.voice_credit_status = 'PENDING';
          if found then
            finalized := finalized + 1;
          else
            retryable := retryable + 1;
          end if;
        end if;
      exception when others then
        retryable := retryable + 1;
      end;
    end loop;
  end if;

  return query select processed, finalized, retryable;
end;
$$;

revoke all on function internal_security.reconcile_expired_ai_voice_sessions(uuid, uuid, integer)
  from public, anon, authenticated;

create or replace function public.reconcile_expired_ai_voice_sessions(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_batch_size integer
)
returns table (processed_count integer, finalized_count integer, retryable_count integer)
language sql
volatile
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
  select *
  from internal_security.reconcile_expired_ai_voice_sessions(
    requested_tenant_id, requested_hr_group_id, requested_batch_size
  );
$$;

create or replace function public.finalize_ai_voice_session(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_actor_user_id uuid,
  requested_context_type text,
  requested_session_id uuid,
  requested_status text,
  requested_tool_call_count integer,
  requested_max_duration_seconds integer,
  requested_month text,
  requested_termination_reason text
)
returns table (
  duration_seconds integer,
  billable_voice_units integer,
  voice_credits integer,
  finalized boolean
)
language plpgsql
volatile
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
declare
  session_max_duration_seconds integer;
begin
  if requested_context_type = 'EMPLOYEE' then
    select session.max_duration_seconds
    into session_max_duration_seconds
    from public.ai_voice_sessions session
    where session.tenant_id = requested_tenant_id
      and session.hr_group_id = requested_hr_group_id
      and session.actor_user_id = requested_actor_user_id
      and session.id = requested_session_id;
  elsif requested_context_type = 'TEAM' then
    select session.max_duration_seconds
    into session_max_duration_seconds
    from public.ai_team_sessions session
    where session.tenant_id = requested_tenant_id
      and session.hr_group_id = requested_hr_group_id
      and session.actor_user_id = requested_actor_user_id
      and session.id = requested_session_id;
  else
    raise exception 'AI_VOICE_FINALIZE_INPUT_INVALID' using errcode = '22023';
  end if;
  if not found or session_max_duration_seconds is null then
    raise exception 'AI_VOICE_SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;

  return query
  select *
  from internal_security.finalize_ai_voice_session(
    requested_tenant_id,
    requested_hr_group_id,
    requested_actor_user_id,
    requested_context_type,
    requested_session_id,
    requested_status,
    requested_tool_call_count,
    session_max_duration_seconds,
    requested_month,
    requested_termination_reason
  );
end;
$$;

revoke all on function public.settle_ai_invocation(uuid, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.release_ai_invocation(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.record_ai_invocation_business_audit(uuid)
  from public, anon, authenticated;
revoke all on function public.reconcile_ai_invocation_lifecycle(uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.reconcile_expired_ai_voice_sessions(uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.finalize_ai_voice_session(uuid, uuid, uuid, text, uuid, text, integer, integer, text, text)
  from public, anon, authenticated;

grant execute on function internal_security.settle_ai_invocation(uuid, uuid, timestamptz)
  to service_role;
grant execute on function internal_security.release_ai_invocation(uuid, uuid, text, timestamptz)
  to service_role;
grant execute on function internal_security.record_ai_invocation_business_audit(uuid)
  to service_role;
grant execute on function internal_security.reconcile_ai_invocation_lifecycle(uuid, uuid, integer)
  to service_role;
grant execute on function internal_security.reconcile_expired_ai_voice_sessions(uuid, uuid, integer)
  to service_role;
grant execute on function public.settle_ai_invocation(uuid, uuid, timestamptz)
  to service_role;
grant execute on function public.release_ai_invocation(uuid, uuid, text, timestamptz)
  to service_role;
grant execute on function public.record_ai_invocation_business_audit(uuid)
  to service_role;
grant execute on function public.reconcile_ai_invocation_lifecycle(uuid, uuid, integer)
  to service_role;
grant execute on function public.reconcile_expired_ai_voice_sessions(uuid, uuid, integer)
  to service_role;
grant execute on function public.finalize_ai_voice_session(uuid, uuid, uuid, text, uuid, text, integer, integer, text, text)
  to service_role;

comment on column public.ai_invocations.business_audit_status is
  'Durable outbox state for the mandatory AI business audit event.';
comment on column public.ai_invocations.release_reason is
  'Persisted release intent while an AI invocation is RELEASING.';
comment on column public.ai_voice_sessions.finalization_deadline_at is
  'Database-derived voice expiry from session start and the server-snapshotted maximum duration.';
comment on column public.ai_team_sessions.finalization_deadline_at is
  'Database-derived voice expiry from session start and the server-snapshotted maximum duration.';

commit;
