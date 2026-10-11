import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireAuthContext: vi.fn(),
  listFocusManagerTeamOverviewForContext: vi.fn(),
  listFocusManagerUpcomingApprovedVacationForContext: vi.fn(),
  listDirectTeamEmployeeScope: vi.fn(),
  listProcessWork: vi.fn(),
  listManagerTeamFollowUps: vi.fn(),
  listManagerTeamDevelopmentPlans: vi.fn(),
  listManagerTalentTeamMatrix: vi.fn(),
  listTalentTeamMatrix: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ requireAuthContext: mocks.requireAuthContext }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/focus/manager-home-service', () => ({
  listFocusManagerTeamOverviewForContext: mocks.listFocusManagerTeamOverviewForContext,
  listFocusManagerUpcomingApprovedVacationForContext: mocks.listFocusManagerUpcomingApprovedVacationForContext,
}))
vi.mock('@/lib/organization/team-scope', () => ({ listDirectTeamEmployeeScope: mocks.listDirectTeamEmployeeScope }))
vi.mock('@/lib/process-automation/work-service', () => ({ listProcessWork: mocks.listProcessWork }))
vi.mock('@/lib/talent/check-in-service', () => ({ listManagerTeamFollowUps: mocks.listManagerTeamFollowUps }))
vi.mock('@/lib/talent/goal-service', () => ({ listManagerTeamDevelopmentPlans: mocks.listManagerTeamDevelopmentPlans }))
vi.mock('@/lib/talent/team-service', () => ({
  listManagerTalentTeamMatrix: mocks.listManagerTalentTeamMatrix,
  listTalentTeamMatrix: mocks.listTalentTeamMatrix,
}))

import {
  HR_WORKFORCE_TOOLS,
  MANAGER_WORKFORCE_TOOLS,
  hrTenantCapabilityMatrixTool,
  managerTeamCapabilityMatrixTool,
  managerPendingWorkTool,
  managerDevelopmentPlansTool,
  managerFollowUpsTool,
} from './manager-tools'
import type { DelegatedWorkforceToolExecutionContext } from './contracts'

const context = {
  tenantId: 'tenant-1',
  hrGroupId: 'group-1',
  administrationId: 'admin-1',
  userId: 'manager-user',
  employeeId: 'manager-employee',
  activeRoles: ['DIRECT_MANAGER'],
  permissions: ['talent-team:read', 'process-task:read'],
}
const client = { marker: 'delegated-rls-client' }
const capabilityId = '00000000-0000-0000-0000-000000000001'
const recordId = '00000000-0000-0000-0000-000000000002'

function matrixFixture() {
  return {
    rows: [{
      employeeId: 'employee-secret',
      employeeNumber: 'E-001',
      employeeLabel: 'Eva Jansen',
      jobTitle: 'Planner',
      departmentId: 'department-secret',
      capabilities: [{
        id: recordId,
        capability_id: capabilityId,
        status: 'RELEASED',
        source_type: 'MANAGER_ENTERED',
        valid_from: '2026-01-01',
        valid_until: null,
        certificate_status: 'VERIFIED',
        evidence_status: 'VERIFIED',
        certificate_code: 'CERTIFICATE-SECRET',
        capabilityName: 'Planning',
        capabilityCode: 'PLAN-001',
        capabilityType: 'SKILL',
      }],
    }],
    sourceTruncated: false,
    scopeCount: 1,
    scopeType: 'TEAM',
    aggregatePolicy: 'DISABLED',
    aggregateMinimumGroupSize: 5,
    aggregateDisabled: true,
  }
}

function processItem(overrides: Record<string, unknown> = {}) {
  return {
    workItemId: 'work-item-secret',
    processInstanceId: 'process-secret',
    stepInstanceId: 'step-secret',
    processDefinitionId: 'definition-secret',
    processKey: 'leave-process',
    processTitle: 'Verlofaanvraag',
    subjectEmployeeId: 'employee-1',
    subjectEmploymentId: 'employment-secret',
    subjectName: 'Eva Jansen',
    stepKey: 'manager-approval',
    stepTitle: 'Managerbeoordeling',
    participantKey: 'manager',
    assignmentMode: 'EXACTLY_ONE',
    receivedVia: 'DIRECT',
    assignmentExplanation: { source: 'direct' },
    status: 'OPEN',
    instanceStatus: 'RUNNING',
    currentStepKey: 'manager-approval',
    instanceVersion: 1,
    expectedVersion: 1,
    claimedByUserId: null,
    assigneeEmployeeId: 'manager-employee',
    claimedAt: null,
    availableAt: '2026-10-10T00:00:00.000Z',
    deadlineAt: '2026-10-12T00:00:00.000Z',
    createdAt: '2026-10-10T00:00:00.000Z',
    updatedAt: '2026-10-10T00:00:00.000Z',
    canAct: true,
    canClaim: true,
    isOverdue: false,
    businessType: 'LEAVE',
    businessCategory: 'LEAVE_REQUEST',
    businessStatus: 'OPEN',
    leaveRequestId: 'leave-request-secret',
    ...overrides,
  }
}

