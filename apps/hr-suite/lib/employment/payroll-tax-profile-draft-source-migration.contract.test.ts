import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../supabase/migrations/20261017063451_allow_scoped_draft_payroll_tax_profile_sources.sql', import.meta.url), 'utf8')

describe('draft IKV payroll tax profile source migration contract', () => {
  it('permits recording the immutable source before the separate IKV readiness transition', () => {
    expect(migration).toContain("'public.confirm_employment_payroll_tax_profile_v2(jsonb)'::pg_catalog.regprocedure")
    expect(migration).toContain("v_income.reporting_status = ''DRAFT''")
    expect(migration).toContain("E'    OR v_income.reporting_status = ''DRAFT''\\n'")
    expect(migration).toContain('PAYROLL_TAX_PROFILE_V2_DRAFT_GUARD_NOT_FOUND')
    expect(migration).toContain('PAYROLL_TAX_PROFILE_V2_SECURITY_DEFINER_REQUIRED')
    expect(migration).toContain('READY remains a separate gated IKV transition')
  })

  it('preserves authenticated-only execution and denies service-role and public callers', () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.confirm_employment_payroll_tax_profile_v2\(jsonb\) FROM PUBLIC, anon, service_role/i)
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.confirm_employment_payroll_tax_profile_v2\(jsonb\) TO authenticated/i)
  })
})
