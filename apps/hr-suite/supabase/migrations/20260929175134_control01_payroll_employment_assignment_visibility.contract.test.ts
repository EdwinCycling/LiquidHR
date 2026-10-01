import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migration = readFileSync(resolve(__dirname, '20260929175134_control01_payroll_employment_assignment_visibility.sql'), 'utf8')

describe('payroll employment assignment visibility migration contract', () => {
  it('grants assignment reads only within the actor HR-group contract-write scope', () => {
    expect(migration).toContain('employee_administration_assignments_select_for_contract_writers')
    expect(migration).toContain('for select to authenticated')
    expect(migration).toContain("'contract:write'")
    expect(migration).toContain('current_user_has_hr_group_permission')
    expect(migration).not.toContain('security definer')
    expect(migration).not.toContain('to anon')
    expect(migration).not.toContain('to public')
  })

  it('binds each imported person to at most one employment within the same tenant and HR group', () => {
    expect(migration).toContain('add column payroll_import_person_id uuid')
    expect(migration).toContain('employments_payroll_import_person_scope_fkey')
    expect(migration).toContain('foreign key (tenant_id, hr_group_id, payroll_import_person_id)')
    expect(migration).toContain('unique index employments_payroll_import_person_key')
    expect(migration).toContain('where payroll_import_person_id is not null')
  })
})
