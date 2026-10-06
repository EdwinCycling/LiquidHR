import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import type { TalentGoalCreateInput } from './goal-schemas'

const authMocks = vi.hoisted(() => ({
  AuthorizationError: class MockAuthorizationError extends Error {},
  requireAuthContext: vi.fn(),
  requirePermission: vi.fn(),
  requireTenantModule: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  AuthorizationError: authMocks.AuthorizationError,
  requireAuthContext: authMocks.requireAuthContext,
  requirePermission: authMocks.requirePermission,
}))
vi.mock('@/lib/modules/module-service', () => ({ requireTenantModule: authMocks.requireTenantModule }))
vi.mock('@/lib/supabase/server', () => ({ createClient: authMocks.createClient }))

import { authorizeTalentGoalCreate } from './goal-service'

const ids = {
  tenant: '10000000-0000-4000-8000-000000000001',
  user: '10000000-0000-4000-8000-000000000002',
  employee: '10000000-0000-4000-8000-000000000003',
  directReport: '10000000-0000-4000-8000-000000000004',
  otherEmployee: '10000000-0000-4000-8000-000000000005',
}

const goalInput: TalentGoalCreateInput = {
  title: 'Klantgesprekken verbeteren',
  periodStart: '2026-10-01',
  progressPercent: 0,
  status: 'DRAFT',
}

function makeContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    tenantId: ids.tenant,
    administrationId: null,
    userId: ids.user,
    employeeId: ids.employee,
    activeRoles: ['EMPLOYEE'],
    permissions: ['self:talent-goal:write'],
    ...overrides,
  }
}

describe('controlled development-goal create authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMocks.requireTenantModule.mockResolvedValue(undefined)
    authMocks.requirePermission.mockResolvedValue(undefined)
  })

  it('allows an Employee self-action through the existing scoped write permission', async () => {
    authMocks.requireAuthContext.mockResolvedValue(makeContext())

    await expect(authorizeTalentGoalCreate(goalInput)).resolves.toMatchObject({
      targetEmployeeId: ids.employee,
      context: { activeRoles: ['EMPLOYEE'] },
    })
    expect(authMocks.requireTenantModule).toHaveBeenCalledWith('TALENT')
    expect(authMocks.requirePermission).toHaveBeenCalledWith('talent-goal:write', ids.employee)
  })

  it('allows a Manager only through the existing permission check for the requested direct report', async () => {
    authMocks.requireAuthContext.mockResolvedValue(makeContext({
      employeeId: ids.employee,
      activeRoles: ['DIRECT_MANAGER'],
      permissions: ['talent-goal:write'],
    }))
    authMocks.requirePermission.mockImplementation(async (_permission: string, employeeId: string) => {
      if (employeeId !== ids.directReport) throw new authMocks.AuthorizationError('out of scope')
    })

    await expect(authorizeTalentGoalCreate({ ...goalInput, employeeId: ids.directReport }))
      .resolves.toMatchObject({ targetEmployeeId: ids.directReport })
    expect(authMocks.requirePermission).toHaveBeenCalledWith('talent-goal:write', ids.directReport)
  })

  it('denies an out-of-scope employee before a draft can be created', async () => {
    authMocks.requireAuthContext.mockResolvedValue(makeContext())
    authMocks.requirePermission.mockRejectedValue(new authMocks.AuthorizationError('out of scope'))

    await expect(authorizeTalentGoalCreate({ ...goalInput, employeeId: ids.otherEmployee }))
      .rejects.toBeInstanceOf(authMocks.AuthorizationError)
  })

  it('allows HR Admin only when the current server context has the existing manage permission', async () => {
    authMocks.requireAuthContext.mockResolvedValue(makeContext({
      activeRoles: ['HR_ADMIN'],
      permissions: ['talent-goal:manage'],
    }))

    await expect(authorizeTalentGoalCreate({ ...goalInput, employeeId: ids.otherEmployee }))
      .resolves.toMatchObject({ targetEmployeeId: ids.otherEmployee })
    expect(authMocks.requirePermission).not.toHaveBeenCalled()
    expect(authMocks.requireTenantModule).toHaveBeenCalledWith('TALENT')
  })
})
