import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../supabase/migrations/20261014153334_core_payroll_tax_profile_admin_source.sql', import.meta.url), 'utf8')
const indexMigration = readFileSync(new URL('../../supabase/migrations/20261014154020_core_payroll_tax_profile_fk_indexes.sql', import.meta.url), 'utf8')
const baseMigration = readFileSync(new URL('../../supabase/migrations/20261014091918_20261013150000_core_employment_payroll_tax_profiles.sql', import.meta.url), 'utf8')

describe('Core payroll tax profile administration source migration', () => {
  it('allows only the two valid source classifications and keeps the profile immutable', () => {
    expect(migration).toContain("CHECK (source_classification IN ('EMPLOYEE_DECLARATION', 'HR_ADMIN_CONFIRMED'))")
    expect(migration).toContain('ALTER TABLE public.employment_payroll_tax_profiles')
    expect(migration).toContain('DROP CONSTRAINT employment_payroll_tax_profiles_source_classification_check')
  })

  it('uses an authenticated scope-checked RPC and audits the chosen source', () => {
    expect(migration).toMatch(/CREATE FUNCTION public\.confirm_employment_payroll_tax_profile_v2\(p_input jsonb\)[\s\S]*?SECURITY DEFINER\s+SET search_path = ''/i)
    expect(migration).toContain('v_actor uuid := auth.uid()')
    expect(migration).toContain("current_user_has_permission(v_employment.tenant_id, v_employment.administration_id, 'salary:write'::text)")
    expect(migration).toContain("role.code IN ('HR_ADMIN', 'TENANT_ADMIN')")
    expect(migration).toContain("v_source_classification NOT IN ('EMPLOYEE_DECLARATION', 'HR_ADMIN_CONFIRMED')")
    expect(migration).toContain("'sourceClassification', v_source_classification")
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.confirm_employment_payroll_tax_profile_v2\(jsonb\) FROM PUBLIC, anon/i)
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.confirm_employment_payroll_tax_profile_v2\(jsonb\) TO authenticated/i)
    expect(migration).not.toContain('PAYROLL_TAX_PROFILE_BACKDATED_CHANGE_UNSUPPORTED')
  })

  it('indexes every fiscal profile foreign-key lookup and restricts the privileged RPC to authenticated callers', () => {
    for (const indexName of [
      'employment_payroll_tax_profile_audit_actor_idx',
      'employment_payroll_tax_profile_audit_scope_idx',
      'employment_payroll_tax_profiles_confirmed_by_idx',
      'employment_payroll_tax_profiles_employment_scope_fk_idx',
      'employment_payroll_tax_profiles_income_link_fk_idx',
      'employment_payroll_tax_profiles_income_scope_fk_idx',
      'employment_payroll_tax_profiles_supersedes_scope_fk_idx',
    ]) {
      expect(indexMigration).toContain(indexName)
    }
    expect(indexMigration).toMatch(/REVOKE ALL ON FUNCTION public\.confirm_employment_payroll_tax_profile_v2\(jsonb\) FROM PUBLIC, anon, service_role/i)
    expect(indexMigration).toMatch(/GRANT EXECUTE ON FUNCTION public\.confirm_employment_payroll_tax_profile_v2\(jsonb\) TO authenticated/i)
  })

  it('appends versions in version order without rewriting prior fiscal records', () => {
    expect(migration).toContain('ORDER BY profile.version_number DESC, profile.effective_from DESC')
    expect(migration).toContain('v_version := v_previous.version_number + 1')
    expect(migration).toContain('supersedes_profile_id')
    expect(baseMigration).toContain('employment_payroll_tax_profiles_idempotency_idx')
    expect(migration).not.toMatch(/UPDATE\s+public\.employment_payroll_tax_profiles/i)
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.employment_payroll_tax_profiles/i)
  })
})
