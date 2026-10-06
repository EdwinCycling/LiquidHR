import { describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { workforceToolHeRaName } from '@/lib/workforce-tools/catalog'
import { WorkforceToolDispatchError } from '@/lib/workforce-tools/registry'
import { dispatchHeRaTool } from './tool-registry'
import { ModuleError } from '@/lib/modules/module-service'

const authState = vi.hoisted(() => ({
  context: {
    tenantId: 'tenant-1',
    administrationId: null,
    userId: 'user-1',
    employeeId: 'employee-1',
    activeRoles: ['HR_MANAGER'],
    permissions: ['salary:read'] as string[],
  },
}))
const { requireAuthContext, requirePermission, requireTenantModule, listTalentGoals } = vi.hoisted(() => ({
  requireAuthContext: vi.fn(async () => authState.context),
  requirePermission: vi.fn(async (permission: string, targetEmployeeId?: string) => {
    const isSelf = targetEmployeeId === authState.context.employeeId
    const expectedPermission = isSelf && !permission.startsWith('self:') ? `self:${permission}` : permission
    const available = isSelf ? [] : authState.context.permissions
    if (!available.includes(expectedPermission)) throw Object.assign(new Error('forbidden'), { status: 403 })
  }),
  requireTenantModule: vi.fn(async () => undefined),
  listTalentGoals: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ requireAuthContext, requirePermission }))
vi.mock('@/lib/modules/module-service', () => ({
  ModuleError: class extends Error {
    constructor(readonly code: string, readonly status: number) { super(code) }
  },
  requireTenantModule,
}))
vi.mock('@/lib/talent/goal-service', () => ({ listTalentGoals }))

const context: AuthContext = {
  tenantId: 'tenant-1',
  administrationId: 'administration-1',
  userId: 'user-1',
  employeeId: 'employee-1',
  activeRoles: ['HR_MANAGER'],
  permissions: ['salary:read'],
}

describe('dispatchHeRaTool', () => {
  it('weigert tenant- en gebruikersscope uit modelargumenten', async () => {
    const analyzeSalaryThreshold = vi.fn()

    await expect(dispatchHeRaTool(context, {
      name: 'analyze_salary_threshold',
      args: { amount: 6000, asOfDate: '2026-07-17', tenantId: 'tenant-2' },
    }, { analyzeSalaryThreshold })).rejects.toMatchObject({ code: 'HERA_TOOL_INPUT_INVALID' })

    expect(analyzeSalaryThreshold).not.toHaveBeenCalled()
  })

  it('stuurt alleen gevalideerde businessargumenten door', async () => {
    const analyzeSalaryThreshold = vi.fn().mockResolvedValue({ source: 'LIQUID_HR' })

    await dispatchHeRaTool(context, {
      name: 'analyze_salary_threshold',
      args: { amount: 6000, asOfDate: '2026-07-17' },
    }, { analyzeSalaryThreshold })

    expect(analyzeSalaryThreshold).toHaveBeenCalledWith(context, {
      amount: 6000,
      asOfDate: '2026-07-17',
    })
  })

  it('weigert scopeverbreding voor medewerker-, dienstverband- en organisatietools', async () => {
    const calls = [
      { name: 'search_visible_employees', args: { query: 'Eva', limit: 10, tenantId: 'tenant-2' } },
      { name: 'get_visible_employment', args: { employeeId: 'employee-2', asOfDate: '2026-07-17', userId: 'user-2' } },
      { name: 'get_visible_organization', args: { asOfDate: '2026-07-17', administrationId: 'administration-2' } },
    ]

    for (const call of calls) {
      await expect(dispatchHeRaTool(context, call, {})).rejects.toMatchObject({
        code: 'HERA_TOOL_INPUT_INVALID',
      })
    }
  })

  it('dispatches a generated HeRa Workforce function name through the shared registry', async () => {
    const dispatchWorkforceTool = vi.fn().mockResolvedValue({ plans: [] })
    const name = workforceToolHeRaName('employee.talent.development-plans.read')

    await expect(dispatchHeRaTool(context, { name, args: {} }, { dispatchWorkforceTool }))
      .resolves.toEqual({ plans: [] })
    expect(dispatchWorkforceTool).toHaveBeenCalledWith(name, {})
  })

  it('turns Workforce authorization failures into a bounded HeRa denial', async () => {
    const dispatchWorkforceTool = vi.fn().mockRejectedValue(new WorkforceToolDispatchError('ACCESS_DENIED'))
    const name = workforceToolHeRaName('employee.talent.development-plans.read')

    await expect(dispatchHeRaTool(context, { name, args: {} }, { dispatchWorkforceTool }))
      .rejects.toMatchObject({ code: 'HERA_TOOL_NOT_ALLOWED' })
  })

  it('maps a required context selection to a bounded HeRa denial', async () => {
    const dispatchWorkforceTool = vi.fn().mockRejectedValue(new WorkforceToolDispatchError('CONTEXT_SELECTION_REQUIRED'))
    const name = workforceToolHeRaName('employee.talent.development-plans.read')

    await expect(dispatchHeRaTool(context, { name, args: {} }, { dispatchWorkforceTool }))
      .rejects.toMatchObject({ code: 'HERA_TOOL_NOT_ALLOWED' })
  })

  it.each([
    { role: 'DIRECT_MANAGER', audience: 'manager' },
    { role: 'HR_ADMIN', audience: 'HR' },
  ])('denies $audience from an employee Workforce function through HeRa', async ({ role }) => {
    authState.context.activeRoles = [role]
    authState.context.permissions = role === 'DIRECT_MANAGER' ? ['talent-team:read'] : ['talent:manage']
    const name = workforceToolHeRaName('employee.talent.development-plans.read')

    await expect(dispatchHeRaTool(authState.context, { name, args: {} }))
      .rejects.toMatchObject({ code: 'HERA_TOOL_NOT_ALLOWED' })
    expect(listTalentGoals).not.toHaveBeenCalled()
  })

  it('maps disabled modules and invalid tool results to bounded HeRa denials', async () => {
    authState.context.activeRoles = ['HR_MANAGER']
    authState.context.permissions = ['talent-team:read', 'talent:manage']
    requireTenantModule.mockRejectedValueOnce(new ModuleError('MODULE_NOT_ACTIVE', 404))
    const name = workforceToolHeRaName('hr.talent.tenant-capability-matrix.read')

    await expect(dispatchHeRaTool(authState.context, { name, args: {} }))
      .rejects.toMatchObject({ code: 'HERA_TOOL_NOT_ALLOWED' })

    const dispatchWorkforceTool = vi.fn().mockRejectedValue(new WorkforceToolDispatchError('RESULT_INVALID'))
    await expect(dispatchHeRaTool(authState.context, { name, args: {} }, { dispatchWorkforceTool }))
      .rejects.toMatchObject({ code: 'HERA_TOOL_NOT_ALLOWED' })

    const missingResourceDispatch = vi.fn().mockRejectedValue(new WorkforceToolDispatchError('RESOURCE_NOT_FOUND'))
    await expect(dispatchHeRaTool(authState.context, { name, args: {} }, { dispatchWorkforceTool: missingResourceDispatch }))
      .rejects.toMatchObject({ code: 'HERA_TOOL_NOT_ALLOWED' })
  })
})
