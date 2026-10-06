-- CONTROL02: durable, server-authoritative decisions and resumable ledger.
-- This is a local forward-only candidate. It does not authorize XML finalization
-- and must not be applied to a shared database without the existing migration
-- and Core/Payroll contract approvals.
begin;

-- Bind both secure BSN matchers to an authorized, active administration.
-- Existing three-argument callers are revoked below; new callers must supply
-- their server-selected administration as well as tenant and HR group.
create or replace function public.match_payroll_import_employee_bsn_fingerprint(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_bsn_fingerprint text
)
returns table (employee_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select employee.id
  from public.employee_secure_identifiers as identifier
  join public.employees as employee
    on employee.tenant_id = identifier.tenant_id
   and employee.id = identifier.employee_id
  join public.employee_administration_assignments as assignment
    on assignment.tenant_id = employee.tenant_id
   and assignment.hr_group_id = requested_hr_group_id
   and assignment.employee_id = employee.id
   and assignment.administration_id = requested_administration_id
   and assignment.effective_from <= current_date
   and (assignment.effective_to is null or assignment.effective_to >= current_date)
  join public.administrations as administration
    on administration.tenant_id = assignment.tenant_id
   and administration.hr_group_id = requested_hr_group_id
   and administration.id = assignment.administration_id
   and administration.is_active
  where requested_bsn_fingerprint ~ '^[0-9a-fA-F]{64}$'
    and identifier.tenant_id = requested_tenant_id
    and identifier.bsn_fingerprint = pg_catalog.lower(requested_bsn_fingerprint)
    and employee.tenant_id = requested_tenant_id
    and employee.hr_group_id = requested_hr_group_id
    and employee.deleted_at is null
    and (select internal_security.current_user_has_hr_group_permission(
      requested_tenant_id, requested_hr_group_id, 'payroll-import:write'
    ))
    and (select internal_security.has_administration_access(
      requested_tenant_id, requested_administration_id
    ))
  order by employee.id
  limit 5;
$$;

revoke all on function public.match_payroll_import_employee_bsn_fingerprint(uuid, uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.match_payroll_import_employee_bsn_fingerprint(uuid, uuid, uuid, text)
to authenticated;

-- Retire the unscoped legacy overload and remove its untrusted search path.
alter function public.match_payroll_import_employee_bsn_fingerprint(uuid, uuid, text)
  set search_path = '';
revoke all on function public.match_payroll_import_employee_bsn_fingerprint(uuid, uuid, text)
from public, anon, authenticated;

-- Batch the same scoped match for the manual-review workspace. The bounded
-- function returns neither raw BSNs nor Employee IDs outside the active admin.
create or replace function public.match_payroll_import_employee_bsn_fingerprints(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_bsn_fingerprints text[]
)
returns table (requested_bsn_fingerprint text, employee_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if requested_tenant_id is null
    or requested_hr_group_id is null
    or requested_administration_id is null
    or requested_bsn_fingerprints is null
    or pg_catalog.cardinality(requested_bsn_fingerprints) not between 1 and 500 then
    raise exception using
      errcode = '22023',
      message = 'PAYROLL_IMPORT_BSN_FINGERPRINT_BATCH_INVALID';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(requested_bsn_fingerprints) as requested(fingerprint)
    where requested.fingerprint is null
      or requested.fingerprint !~ '^[0-9a-fA-F]{64}$'
  ) then
    raise exception using
      errcode = '22023',
      message = 'PAYROLL_IMPORT_BSN_FINGERPRINT_INVALID';
  end if;

  if not (
    (select internal_security.current_user_has_hr_group_permission(
      requested_tenant_id,
      requested_hr_group_id,
      'payroll-import:write'
    ))
    and (select internal_security.has_administration_access(
      requested_tenant_id,
      requested_administration_id
    ))
  ) then
    raise exception using
      errcode = '42501',
      message = 'PAYROLL_IMPORT_BSN_MATCH_NOT_AUTHORIZED';
  end if;

  return query
  with requested as (
    select distinct pg_catalog.lower(input.fingerprint) as fingerprint
    from pg_catalog.unnest(requested_bsn_fingerprints) as input(fingerprint)
  ), matched as (
    select requested.fingerprint,
           identifier.employee_id
    from requested
    join public.employee_secure_identifiers identifier
      on identifier.tenant_id = requested_tenant_id
     and identifier.bsn_fingerprint = requested.fingerprint
    join public.employees employee
      on employee.tenant_id = identifier.tenant_id
     and employee.id = identifier.employee_id
    join public.employee_administration_assignments assignment
      on assignment.tenant_id = employee.tenant_id
     and assignment.hr_group_id = requested_hr_group_id
     and assignment.employee_id = employee.id
     and assignment.administration_id = requested_administration_id
     and assignment.effective_from <= current_date
     and (assignment.effective_to is null or assignment.effective_to >= current_date)
    join public.administrations administration
      on administration.tenant_id = assignment.tenant_id
     and administration.hr_group_id = requested_hr_group_id
     and administration.id = assignment.administration_id
     and administration.is_active
    where employee.tenant_id = requested_tenant_id
      and employee.hr_group_id = requested_hr_group_id
      and employee.deleted_at is null
  ), ranked as (
    select matched.fingerprint,
           matched.employee_id,
           pg_catalog.row_number() over (partition by matched.fingerprint order by matched.employee_id) as match_number
    from matched
  )
  select ranked.fingerprint, ranked.employee_id
  from ranked
  where ranked.match_number <= 5
  order by ranked.fingerprint, ranked.employee_id;
end;
$$;

revoke all on function public.match_payroll_import_employee_bsn_fingerprints(uuid, uuid, uuid, text[])
from public, anon, authenticated;
grant execute on function public.match_payroll_import_employee_bsn_fingerprints(uuid, uuid, uuid, text[])
to authenticated;

-- The existing batch primary scope key omits administration_id. Add the
-- equivalent composite key so every new decision/action FK also proves the
-- administration context at the database boundary.
create unique index payroll_import_batches_administration_scope_key
  on public.payroll_import_batches (tenant_id, hr_group_id, administration_id, id);

create table public.payroll_import_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  administration_id uuid not null,
  batch_id uuid not null,
  import_person_id uuid not null,
  decision_version integer not null,
  decision_payload jsonb not null,
  decision_hash text not null,
  source_hash text not null,
  analysis_hash text not null,
  core_state_hash text not null,
  contract_version text,
  schema_version text,
  confirmer_user_id uuid not null references auth.users(id) on delete restrict,
  confirmed_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint payroll_import_decisions_batch_scope_fkey
    foreign key (tenant_id, hr_group_id, administration_id, batch_id)
    references public.payroll_import_batches(tenant_id, hr_group_id, administration_id, id)
    on delete cascade,
  constraint payroll_import_decisions_person_scope_fkey
    foreign key (tenant_id, hr_group_id, batch_id, import_person_id)
    references public.payroll_import_persons(tenant_id, hr_group_id, batch_id, id)
    on delete cascade,
  constraint payroll_import_decisions_version_check
    check (decision_version > 0),
  constraint payroll_import_decisions_payload_check
    check (jsonb_typeof(decision_payload) = 'object'),
  constraint payroll_import_decisions_hash_check
    check (
      decision_hash ~ '^[0-9a-f]{64}$'
      and source_hash ~ '^[0-9a-f]{64}$'
      and analysis_hash ~ '^[0-9a-f]{64}$'
      and core_state_hash ~ '^[0-9a-f]{64}$'
    ),
  constraint payroll_import_decisions_scope_version_key
    unique (tenant_id, hr_group_id, batch_id, import_person_id, decision_version),
  constraint payroll_import_decisions_scope_hash_key
    unique (tenant_id, hr_group_id, batch_id, import_person_id, decision_hash),
  constraint payroll_import_decisions_scope_id_key
    unique (tenant_id, hr_group_id, batch_id, id)
);

create index payroll_import_decisions_batch_person_idx
  on public.payroll_import_decisions (tenant_id, hr_group_id, batch_id, import_person_id, decision_version desc);

create function internal_security.prevent_payroll_import_decision_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'PAYROLL_IMPORT_DECISION_IMMUTABLE';
end;
$$;

revoke all on function internal_security.prevent_payroll_import_decision_mutation() from public;
grant execute on function internal_security.prevent_payroll_import_decision_mutation() to service_role;

create trigger prevent_payroll_import_decision_mutation
before update or delete on public.payroll_import_decisions
for each row execute function internal_security.prevent_payroll_import_decision_mutation();

create table public.payroll_import_finalization_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  administration_id uuid not null,
  batch_id uuid not null,
  plan_hash text not null,
  source_hash text not null,
  analysis_hash text not null,
  core_state_hash text not null,
  contract_version text,
  schema_version text,
  expected_action_count integer not null,
  completed_action_count integer not null default 0,
  status text not null default 'PENDING',
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  invalidated_by_user_id uuid references auth.users(id) on delete restrict,
  invalidation_reason text,
  invalidated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payroll_import_finalization_plans_batch_scope_fkey
    foreign key (tenant_id, hr_group_id, administration_id, batch_id)
    references public.payroll_import_batches(tenant_id, hr_group_id, administration_id, id)
    on delete cascade,
  constraint payroll_import_finalization_plans_hash_check
    check (
      plan_hash ~ '^[0-9a-f]{64}$'
      and source_hash ~ '^[0-9a-f]{64}$'
      and analysis_hash ~ '^[0-9a-f]{64}$'
      and core_state_hash ~ '^[0-9a-f]{64}$'
    ),
  constraint payroll_import_finalization_plans_count_check
    check (expected_action_count > 0 and completed_action_count >= 0 and completed_action_count <= expected_action_count),
  constraint payroll_import_finalization_plans_status_check
    check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'BLOCKED', 'INVALIDATED')),
  constraint payroll_import_finalization_plans_invalidation_check
    check (
      (status = 'INVALIDATED' and invalidated_at is not null and invalidated_by_user_id is not null and invalidation_reason is not null)
      or (status <> 'INVALIDATED' and invalidated_at is null and invalidated_by_user_id is null and invalidation_reason is null)
    ),
  constraint payroll_import_finalization_plans_scope_hash_key
    unique (tenant_id, hr_group_id, batch_id, plan_hash),
  constraint payroll_import_finalization_plans_scope_id_key
    unique (tenant_id, hr_group_id, batch_id, id)
);

