import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({
  context: {
    tenantId: 'tenant-1',
    administrationId: null,
    userId: 'user-1',
    employeeId: 'employee-1',
    activeRoles: ['DIRECT_MANAGER'],
    permissions: ['talent-team:read'] as string[],
  },
}))
const { requireAuthContext, requirePermission, requireTenantModule, listTalentGoals, listMyTalentGoalCheckIns, listTalentTeamMatrix } = vi.hoisted(() => ({
  requireAuthContext: vi.fn(async () => authState.context),
  requirePermission: vi.fn(async (permission: string, targetEmployeeId?: string) => {
    const isSelf = targetEmployeeId === authState.context.employeeId
    const expectedPermission = isSelf && !permission.startsWith('self:') ? `self:${permission}` : permission
    const available = isSelf ? [] : authState.context.permissions
    if (!available.includes(expectedPermission)) throw Object.assign(new Error('forbidden'), { status: 403 })
  }),
  requireTenantModule: vi.fn(async () => undefined),
  listTalentGoals: vi.fn(),
  listMyTalentGoalCheckIns: vi.fn(),
  listTalentTeamMatrix: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ requireAuthContext, requirePermission, permissionErrorResponse: vi.fn(() => null) }))
vi.mock('@/lib/modules/module-service', () => ({
  ModuleError: class extends Error {
    constructor(readonly code: string, readonly status: number) { super(code) }
  },
  requireTenantModule,
}))
vi.mock('@/lib/talent/goal-service', () => ({ listTalentGoals }))
vi.mock('@/lib/talent/check-in-service', () => ({ listMyTalentGoalCheckIns }))
vi.mock('@/lib/talent/team-service', () => ({ listTalentTeamMatrix }))

import { POST } from './route'

function post(toolId: string, input: unknown): Request {
  return new Request('http://localhost/api/internal/workforce-tools', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ toolId, input }),
  })
}

describe('POST /api/internal/workforce-tools authorization', () => {
  beforeEach(() => {
    authState.context.activeRoles = ['DIRECT_MANAGER']
    authState.context.permissions = ['talent-team:read']
    vi.clearAllMocks()
  })

  it.each([
    { role: 'DIRECT_MANAGER', toolId: 'employee.talent.goal-check-ins.read', input: { goalId: '00000000-0000-0000-0000-000000000001' } },
    { role: 'HR_ADMIN', toolId: 'employee.talent.goal-check-ins.read', input: { goalId: '00000000-0000-0000-0000-000000000001' } },
    { role: 'EMPLOYEE', toolId: 'hr.talent.tenant-capability-matrix.read', input: {} },
  ])('denies role $role outside the tool audience before reading data', async ({ role, toolId, input }) => {
    authState.context.activeRoles = [role]

    const response = await POST(post(toolId, input))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'ACCESS_DENIED' })
    expect(listTalentGoals).not.toHaveBeenCalled()
    expect(listMyTalentGoalCheckIns).not.toHaveBeenCalled()
    expect(listTalentTeamMatrix).not.toHaveBeenCalled()
  })
})
