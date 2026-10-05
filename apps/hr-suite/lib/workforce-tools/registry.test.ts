import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({
  context: {
    tenantId: 'tenant-1',
    administrationId: null,
    userId: 'user-1',
    employeeId: 'employee-1',
    activeRoles: ['EMPLOYEE'],
    permissions: [] as string[],
  },
  selfPermissions: [
    'self:talent-goal:read',
    'self:talent-record:read',
    'self:talent-comparison:read',
  ],
}))
const { listTalentGoals, listMyTalentGoalCheckIns, requireAuthContext, requirePermission, requireTenantModule } = vi.hoisted(() => ({
  listTalentGoals: vi.fn(),
  listMyTalentGoalCheckIns: vi.fn(),
  requireAuthContext: vi.fn(async () => authState.context),
  requirePermission: vi.fn(async (permission: string, targetEmployeeId?: string) => {
    const isSelf = targetEmployeeId === authState.context.employeeId
    const expectedPermission = isSelf && !permission.startsWith('self:') ? `self:${permission}` : permission
    const available = isSelf ? authState.selfPermissions : authState.context.permissions
    if (!available.includes(expectedPermission)) throw Object.assign(new Error('forbidden'), { status: 403 })
  }),
  requireTenantModule: vi.fn(async () => undefined),
}))
vi.mock('@/lib/auth/permissions', () => ({ requireAuthContext, requirePermission }))
vi.mock('@/lib/modules/module-service', () => ({
  ModuleError: class extends Error {
    constructor(readonly code: string, readonly status: number) { super(code) }
  },
  requireTenantModule,
}))
vi.mock('@/lib/talent/check-in-service', () => ({ listMyTalentGoalCheckIns }))
vi.mock('@/lib/talent/goal-service', () => ({ listTalentGoals }))

import { workforceToolHeRaName, WORKFORCE_TOOL_CATALOG } from './catalog'
import { createLocalWorkforceMcpHarness } from './mcp-local'
import {
  assertWorkforceToolCatalogIsValid,
  dispatchHeRaWorkforceTool,
  dispatchWorkforceTool,
  resolveWorkforceToolAudience,
} from './registry'
import { ModuleError } from '@/lib/modules/module-service'

const toolId = 'employee.talent.development-progress.read'
const mockGoal = {
  id: '00000000-0000-0000-0000-000000000001',
  tenant_id: 'private-tenant',
  employee_id: 'private-employee',
  capability_id: null,
  title: 'Mijn leerdoel',
  description: 'Niet retourneren',
  period_start: '2026-01-01',
  period_end: null,
  progress_percent: 40,
  status: 'ACTIVE',
  source_type: 'SELF_ENTERED',
  version: 1,
  completed_at: null,
  archived_at: null,
  employeeLabel: null,
  capabilityLabel: null,
}

