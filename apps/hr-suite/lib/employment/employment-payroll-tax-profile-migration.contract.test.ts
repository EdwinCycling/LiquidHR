import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../supabase/migrations/20261014091918_20261013150000_core_employment_payroll_tax_profiles.sql', import.meta.url), 'utf8')

describe('Core employment payroll tax profile migration contract', () => {
  it('limits stored profiles to the supported, explicit Dutch monthly wage combination', () => {
    expect(migration).toContain("residence_country_code = 'NL'")
    expect(migration).toContain("wage_tax_table = 'WHITE'")
    expect(migration).toContain("herleiding_code = 'STD'")
    expect(migration).toContain("time_period = 'MONTH'")
    expect(migration).toContain("source_classification = 'EMPLOYEE_DECLARATION'")
    expect(migration).toContain('payroll_tax_credit_applies boolean NOT NULL')
    expect(migration).toContain('effective_from date NOT NULL')
    expect(migration).toContain('version_number integer NOT NULL')
  })

  it('confirms only a scoped HR Admin input against a real employment and live IKV link', () => {
    expect(migration).toMatch(/CREATE FUNCTION public\.confirm_employment_payroll_tax_profile\(p_input jsonb\)[\s\S]*?SECURITY DEFINER\s+SET search_path = ''/i)
    expect(migration).toContain("current_user_has_permission(v_employment.tenant_id, v_employment.administration_id, 'salary:write'::text)")
    expect(migration).toContain("role.code IN ('HR_ADMIN', 'TENANT_ADMIN')")
    expect(migration).toContain('AND role.is_active')
    expect(migration).toContain('AND role.deleted_at IS NULL')
    expect(migration).toContain('employment_income_relationships AS link')
    expect(migration).toContain('public.user_access AS assignment')
    expect(migration).not.toContain('public.user_management_roles')
    expect(migration).toContain('PAYROLL_TAX_PROFILE_IKV_LINK_INVALID')
    expect(migration).toContain('v_income_link_count IS DISTINCT FROM 1')
    expect(migration).toContain('link.valid_until > v_effective_to')
    expect(migration).toContain('PAYROLL_TAX_PROFILE_CREDIT_ALREADY_APPLIES')
    expect(migration).toContain('latest_at_start AS')
    expect(migration).toContain('coalesce(slice.effective_to, \'infinity\'::date) >= v_effective_from')
    expect(migration).toContain('pg_advisory_xact_lock')
  })

  it('records immutable versions and audit rows with idempotency and scope-bound RLS', () => {
    expect(migration).toContain('employment_payroll_tax_profiles_one_successor_idx')
    expect(migration).toContain('employment_payroll_tax_profiles_idempotency_idx')
    expect(migration).toContain('employment_payroll_tax_profiles_supersedes_scope_fkey')
    expect(migration).toContain('employment_payroll_tax_profile_audit')
    expect(migration).toContain('employment_payroll_tax_profiles ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('employment_payroll_tax_profile_audit ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('employment_payroll_tax_profiles_immutable')
    expect(migration).toContain('employment_payroll_tax_profile_audit_immutable')
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.reject_employment_payroll_tax_profile_mutation()')
    expect(migration).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.employment_payroll_tax_profiles FROM PUBLIC, anon, authenticated/i)
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.confirm_employment_payroll_tax_profile\(jsonb\) FROM PUBLIC, anon/i)
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.confirm_employment_payroll_tax_profile\(jsonb\) TO authenticated/i)
    expect(migration).not.toContain("auth.jwt() -> 'user_metadata'")
    expect(migration).toMatch(/BEGIN;[\s\S]*COMMIT;/)
  })
})