create index payroll_import_finalization_plans_scope_status_idx
  on public.payroll_import_finalization_plans (tenant_id, hr_group_id, batch_id, status, updated_at desc);

create function internal_security.validate_payroll_import_finalization_plan_scope()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'UPDATE' and row(
    old.tenant_id,
    old.hr_group_id,
    old.administration_id,
    old.batch_id,
    old.plan_hash,
    old.source_hash,
    old.analysis_hash,
    old.core_state_hash,
    old.contract_version,
    old.schema_version,
    old.expected_action_count,
    old.created_by_user_id
  ) is distinct from row(
    new.tenant_id,
    new.hr_group_id,
    new.administration_id,
    new.batch_id,
    new.plan_hash,
    new.source_hash,
    new.analysis_hash,
    new.core_state_hash,
    new.contract_version,
    new.schema_version,
    new.expected_action_count,
    new.created_by_user_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'PAYROLL_FINALIZATION_PLAN_PROVENANCE_IMMUTABLE';
  end if;
  return new;
end;
$$;

revoke all on function internal_security.validate_payroll_import_finalization_plan_scope() from public;
grant execute on function internal_security.validate_payroll_import_finalization_plan_scope() to service_role;

create trigger validate_payroll_import_finalization_plan_scope
before update on public.payroll_import_finalization_plans
for each row execute function internal_security.validate_payroll_import_finalization_plan_scope();

create function internal_security.prevent_payroll_import_finalization_plan_delete()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'PAYROLL_FINALIZATION_PLAN_IMMUTABLE';
end;
$$;

revoke all on function internal_security.prevent_payroll_import_finalization_plan_delete() from public;
grant execute on function internal_security.prevent_payroll_import_finalization_plan_delete() to service_role;

create trigger prevent_payroll_import_finalization_plan_delete
before delete on public.payroll_import_finalization_plans
for each row execute function internal_security.prevent_payroll_import_finalization_plan_delete();

create trigger set_payroll_import_finalization_plans_updated_at
before update on public.payroll_import_finalization_plans
for each row execute function internal_security.set_updated_at();

create table public.payroll_import_finalization_plan_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  administration_id uuid not null,
  batch_id uuid not null,
  plan_id uuid not null,
  event_key text not null,
  event_type text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null,
  source_hash text not null,
  analysis_hash text not null,
  core_state_hash text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint payroll_import_finalization_plan_events_plan_scope_fkey
    foreign key (tenant_id, hr_group_id, batch_id, plan_id)
    references public.payroll_import_finalization_plans(tenant_id, hr_group_id, batch_id, id)
    on delete cascade,
  constraint payroll_import_finalization_plan_events_key_check
    check (event_key ~ '^[A-Za-z0-9_.:-]{1,160}$'),
  constraint payroll_import_finalization_plan_events_type_check
    check (event_type in ('INVALIDATED')),
  constraint payroll_import_finalization_plan_events_reason_check
    check (reason ~ '^[A-Z][A-Z0-9_.:-]{0,63}$'),
  constraint payroll_import_finalization_plan_events_hash_check
    check (
      source_hash ~ '^[0-9a-f]{64}$'
      and analysis_hash ~ '^[0-9a-f]{64}$'
      and core_state_hash ~ '^[0-9a-f]{64}$'
    ),
  constraint payroll_import_finalization_plan_events_key_unique
    unique (tenant_id, hr_group_id, batch_id, plan_id, event_key)
);

