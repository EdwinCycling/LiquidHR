import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./supabase/migrations/20261013120000_paycalc_real01_generic_input_reference.sql', import.meta.url), 'utf8')

describe('PAYCALC-REAL-01 generic input reference migration contract', () => {
  it('pins immutable calculation inputs to scoped employment, one exact IKV link, and an effective fiscal profile', () => {
    expect(migration).toContain('CREATE TABLE public.generic_payroll_input_references')
    expect(migration).toContain('generic_payroll_input_reference_once UNIQUE (calculation_input_set_id)')
    expect(migration).toContain('candidate.employment_id = NEW.source_employment_id')
    expect(migration).toContain('candidate.income_relationship_id = NEW.source_income_relationship_id')
    expect(migration).toContain('tax_profile.employment_income_relationship_id IS DISTINCT FROM income_link.id')
    expect(migration).toContain('income_link.valid_from > payroll_period.starts_on')
    expect(migration).toContain('income_link.valid_until <= payroll_period.ends_on')
    expect(migration).toContain('tax_profile.effective_from > payroll_period.starts_on')
    expect(migration).toContain('tax_profile.effective_to < payroll_period.ends_on')
    expect(migration).toContain('Generic payroll input references are immutable.')
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY')
  })

  it('keeps the existing lifecycle contract and accepts either input-reference path', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.payrun01_mark_succeeded_with_concept')
    expect(migration).toContain('public.individual_payroll_input_references AS input_ref')
    expect(migration).toContain('public.generic_payroll_input_references AS input_ref')
    expect(migration).toContain("'CONCEPT', p_event_payload, p_actor_user_id")
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.guard_individual_payroll_lifecycle_event()')
    expect(migration).toContain("NEW.event_type = 'REVIEWED'")
    expect(migration).toContain("NEW.event_type = 'FINALIZED'")
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.payrun01_mark_succeeded_with_concept')
    expect(migration).toMatch(/BEGIN;[\s\S]*COMMIT;/)
  })
})
