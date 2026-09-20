begin;

-- AI administration is deliberately HR-group scoped. The table stores
-- governance choices only; prompts, transcripts and audio never belong here.
create table public.ai_group_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  ai_enabled boolean not null default true,
  voice_enabled boolean not null default true,
  employee_ai_enabled boolean not null default true,
  team_ai_enabled boolean not null default true,
  quality_profile text not null default 'EFFICIENT'
    check (quality_profile in ('EFFICIENT', 'BALANCED', 'IN_DEPTH')),
  conversation_style text not null default 'NEUTRAL'
    check (conversation_style in ('NEUTRAL', 'BUSINESS', 'COACHING')),
  answer_length text not null default 'NORMAL'
    check (answer_length in ('SHORT', 'NORMAL', 'DETAILED')),
  voice_id text not null default 'alloy'
    check (voice_id in ('alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse')),
  max_voice_session_seconds integer not null default 1800
    check (max_voice_session_seconds between 30 and 3600),
  end_summary_enabled boolean not null default true,
  employee_note_save_enabled boolean not null default false,
  team_logbook_save_enabled boolean not null default true,
  role_policies jsonb not null default jsonb_build_object(
    'EMPLOYEE', jsonb_build_object('aiEnabled', true, 'voiceEnabled', true),
    'DIRECT_MANAGER', jsonb_build_object('aiEnabled', true, 'voiceEnabled', true),
    'TEAM_LEAD', jsonb_build_object('aiEnabled', true, 'voiceEnabled', true),
    'HR_ADVISOR', jsonb_build_object('aiEnabled', true, 'voiceEnabled', true),
    'PAYROLL_SPECIALIST', jsonb_build_object('aiEnabled', true, 'voiceEnabled', true),
    'HR_ADMIN', jsonb_build_object('aiEnabled', true, 'voiceEnabled', true),
    'TENANT_ADMIN', jsonb_build_object('aiEnabled', true, 'voiceEnabled', true)
  )
    check (jsonb_typeof(role_policies) = 'object'),
  capability_settings jsonb not null default jsonb_build_object(
    'IMPROVE_EXISTING_HR_TEXT', true,
    'EMPLOYEE_SUMMARY', true,
    'CONVERSATION_PREPARATION', true,
    'DEVELOPMENT_GOAL_SMART', true,
    'VACANCY_DRAFT', true,
    'TEAM_SUMMARY', true,
    'VOICE', true
  )
    check (jsonb_typeof(capability_settings) = 'object'),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_group_settings_scope_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict,
  constraint ai_group_settings_scope_key unique (tenant_id, hr_group_id)
);

create index ai_group_settings_scope_idx
  on public.ai_group_settings (tenant_id, hr_group_id);

create or replace function internal_security.audit_ai_group_settings_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  changed_fields jsonb := '[]'::jsonb;
  audit_actor uuid;
  audit_tenant uuid;
  audit_group uuid;
  audit_id uuid;
  audit_action text;
