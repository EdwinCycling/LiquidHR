import { describe, expect, it } from 'vitest'
import { isColumnPermissionDenied, isOutOfScopeHttpStatus, roleMatchesPersona } from './sec101-postrelease-acceptance.mjs'

describe('SEC-101 live runner persona gates', () => {
  it('accepts an Employee-only account and rejects a Manager account for that slot', () => {
    expect(roleMatchesPersona('employee-only', ['EMPLOYEE'])).toBe(true)
    expect(roleMatchesPersona('employee-only', ['EMPLOYEE', 'DIRECT_MANAGER'])).toBe(false)
  })

  it('requires direct Manager and excludes administrative roles', () => {
    expect(roleMatchesPersona('manager', ['EMPLOYEE', 'DIRECT_MANAGER'])).toBe(true)
    expect(roleMatchesPersona('manager', ['DIRECT_MANAGER', 'TENANT_ADMIN'])).toBe(false)
  })

  it('requires Tenant Admin and excludes Manager overlap', () => {
    expect(roleMatchesPersona('tenant-admin', ['TENANT_ADMIN'])).toBe(true)
    expect(roleMatchesPersona('tenant-admin', ['TENANT_ADMIN', 'DIRECT_MANAGER'])).toBe(false)
    expect(roleMatchesPersona('tenant-admin', ['TENANT_ADMIN', 'HR_ADMIN'])).toBe(false)
  })

  it('accepts only a database column permission denial as a protected-column PASS', () => {
    expect(isColumnPermissionDenied({ status: 400, error: { code: '42501' } })).toBe(true)
    expect(isColumnPermissionDenied({ status: 200, error: null })).toBe(false)
    expect(isColumnPermissionDenied({ status: 403, error: { code: 'PGRST301' } })).toBe(false)
    expect(isColumnPermissionDenied({ status: 401, error: null })).toBe(false)
  })

  it('accepts only explicit forbidden or not-found statuses for out-of-scope app routes', () => {
    expect(isOutOfScopeHttpStatus(403)).toBe(true)
    expect(isOutOfScopeHttpStatus(404)).toBe(true)
    expect(isOutOfScopeHttpStatus(401)).toBe(false)
    expect(isOutOfScopeHttpStatus(500)).toBe(false)
  })
})
