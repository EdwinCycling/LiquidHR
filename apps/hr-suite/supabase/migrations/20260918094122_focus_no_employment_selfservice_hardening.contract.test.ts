import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(resolve(__dirname, '20260918094122_focus_no_employment_selfservice_hardening.sql'), 'utf8')

describe('NO_EMPLOYMENT selfservice hardening migration contract', () => {
  it('requires exact-scope active or future confirmed employment before ordinary selfservice', () => {
    expect(sql).toContain("requested_permission_code = 'self:employee:read'")
    expect(sql).toContain("employee.auth_user_id = (select auth.uid())")
    expect(sql).toContain('employee.tenant_id = requested_tenant_id')
    expect(sql).toContain('employee.hr_group_id = requested_hr_group_id')
    expect(sql).toContain("employment.record_status = 'CONFIRMED'")
    expect(sql).toContain('employment.starts_on > current_date')
    expect(sql).toContain('employment.ends_on is null or employment.ends_on >= current_date')
    expect(sql).toContain('current_employee_ess_access_is_blocked(')
  })
})
