import { describe, expect, it } from 'vitest'
import { isEmployeeOutsideDirectManagerScope } from './team-scope'

describe('employee detail manager scope', () => {
  it('denies a non-team employee to a direct manager', () => {
    expect(isEmployeeOutsideDirectManagerScope({ employeeId: 'manager', activeRoles: ['DIRECT_MANAGER'] }, 'outside', ['direct-report'])).toBe(true)
  })

  it('allows a direct report and the manager self profile', () => {
    const auth = { employeeId: 'manager', activeRoles: ['DIRECT_MANAGER'] }
    expect(isEmployeeOutsideDirectManagerScope(auth, 'direct-report', ['direct-report'])).toBe(false)
    expect(isEmployeeOutsideDirectManagerScope(auth, 'manager', [])).toBe(false)
  })

  it('keeps tenant-admin access unrestricted', () => {
    expect(isEmployeeOutsideDirectManagerScope({ employeeId: 'manager', activeRoles: ['TENANT_ADMIN', 'DIRECT_MANAGER'] }, 'outside', [])).toBe(false)
  })
})
