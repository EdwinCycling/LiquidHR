import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  listTalentGoals, listMyTalentEmployeeCapabilityRecords, listTalentCurrentRoleProfileWorkspace,
  listMyTalentGoalCheckIns, getLeaveBalanceReport, getMyNextApprovedLeave, listMyLeaveRequests,
  listMyReminders,
} = vi.hoisted(() => ({
  listTalentGoals: vi.fn(),
  listMyTalentEmployeeCapabilityRecords: vi.fn(),
  listTalentCurrentRoleProfileWorkspace: vi.fn(),
  listMyTalentGoalCheckIns: vi.fn(),
  getLeaveBalanceReport: vi.fn(),
  getMyNextApprovedLeave: vi.fn(),
  listMyLeaveRequests: vi.fn(),
  listMyReminders: vi.fn(),
}))

vi.mock('@/lib/talent/goal-service', () => ({ listTalentGoals }))
vi.mock('@/lib/talent/employee-capability-service', () => ({ listMyTalentEmployeeCapabilityRecords }))
vi.mock('@/lib/talent/role-explorer-service', () => ({ listTalentCurrentRoleProfileWorkspace }))
vi.mock('@/lib/talent/check-in-service', () => ({ listMyTalentGoalCheckIns }))
vi.mock('@/lib/leave/leave-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/leave/leave-service')>()
  return { ...actual, getLeaveBalanceReport }
})
vi.mock('@/lib/leave/employee-self-service', () => ({ getMyNextApprovedLeave, listMyLeaveRequests }))
vi.mock('@/lib/reminders/reminder-service', () => ({ listMyReminders }))

import type { AuthContext } from '@/lib/auth/permissions'
import type { DelegatedWorkforceToolExecutionContext } from './contracts'
import {
  EMPLOYEE_WORKFORCE_TOOLS,
  employeeLeaveBalanceTool,
  employeeLeaveRequestsTool,
  employeeNextLeaveTool,
  employeeRemindersTool,
  employeeCompetenciesTool,
  employeeDevelopmentGapsTool,
  employeeDevelopmentPlansTool,
  employeeDevelopmentProgressTool,
  employeeGoalCheckInsTool,
  employeeSkillsTool,
} from './employee-tools'

const goalId = '00000000-0000-0000-0000-000000000001'
const capabilityId = '00000000-0000-0000-0000-000000000002'
const recordId = '00000000-0000-0000-0000-000000000003'
const requirementId = '00000000-0000-0000-0000-000000000004'

