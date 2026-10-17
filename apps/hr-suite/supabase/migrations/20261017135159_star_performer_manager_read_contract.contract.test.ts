import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migration = readFileSync(resolve(__dirname, '20261017135159_star_performer_manager_read_contract.sql'), 'utf8')

describe('STAR-V2-04B Manager read contract migration', () => {
  it('grants only the dedicated Manager read permission', () => {
    expect(migration).toContain("'star-performer:manager-read'")
    expect(migration).toContain("role.code = 'DIRECT_MANAGER'")
    expect(migration).toContain('for select')
    expect(migration).not.toContain("permission.code = 'star-performer:write'")
    expect(migration).not.toContain('for all')
    expect(migration).not.toMatch(/\bto anon\b/)
    expect(migration).not.toMatch(/\bto public\b/)
  })

  it('requires the current direct-manager placement and active dates', () => {
    expect(migration).toContain('organization.direct_manager_id = (select internal_security.current_employee_id())')
    expect(migration).toContain('organization.administration_id = star_performer_assessments.administration_id')
    expect(migration).toContain('organization.effective_from <= current_date')
    expect(migration).toContain('(organization.effective_to is null or organization.effective_to >= current_date)')
    expect(migration).toContain('employee_id <> (select internal_security.current_employee_id())')
  })
})