create index payroll_import_finalization_plan_events_readback_idx
  on public.payroll_import_finalization_plan_events (tenant_id, hr_group_id, batch_id, plan_id, created_at);

create function internal_security.prevent_payroll_import_finalization_plan_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'PAYROLL_FINALIZATION_PLAN_EVENT_IMMUTABLE';
end;
$$;

revoke all on function internal_security.prevent_payroll_import_finalization_plan_event_mutation() from public;
grant execute on function internal_security.prevent_payroll_import_finalization_plan_event_mutation() to service_role;

create trigger prevent_payroll_import_finalization_plan_event_mutation
before update or delete on public.payroll_import_finalization_plan_events
for each row execute function internal_security.prevent_payroll_import_finalization_plan_event_mutation();

create table public.payroll_import_finalization_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  administration_id uuid not null,
  batch_id uuid not null,
  plan_id uuid not null,
  import_person_id uuid not null,
  decision_id uuid not null,
  sequence_no integer not null,
  action_id text not null,
  idempotency_key text not null,
  source_person_ref text not null,
  source_income_ref text,
  target_employee_id uuid,
  target_employee_ref text,
  target_employment_id uuid,
  target_employment_ref text,
  target_income_relationship_id uuid,
  action_type text not null,
  source_payroll_tax_number text,
  source_ikv_number integer,
  source_starts_on date,
  source_ends_on date,
  source_refs jsonb not null default '[]'::jsonb,
  preconditions jsonb not null default '[]'::jsonb,
  depends_on_action_ids text[] not null default '{}',
  plan_hash text not null,
  decision_hash text not null,
  source_hash text not null,
  analysis_hash text not null,
  core_state_hash text not null,
  contract_version text,
  schema_version text,
  status text not null default 'PENDING',
  attempt_count integer not null default 0,
  lease_until timestamptz,
  lease_owner uuid,
  lease_token_hash text,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  checkpoint jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payroll_import_finalization_actions_batch_scope_fkey
    foreign key (tenant_id, hr_group_id, administration_id, batch_id)
    references public.payroll_import_batches(tenant_id, hr_group_id, administration_id, id)
    on delete cascade,
  constraint payroll_import_finalization_actions_plan_scope_fkey
    foreign key (tenant_id, hr_group_id, batch_id, plan_id)
    references public.payroll_import_finalization_plans(tenant_id, hr_group_id, batch_id, id)
    on delete restrict,
  constraint payroll_import_finalization_actions_person_scope_fkey
    foreign key (tenant_id, hr_group_id, batch_id, import_person_id)
    references public.payroll_import_persons(tenant_id, hr_group_id, batch_id, id)
    on delete cascade,
  constraint payroll_import_finalization_actions_decision_scope_fkey
    foreign key (tenant_id, hr_group_id, batch_id, decision_id)
    references public.payroll_import_decisions(tenant_id, hr_group_id, batch_id, id)
    on delete restrict,
  constraint payroll_import_finalization_actions_sequence_check
    check (sequence_no > 0),
  constraint payroll_import_finalization_actions_action_id_check
    check (btrim(action_id) <> ''),
  constraint payroll_import_finalization_actions_source_person_ref_check
    check (btrim(source_person_ref) <> ''),
  constraint payroll_import_finalization_actions_target_ref_check
    check ((target_employee_ref is null or btrim(target_employee_ref) <> '')
      and (target_employment_ref is null or btrim(target_employment_ref) <> '')),
  constraint payroll_import_finalization_actions_source_ikv_check
    check (source_payroll_tax_number is null or source_payroll_tax_number ~ '^[0-9]{9}L(0[1-9]|[1-9][0-9])$'),
  constraint payroll_import_finalization_actions_source_ikv_number_check
    check (source_ikv_number is null or source_ikv_number between 1 and 99),
  constraint payroll_import_finalization_actions_source_period_check
    check (source_ends_on is null or source_starts_on is null or source_ends_on >= source_starts_on),
  constraint payroll_import_finalization_actions_json_check
    check (jsonb_typeof(source_refs) = 'array' and jsonb_typeof(preconditions) = 'array' and jsonb_typeof(checkpoint) = 'object'),
  constraint payroll_import_finalization_actions_action_type_check
    check (action_type in (
      'REUSE_EMPLOYEE',
      'CREATE_EMPLOYEE',
      'ADD_ADMINISTRATION_ASSIGNMENT',
      'UPDATE_EMPLOYEE_FIELDS',
      'REUSE_EMPLOYMENT',
      'CREATE_DRAFT_EMPLOYMENT',
      'CREATE_INCOME_RELATIONSHIP',
      'LINK_INCOME_RELATIONSHIP',
      'NO_CHANGE',
      'REQUIRES_REVIEW',
      'BLOCKED'
    )),
  constraint payroll_import_finalization_actions_hash_check
    check (
      plan_hash ~ '^[0-9a-f]{64}$'
      and decision_hash ~ '^[0-9a-f]{64}$'
      and source_hash ~ '^[0-9a-f]{64}$'
      and analysis_hash ~ '^[0-9a-f]{64}$'
      and core_state_hash ~ '^[0-9a-f]{64}$'
    ),
  constraint payroll_import_finalization_actions_status_check
    check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'BLOCKED')),
  constraint payroll_import_finalization_actions_attempt_check
    check (attempt_count >= 0),
  constraint payroll_import_finalization_actions_lease_check
    check ((status = 'IN_PROGRESS'
        and lease_until is not null and lease_owner is not null and lease_token_hash is not null)
      or (status <> 'IN_PROGRESS'
        and lease_until is null and lease_owner is null and lease_token_hash is null)),
  constraint payroll_import_finalization_actions_lease_hash_check
    check (lease_token_hash is null or lease_token_hash ~ '^[0-9a-f]{64}$'),
  constraint payroll_import_finalization_actions_dependency_check
    check (not (action_id = any(depends_on_action_ids))),
  constraint payroll_import_finalization_actions_completed_check
    check ((status = 'COMPLETED') = (completed_at is not null)),
  constraint payroll_import_finalization_actions_error_code_check
    check (last_error_code is null or last_error_code ~ '^[A-Z][A-Z0-9_.:-]{0,63}$'),
  constraint payroll_import_finalization_actions_scope_id_key
    unique (tenant_id, hr_group_id, batch_id, action_id),
  constraint payroll_import_finalization_actions_scope_idempotency_key
    unique (tenant_id, hr_group_id, batch_id, idempotency_key)
);