begin
  if tg_op = 'DELETE' then
    audit_tenant := old.tenant_id;
    audit_group := old.hr_group_id;
    audit_id := old.id;
    audit_actor := coalesce(auth.uid(), old.updated_by);
    audit_action := 'DELETE';
  else
    audit_tenant := new.tenant_id;
    audit_group := new.hr_group_id;
    audit_id := new.id;
    audit_actor := coalesce(auth.uid(), new.updated_by);
    audit_action := case when tg_op = 'INSERT' then 'CREATE' else 'UPDATE' end;
  end if;

  if tg_op = 'INSERT' then
    changed_fields := to_jsonb(array[
      'ai_enabled', 'voice_enabled', 'employee_ai_enabled', 'team_ai_enabled',
      'quality_profile', 'conversation_style', 'answer_length', 'voice_id',
      'max_voice_session_seconds', 'end_summary_enabled',
      'employee_note_save_enabled', 'team_logbook_save_enabled',
      'role_policies', 'capability_settings'
    ]);
  elsif tg_op = 'UPDATE' then
    if new.ai_enabled is distinct from old.ai_enabled then changed_fields := changed_fields || '["ai_enabled"]'::jsonb; end if;
    if new.voice_enabled is distinct from old.voice_enabled then changed_fields := changed_fields || '["voice_enabled"]'::jsonb; end if;
    if new.employee_ai_enabled is distinct from old.employee_ai_enabled then changed_fields := changed_fields || '["employee_ai_enabled"]'::jsonb; end if;
    if new.team_ai_enabled is distinct from old.team_ai_enabled then changed_fields := changed_fields || '["team_ai_enabled"]'::jsonb; end if;
    if new.quality_profile is distinct from old.quality_profile then changed_fields := changed_fields || '["quality_profile"]'::jsonb; end if;
    if new.conversation_style is distinct from old.conversation_style then changed_fields := changed_fields || '["conversation_style"]'::jsonb; end if;
    if new.answer_length is distinct from old.answer_length then changed_fields := changed_fields || '["answer_length"]'::jsonb; end if;
    if new.voice_id is distinct from old.voice_id then changed_fields := changed_fields || '["voice_id"]'::jsonb; end if;
    if new.max_voice_session_seconds is distinct from old.max_voice_session_seconds then changed_fields := changed_fields || '["max_voice_session_seconds"]'::jsonb; end if;
    if new.end_summary_enabled is distinct from old.end_summary_enabled then changed_fields := changed_fields || '["end_summary_enabled"]'::jsonb; end if;
    if new.employee_note_save_enabled is distinct from old.employee_note_save_enabled then changed_fields := changed_fields || '["employee_note_save_enabled"]'::jsonb; end if;
    if new.team_logbook_save_enabled is distinct from old.team_logbook_save_enabled then changed_fields := changed_fields || '["team_logbook_save_enabled"]'::jsonb; end if;
    if new.role_policies is distinct from old.role_policies then changed_fields := changed_fields || '["role_policies"]'::jsonb; end if;
    if new.capability_settings is distinct from old.capability_settings then changed_fields := changed_fields || '["capability_settings"]'::jsonb; end if;
  end if;

  insert into public.audit_logs (
    tenant_id, administration_id, entity_name, entity_id, actor_user_id, action, changes
  ) values (
    audit_tenant,
    null,
    'ai_group_settings',
    audit_id,
    audit_actor,
    audit_action,
    jsonb_build_object('hr_group_id', audit_group, 'changed_fields', changed_fields)
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function internal_security.audit_ai_group_settings_change() from public, anon, authenticated;

create trigger ai_group_settings_updated_at
before update on public.ai_group_settings
for each row execute function internal_security.set_updated_at();

create trigger ai_group_settings_audit
after insert or update or delete on public.ai_group_settings
for each row execute function internal_security.audit_ai_group_settings_change();

alter table public.ai_group_settings enable row level security;
revoke all on table public.ai_group_settings from public, anon, authenticated;
grant select, insert, update on table public.ai_group_settings to authenticated;
grant all on table public.ai_group_settings to service_role;

create policy ai_group_settings_select_scoped
on public.ai_group_settings for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'ai:manage')));

create policy ai_group_settings_insert_scoped
on public.ai_group_settings for insert to authenticated
with check (
  updated_by = (select auth.uid())
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'ai:manage'))
);

create policy ai_group_settings_update_scoped
on public.ai_group_settings for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'ai:manage')))
with check (
  updated_by = (select auth.uid())
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'ai:manage'))
);

-- Keep the central catalog and allocation ledger authoritative for both
-- capability and realtime usage. VOICE_MINUTE is a catalog profile, not a
-- second balance system.
alter table public.ai_credit_charge_catalog
  drop constraint if exists ai_credit_charge_catalog_quality_profile_check;
alter table public.ai_credit_charge_catalog
  add constraint ai_credit_charge_catalog_quality_profile_check
  check (quality_profile in ('EFFICIENT', 'BALANCED', 'IN_DEPTH', 'VOICE_MINUTE'));