describe('employee workforce tool definitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listTalentGoals.mockResolvedValue({ goals: [], employees: [], capabilities: [] })
    listMyTalentEmployeeCapabilityRecords.mockResolvedValue([])
    listTalentCurrentRoleProfileWorkspace.mockResolvedValue({
      mode: 'self',
      asOf: '2026-10-04',
      profiles: [],
      employees: [],
      selectedEmployeeId: null,
      selectedProfileVersionId: null,
      comparison: null,
    })
    listMyTalentGoalCheckIns.mockResolvedValue([])
    getLeaveBalanceReport.mockResolvedValue({
      report: {
        asOfDate: '2026-10-09',
        employmentId: '00000000-0000-4000-8000-000000000008',
        leaveTypes: [{
          name: 'Vakantie',
          currentBalance: 96,
          entitlementMode: 'ACCRUAL',
          expirationBuckets: [{ expirationDate: '2027-01-01', remainingHours: 8, daysUntilExpiration: 84 }],
        }],
      },
      sourceTruncated: false,
    })
    getMyNextApprovedLeave.mockResolvedValue({ asOfDate: '2026-10-09', nextLeave: null })
    listMyLeaveRequests.mockResolvedValue({ asOfDate: '2026-10-09', requests: [], sourceTruncated: false })
    listMyReminders.mockResolvedValue([])
  })

  it('registers only read-only, self-bound tools with strict scope-free inputs', () => {
    expect(EMPLOYEE_WORKFORCE_TOOLS.map((tool) => tool.id)).toEqual([
      'employee.talent.development-plans.read',
      'employee.talent.development-progress.read',
      'employee.talent.skills.read',
      'employee.talent.competencies.read',
      'employee.talent.development-gaps.read',
      'employee.talent.goal-check-ins.read',
      'employee.leave.balance.read',
      'employee.leave.next.read',
      'employee.leave.requests.read',
      'employee.reminders.read',
    ])

    for (const tool of EMPLOYEE_WORKFORCE_TOOLS) {
      expect(tool.scope).toBe('SELF')
      expect(tool.operation).toBe('READ')
      expect(tool.audience).toEqual(['EMPLOYEE'])
      expect(tool.module).toBe(tool.id.startsWith('employee.leave.') ? 'HERA' : tool.id === 'employee.reminders.read' ? 'REMINDERS' : 'TALENT')
      expect(tool.inputSchema.safeParse({ employeeId: 'attacker-selected' }).success).toBe(false)
      expect(tool.inputSchema.safeParse({ tenantId: 'attacker-selected' }).success).toBe(false)
      expect(tool.inputSchema.safeParse({ hrGroupId: 'attacker-selected' }).success).toBe(false)
      expect(tool.inputSchema.safeParse({ administrationId: 'attacker-selected' }).success).toBe(false)
      expect(tool.inputSchema.safeParse({ actor: 'attacker-selected' }).success).toBe(false)
    }

    const balanceTool = EMPLOYEE_WORKFORCE_TOOLS.find((tool) => tool.id === 'employee.leave.balance.read')
    expect(balanceTool?.inputSchema.safeParse({}).success).toBe(true)
    expect(balanceTool?.inputSchema.safeParse({ employmentId: '00000000-0000-0000-0000-000000000001' }).success).toBe(true)
    expect(balanceTool?.inputSchema.safeParse({ employmentId: 'not-a-uuid' }).success).toBe(false)
    expect(employeeGoalCheckInsTool.inputSchema.safeParse({ goalId, employeeId: 'attacker-selected' }).success).toBe(false)
  })

  it('uses the bearer RLS client and server-derived Employee context for all new ESS reads', async () => {
    const authContext: AuthContext = {
      tenantId: '10000000-0000-4000-8000-000000000001',
      hrGroupId: '10000000-0000-4000-8000-000000000002',
      administrationId: '10000000-0000-4000-8000-000000000003',
      userId: '10000000-0000-4000-8000-000000000004',
      employeeId: '10000000-0000-4000-8000-000000000005',
      activeRoles: ['EMPLOYEE'],
      permissions: ['self:leave:read', 'self:reminder:read'],
    }
    const bearerClient = {} as unknown as DelegatedWorkforceToolExecutionContext['rls']['client']
    const execution = {
      authContext,
      rls: { kind: 'supabase-bearer', client: bearerClient, userId: authContext.userId, identity: { issuer: 'test', subject: authContext.userId } },
    } as unknown as DelegatedWorkforceToolExecutionContext

    await expect(employeeLeaveBalanceTool.execute({}, execution)).resolves.toMatchObject({
      selectionRequired: false,
      asOf: '2026-10-09',
      balances: [{ leaveType: 'Vakantie', availableHours: 96, unit: 'hours', expiring: [{ expiresOn: '2027-01-01', remainingHours: 8 }] }],
    })
    await expect(employeeNextLeaveTool.execute({}, execution)).resolves.toMatchObject({ asOf: '2026-10-09', nextLeave: null })
    await expect(employeeLeaveRequestsTool.execute({}, execution)).resolves.toMatchObject({ asOf: '2026-10-09', requests: [] })
    await expect(employeeRemindersTool.execute({}, execution)).resolves.toMatchObject({ timeZone: 'Europe/Amsterdam', reminders: [] })

    expect(getLeaveBalanceReport).toHaveBeenCalledWith({}, { context: authContext, supabase: bearerClient })
    expect(getMyNextApprovedLeave).toHaveBeenCalledWith({ context: authContext, supabase: bearerClient })
    expect(listMyLeaveRequests).toHaveBeenCalledWith({ context: authContext, supabase: bearerClient })
    expect(listMyReminders).toHaveBeenCalledWith(100, { context: authContext, supabase: bearerClient })
  })

  it('keeps only own pending personal reminders and drops HR, completed, and cancelled records', async () => {
    const authContext: AuthContext = {
      tenantId: '10000000-0000-4000-8000-000000000001',
      hrGroupId: '10000000-0000-4000-8000-000000000002',
      administrationId: null,
      userId: '10000000-0000-4000-8000-000000000004',
      employeeId: '10000000-0000-4000-8000-000000000005',
      activeRoles: ['EMPLOYEE'],
      permissions: ['self:reminder:read'],
    }
    const bearerClient = {} as unknown as DelegatedWorkforceToolExecutionContext['rls']['client']
    const execution = {
      authContext,
      rls: { kind: 'supabase-bearer', client: bearerClient, userId: authContext.userId, identity: { issuer: 'test', subject: authContext.userId } },
    } as unknown as DelegatedWorkforceToolExecutionContext
    const base = {
      recipientId: 'recipient',
      employeeId: authContext.employeeId,
      employeeName: null,
      reminderId: 'reminder',
      title: 'POP bijwerken',
      description: null,
      remindAt: '2026-10-12T08:00:00.000Z',
      originalRemindAt: '2026-10-12T08:00:00.000Z',
      targetType: 'SELF',
      createdByUserId: authContext.userId,
    } as const
    listMyReminders.mockResolvedValueOnce([
      { ...base, type: 'PERSONAL', recipientStatus: 'PENDING', reminderStatus: 'PUBLISHED' },
      { ...base, type: 'HR', recipientStatus: 'PENDING', reminderStatus: 'PUBLISHED' },
      { ...base, type: 'PERSONAL', recipientStatus: 'COMPLETED', reminderStatus: 'PUBLISHED' },
      { ...base, type: 'PERSONAL', recipientStatus: 'PENDING', reminderStatus: 'CANCELLED' },
    ])

    const result = await employeeRemindersTool.execute({}, execution)
    expect(result.reminders).toHaveLength(1)
    expect(result.reminders[0]).toMatchObject({
      title: 'POP bijwerken',
      status: 'PENDING',
      isOverdue: false,
    })
    expect(JSON.stringify(result)).not.toContain('createdByUserId')
  })

  it('reads own development plans through the self goal service and strips descriptions and scope identifiers', async () => {
    listTalentGoals.mockResolvedValue({
      goals: [{
        id: goalId,
        tenant_id: 'tenant-secret',
        employee_id: 'employee-secret',
        capability_id: capabilityId,
        title: 'Leiderschap',
        description: 'Private development narrative',
        period_start: '2026-01-01',
        period_end: '2026-12-31',
        progress_percent: 45,
        status: 'ACTIVE',
        source_type: 'SELF_ENTERED',
        version: 2,
        completed_at: null,
        archived_at: null,
        employeeLabel: 'Employee secret',
        capabilityLabel: 'Leiderschap (LEADERSHIP)',
      }],
      employees: [],
      capabilities: [],
    })

    await expect(employeeDevelopmentPlansTool.execute({})).resolves.toEqual({
      plans: [{
        goalId,
        title: 'Leiderschap',
        capability: 'Leiderschap (LEADERSHIP)',
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        progressPercent: 45,
        status: 'ACTIVE',
        sourceType: 'SELF_ENTERED',
        completedAt: null,
        archivedAt: null,
      }],
    })
    const plans = await employeeDevelopmentPlansTool.execute({})
    await employeeGoalCheckInsTool.execute({ goalId: plans.plans[0].goalId })
    expect(listMyTalentGoalCheckIns).toHaveBeenCalledWith(goalId)
    expect(listTalentGoals).toHaveBeenCalledWith('self')
    expect(JSON.stringify(await employeeDevelopmentPlansTool.execute({}))).not.toContain('tenant-secret')
    expect(JSON.stringify(await employeeDevelopmentPlansTool.execute({}))).not.toContain('Private development narrative')
  })

  it('reads own development progress through the same self goal service', async () => {
    listTalentGoals.mockResolvedValue({
      goals: [{
        id: goalId,
        tenant_id: 'tenant-secret',
        employee_id: 'employee-secret',
        capability_id: null,
        title: 'Leerdoel',
        description: 'Do not return',
        period_start: '2026-01-01',
        period_end: null,
        progress_percent: 25,
        status: 'ACTIVE',
        source_type: 'MANAGER_ENTERED',
        version: 1,
        completed_at: null,
        archived_at: null,
        employeeLabel: null,
        capabilityLabel: null,
      }],
      employees: [],
      capabilities: [],
    })

    await expect(employeeDevelopmentProgressTool.execute({})).resolves.toEqual({
      plans: [{
        title: 'Leerdoel',
        periodStart: '2026-01-01',
        periodEnd: null,
        progressPercent: 25,
        status: 'ACTIVE',
      }],
    })
    expect(listTalentGoals).toHaveBeenCalledWith('self')
  })

  it('filters own skill records and omits employee and evidence identifiers', async () => {
    listMyTalentEmployeeCapabilityRecords.mockResolvedValue([
      {
        id: recordId,
        employeeId: 'employee-secret',
        employeeLabel: 'Employee secret',
        employeeNumber: 'E-1',
        capabilityId,
        capabilityCode: 'SKILL-1',
        capabilityName: 'Planning',
        capabilityType: 'SKILL',
        talentLevelId: null,
        talentLevelCode: 'L2',
        talentLevelName: 'Goed',
        languageLevel: null,
        languageIsNative: false,
        certificateStatus: null,
        certificateIssuingBody: null,
        certificateCode: null,
        certificateValidityMonths: null,
        certificateIsPermanent: false,
        certificateRenewalRequired: false,
        evidenceStatus: 'NOT_PROVIDED',
        qualificationResponsibleAssigned: false,
        sourceType: 'SELF_ENTERED',
        status: 'DRAFT',
        validFrom: '2026-01-01',
        validUntil: null,
        evidenceDocumentId: 'evidence-secret',
        version: 1,
        updatedAt: '2026-10-04T10:00:00.000Z',
      },
      {
        id: '00000000-0000-0000-0000-000000000005',
        employeeId: 'employee-secret',
        employeeLabel: 'Employee secret',
        employeeNumber: 'E-1',
        capabilityId,
        capabilityCode: 'COMP-1',
        capabilityName: 'Samenwerken',
        capabilityType: 'COMPETENCY',
        talentLevelId: null,
        talentLevelCode: null,
        talentLevelName: null,
        languageLevel: null,
        languageIsNative: false,
        certificateStatus: null,
        certificateIssuingBody: null,
        certificateCode: null,
        certificateValidityMonths: null,
        certificateIsPermanent: false,
        certificateRenewalRequired: false,
        evidenceStatus: null,
        qualificationResponsibleAssigned: false,
        sourceType: 'MANAGER_ENTERED',
        status: 'RELEASED',
        validFrom: '2026-01-01',
        validUntil: null,
        evidenceDocumentId: null,
        version: 1,
        updatedAt: '2026-10-04T10:00:00.000Z',
      },
    ])

    await expect(employeeSkillsTool.execute({})).resolves.toEqual({
      skills: [{
        code: 'SKILL-1',
        name: 'Planning',
        levelCode: 'L2',
        levelName: 'Goed',
        languageLevel: null,
        languageIsNative: false,
        certificateStatus: null,
        evidenceStatus: 'NOT_PROVIDED',
        sourceType: 'SELF_ENTERED',
        status: 'DRAFT',
        validFrom: '2026-01-01',
        validUntil: null,
        updatedAt: '2026-10-04T10:00:00.000Z',
      }],
    })
    expect(JSON.stringify(await employeeSkillsTool.execute({}))).not.toContain('employee-secret')
    expect(JSON.stringify(await employeeSkillsTool.execute({}))).not.toContain('evidence-secret')
  })

  it('filters own competency records separately from skills', async () => {
    listMyTalentEmployeeCapabilityRecords.mockResolvedValue([
      {
        id: recordId,
        employeeId: 'employee-secret',
        employeeLabel: 'Employee secret',
        employeeNumber: 'E-1',
        capabilityId,
        capabilityCode: 'COMP-1',
        capabilityName: 'Samenwerken',
        capabilityType: 'COMPETENCY',
        talentLevelId: null,
        talentLevelCode: 'L3',
        talentLevelName: 'Sterk',
        languageLevel: null,
        languageIsNative: false,
        certificateStatus: null,
        certificateIssuingBody: null,
        certificateCode: null,
        certificateValidityMonths: null,
        certificateIsPermanent: false,
        certificateRenewalRequired: false,
        evidenceStatus: null,
        qualificationResponsibleAssigned: false,
        sourceType: 'MANAGER_ENTERED',
        status: 'RELEASED',
        validFrom: '2026-01-01',
        validUntil: null,
        evidenceDocumentId: null,
        version: 1,
        updatedAt: '2026-10-04T10:00:00.000Z',
      },
    ])

    await expect(employeeCompetenciesTool.execute({})).resolves.toEqual({
      competencies: [{
        code: 'COMP-1',
        name: 'Samenwerken',
        levelCode: 'L3',
        levelName: 'Sterk',
        languageLevel: null,
        languageIsNative: false,
        certificateStatus: null,
        evidenceStatus: null,
        sourceType: 'MANAGER_ENTERED',
        status: 'RELEASED',
        validFrom: '2026-01-01',
        validUntil: null,
        updatedAt: '2026-10-04T10:00:00.000Z',
      }],
    })
  })

  it('projects non-matching role requirements as own development gaps', async () => {
    listTalentCurrentRoleProfileWorkspace.mockResolvedValue({
      mode: 'self',
      asOf: '2026-10-04',
      profiles: [],
      employees: [],
      selectedEmployeeId: 'employee-secret',
      selectedProfileVersionId: 'profile-secret',
      comparison: {
        employee: {
          employeeId: 'employee-secret',
          employeeNumber: 'E-1',
          employeeLabel: 'Employee secret',
          jobId: null,
          jobTitle: null,
          currentJobCode: 'JOB-1',
          currentProfileVersionId: 'profile-secret',
          currentProfileVersion: 1,
        },
        profile: {
          profileVersionId: 'profile-secret',
          jobId: 'job-secret',
          jobCode: 'JOB-1',
          jobGroupName: null,
          profileVersion: 1,
          validFrom: '2026-01-01',
          validUntil: null,
        },
        axes: [
          {
            requirementId,
            capabilityId,
            capabilityCode: 'COMP-1',
            capabilityName: 'Samenwerken',
            capabilityType: 'COMPETENCY',
            requirementType: 'REQUIRED',
            targetLevelCode: 'L4',
            targetLevelRank: 4,
            targetLanguageLevel: null,
            currentLevelCode: 'L2',
            currentLevelRank: 2,
            currentLanguageLevel: null,
            status: 'GAP',
            sourceType: 'RELEASED',
            validFrom: '2026-01-01',
            validUntil: null,
            sourceRecordId: 'record-secret',
            rationale: 'Private rationale',
          },
          {
            requirementId: '00000000-0000-0000-0000-000000000006',
            capabilityId,
            capabilityCode: 'SKILL-1',
            capabilityName: 'Planning',
            capabilityType: 'SKILL',
            requirementType: 'OPTIONAL',
            targetLevelCode: 'L2',
            targetLevelRank: 2,
            targetLanguageLevel: null,
            currentLevelCode: 'L2',
            currentLevelRank: 2,
            currentLanguageLevel: null,
            status: 'MATCH',
            sourceType: 'RELEASED',
            validFrom: '2026-01-01',
            validUntil: null,
            sourceRecordId: 'record-secret',
            rationale: null,
          },
        ],
      },
    })

    await expect(employeeDevelopmentGapsTool.execute({})).resolves.toEqual({
      asOf: '2026-10-04',
      gaps: [{
        code: 'COMP-1',
        name: 'Samenwerken',
        capabilityType: 'COMPETENCY',
        requirementType: 'REQUIRED',
        targetLevelCode: 'L4',
        targetLevelRank: 4,
        targetLanguageLevel: null,
        currentLevelCode: 'L2',
        currentLevelRank: 2,
        currentLanguageLevel: null,
        status: 'GAP',
        validFrom: '2026-01-01',
        validUntil: null,
      }],
    })
    expect(listTalentCurrentRoleProfileWorkspace).toHaveBeenCalledOnce()
    expect(JSON.stringify(await employeeDevelopmentGapsTool.execute({}))).not.toContain('employee-secret')
    expect(JSON.stringify(await employeeDevelopmentGapsTool.execute({}))).not.toContain('Private rationale')
    expect(JSON.stringify(await employeeDevelopmentGapsTool.execute({}))).not.toContain('record-secret')
  })

  it('reads only self-bound check-in metadata and excludes private bodies', async () => {
    listMyTalentGoalCheckIns.mockResolvedValue([{
      id: '00000000-0000-0000-0000-000000000007',
      goal_id: goalId,
      employee_id: 'employee-secret',
      entry_type: 'EMPLOYEE_REFLECTION',
      body: 'Private reflection',
      follow_up_title: 'Bespreek voortgang',
      follow_up_due_on: '2026-10-20',
      status: 'OPEN',
      version: 1,
      created_at: '2026-10-04T10:00:00.000Z',
      completed_at: null,
    }])

    await expect(employeeGoalCheckInsTool.execute({ goalId })).resolves.toEqual({
      checkIns: [{
        goalId,
        entryType: 'EMPLOYEE_REFLECTION',
        followUpDueOn: '2026-10-20',
        status: 'OPEN',
        createdAt: '2026-10-04T10:00:00.000Z',
        completedAt: null,
      }],
    })
    expect(listMyTalentGoalCheckIns).toHaveBeenCalledWith(goalId)
    expect(JSON.stringify(await employeeGoalCheckInsTool.execute({ goalId }))).not.toContain('employee-secret')
    expect(JSON.stringify(await employeeGoalCheckInsTool.execute({ goalId }))).not.toContain('Private reflection')
    expect(JSON.stringify(await employeeGoalCheckInsTool.execute({ goalId }))).not.toContain('Bespreek voortgang')
  })
})
