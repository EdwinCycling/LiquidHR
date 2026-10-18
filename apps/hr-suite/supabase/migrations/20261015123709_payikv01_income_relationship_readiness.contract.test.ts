import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./20261015123709_payikv01_income_relationship_readiness.sql', import.meta.url), 'utf8')
  .replace(/\r\n?/g, '\n')

describe('PAYIKV-01 income relationship readiness migration contract', () => {
  it('uses the existing scoped payroll permission and HR administrator roles', () => {
    expect(migration).toContain("current_user_has_permission(\n      NEW.tenant_id, NEW.administration_id, 'salary:write'::text\n    )")
    expect(migration).toContain("role.code IN ('HR_ADMIN', 'TENANT_ADMIN')")
    expect(migration).toContain("assignment.scope_type = 'ADMINISTRATION' AND assignment.administration_id = NEW.administration_id")
    expect(migration).toContain('internal_security.has_hr_group_access')
    expect(migration).not.toMatch(/insert\s+into\s+public\.(user_access|role_permissions)/i)
    expect(migration).not.toContain('service_role')
  })

  it('validates identification, registered employer number, IKV dates, employment links and contracts', () => {
    expect(migration).toContain('employee_secure_identifiers')
    expect(migration).toContain('bsn_fingerprint IS NOT NULL')
    expect(migration).toContain('NEW.payroll_tax_binding_id')
    expect(migration).toContain('tax_number.id = NEW.payroll_tax_binding_id')
    expect(migration).toContain('tax_number.payroll_tax_number = NEW.payroll_tax_number')
    expect(migration).toContain('NEW.payroll_tax_binding_hr_group_id IS DISTINCT FROM v_hr_group_id')
    expect(migration).toContain('right(tax_number.payroll_tax_number, char_length(NEW.payroll_tax_subnumber)) = NEW.payroll_tax_subnumber')
    expect(migration).toContain("NEW.payroll_tax_subnumber !~ '^(L)?(0[1-9]|[1-9][0-9])$'")
    expect(migration).toContain('tax_number_count > 1')
    expect(migration).toContain('employment.record_status <> \'CONFIRMED\'')
    expect(migration).toContain('public.employment_contracts AS contract')
    expect(migration).toContain('FOR v_contract IN')
    expect(migration).toContain('contract.ends_on + 1 > v_covered_until')
    expect(migration).toContain('PAYROLL_IKV_EMPLOYMENT_LINK_GAP')
    expect(migration).not.toContain('bsn_ciphertext')
  })

  it('audits the status transition through existing scoped writes without widening RLS or roles', () => {
    expect(migration).toMatch(/CREATE FUNCTION internal_security\.validate_income_relationship_ready\(\)[\s\S]*?SECURITY INVOKER/i)
    expect(migration).toMatch(/BEFORE UPDATE OF reporting_status ON public\.income_relationships/i)
    expect(migration).toContain("EXECUTE FUNCTION internal_security.audit_hr_change('income_relationship')")
    expect(migration).toContain('REVOKE ALL ON FUNCTION internal_security.validate_income_relationship_ready() FROM PUBLIC, anon, authenticated')
    expect(migration).not.toMatch(/CREATE FUNCTION public\./i)
    expect(migration).not.toMatch(/GRANT\s+EXECUTE/i)
    expect(migration).not.toMatch(/CREATE POLICY|ENABLE ROW LEVEL SECURITY|DISABLE ROW LEVEL SECURITY|FORCE ROW LEVEL SECURITY/i)
    expect(migration).toMatch(/BEGIN;[\s\S]*COMMIT;/)
  })

  it('reconciles the explicit tax-number binding fields without creating data or role grants', () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS payroll_tax_number text/i)
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS payroll_tax_binding_hr_group_id uuid/i)
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS payroll_tax_binding_id uuid/i)
    expect(migration).toContain('income_relationships_payroll_tax_binding_pair_check')
    expect(migration).toContain('income_relationships_payroll_tax_binding_scope_fkey')
    expect(migration).not.toMatch(/INSERT\s+INTO|UPDATE\s+public\.(income_relationships|employees|user_access|role_permissions)/i)
    expect(migration).not.toMatch(/GRANT\s+.*\s+TO\s+(HR_ADMIN|TENANT_ADMIN|service_role)/i)
    expect(migration).not.toContain('SECURITY DEFINER')
    expect(migration).toContain(')) IS NOT TRUE')
    expect(migration).toContain("'salary:write'::text\n    ) IS NOT TRUE")
  })
})