insert into public.ai_credit_charge_catalog (
  feature_code, quality_profile, charge_reference, credit_amount, config_version
)
values ('REALTIME_VOICE', 'VOICE_MINUTE', 'ai.realtime-voice.started-minute', 1, 'ai-voice.20260915.1')
on conflict (feature_code, quality_profile) do update
set charge_reference = excluded.charge_reference,
    credit_amount = excluded.credit_amount,
    config_version = excluded.config_version,
    is_active = true,
    updated_at = timezone('utc', now());

alter table public.ai_invocations
  add column if not exists invocation_origin text not null default 'UI';
alter table public.ai_invocations
  drop constraint if exists ai_invocations_invocation_origin_check;
alter table public.ai_invocations
  add constraint ai_invocations_invocation_origin_check
  check (invocation_origin in ('UI', 'VOICE'));
create index if not exists ai_invocations_origin_idx
  on public.ai_invocations (tenant_id, hr_group_id, invocation_origin, created_at desc);

alter table public.ai_voice_sessions
  add column if not exists termination_reason text
    check (termination_reason is null or termination_reason in ('NORMAL', 'EXPLICIT', 'TIMEOUT', 'DISCONNECT', 'FAILURE', 'CANCELLED'));
alter table public.ai_voice_sessions
  add column if not exists billable_voice_units integer not null default 0 check (billable_voice_units >= 0);
alter table public.ai_voice_sessions
  add column if not exists voice_credits integer not null default 0 check (voice_credits >= 0);
alter table public.ai_voice_sessions
  add column if not exists voice_credit_status text not null default 'PENDING' check (voice_credit_status in ('PENDING', 'SETTLED'));

alter table public.ai_team_sessions
  add column if not exists termination_reason text
    check (termination_reason is null or termination_reason in ('NORMAL', 'EXPLICIT', 'TIMEOUT', 'DISCONNECT', 'FAILURE', 'CANCELLED'));
alter table public.ai_team_sessions
  add column if not exists billable_voice_units integer not null default 0 check (billable_voice_units >= 0);
alter table public.ai_team_sessions
  add column if not exists voice_credits integer not null default 0 check (voice_credits >= 0);
alter table public.ai_team_sessions
  add column if not exists voice_credit_status text not null default 'PENDING' check (voice_credit_status in ('PENDING', 'SETTLED'));

create table public.ai_voice_credit_charges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  context_type text not null check (context_type in ('EMPLOYEE', 'TEAM')),
  source_session_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  period_month date not null check (period_month = date_trunc('month', period_month)::date),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  billable_voice_units integer not null check (billable_voice_units >= 0),
  charge_reference text not null check (char_length(btrim(charge_reference)) between 1 and 200),
  credit_amount integer not null check (credit_amount >= 0),
  session_status text not null check (session_status in ('ENDED', 'FAILED')),
  termination_reason text not null check (termination_reason in ('NORMAL', 'EXPLICIT', 'TIMEOUT', 'DISCONNECT', 'FAILURE', 'CANCELLED')),
  created_at timestamptz not null default timezone('utc', now()),
  constraint ai_voice_credit_charges_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict,
  constraint ai_voice_credit_charges_session_key
    unique (tenant_id, hr_group_id, context_type, source_session_id)
);

create index ai_voice_credit_charges_scope_period_idx
  on public.ai_voice_credit_charges (tenant_id, hr_group_id, period_month, ended_at desc);
create index ai_voice_credit_charges_actor_idx
  on public.ai_voice_credit_charges (tenant_id, hr_group_id, actor_user_id, ended_at desc);

