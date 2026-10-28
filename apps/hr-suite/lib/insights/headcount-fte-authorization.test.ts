import { describe, expect, it } from 'vitest'
import { headcountFteEmployeeWithinScope, headcountFtePopulationForRoles, headcountFteSelectionWithinScope } from './headcount-fte-authorization'

describe('Headcount & FTE scope contract', () => {
  it('permits only HR Admin and direct Manager audiences', () => {
    expect(headcountFtePopulationForRoles(['HR_ADMIN'])).toBe('HR_ADMIN')
    expect(headcountFtePopulationForRoles(['TENANT_ADMIN'])).toBe('HR_ADMIN')
    expect(headcountFtePopulationForRoles(['DIRECT_MANAGER'])).toBe('DIRECT_MANAGER')
    expect(headcountFtePopulationForRoles(['EMPLOYEE'])).toBeNull()
  })

  it('keeps Managers within the authenticated direct-team employee set', () => {
    const team = new Set(['employee-a'])
    expect(headcountFteEmployeeWithinScope('DIRECT_MANAGER', 'employee-a', team)).toBe(true)
    expect(headcountFteEmployeeWithinScope('DIRECT_MANAGER', 'employee-b', team)).toBe(false)
    expect(headcountFteEmployeeWithinScope('DIRECT_MANAGER', 'employee-a', null)).toBe(false)
    expect(headcountFteEmployeeWithinScope('HR_ADMIN', 'employee-b', null)).toBe(true)
  })

  it('rejects administration, department and team filters outside the server allowlist', () => {
    expect(headcountFteSelectionWithinScope(['admin-a', 'admin-b'], ['admin-a', 'admin-b'])).toBe(true)
    expect(headcountFteSelectionWithinScope(['admin-c'], ['admin-a', 'admin-b'])).toBe(false)
  })
})
