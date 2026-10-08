import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migrationPath = fileURLToPath(new URL('../../../supabase/migrations/20261007081449_control02_test_core_transactional_write.sql', import.meta.url))
const advisorFollowupPath = fileURLToPath(new URL('../../../supabase/migrations/20261007081753_control02_test_finalization_advisor_followup.sql', import.meta.url))
const proofGuardFollowupPath = fileURLToPath(new URL('../../../supabase/migrations/20261007181000_control02_test_finalization_writer_guard_fix.sql', import.meta.url))

describe('CONTROL02 TEST Core writer migration candidate', () => {
  it('accepts string proof versions and the active TEST contract version', () => {
    const migration = readFileSync(proofGuardFollowupPath, 'utf8').replace(/\r\n/g, '\n').toLowerCase()
    const writer = migration.match(/create or replace function public\.execute_control02_test_payroll_finalization_action\(([\s\S]*?)\n\$\$;/)?.[1] ?? ''

    expect(writer).toContain("or exists (select 1 from pg_catalog.jsonb_each(requested_expected_versions) e where pg_catalog.jsonb_typeof(e.value) <> 'string')")
    expect(writer).not.toContain("or not exists (select 1 from pg_catalog.jsonb_each(requested_expected_versions) e where pg_catalog.jsonb_typeof(e.value) <> 'string')")
    expect(writer).toContain("current_plan.contract_version is distinct from 'control02-core-payroll-test-candidate-2'")
    expect(migration).toContain('revoke all on function public.execute_control02_test_payroll_finalization_action')
    expect(migration).toContain('to service_role')
  })
  it('preserves current legacy IKV uniqueness and adds full LhNr identity without rewriting legacy rows', () => {
    const migration = readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n').toLowerCase()

    expect(migration).toContain('income_relationships_ikv_employee_active_key')
    expect(migration).toContain('create unique index income_relationships_full_lhnr_ikv_active_key')
    expect(migration).toContain('where deleted_at is null and payroll_tax_number is not null')
    expect(migration).not.toContain('drop index public.income_relationships_ikv_active_key')
    expect(migration).not.toMatch(/update\s+public\.payroll_import_persons/)
    expect(migration).toContain('prevent_payroll_import_source_projection_change')
  })

  it('fences each Core write and its verified readback inside the service-role transaction', () => {
    const migration = readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n').toLowerCase()
    const writer = migration.match(/create or replace function public\.execute_control02_test_payroll_finalization_action\(([\s\S]*?)\n\$\$;/)?.[1] ?? ''

    expect(writer).toContain("current_action.status <> 'in_progress'")
    expect(writer).toContain('current_action.lease_owner is distinct from requested_lease_owner')
    expect(writer).toContain('current_action.lease_token_hash is distinct from requested_lease_token_hash')
    expect(writer).toContain('current_action.lease_until <= pg_catalog.now()')
    expect(writer).toContain('record_payroll_import_finalization_event')
    expect(writer).toContain('readbackverified')
    expect(migration).toContain('grant execute on function public.execute_control02_test_payroll_finalization_action')
    expect(migration).toContain('to service_role')
    expect(migration).toContain("'public.payroll_import_finalization_plan_events'")
    expect(migration).toContain("'public.payroll_import_finalization_action_events'")
  })

  it('adds explicit deny policies and indexes every new ledger batch/decision foreign key', () => {
    const migration = readFileSync(advisorFollowupPath, 'utf8').replace(/\r\n/g, '\n').toLowerCase()

    expect(migration).toContain('payroll_import_xml_provenance_authenticated_deny')
    expect(migration).toContain('payroll_import_protected_identifiers_authenticated_deny')
    expect(migration).toContain('using (false)')
    expect(migration).toContain('with check (false)')
    expect(migration).toContain('payroll_import_finalization_actions_batch_scope_idx')
    expect(migration).toContain('payroll_import_finalization_actions_decision_scope_idx')
    expect(migration).toContain('payroll_import_finalization_plans_batch_scope_idx')
    expect(migration).toContain('from pg_catalog.pg_policy')
  })
})