create index payroll_import_finalization_actions_pending_idx
  on public.payroll_import_finalization_actions (tenant_id, hr_group_id, batch_id, status, sequence_no);

create index payroll_import_finalization_actions_lease_idx
  on public.payroll_import_finalization_actions (status, lease_until)
  where status = 'IN_PROGRESS';

create function internal_security.validate_payroll_import_finalization_action_scope()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  dependency_count bigint;
begin
  select count(distinct dependency_id)::bigint
  into dependency_count
  from unnest(new.depends_on_action_ids) as dependency(dependency_id);

  if dependency_count <> cardinality(new.depends_on_action_ids) then
    raise exception using
      errcode = '23514',
      message = 'PAYROLL_FINALIZATION_ACTION_DEPENDENCIES_INVALID';
  end if;

  if not exists (
    select 1
    from public.payroll_import_batches as batch
    where batch.id = new.batch_id
      and batch.tenant_id = new.tenant_id
      and batch.hr_group_id = new.hr_group_id
      and batch.administration_id = new.administration_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'PAYROLL_FINALIZATION_ADMINISTRATION_SCOPE_MISMATCH';
  end if;

  if tg_op = 'UPDATE' and row(
    old.tenant_id,
    old.hr_group_id,
    old.administration_id,
    old.batch_id,
    old.plan_id,
    old.import_person_id,
    old.decision_id,
    old.sequence_no,
    old.action_id,
    old.idempotency_key,
    old.source_person_ref,
    old.source_income_ref,
    old.target_employee_id,
    old.target_employee_ref,
    old.target_employment_id,
    old.target_employment_ref,
    old.target_income_relationship_id,
    old.action_type,
    old.source_refs,
    old.preconditions,
    old.depends_on_action_ids,
    old.plan_hash,
    old.decision_hash,
    old.source_hash,
    old.analysis_hash,
    old.core_state_hash,
    old.source_payroll_tax_number,
    old.source_ikv_number,
    old.source_starts_on,
    old.source_ends_on,
    old.contract_version,
    old.schema_version
  ) is distinct from row(
    new.tenant_id,
    new.hr_group_id,
    new.administration_id,
    new.batch_id,
    new.plan_id,
    new.import_person_id,
    new.decision_id,
    new.sequence_no,
    new.action_id,
    new.idempotency_key,
    new.source_person_ref,
    new.source_income_ref,
    new.target_employee_id,
    new.target_employee_ref,
    new.target_employment_id,
    new.target_employment_ref,
    new.target_income_relationship_id,
    new.action_type,
    new.source_refs,
    new.preconditions,
    new.depends_on_action_ids,
    new.plan_hash,
    new.decision_hash,
    new.source_hash,
    new.analysis_hash,
    new.core_state_hash,
    new.source_payroll_tax_number,
    new.source_ikv_number,
    new.source_starts_on,
    new.source_ends_on,
    new.contract_version,
    new.schema_version
  ) then
    raise exception using
      errcode = '42501',
      message = 'PAYROLL_FINALIZATION_PROVENANCE_IMMUTABLE';
  end if;

  return new;
end;
$$;

revoke all on function internal_security.validate_payroll_import_finalization_action_scope() from public;
grant execute on function internal_security.validate_payroll_import_finalization_action_scope() to service_role;

create trigger validate_payroll_import_finalization_action_scope
before insert or update on public.payroll_import_finalization_actions
for each row execute function internal_security.validate_payroll_import_finalization_action_scope();

create function internal_security.prevent_payroll_import_finalization_action_delete()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'PAYROLL_FINALIZATION_ACTION_IMMUTABLE';
end;
$$;

revoke all on function internal_security.prevent_payroll_import_finalization_action_delete() from public;
grant execute on function internal_security.prevent_payroll_import_finalization_action_delete() to service_role;

create trigger prevent_payroll_import_finalization_action_delete
before delete on public.payroll_import_finalization_actions
for each row execute function internal_security.prevent_payroll_import_finalization_action_delete();

create trigger set_payroll_import_finalization_actions_updated_at
before update on public.payroll_import_finalization_actions
for each row execute function internal_security.set_updated_at();

create table public.payroll_import_finalization_action_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  batch_id uuid not null,
  action_id text not null,
  event_key text not null,
  event_type text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  attempt_number integer not null,
  checkpoint jsonb not null default '{}'::jsonb,
  error_code text,
  lease_until timestamptz,
  lease_owner uuid,
  source_hash text not null,
  analysis_hash text not null,
  core_state_hash text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint payroll_import_finalization_action_events_action_scope_fkey
    foreign key (tenant_id, hr_group_id, batch_id, action_id)
    references public.payroll_import_finalization_actions(tenant_id, hr_group_id, batch_id, action_id)
    on delete cascade,
  constraint payroll_import_finalization_action_events_key_check
    check (event_key ~ '^[A-Za-z0-9_.:-]{1,160}$'),
  constraint payroll_import_finalization_action_events_type_check
    check (event_type in ('PLANNED', 'CLAIMED', 'CHECKPOINT', 'COMPLETED', 'FAILED', 'RETRY', 'RECOVERED', 'BLOCKED')),
  constraint payroll_import_finalization_action_events_attempt_check
    check (attempt_number >= 0),
  constraint payroll_import_finalization_action_events_checkpoint_check
    check (jsonb_typeof(checkpoint) = 'object'),
  constraint payroll_import_finalization_action_events_error_check
    check (error_code is null or error_code ~ '^[A-Z][A-Z0-9_.:-]{0,63}$'),
  constraint payroll_import_finalization_action_events_lease_check
    check ((event_type in ('CLAIMED', 'CHECKPOINT') and lease_until is not null)
      or (event_type not in ('CLAIMED', 'CHECKPOINT') and lease_until is null)),
  constraint payroll_import_finalization_action_events_lease_owner_check
    check ((event_type in ('CLAIMED', 'CHECKPOINT', 'COMPLETED', 'FAILED') and lease_owner is not null)
      or (event_type not in ('CLAIMED', 'CHECKPOINT', 'COMPLETED', 'FAILED') and lease_owner is null)),
  constraint payroll_import_finalization_action_events_hash_check
    check (
      source_hash ~ '^[0-9a-f]{64}$'
      and analysis_hash ~ '^[0-9a-f]{64}$'
      and core_state_hash ~ '^[0-9a-f]{64}$'
    ),
  constraint payroll_import_finalization_action_events_key_unique
    unique (tenant_id, hr_group_id, batch_id, action_id, event_key)
);

