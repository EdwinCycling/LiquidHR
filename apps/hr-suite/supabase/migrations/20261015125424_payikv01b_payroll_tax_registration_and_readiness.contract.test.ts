import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./20261015125424_payikv01b_payroll_tax_registration_and_readiness.sql', import.meta.url), 'utf8')

describe('PAYIKV-01B payroll tax registration and readiness contract', () => {
  it('keeps the employer number, employer suffix, and employee IKV number separate', () => {
    expect(migration).toContain('payroll_tax_number text')
    expect(migration).toContain("NEW.payroll_tax_subnumber !~ '^L(0[1-9]|[1-9][0-9])$'")
    expect(migration).toContain('NEW.ikv_number NOT BETWEEN 1 AND 99')
    expect(migration).toContain('right(NEW.payroll_tax_number, 3) IS DISTINCT FROM NEW.payroll_tax_subnumber')
    expect(migration).toContain('income_relationships_employer_employee_ikv_active_key')
    expect(migration).toContain('income_relationships_unbound_employee_ikv_active_key')
    expect(migration).not.toContain("NEW.payroll_tax_subnumber !~ '^(L)?")
  })

  it('uses only scoped salary permissions and active HR Admin or Tenant Admin assignments', () => {
    expect(migration).toContain("'salary:read'::text")
    expect(migration).toContain("'salary:write'::text")
    expect(migration).toContain("role.code IN ('HR_ADMIN', 'TENANT_ADMIN')")
    expect(migration).toContain("assignment.scope_type::text = 'TENANT'")
    expect(migration).toContain("assignment.scope_type::text = 'ADMINISTRATION'")
    expect(migration).toContain('assignment.hr_group_id = requested_hr_group_id')
    expect(migration).toContain('internal_security.has_hr_group_access')
    expect(migration).toContain('is_scoped_payroll_admin(tenant_id, hr_group_id, administration_id)')
    expect(migration).not.toContain('payroll-import:read')
    expect(migration).not.toContain('payroll-import:write')
    expect(migration).not.toMatch(/INSERT\s+INTO\s+public\.(user_access|role_permissions)/i)
    expect(migration).not.toContain('SECURITY DEFINER')
  })

  it('preserves registration history and audits scoped, idempotent registration changes', () => {
    expect(migration).toContain('PAYROLL_TAX_NUMBER_HISTORY_IMMUTABLE')
    expect(migration).toContain('PAYROLL_TAX_NUMBER_CONFLICT')
    expect(migration).toContain('requested_valid_until')
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain("EXECUTE FUNCTION internal_security.audit_hr_change('administration_payroll_tax_number')")
    expect(migration).toContain("EXECUTE FUNCTION internal_security.audit_hr_change('income_relationship')")
    expect(migration).toContain('CREATE POLICY administration_payroll_tax_numbers_select_salary_scoped')
    expect(migration).toContain('CREATE POLICY administration_payroll_tax_numbers_insert_salary_admin')
    expect(migration).toContain('CREATE POLICY administration_payroll_tax_numbers_update_salary_admin')
    expect(migration).not.toMatch(/CREATE POLICY\s+administration_payroll_tax_numbers_\w+\s+ON[\s\S]*?FOR DELETE/i)
    expect(migration).toMatch(/BEGIN;[\s\S]*COMMIT;/)
  })

  it('requires a verified secure BSN and revalidates inserts or changed bindings that remain READY', () => {
    expect(migration).toContain('employee_secure_identifiers AS identifier')
    expect(migration).toContain('identifier.bsn_fingerprint IS NOT NULL')
    expect(migration).not.toContain('employee.employee_number')
    expect(migration).toContain('BEFORE INSERT OR UPDATE OF reporting_status')
    expect(migration).toContain('OR OLD.payroll_tax_binding_id IS DISTINCT FROM NEW.payroll_tax_binding_id')
    expect(migration).toContain('NEW.payroll_tax_number !~')
    expect(migration).toContain('tax_number.valid_from <= NEW.starts_on')
    expect(migration).toContain('PAYROLL_IKV_EMPLOYMENT_LINK_GAP')
    expect(migration).toContain("'salary:write'::text")
    expect(migration).not.toContain('bsn_ciphertext')
  })
})
