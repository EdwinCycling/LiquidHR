import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'

const authState = vi.hoisted(() => ({
  employeeId: 'employee-1',
  goalEmployeeId: 'employee-1',
  goalStatus: 'ACTIVE',
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
    activeRoles: ['EMPLOYEE'] as string[],
    permissions: [] as string[],
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
      const isRequestedGoal = filters.get('id') === goalId && !filters.has('employee_id')
      return {
        data: table === 'talent_development_goals' && (isOwnGoal || isRequestedGoal)
          ? { id: goalId, employee_id: authState.goalEmployeeId, status: authState.goalStatus, title: 'Goal', version: 1 }
          : null,
        error: null,
      }
    }),
  }
  return query
}

describe('listMyTalentGoalCheckIns', () => {
  beforeEach(() => {
    authState.employeeId = 'employee-1'
    authState.goalEmployeeId = 'employee-1'
    authState.goalStatus = 'ACTIVE'
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

  it('authorizes an Employee self-reflection through the existing read and write checks', async () => {
    const { authorizeTalentGoalCheckIn } = await import('./check-in-service')

    await expect(authorizeTalentGoalCheckIn(goalId, {
      entryType: 'EMPLOYEE_REFLECTION',
      body: 'Ik heb geoefend met klantgesprekken.',
    })).resolves.toMatchObject({ employeeId: 'employee-1', goalStatus: 'ACTIVE', goalTitle: 'Goal', goalVersion: 1 })
    expect(requirePermission).toHaveBeenNthCalledWith(1, 'talent-goal:read', 'employee-1')
    expect(requirePermission).toHaveBeenNthCalledWith(2, 'talent-goal:write', 'employee-1')
  })

  it('authorizes a Manager observation for a scoped direct report', async () => {
    authState.employeeId = 'manager-1'
    authState.goalEmployeeId = 'employee-2'
    requireAuthContext.mockResolvedValueOnce({
      tenantId: 'tenant-1',
      hrGroupId: 'hr-group-1',
      administrationId: null,
      userId: 'manager-user',
      employeeId: 'manager-1',
      activeRoles: ['DIRECT_MANAGER'],
      permissions: ['talent-goal:read', 'talent-goal:write'],
    })
    const { authorizeTalentGoalCheckIn } = await import('./check-in-service')

    await expect(authorizeTalentGoalCheckIn(goalId, {
      entryType: 'MANAGER_OBSERVATION',
      body: 'Bespreking ingepland.',
    })).resolves.toMatchObject({ employeeId: 'employee-2' })
    expect(requirePermission).toHaveBeenCalledWith('talent-goal:write', 'employee-2')
  })

  it('denies an Employee attempt to submit a Manager observation for their own goal', async () => {
    const { authorizeTalentGoalCheckIn } = await import('./check-in-service')

    await expect(authorizeTalentGoalCheckIn(goalId, {
      entryType: 'MANAGER_OBSERVATION',
      body: 'Niet toegestaan voor een medewerker.',
    })).rejects.toMatchObject({ code: 'TALENT_CHECKIN_ENTRY_TYPE_FORBIDDEN', status: 403 })
    expect(requirePermission).toHaveBeenCalledTimes(1)
  })

  it('denies a Manager reflection and an out-of-scope report before any check-in mutation', async () => {
    authState.employeeId = 'manager-1'
    authState.goalEmployeeId = 'employee-2'
    requireAuthContext.mockResolvedValueOnce({
      tenantId: 'tenant-1',
      hrGroupId: 'hr-group-1',
      administrationId: null,
      userId: 'manager-user',
      employeeId: 'manager-1',
      activeRoles: ['DIRECT_MANAGER'],
      permissions: ['talent-goal:read', 'talent-goal:write'],
    })
    const { authorizeTalentGoalCheckIn } = await import('./check-in-service')

    await expect(authorizeTalentGoalCheckIn(goalId, {
      entryType: 'EMPLOYEE_REFLECTION',
      body: 'Onjuiste auteur.',
    })).rejects.toMatchObject({ code: 'TALENT_CHECKIN_ENTRY_TYPE_FORBIDDEN', status: 403 })

    requirePermission.mockRejectedValueOnce(new AuthorizationError('out of scope'))
    await expect(authorizeTalentGoalCheckIn(goalId, {
      entryType: 'MANAGER_OBSERVATION',
      body: 'Buiten de scope.',
    })).rejects.toMatchObject({ code: 'TALENT_CHECKIN_FORBIDDEN', status: 403 })
    expect(authState.checkInQueries).toBe(0)
  })

  it('allows an HR Admin context with the existing manage permission across employee goals', async () => {
    authState.employeeId = 'hr-admin-employee'
    authState.goalEmployeeId = 'employee-3'
    requireAuthContext.mockResolvedValueOnce({
      tenantId: 'tenant-1',
      hrGroupId: 'hr-group-1',
      administrationId: null,
      userId: 'hr-admin-user',
      employeeId: 'hr-admin-employee',
      activeRoles: ['HR_ADMIN'],
      permissions: ['talent-goal:manage', 'talent-goal:read', 'talent-goal:write'],
    })
    const { authorizeTalentGoalCheckIn } = await import('./check-in-service')

    await expect(authorizeTalentGoalCheckIn(goalId, {
      entryType: 'FOLLOW_UP',
      body: 'Volgende voortgangsbespreking.',
    })).resolves.toMatchObject({ employeeId: 'employee-3' })
  })
})