create index payroll_import_finalization_action_events_readback_idx
  on public.payroll_import_finalization_action_events (tenant_id, hr_group_id, batch_id, action_id, created_at);

create function internal_security.prevent_payroll_import_finalization_action_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'PAYROLL_FINALIZATION_EVENT_IMMUTABLE';
end;
$$;

revoke all on function internal_security.prevent_payroll_import_finalization_action_event_mutation() from public;
grant execute on function internal_security.prevent_payroll_import_finalization_action_event_mutation() to service_role;

create trigger prevent_payroll_import_finalization_action_event_mutation
before update or delete on public.payroll_import_finalization_action_events
for each row execute function internal_security.prevent_payroll_import_finalization_action_event_mutation();

alter table public.payroll_import_decisions enable row level security;
alter table public.payroll_import_finalization_plans enable row level security;
alter table public.payroll_import_finalization_plan_events enable row level security;
alter table public.payroll_import_finalization_actions enable row level security;
alter table public.payroll_import_finalization_action_events enable row level security;

create policy payroll_import_decisions_select_group
on public.payroll_import_decisions for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:read'))
  and (select internal_security.has_administration_access(tenant_id, administration_id))
);

create policy payroll_import_finalization_actions_select_group
on public.payroll_import_finalization_actions for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:read'))
  and (select internal_security.has_administration_access(tenant_id, administration_id))
);

