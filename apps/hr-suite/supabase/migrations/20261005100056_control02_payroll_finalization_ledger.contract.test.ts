import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migration = readFileSync(
  resolve(__dirname, '20261005100056_control02_payroll_finalization_ledger.sql'),
  'utf8',
).replace(/\r\n/g, '\n')

describe('CONTROL02 durable decision and finalization ledger migration', () => {
  it('provides one bounded, write-authorized secure BSN batch matcher', () => {
    expect(migration).toContain('create or replace function public.match_payroll_import_employee_bsn_fingerprints(')
    expect(migration).toContain('requested_administration_id uuid')
    expect(migration).toContain('requested_bsn_fingerprints text[]')
    expect(migration).toContain('pg_catalog.cardinality(requested_bsn_fingerprints) not between 1 and 500')
    expect(migration).toContain("requested.fingerprint !~ '^[0-9a-fA-F]{64}$'")
    expect(migration).toContain("'payroll-import:write'")
    expect(migration).toContain('internal_security.has_administration_access(')
    expect(migration).toContain('assignment.administration_id = requested_administration_id')
    expect(migration.match(/assignment\.hr_group_id = requested_hr_group_id/g)).toHaveLength(2)
    expect(migration.match(/administration\.hr_group_id = requested_hr_group_id/g)).toHaveLength(2)
    expect(migration.match(/administration\.id = assignment\.administration_id/g)).toHaveLength(2)
    expect(migration.match(/administration\.is_active/g)).toHaveLength(2)
    expect(migration).toContain('assignment.effective_from <= current_date')
    expect(migration).toContain('assignment.effective_to >= current_date')
    expect(migration).toContain('row_number() over (partition by matched.fingerprint')
    expect(migration).toContain('where ranked.match_number <= 5')
    expect(migration).toContain('revoke all on function public.match_payroll_import_employee_bsn_fingerprints(uuid, uuid, uuid, text[])')
    expect(migration).toContain('grant execute on function public.match_payroll_import_employee_bsn_fingerprints(uuid, uuid, uuid, text[])')
    expect(migration).toContain('to authenticated;')
  })

  it('retires unscoped scalar RPC access and pins every definer routine to an empty search path', () => {
    expect(migration).toContain('create or replace function public.match_payroll_import_employee_bsn_fingerprint(\n  requested_tenant_id uuid,\n  requested_hr_group_id uuid,\n  requested_administration_id uuid,\n  requested_bsn_fingerprint text')
    expect(migration).toContain('alter function public.match_payroll_import_employee_bsn_fingerprint(uuid, uuid, text)')
    expect(migration).toContain('revoke all on function public.match_payroll_import_employee_bsn_fingerprint(uuid, uuid, text)\nfrom public, anon, authenticated;')
    expect(migration).toContain('security definer\nset search_path = \'\'')
    expect(migration).not.toContain('pg_temp')
  })

  it('stores server-confirmed decisions with full scope and state fingerprints', () => {
    expect(migration).toContain('create table public.payroll_import_decisions')
    expect(migration).toContain('administration_id uuid not null')
    expect(migration).toContain('decision_hash text not null')
    expect(migration).toContain('source_hash text not null')
    expect(migration).toContain('analysis_hash text not null')
    expect(migration).toContain('core_state_hash text not null')
    expect(migration).toContain('contract_version text')
    expect(migration).toContain('schema_version text')
    expect(migration).toContain('foreign key (tenant_id, hr_group_id, administration_id, batch_id)')
    expect(migration).toContain('references public.payroll_import_batches(tenant_id, hr_group_id, administration_id, id)')
    expect(migration).toContain('before update or delete on public.payroll_import_decisions')
    expect(migration).not.toContain('raw_xml')
    expect(migration).not.toContain('plaintext_bsn')
  })

  it('provides a scope-bound action ledger and immutable event history', () => {
    expect(migration).toContain('create table public.payroll_import_finalization_plans')
    expect(migration).toContain('create table public.payroll_import_finalization_plan_events')
    expect(migration).toContain('PAYROLL_FINALIZATION_PLAN_EVENT_IMMUTABLE')
    expect(migration).toContain('expected_action_count integer not null')
    expect(migration).toContain('completed_action_count integer not null default 0')
    expect(migration).toContain("status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'BLOCKED', 'INVALIDATED')")
    expect(migration).toContain('constraint payroll_import_finalization_plans_scope_hash_key')
    expect(migration).toContain('PAYROLL_FINALIZATION_PLAN_PROVENANCE_IMMUTABLE')
    expect(migration).toContain('PAYROLL_FINALIZATION_PLAN_IMMUTABLE')
    expect(migration).toContain("status = 'INVALIDATED' and invalidated_at is not null and invalidated_by_user_id is not null and invalidation_reason is not null")
    expect(migration).toContain("status <> 'INVALIDATED' and invalidated_at is null and invalidated_by_user_id is null and invalidation_reason is null")
    expect(migration).toContain('create table public.payroll_import_finalization_actions')
    expect(migration).toContain('plan_id uuid not null')
    expect(migration).toContain('payroll_import_finalization_actions_plan_scope_fkey')
    expect(migration).toContain('unique (tenant_id, hr_group_id, batch_id, action_id)')
    expect(migration).toContain('unique (tenant_id, hr_group_id, batch_id, idempotency_key)')
    expect(migration).toContain("status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'BLOCKED')")
    expect(migration).toContain("event_type in ('PLANNED', 'CLAIMED', 'CHECKPOINT', 'COMPLETED', 'FAILED', 'RETRY', 'RECOVERED', 'BLOCKED')")
    expect(migration).toContain('lease_until timestamptz')
    expect(migration).toContain('before update or delete on public.payroll_import_finalization_action_events')
    expect(migration).toContain('PAYROLL_FINALIZATION_PROVENANCE_IMMUTABLE')
    expect(migration).toContain('PAYROLL_FINALIZATION_ACTION_IMMUTABLE')
    expect(migration).toContain('PAYROLL_FINALIZATION_PLAN_INCOMPLETE')
    for (const column of [
      'old.target_employee_id',
      'old.target_employee_ref',
      'old.target_employment_id',
      'old.target_employment_ref',
      'old.target_income_relationship_id',
      'old.plan_id',
      'old.action_type',
      'old.source_refs',
      'old.preconditions',
    ]) expect(migration).toContain(column)
  })

  it('makes transitions idempotent and atomic through a service-role-only RPC', () => {
    expect(migration).toContain('create or replace function public.record_payroll_import_finalization_event(')
    expect(migration).toContain('security definer')
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain('for update;')
    expect(migration).toContain('PAYROLL_FINALIZATION_EVENT_KEY_REUSED')
    expect(migration).toContain("requested_checkpoint -> 'completionProof' ->> 'readbackVerified'")
    expect(migration).toContain("coalesce(requested_checkpoint -> 'completionProof' ->> 'sourceHash', '')")
    expect(migration).toContain('PAYROLL_FINALIZATION_PLAN_INCOMPLETE')
    expect(migration).toContain('existing_event.lease_until is distinct from requested_lease_until')
    expect(migration).toContain('revoke all on function public.record_payroll_import_finalization_event(')
    expect(migration).toContain(') to service_role;')
    expect(migration).not.toContain('insert into public.employees')
    expect(migration).not.toContain('insert into public.employments')
    expect(migration).not.toContain('insert into public.income_relationships')
  })

  it('keeps direct client writes closed while allowing scoped readback', () => {
    expect(migration).toContain('alter table public.payroll_import_decisions enable row level security')
    expect(migration).toContain('alter table public.payroll_import_finalization_actions enable row level security')
    expect(migration).toContain('alter table public.payroll_import_finalization_plan_events enable row level security')
    expect(migration).toContain('alter table public.payroll_import_finalization_action_events enable row level security')
    expect(migration).toContain('grant select on table public.payroll_import_decisions to authenticated')
    expect(migration).toContain('grant select on table public.payroll_import_finalization_actions to authenticated')
    expect(migration).toContain('grant select on table public.payroll_import_finalization_plan_events to authenticated')
    expect(migration).toContain('grant select on table public.payroll_import_finalization_action_events to authenticated')
    expect(migration.match(/has_administration_access\(tenant_id, administration_id\)/g)).toHaveLength(4)
    expect(migration).toContain('from public.payroll_import_finalization_actions as ledger_action')
    expect(migration).toContain('ledger_action.action_id = payroll_import_finalization_action_events.action_id')
    expect(migration).not.toContain('has_administration_access(tenant_id, administration_id))\n);\n\nrevoke all on table public.payroll_import_finalization_action_events')
    expect(migration).toContain('grant select, insert on table public.payroll_import_decisions to service_role')
    expect(migration).toContain('grant select, insert on table public.payroll_import_finalization_plans to service_role')
    expect(migration).toContain('grant select, insert on table public.payroll_import_finalization_actions to service_role')
    expect(migration).toContain('grant select, insert on table public.payroll_import_finalization_action_events to service_role')
    expect(migration).not.toContain('grant insert on table public.payroll_import_decisions to authenticated')
    expect(migration).not.toContain('grant update on table public.payroll_import_finalization_actions to authenticated')
    expect(migration).not.toContain('grant select, insert, update on table public.payroll_import_finalization_actions to service_role')
  })

  it('invalidates stale plans through a service-role-only state transition', () => {
    expect(migration).toContain('create or replace function public.invalidate_payroll_import_finalization_plan(')
    expect(migration).toContain("status = 'INVALIDATED'")
    expect(migration).toContain('requested_reason')
    expect(migration).toContain("'INVALIDATED'")
    expect(migration).toContain('payroll_import_finalization_plan_events')
    expect(migration).toContain('grant execute on function public.invalidate_payroll_import_finalization_plan')
    expect(migration).toContain('to service_role;')
  })
})