create table public.ai_voice_credit_charge_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  charge_id uuid not null,
  allocation_id uuid not null,
  settled_credits integer not null check (settled_credits > 0),
  created_at timestamptz not null default timezone('utc', now()),
  constraint ai_voice_credit_charge_allocations_charge_fkey
    foreign key (charge_id) references public.ai_voice_credit_charges(id) on delete cascade,
  constraint ai_voice_credit_charge_allocations_allocation_fkey
    foreign key (tenant_id, hr_group_id, allocation_id)
    references public.ai_credit_allocations(tenant_id, hr_group_id, id)
    on delete restrict,
  constraint ai_voice_credit_charge_allocations_key unique (charge_id, allocation_id)
);

alter table public.ai_voice_credit_charges enable row level security;
alter table public.ai_voice_credit_charge_allocations enable row level security;
revoke all on table public.ai_voice_credit_charges, public.ai_voice_credit_charge_allocations from public, anon, authenticated;
grant select on table public.ai_voice_credit_charges, public.ai_voice_credit_charge_allocations to authenticated;
grant all on table public.ai_voice_credit_charges, public.ai_voice_credit_charge_allocations to service_role;

create policy ai_voice_credit_charges_select_scoped
on public.ai_voice_credit_charges for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'ai:usage-read')));

create policy ai_voice_credit_charge_allocations_select_scoped
on public.ai_voice_credit_charge_allocations for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'ai:usage-read')));