create policy payroll_import_finalization_plans_select_group
on public.payroll_import_finalization_plans for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:read'))
  and (select internal_security.has_administration_access(tenant_id, administration_id))
);

create policy payroll_import_finalization_plan_events_select_group
on public.payroll_import_finalization_plan_events for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:read'))
  and (select internal_security.has_administration_access(tenant_id, administration_id))
);

create policy payroll_import_finalization_action_events_select_group
on public.payroll_import_finalization_action_events for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll-import:read'))
  and exists (
    select 1
    from public.payroll_import_finalization_actions as ledger_action
    where ledger_action.tenant_id = payroll_import_finalization_action_events.tenant_id
      and ledger_action.hr_group_id = payroll_import_finalization_action_events.hr_group_id
      and ledger_action.batch_id = payroll_import_finalization_action_events.batch_id
      and ledger_action.action_id = payroll_import_finalization_action_events.action_id
      and (select internal_security.has_administration_access(ledger_action.tenant_id, ledger_action.administration_id))
  )
);

revoke all on table public.payroll_import_decisions from public, anon, authenticated;
revoke all on table public.payroll_import_finalization_plans from public, anon, authenticated;
revoke all on table public.payroll_import_finalization_plan_events from public, anon, authenticated;
revoke all on table public.payroll_import_finalization_actions from public, anon, authenticated;
revoke all on table public.payroll_import_finalization_action_events from public, anon, authenticated;
grant select on table public.payroll_import_decisions to authenticated;
grant select on table public.payroll_import_finalization_plans to authenticated;
grant select on table public.payroll_import_finalization_plan_events to authenticated;
grant select on table public.payroll_import_finalization_actions to authenticated;
grant select on table public.payroll_import_finalization_action_events to authenticated;
grant select, insert on table public.payroll_import_decisions to service_role;
grant select, insert on table public.payroll_import_finalization_plans to service_role;
grant select, insert on table public.payroll_import_finalization_plan_events to service_role;
grant select, insert on table public.payroll_import_finalization_actions to service_role;
grant select, insert on table public.payroll_import_finalization_action_events to service_role;

