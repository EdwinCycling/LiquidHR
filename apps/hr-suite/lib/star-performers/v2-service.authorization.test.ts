import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class MockAuthorizationError extends Error {
    readonly status = 403
  }

  return {
    AuthorizationError: MockAuthorizationError,
    getRequestAuthorizationContext: vi.fn(),
    requirePermissionInContext: vi.fn(),
    listDirectTeamEmployeeIds: vi.fn(),
  }
})

vi.mock('@/lib/auth/permissions', () => ({
  AuthorizationError: mocks.AuthorizationError,
  getRequestAuthorizationContext: mocks.getRequestAuthorizationContext,
  requirePermissionInContext: mocks.requirePermissionInContext,
}))

vi.mock('@/lib/organization/team-scope', () => ({ listDirectTeamEmployeeIds: mocks.listDirectTeamEmployeeIds }))

import { getStarPerformersDetail } from './v2-service'

describe('star performer talent passport authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const supabase = { from: vi.fn() }
    mocks.getRequestAuthorizationContext.mockResolvedValue({
      context: { tenantId: 'tenant-1', administrationId: 'administration-1', userId: 'user-1', employeeId: 'manager-1', activeRoles: ['DIRECT_MANAGER'], permissions: ['star-performer:manager-read'] },
      supabase,
    })
    mocks.requirePermissionInContext.mockResolvedValue(undefined)
    mocks.listDirectTeamEmployeeIds.mockResolvedValue(['employee-1'])
  })

  it('rejects a forged employee outside the direct-team scope before any detail read', async () => {
    await expect(getStarPerformersDetail('employee-outside-team')).rejects.toMatchObject({ status: 403 })
    expect(mocks.getRequestAuthorizationContext).toHaveBeenCalledTimes(1)
    expect(mocks.listDirectTeamEmployeeIds).toHaveBeenCalledTimes(1)
  })
})