create or replace function internal_security.finalize_ai_voice_session(
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
security definer
set search_path = ''
as $$
declare
  period_start date;
  policy_exists boolean;
  existing_charge record;
  employee_session public.ai_voice_sessions%rowtype;
  team_session public.ai_team_sessions%rowtype;
  started_at_value timestamptz;
  ended_at_value timestamptz;
  final_status text;
  final_reason text;
  duration_value integer;
  units_value integer;
  credits_value integer;
  catalog_reference text;
  catalog_credit_amount integer;
  charge_id_value uuid;
  quota_row record;
  usage_row public.ai_credit_actor_usage%rowtype;
  allocation_row record;
  allocation_units integer;
  remaining integer;
  group_available integer;
begin
  if requested_context_type not in ('EMPLOYEE', 'TEAM')
     or requested_status not in ('ENDED', 'FAILED')
     or requested_tool_call_count is null or requested_tool_call_count < 0
     or requested_max_duration_seconds is null or requested_max_duration_seconds < 30
     or requested_termination_reason not in ('NORMAL', 'EXPLICIT', 'TIMEOUT', 'DISCONNECT', 'FAILURE', 'CANCELLED') then
    raise exception 'AI_VOICE_FINALIZE_INPUT_INVALID' using errcode = '22023';
  end if;
  period_start := internal_security.ai_credit_month_start(requested_month);

  select true into policy_exists
  from public.ai_credit_group_policies policy
  where policy.tenant_id = requested_tenant_id
    and policy.hr_group_id = requested_hr_group_id
    and policy.is_active
  for update;
  if not coalesce(policy_exists, false) then
    raise exception 'AI_CREDITS_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select charge.* into existing_charge
  from public.ai_voice_credit_charges charge
  where charge.tenant_id = requested_tenant_id
    and charge.hr_group_id = requested_hr_group_id
    and charge.context_type = requested_context_type
    and charge.source_session_id = requested_session_id
  for update;
  if found then
    return query select existing_charge.duration_seconds, existing_charge.billable_voice_units, existing_charge.credit_amount, false;
    return;
  end if;

  if requested_context_type = 'EMPLOYEE' then
    select session.* into employee_session
    from public.ai_voice_sessions session
    where session.id = requested_session_id
      and session.tenant_id = requested_tenant_id
      and session.hr_group_id = requested_hr_group_id
      and session.actor_user_id = requested_actor_user_id
    for update;
    if not found then raise exception 'AI_VOICE_SESSION_NOT_FOUND' using errcode = 'P0002'; end if;
    started_at_value := employee_session.started_at;
    ended_at_value := coalesce(employee_session.ended_at, timezone('utc', now()));
    final_status := case when employee_session.status in ('ENDED', 'FAILED') then employee_session.status else requested_status end;
    final_reason := coalesce(employee_session.termination_reason, requested_termination_reason);
  else
    select session.* into team_session
    from public.ai_team_sessions session
    where session.id = requested_session_id
      and session.tenant_id = requested_tenant_id
      and session.hr_group_id = requested_hr_group_id
      and session.actor_user_id = requested_actor_user_id
    for update;
    if not found then raise exception 'AI_VOICE_SESSION_NOT_FOUND' using errcode = 'P0002'; end if;
    started_at_value := team_session.started_at;
    ended_at_value := coalesce(team_session.ended_at, timezone('utc', now()));
    final_status := case when team_session.status in ('ENDED', 'FAILED') then team_session.status else requested_status end;
    final_reason := coalesce(team_session.termination_reason, requested_termination_reason);
  end if;

  duration_value := greatest(0, least(requested_max_duration_seconds, ceil(extract(epoch from ended_at_value - started_at_value))::integer));
  units_value := case when duration_value > 0 then ceil(duration_value / 60.0)::integer else 0 end;

  select catalog.charge_reference, catalog.credit_amount
  into catalog_reference, catalog_credit_amount
  from public.ai_credit_charge_catalog catalog
  where catalog.feature_code = 'REALTIME_VOICE'
    and catalog.quality_profile = 'VOICE_MINUTE'
    and catalog.is_active;
  if catalog_reference is null or catalog_credit_amount is null or catalog_credit_amount < 0 then
    raise exception 'AI_CREDIT_CHARGE_NOT_CONFIGURED' using errcode = 'P0001';
  end if;
  credits_value := units_value * catalog_credit_amount;

  if credits_value > 0 then
    perform internal_security.ensure_ai_monthly_allowance(requested_tenant_id, requested_hr_group_id, requested_month);
    perform internal_security.expire_ai_credit_allocations(requested_tenant_id, requested_hr_group_id);

    select resolved.* into quota_row
    from internal_security.resolve_ai_actor_quota(requested_tenant_id, requested_hr_group_id, requested_actor_user_id) resolved
    limit 1;
    if not found then raise exception 'AI_CREDIT_QUOTA_UNAVAILABLE' using errcode = 'P0001'; end if;

    insert into public.ai_credit_actor_usage (tenant_id, hr_group_id, actor_user_id, period_month)
    values (requested_tenant_id, requested_hr_group_id, requested_actor_user_id, period_start)
    on conflict (tenant_id, hr_group_id, actor_user_id, period_month) do nothing;
    select usage.* into usage_row
    from public.ai_credit_actor_usage usage
    where usage.tenant_id = requested_tenant_id
      and usage.hr_group_id = requested_hr_group_id
      and usage.actor_user_id = requested_actor_user_id
      and usage.period_month = period_start
    for update;
    if usage_row.used_credits + credits_value > quota_row.monthly_quota_credits then
      raise exception 'AI_CREDIT_QUOTA_EXHAUSTED' using errcode = 'P0001';
    end if;

    select coalesce(sum(allocation.available_credits), 0)::integer into group_available
    from public.ai_credit_allocations allocation
    where allocation.tenant_id = requested_tenant_id
      and allocation.hr_group_id = requested_hr_group_id
      and (allocation.expires_at is null or allocation.expires_at > timezone('utc', now()));
    if group_available < credits_value then raise exception 'AI_CREDITS_EXHAUSTED' using errcode = 'P0001'; end if;
  end if;

  insert into public.ai_voice_credit_charges (
    tenant_id, hr_group_id, context_type, source_session_id, actor_user_id,
    period_month, started_at, ended_at, duration_seconds, billable_voice_units,
    charge_reference, credit_amount, session_status, termination_reason
  ) values (
    requested_tenant_id, requested_hr_group_id, requested_context_type, requested_session_id, requested_actor_user_id,
    period_start, started_at_value, ended_at_value, duration_value, units_value,
    catalog_reference, credits_value, final_status, final_reason
  ) returning id into charge_id_value;

  remaining := credits_value;
  for allocation_row in
    select allocation.id, allocation.available_credits
    from public.ai_credit_allocations allocation
    where allocation.tenant_id = requested_tenant_id
      and allocation.hr_group_id = requested_hr_group_id
      and allocation.available_credits > 0
      and (allocation.expires_at is null or allocation.expires_at > timezone('utc', now()))
    order by allocation.expires_at is null asc, allocation.expires_at asc nulls last, allocation.granted_at asc, allocation.id asc
    for update
  loop
    exit when remaining = 0;
    allocation_units := least(remaining, allocation_row.available_credits);
    update public.ai_credit_allocations allocation
    set settled_credits = allocation.settled_credits + allocation_units,
        updated_at = timezone('utc', now())
    where allocation.id = allocation_row.id
      and allocation.tenant_id = requested_tenant_id
      and allocation.hr_group_id = requested_hr_group_id;
    insert into public.ai_voice_credit_charge_allocations (
      tenant_id, hr_group_id, charge_id, allocation_id, settled_credits
    ) values (
      requested_tenant_id, requested_hr_group_id, charge_id_value, allocation_row.id, allocation_units
    );
    remaining := remaining - allocation_units;
  end loop;
  if remaining <> 0 then raise exception 'AI_CREDITS_UNAVAILABLE' using errcode = 'P0001'; end if;

  if credits_value > 0 then
    update public.ai_credit_actor_usage usage
    set settled_credits = usage.settled_credits + credits_value,
        updated_at = timezone('utc', now())
    where usage.tenant_id = requested_tenant_id
      and usage.hr_group_id = requested_hr_group_id
      and usage.actor_user_id = requested_actor_user_id
      and usage.period_month = period_start;
  end if;

  if requested_context_type = 'EMPLOYEE' then
    update public.ai_voice_sessions
    set status = final_status,
        ended_at = ended_at_value,
        duration_seconds = duration_value,
        tool_call_count = greatest(tool_call_count, requested_tool_call_count),
        termination_reason = final_reason,
        billable_voice_units = units_value,
        voice_credits = credits_value,
        voice_credit_status = 'SETTLED'
    where id = requested_session_id;
  else
    update public.ai_team_sessions
    set status = final_status,
        ended_at = ended_at_value,
        duration_seconds = duration_value,
        tool_call_count = greatest(tool_call_count, requested_tool_call_count),
        termination_reason = final_reason,
        billable_voice_units = units_value,
        voice_credits = credits_value,
        voice_credit_status = 'SETTLED'
    where id = requested_session_id;
  end if;

  return query select duration_value, units_value, credits_value, true;
end;
$$;

revoke all on function internal_security.finalize_ai_voice_session(uuid, uuid, uuid, text, uuid, text, integer, integer, text, text) from public, anon, authenticated;

create function public.finalize_ai_voice_session(
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
returns table (duration_seconds integer, billable_voice_units integer, voice_credits integer, finalized boolean)
language sql
volatile
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
  select * from internal_security.finalize_ai_voice_session(
    requested_tenant_id, requested_hr_group_id, requested_actor_user_id,
    requested_context_type, requested_session_id, requested_status,
    requested_tool_call_count, requested_max_duration_seconds, requested_month,
    requested_termination_reason
  );
$$;

revoke all on function public.finalize_ai_voice_session(uuid, uuid, uuid, text, uuid, text, integer, integer, text, text) from public, anon, authenticated;
grant execute on function public.finalize_ai_voice_session(uuid, uuid, uuid, text, uuid, text, integer, integer, text, text) to service_role;

comment on table public.ai_group_settings is 'HR-groepgebonden AI governance settings; geen prompts, transcripties of audio.';
comment on table public.ai_voice_credit_charges is 'Realtime voice accounting trace; central ai_credit_allocations remains the balance ledger.';
comment on table public.ai_voice_credit_charge_allocations is 'Deterministic allocation links for realtime voice charges.';

commit;