-- All state transitions are recorded atomically with their immutable event.
-- The function is service-role-only; the calling server action must establish
-- the signed-in actor's permission and current tenant/group/administration scope.
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
    and action_id = requested_action_id
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
    count(*) filter (where status = 'COMPLETED')::bigint
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
    and action_id = requested_action_id
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
    count(*) filter (where status = 'COMPLETED')::bigint
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

  select id, status, administration_id, source_hash, analysis_hash, core_state_hash
  into current_plan
  from public.payroll_import_finalization_plans
  where tenant_id = requested_tenant_id
    and hr_group_id = requested_hr_group_id
    and batch_id = requested_batch_id
    and plan_hash = requested_plan_hash
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

comment on table public.payroll_import_decisions is
  'Append-only, server-confirmed matching and IKV/Employment decisions; raw XML and plaintext BSN are excluded.';
comment on table public.payroll_import_finalization_plans is
  'Durable CONTROL02 plan identity and action-count ledger. A plan becomes COMPLETED only after every expected action is complete.';
comment on table public.payroll_import_finalization_plan_events is
  'Immutable audit for plan invalidation caused by a changed persisted decision or source/Core state.';
comment on table public.payroll_import_finalization_actions is
  'Durable CONTROL02 plan ledger. It records safe planned actions only; it never performs Core XML writes.';
comment on table public.payroll_import_finalization_action_events is
  'Immutable transition and checkpoint audit for resumable CONTROL02 actions.';
comment on function public.record_payroll_import_finalization_event(uuid, uuid, uuid, text, text, text, uuid, integer, text, text, text, jsonb, text, timestamptz, uuid, text) is
  'Atomically records one idempotent CONTROL02 ledger event and advances its safe checkpoint state.';
comment on function public.invalidate_payroll_import_finalization_plan(uuid, uuid, uuid, text, uuid, text) is
  'Marks an incomplete CONTROL02 plan invalid when its source or Core state is superseded; it never writes Core domain data.';

commit;
