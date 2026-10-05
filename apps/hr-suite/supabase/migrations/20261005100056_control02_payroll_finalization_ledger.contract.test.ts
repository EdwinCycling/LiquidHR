import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migration = readFileSync(
  resolve(__dirname, '20261005100056_control02_payroll_finalization_ledger.sql'),
  'utf8',
)

describe('CONTROL02 durable decision and finalization ledger migration', () => {
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
    expect(migration).toContain('create table public.payroll_import_finalization_actions')
    expect(migration).toContain('unique (tenant_id, hr_group_id, batch_id, action_id)')
    expect(migration).toContain('unique (tenant_id, hr_group_id, batch_id, idempotency_key)')
    expect(migration).toContain("status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'BLOCKED')")
    expect(migration).toContain("event_type in ('PLANNED', 'CLAIMED', 'CHECKPOINT', 'COMPLETED', 'FAILED', 'RETRY', 'RECOVERED', 'BLOCKED')")
    expect(migration).toContain('lease_until timestamptz')
    expect(migration).toContain('before update or delete on public.payroll_import_finalization_action_events')
    expect(migration).toContain('PAYROLL_FINALIZATION_PROVENANCE_IMMUTABLE')
    for (const column of [
      'old.target_employee_id',
      'old.target_employee_ref',
      'old.target_employment_id',
      'old.target_employment_ref',
      'old.target_income_relationship_id',
      'old.action_type',
      'old.source_refs',
      'old.preconditions',
    ]) expect(migration).toContain(column)
  })

  it('makes transitions idempotent and atomic through a service-role-only RPC', () => {
    expect(migration).toContain('create or replace function public.record_payroll_import_finalization_event(')
    expect(migration).toContain('security definer')
    expect(migration).toContain('set search_path = pg_catalog, public')
    expect(migration).toContain('for update;')
    expect(migration).toContain('PAYROLL_FINALIZATION_EVENT_KEY_REUSED')
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
    expect(migration).toContain('alter table public.payroll_import_finalization_action_events enable row level security')
    expect(migration).toContain('grant select on table public.payroll_import_decisions to authenticated')
    expect(migration).toContain('grant select on table public.payroll_import_finalization_actions to authenticated')
    expect(migration).toContain('grant select on table public.payroll_import_finalization_action_events to authenticated')
    expect(migration.match(/has_administration_access\(tenant_id, administration_id\)/g)).toHaveLength(2)
    expect(migration).toContain('from public.payroll_import_finalization_actions as ledger_action')
    expect(migration).toContain('ledger_action.action_id = payroll_import_finalization_action_events.action_id')
    expect(migration).not.toContain('has_administration_access(tenant_id, administration_id))\n);\n\nrevoke all on table public.payroll_import_finalization_action_events')
    expect(migration).toContain('grant select, insert on table public.payroll_import_decisions to service_role')
    expect(migration).toContain('grant select, insert on table public.payroll_import_finalization_actions to service_role')
    expect(migration).toContain('grant select, insert on table public.payroll_import_finalization_action_events to service_role')
    expect(migration).not.toContain('grant insert on table public.payroll_import_decisions to authenticated')
    expect(migration).not.toContain('grant update on table public.payroll_import_finalization_actions to authenticated')
    expect(migration).not.toContain('grant select, insert, update on table public.payroll_import_finalization_actions to service_role')
  })
})
