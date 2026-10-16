import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./supabase/migrations/20261014091926_20261013120000_paycalc_real01_generic_input_reference.sql', import.meta.url), 'utf8')

describe('PAYCALC-REAL-01 generic input reference migration contract', () => {
  it('stores an immutable, version-bound Core reference without cross-database relations', () => {
    expect(migration).toContain('CREATE TABLE public.generic_payroll_input_references')
    expect(migration).toContain('generic_payroll_input_reference_once UNIQUE (calculation_input_set_id)')
    expect(migration).toContain("core_source_contract_version text NOT NULL CHECK (core_source_contract_version = 'payroll-source-v4')")
    expect(migration).toContain('core_validated_at timestamptz NOT NULL')
    expect(migration).toContain('source_version_vector jsonb NOT NULL')
    expect(migration).toContain('source_snapshot.source_version_vector IS DISTINCT FROM NEW.source_version_vector')
    expect(migration).toContain('PAYROLL_INPUT_REFERENCE_LOCAL_SNAPSHOT_MISMATCH')
    expect(migration).not.toMatch(/public\.(employments|income_relationships|employment_income_relationships|employment_payroll_tax_profiles)\b/i)
    expect(migration).not.toMatch(/REFERENCES\s+public\.(employments|income_relationships|employment_income_relationships|employment_payroll_tax_profiles)\b/i)
    expect(migration).toContain('Generic payroll input references are immutable.')
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY')
  })

  it('keeps the existing lifecycle contract and accepts either input-reference path', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.payrun01_mark_succeeded_with_concept')
    expect(migration).toContain('public.individual_payroll_input_references AS input_ref')
    expect(migration).toContain('public.generic_payroll_input_references AS input_ref')
    expect(migration).toContain('input_ref.source_version_vector = source_snapshot.source_version_vector')
    expect(migration).toContain('input_ref.source_income_relationship_id = source_snapshot.source_income_relationship_id')
    expect(migration).toContain("'CONCEPT', p_event_payload, p_actor_user_id")
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.guard_individual_payroll_lifecycle_event()')
    expect(migration).toContain("NEW.event_type = 'REVIEWED'")
    expect(migration).toContain("NEW.event_type = 'FINALIZED'")
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.payrun01_mark_succeeded_with_concept')
    expect(migration).toMatch(/BEGIN;[\s\S]*COMMIT;/)
  })
})