describe('provider-neutral workforce catalog and adapters', () => {
  beforeEach(() => {
    authState.context.activeRoles = ['EMPLOYEE']
    authState.context.permissions = []
    listTalentGoals.mockReset().mockResolvedValue({ goals: [mockGoal], employees: [], capabilities: [] })
    listMyTalentGoalCheckIns.mockReset().mockResolvedValue([])
    requireAuthContext.mockClear()
    requirePermission.mockClear()
    requireTenantModule.mockReset().mockResolvedValue(undefined)
  })

  it('has unique IDs and explicit runtime metadata for every registered tool', () => {
    assertWorkforceToolCatalogIsValid()
    expect(new Set(WORKFORCE_TOOL_CATALOG.map((tool) => tool.id)).size).toBe(WORKFORCE_TOOL_CATALOG.length)
    expect(WORKFORCE_TOOL_CATALOG.every((tool) => tool.operation === 'READ' && tool.permission && tool.module)).toBe(true)
  })

  it('uses the same role precedence for browser exposure and server dispatch', () => {
    expect(resolveWorkforceToolAudience(['EMPLOYEE'])).toBe('EMPLOYEE')
    expect(resolveWorkforceToolAudience(['DIRECT_MANAGER'])).toBe('MANAGER')
    expect(resolveWorkforceToolAudience(['HR_ADMIN', 'DIRECT_MANAGER'])).toBe('HR')
    expect(resolveWorkforceToolAudience(['TENANT_ADMIN'])).toBe('HR')
    expect(resolveWorkforceToolAudience(['UNRELATED_ROLE'])).toBeNull()
  })

  it('returns the same employee result through shared dispatch, local MCP, and HeRa adapters', async () => {
    const direct = await dispatchWorkforceTool(toolId, {})
    const mcp = await createLocalWorkforceMcpHarness().callTool({ name: toolId, arguments: {} })
    const heRa = await dispatchHeRaWorkforceTool(workforceToolHeRaName(toolId), {})

    expect(mcp).toEqual(direct)
    expect(heRa).toEqual(direct)
    expect(JSON.stringify(direct)).not.toContain('private-employee')
    expect(JSON.stringify(direct)).not.toContain('Niet retourneren')
    expect(listTalentGoals).toHaveBeenCalledTimes(3)
    expect(listTalentGoals).toHaveBeenNthCalledWith(1, 'self')
    expect(listTalentGoals).toHaveBeenNthCalledWith(2, 'self')
    expect(listTalentGoals).toHaveBeenNthCalledWith(3, 'self')
  })

  it('rejects invalid tool input and sanitizes access failures', async () => {
    await expect(dispatchWorkforceTool(toolId, { employeeId: 'attacker-choice' }))
      .rejects.toMatchObject({ code: 'INPUT_INVALID' })
    expect(listTalentGoals).not.toHaveBeenCalled()

    listTalentGoals.mockRejectedValue(Object.assign(new Error('private authorization detail'), { status: 403 }))
    await expect(dispatchWorkforceTool(toolId, {}))
      .rejects.toMatchObject({ code: 'ACCESS_DENIED' })
  })

  it.each([
    { role: 'DIRECT_MANAGER', audience: 'MANAGER' },
    { role: 'HR_ADMIN', audience: 'HR' },
  ])('denies an $audience from the employee self tool through every adapter', async ({ role }) => {
    authState.context.activeRoles = [role]

    await expect(dispatchWorkforceTool(toolId, {})).rejects.toMatchObject({ code: 'ACCESS_DENIED' })
    await expect(createLocalWorkforceMcpHarness().callTool({ name: toolId, arguments: {} }))
      .rejects.toMatchObject({ code: 'ACCESS_DENIED' })
    await expect(dispatchHeRaWorkforceTool(workforceToolHeRaName(toolId), {}))
      .rejects.toMatchObject({ code: 'ACCESS_DENIED' })

    expect(listTalentGoals).not.toHaveBeenCalled()
  })

  it('requires every declared permission before executing an HR tool', async () => {
    authState.context.activeRoles = ['HR_ADMIN']
    authState.context.permissions = ['talent-team:read']

    await expect(dispatchWorkforceTool('hr.talent.tenant-capability-matrix.read', {}))
      .rejects.toMatchObject({ code: 'ACCESS_DENIED' })
    expect(requirePermission).toHaveBeenCalledWith('talent-team:read', undefined)
    expect(requirePermission).toHaveBeenCalledWith('talent:manage', undefined)
  })

  it('maps a disabled module to a stable inactive-module result', async () => {
    requireTenantModule.mockRejectedValue(new ModuleError('MODULE_NOT_ACTIVE', 404))

    await expect(dispatchWorkforceTool(toolId, {})).rejects.toMatchObject({ code: 'MODULE_INACTIVE' })
    expect(listTalentGoals).not.toHaveBeenCalled()
  })

  it('maps inaccessible self-bound resources to a generic not-found result', async () => {
    listMyTalentGoalCheckIns.mockRejectedValue(Object.assign(new Error('TALENT_GOAL_NOT_FOUND'), { status: 404 }))

    await expect(dispatchWorkforceTool('employee.talent.goal-check-ins.read', {
      goalId: '00000000-0000-0000-0000-000000000001',
    })).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' })
  })
})
