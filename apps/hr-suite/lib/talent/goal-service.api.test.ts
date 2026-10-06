import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, requireAuthContext, requirePermission, requirePermissionInContext, requireTenantModule } = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireAuthContext: vi.fn(),
  requirePermission: vi.fn(),
  requirePermissionInContext: vi.fn(),
  requireTenantModule: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ requireAuthContext, requirePermission, requirePermissionInContext }))
vi.mock('@/lib/modules/module-service', () => ({ requireTenantModule }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { createSupabaseBearerRlsBinding } from '@/lib/api-v1/auth/bearer-rls'
import type { AuthContext } from '@/lib/auth/permissions'
import { listSelfDevelopmentPlans, listTalentGoals } from './goal-service'

function createRls(userId = 'user-1') {
  return createSupabaseBearerRlsBinding({
    supabaseUrl: 'http://localhost:54321',
    publishableKey: 'sb_publishable_test',
    accessToken: 'synthetic.access-token.signature',
    supabaseUserId: userId,
    identity: { issuer: 'https://issuer.synthetic.invalid', subject: 'subject-1' },
    account: { userId },
  })
}

describe('listTalentGoals delegated self-read dependencies', () => {
  beforeEach(() => {
    createClient.mockReset()
    requireAuthContext.mockReset()
    requirePermission.mockReset()
    requirePermissionInContext.mockReset()
    requireTenantModule.mockReset()
  })

  it('uses one explicit context and bearer RLS client for permission, module, and domain reads', async () => {
    const authContext: AuthContext = {
      tenantId: 'tenant-1',
      hrGroupId: 'group-1',
      administrationId: 'administration-1',
      userId: 'user-1',
      employeeId: 'employee-1',
      activeRoles: ['EMPLOYEE'],
      permissions: [],
    }
    const goalQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      then: (resolve: (value: { data: readonly unknown[]; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    }
    goalQuery.select.mockReturnValue(goalQuery)
    goalQuery.eq.mockReturnValue(goalQuery)
    goalQuery.order.mockReturnValue(goalQuery)
    goalQuery.limit.mockReturnValue(goalQuery)
    const rls = createRls()
    const from = vi.spyOn(rls.client, 'from').mockImplementation((() => goalQuery) as never)
    requirePermissionInContext.mockImplementation(async (_client, context) => context)
    requireTenantModule.mockResolvedValue(undefined)

    await expect(listTalentGoals(
      'self',
      {},
      { includeOptions: false },
      { authContext, rls },
    )).resolves.toEqual({ goals: [], employees: [], capabilities: [] })

    expect(requirePermissionInContext).toHaveBeenCalledWith(
      rls.client,
      authContext,
      'self:talent-goal:read',
      'employee-1',
    )
    expect(requireTenantModule).toHaveBeenCalledWith('TALENT', { auth: authContext, supabase: rls.client })
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('talent_development_goals')
    expect(createClient).not.toHaveBeenCalled()
    expect(requireAuthContext).not.toHaveBeenCalled()
    expect(requirePermission).not.toHaveBeenCalled()
  })

  it('rejects delegated dependency injection for admin or manager mode', async () => {
    const authContext: AuthContext = {
      tenantId: 'tenant-1',
      hrGroupId: 'group-1',
      administrationId: null,
      userId: 'user-1',
      employeeId: 'employee-1',
      activeRoles: ['EMPLOYEE'],
      permissions: [],
    }

    await expect(listTalentGoals('manager', {}, {}, {
      authContext,
      rls: createRls(),
    })).rejects.toMatchObject({ code: 'TALENT_GOAL_FORBIDDEN', status: 403 })
    expect(requirePermissionInContext).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('rejects a structural but unbranded RLS wrapper before permission or data access', async () => {
    const authContext: AuthContext = {
      tenantId: 'tenant-1',
      hrGroupId: 'group-1',
      administrationId: 'administration-1',
      userId: 'user-1',
      employeeId: 'employee-1',
      activeRoles: ['EMPLOYEE'],
      permissions: [],
    }
    const rls = createRls()
    const unbrandedRls = { ...rls } as typeof rls

    await expect(listSelfDevelopmentPlans({ authContext, rls: unbrandedRls }))
      .rejects.toMatchObject({ code: 'RLS_CLIENT_INVALID', status: 500 })

    expect(requirePermissionInContext).not.toHaveBeenCalled()
    expect(requireTenantModule).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('uses only the approved self-plan fields and server-bound tenant/employee filters', async () => {
    const authContext: AuthContext = {
      tenantId: 'tenant-1',
      hrGroupId: 'group-1',
      administrationId: 'administration-1',
      userId: 'user-1',
      employeeId: 'employee-1',
      activeRoles: ['EMPLOYEE'],
      permissions: [],
    }
    const goalQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      then: (resolve: (value: { data: readonly unknown[]; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    }
    goalQuery.select.mockReturnValue(goalQuery)
    goalQuery.eq.mockReturnValue(goalQuery)
    goalQuery.order.mockReturnValue(goalQuery)
    goalQuery.limit.mockReturnValue(goalQuery)
    const rls = createRls()
    const from = vi.spyOn(rls.client, 'from').mockImplementation((() => goalQuery) as never)
    requirePermissionInContext.mockImplementation(async (_client, context) => context)
    requireTenantModule.mockResolvedValue(undefined)

    await expect(listSelfDevelopmentPlans({ authContext, rls })).resolves.toEqual([])

    expect(from).toHaveBeenCalledWith('talent_development_goals')
    expect(goalQuery.select).toHaveBeenCalledWith(
      'tenant_id,employee_id,period_start,period_end,progress_percent,status,completed_at',
    )
    expect(goalQuery.select).not.toHaveBeenCalledWith('*')
    expect(goalQuery.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1')
    expect(goalQuery.eq).toHaveBeenCalledWith('employee_id', 'employee-1')
    expect(requirePermissionInContext).toHaveBeenCalledWith(
      rls.client,
      authContext,
      'self:talent-goal:read',
      'employee-1',
    )
    expect(requireTenantModule).toHaveBeenCalledWith('TALENT', { auth: authContext, supabase: rls.client })
  })
})
