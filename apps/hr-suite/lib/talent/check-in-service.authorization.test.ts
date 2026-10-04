import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'

const authState = vi.hoisted(() => ({
  employeeId: 'employee-1',
  goalEmployeeId: 'employee-1',
  checkInQueries: 0,
}))
const { AuthorizationError, AuthenticationError, requireAuthContext, requirePermission, requireTenantModule, createServerClient } = vi.hoisted(() => ({
  AuthorizationError: class MockAuthorizationError extends Error {},
  AuthenticationError: class MockAuthenticationError extends Error {},
  requireAuthContext: vi.fn(async () => ({
    tenantId: 'tenant-1',
    hrGroupId: 'hr-group-1',
    administrationId: null,
    userId: 'user-1',
    employeeId: authState.employeeId,
    activeRoles: ['EMPLOYEE'],
    permissions: [],
  })),
  requirePermission: vi.fn(async () => undefined),
  requireTenantModule: vi.fn(async () => undefined),
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ AuthorizationError, AuthenticationError, requireAuthContext, requirePermission }))
vi.mock('@/lib/modules/module-service', () => ({ requireTenantModule }))
vi.mock('@/lib/supabase/server', () => ({ createClient: createServerClient }))

import { listMyTalentGoalCheckIns } from './check-in-service'

const goalId = '00000000-0000-0000-0000-000000000001'

function makeQuery(table: string) {
  const filters = new Map<string, string>()
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: string) => {
      filters.set(column, value)
      return query
    }),
    order: vi.fn(() => query),
    limit: vi.fn(async () => {
      if (table === 'talent_goal_check_ins') authState.checkInQueries += 1
      return { data: [], error: null }
    }),
    maybeSingle: vi.fn(async () => {
      const isOwnGoal = filters.get('employee_id') === authState.goalEmployeeId
        && filters.get('id') === goalId
      return { data: table === 'talent_development_goals' && isOwnGoal ? { id: goalId } : null, error: null }
    }),
  }
  return query
}

describe('listMyTalentGoalCheckIns', () => {
  beforeEach(() => {
    authState.employeeId = 'employee-1'
    authState.goalEmployeeId = 'employee-1'
    authState.checkInQueries = 0
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue({
      from: (table: string) => makeQuery(table),
    } as never)
  })

  it('requires the self permission and constrains the goal query to the authenticated employee', async () => {
    await expect(listMyTalentGoalCheckIns(goalId)).resolves.toEqual([])

    expect(requirePermission).toHaveBeenCalledWith('self:talent-goal:read', 'employee-1')
    expect(authState.checkInQueries).toBe(1)
  })

  it('does not read check-ins when a supplied goal belongs to another employee', async () => {
    authState.goalEmployeeId = 'employee-2'

    await expect(listMyTalentGoalCheckIns(goalId)).rejects.toMatchObject({ status: 404 })

    expect(requirePermission).toHaveBeenCalledWith('self:talent-goal:read', 'employee-1')
    expect(authState.checkInQueries).toBe(0)
  })

  it('maps only authorization failures to a bounded forbidden result', async () => {
    requirePermission.mockRejectedValueOnce(new AuthorizationError('forbidden'))

    await expect(listMyTalentGoalCheckIns(goalId)).rejects.toMatchObject({ status: 403, code: 'TALENT_CHECKIN_FORBIDDEN' })
    expect(authState.checkInQueries).toBe(0)
  })

  it('preserves authentication and operational errors from permission resolution', async () => {
    const authenticationError = new AuthenticationError('auth unavailable')
    requirePermission.mockRejectedValueOnce(authenticationError)
    await expect(listMyTalentGoalCheckIns(goalId)).rejects.toBe(authenticationError)

    const operationalError = new Error('permission store unavailable')
    requirePermission.mockRejectedValueOnce(operationalError)
    await expect(listMyTalentGoalCheckIns(goalId)).rejects.toBe(operationalError)
    expect(authState.checkInQueries).toBe(0)
  })
})