describe('manager workforce tool definitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createClient.mockResolvedValue(client)
    mocks.requireAuthContext.mockResolvedValue(context)
    mocks.listFocusManagerTeamOverviewForContext.mockResolvedValue({
      members: [{ employeeId: 'employee-1', employeeName: 'Eva Jansen' }],
      total: 1,
      sourceTruncated: false,
    })
    mocks.listFocusManagerUpcomingApprovedVacationForContext.mockResolvedValue({
      windowStart: '2026-10-11',
      windowEnd: '2027-01-08',
      events: [{ employeeId: 'employee-1', employeeName: 'Eva Jansen', startDate: '2026-11-01', endDate: '2026-11-05' }],
      sourceTruncated: false,
    })
    mocks.listDirectTeamEmployeeScope.mockResolvedValue({
      members: [{ employee_id: 'employee-1' }],
      employeeIds: ['employee-1'],
      sourceTruncated: false,
    })
    mocks.listProcessWork.mockResolvedValue({ items: [], total: 0, hasMore: false })
    mocks.listManagerTeamFollowUps.mockResolvedValue({ followUps: [], sourceTruncated: false })
    mocks.listManagerTeamDevelopmentPlans.mockResolvedValue({ plans: [], sourceTruncated: false })
    mocks.listManagerTalentTeamMatrix.mockResolvedValue(matrixFixture())
    mocks.listTalentTeamMatrix.mockResolvedValue(matrixFixture())
  })

  it('publishes six read-only direct-manager tools with strict selector-free inputs', () => {
    expect(MANAGER_WORKFORCE_TOOLS.map((tool) => tool.id)).toEqual([
      'manager.team.overview.read',
      'manager.work.pending.read',
      'manager.leave.calendar.read',
      'manager.talent.development-plans.read',
      'manager.talent.follow-ups.read',
      'manager.talent.team-capability-matrix.read',
    ])

    for (const tool of MANAGER_WORKFORCE_TOOLS) {
      expect(tool.scope).toBe('MANAGER_SCOPE')
      expect(tool.operation).toBe('READ')
      expect(tool.audience).toEqual(['MANAGER'])
      expect(tool.delegatedHandler).toBeTypeOf('function')
      expect(tool.inputSchema.safeParse({ employeeId: 'attacker-selected' }).success).toBe(false)
      expect(tool.inputSchema.safeParse({ tenantId: 'attacker-selected' }).success).toBe(false)
      expect(tool.inputSchema.safeParse({ hrGroupId: 'attacker-selected' }).success).toBe(false)
      expect(tool.inputSchema.safeParse({ administrationId: 'attacker-selected' }).success).toBe(false)
      expect(tool.inputSchema.safeParse({ teamId: 'attacker-selected' }).success).toBe(false)
    }

    expect(managerTeamCapabilityMatrixTool.module).toBe('TALENT')
    expect(managerPendingWorkTool.module).toBe('HERA')
  })

  it('projects only names from the manager direct-team overview and caps the page', async () => {
    mocks.listFocusManagerTeamOverviewForContext.mockResolvedValue({
      members: Array.from({ length: 30 }, (_, index) => ({ employeeId: `secret-${index}`, employeeName: `Employee ${index}` })),
      total: 30,
      sourceTruncated: false,
    })
    const delegated = { authContext: context, rls: { client, userId: context.userId } } as unknown as DelegatedWorkforceToolExecutionContext

    await expect(MANAGER_WORKFORCE_TOOLS[0].execute({ limit: 10, offset: 5 }, delegated)).resolves.toEqual({
      members: Array.from({ length: 10 }, (_, index) => ({ employeeName: `Employee ${index + 5}` })),
      total: 30,
      hasMore: true,
      nextOffset: 15,
      sourceTruncated: true,
    })
    expect(mocks.listFocusManagerTeamOverviewForContext).toHaveBeenCalledWith(context, client)
    expect(JSON.stringify(await MANAGER_WORKFORCE_TOOLS[0].execute({ limit: 1 }))).not.toContain('secret-')
  })

  it('filters pending work to direct-team employees and safe actionable categories', async () => {
    mocks.listProcessWork
      .mockResolvedValueOnce({
        items: [
        processItem(),
        processItem({ subjectEmployeeId: 'other-team-employee' }),
        processItem({ businessCategory: 'INTERNAL_TRANSFER' }),
        processItem({ businessType: 'P_MUTATION', businessCategory: 'GENERAL' }),
        processItem({ status: 'WAITING' }),
        processItem({ canAct: false }),
        ],
        total: 6,
        hasMore: false,
      })
      .mockResolvedValue({ items: [], total: 0, hasMore: false })
    const delegated = { authContext: context, rls: { client, userId: context.userId } } as unknown as DelegatedWorkforceToolExecutionContext

    const result = await managerPendingWorkTool.execute({ limit: 5 }, delegated)
    expect(result).toEqual({
      items: [{
        category: 'LEAVE_REQUEST',
        processTitle: 'Verlofaanvraag',
        stepTitle: 'Managerbeoordeling',
        employeeName: 'Eva Jansen',
        deadlineAt: '2026-10-12T00:00:00.000Z',
        overdue: false,
      }],
      total: 1,
      hasMore: false,
      nextOffset: null,
      sourceTruncated: false,
    })
    expect(mocks.listProcessWork).toHaveBeenCalledTimes(3)
    for (const call of mocks.listProcessWork.mock.calls) {
      expect(call[0]).toMatchObject({ administrationId: 'admin-1', tab: 'TODO', limit: 200, offset: 0 })
      expect(call[1]).toEqual({ context, supabase: client })
    }
    const serialized = JSON.stringify(result)
    for (const secret of ['work-item-secret', 'leave-request-secret', 'employment-secret', 'definition-secret']) {
      expect(serialized).not.toContain(secret)
    }
  })

  it('projects approved vacation without medical absence or request identifiers', async () => {
    const result = await MANAGER_WORKFORCE_TOOLS[2].execute({ limit: 10 })
    expect(result).toEqual({
      windowStart: '2026-10-11',
      windowEnd: '2027-01-08',
      events: [{ employeeName: 'Eva Jansen', startDate: '2026-11-01', endDate: '2026-11-05' }],
      total: 1,
      sourceTruncated: false,
    })
    expect(mocks.listFocusManagerUpcomingApprovedVacationForContext).toHaveBeenCalledWith(context, expect.any(String), client)
  })

  it('passes Manager development and follow-up reads through the bearer-bound domain services', async () => {
    mocks.listManagerTeamDevelopmentPlans.mockResolvedValue({
      plans: [{
        employeeName: 'Eva Jansen',
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        progressPercent: 40,
        status: 'ACTIVE',
        completedAt: null,
      }],
      sourceTruncated: false,
    })
    mocks.listManagerTeamFollowUps.mockResolvedValue({
      followUps: [{ employeeName: 'Eva Jansen', dueOn: '2026-11-01' }],
      sourceTruncated: false,
    })
    const delegated = { authContext: context, rls: { client, userId: context.userId } } as unknown as DelegatedWorkforceToolExecutionContext

    await expect(managerDevelopmentPlansTool.execute({ limit: 10 }, delegated)).resolves.toMatchObject({ total: 1 })
    await expect(managerFollowUpsTool.execute({ limit: 10 }, delegated)).resolves.toMatchObject({ total: 1 })
    expect(mocks.listManagerTeamDevelopmentPlans).toHaveBeenCalledWith({ authContext: context, rls: delegated.rls })
    expect(mocks.listManagerTeamFollowUps).toHaveBeenCalledWith({ authContext: context, rls: delegated.rls })
    expect(mocks.requireAuthContext).not.toHaveBeenCalled()
  })

  it('uses the direct-team matrix service and strips employee, record, and certificate identifiers', async () => {
    const input = { q: 'Eva', type: 'SKILL' as const, status: 'RELEASED' as const, source: 'MANAGER_ENTERED' as const }

    const result = await managerTeamCapabilityMatrixTool.execute(input)
    expect(mocks.listManagerTalentTeamMatrix).toHaveBeenCalledWith(input)
    expect(result).toEqual({
      rows: [{
        employeeLabel: 'Eva Jansen',
        capabilitiesTruncated: false,
        capabilities: [{
          code: 'PLAN-001',
          name: 'Planning',
          type: 'SKILL',
          status: 'RELEASED',
          sourceType: 'MANAGER_ENTERED',
          validFrom: '2026-01-01',
          validUntil: null,
        }],
      }],
      hasMore: false,
      nextOffset: null,
      sourceTruncated: false,
    })
    const serialized = JSON.stringify(result)
    for (const secret of ['employee-secret', 'E-001', 'department-secret', 'CERTIFICATE-SECRET', recordId, capabilityId]) {
      expect(serialized).not.toContain(secret)
    }
  })

  it('passes the bound delegated RLS client into the direct-team matrix service', async () => {
    const delegated = { authContext: context, rls: { client, userId: context.userId } } as unknown as DelegatedWorkforceToolExecutionContext
    await managerTeamCapabilityMatrixTool.execute({}, delegated)
    expect(mocks.listManagerTalentTeamMatrix).toHaveBeenCalledWith({}, { context, supabase: client })
  })

  it('preserves the existing HR-only tenant matrix tool and separate permission gate', async () => {
    expect(HR_WORKFORCE_TOOLS.map((tool) => tool.id)).toEqual(['hr.talent.tenant-capability-matrix.read'])
    expect(hrTenantCapabilityMatrixTool.scope).toBe('TENANT')
    expect(hrTenantCapabilityMatrixTool.audience).toEqual(['HR'])
    expect(hrTenantCapabilityMatrixTool.permission).toBe('talent-team:read')
    expect(hrTenantCapabilityMatrixTool.additionalPermissions).toEqual(['talent:manage'])
    await hrTenantCapabilityMatrixTool.execute({})
    expect(mocks.listTalentTeamMatrix).toHaveBeenCalledWith({})
  })
})
