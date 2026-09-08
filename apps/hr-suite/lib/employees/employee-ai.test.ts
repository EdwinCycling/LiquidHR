import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/employment/employment-service', () => ({ getEmployeeEmploymentDetail: vi.fn() }))
vi.mock('@/lib/talent/goal-service', () => ({ listTalentGoals: vi.fn() }))
vi.mock('./employee-activity-service', () => ({ listEmployeeActivity: vi.fn() }))

import type { AuthContext } from '@/lib/auth/permissions'
import { CONVERSATION_PREPARATION_FEATURE, EMPLOYEE_SUMMARY_FEATURE } from '@/lib/ai/feature-registry'
import { getEmployeeEmploymentDetail } from '@/lib/employment/employment-service'
import { listTalentGoals } from '@/lib/talent/goal-service'
import { listEmployeeActivity } from './employee-activity-service'
import { createEmployeeAiContextLoader, createEmployeeAiInvocationInput } from './employee-ai'

describe('Employee AI Everywhere context', () => {
  const authContext = {
    tenantId: 'tenant-1',
    hrGroupId: 'group-1',
    administrationId: 'administration-1',
    userId: 'user-1',
    employeeId: 'manager-1',
    activeRoles: ['MANAGER'],
    permissions: ['employee-activity:read', 'talent-goal:read'],
  } as AuthContext

  it('includes authorized work context and excludes salary, absence, medical text and identifiers', async () => {
    vi.mocked(getEmployeeEmploymentDetail).mockResolvedValue({
      employee: { firstName: 'Ada', birthName: 'Lovelace' },
      status: 'ACTIVE',
      currentEmploymentSummary: { jobTitle: 'HR adviseur', departmentName: 'People', managerName: 'Grace Hopper', hoursPerWeek: 32, salary: 999_999 },
    } as never)
    vi.mocked(listTalentGoals).mockResolvedValue({ goals: [
      { title: 'Leiderschap ontwikkelen', description: 'Volg een training.', period_start: '2026-01-01', period_end: '2026-12-31', progress_percent: 25, status: 'ACTIVE' },
      { title: 'Ziekteverzuim bespreken', description: 'Medische diagnose', period_start: '2026-01-01', period_end: null, progress_percent: 0, status: 'ACTIVE' },
    ] } as never)
    vi.mocked(listEmployeeActivity).mockResolvedValue([
      { message: 'Plan opvolggesprek', createdAt: '2026-09-01T09:00:00.000Z' },
      { message: 'Bespreek medische diagnose', createdAt: '2026-09-02T09:00:00.000Z' },
    ] as never)

    const request = { locale: 'nl' as const }
    const loader = createEmployeeAiContextLoader(EMPLOYEE_SUMMARY_FEATURE, 'employee-1', request)
    const context = await loader.load({ authContext, businessObject: { type: 'employee-summary', id: 'employee-1' } })

    expect(context.fields).toEqual({
      employeeName: 'Ada Lovelace', employmentStatus: 'ACTIVE', role: 'HR adviseur', department: 'People', manager: 'Grace Hopper', hoursPerWeek: 32,
      goals: [{ title: 'Leiderschap ontwikkelen', description: 'Volg een training.', periodStart: '2026-01-01', periodEnd: '2026-12-31', progressPercent: 25, status: 'ACTIVE' }],
      openActions: [{ title: 'Leiderschap ontwikkelen', dueOn: '2026-12-31' }],
      recentActions: [{ message: 'Plan opvolggesprek', occurredAt: '2026-09-01T09:00:00.000Z' }],
    })
    expect(JSON.stringify(context.fields)).not.toContain('999999')
    expect(JSON.stringify(context.fields)).not.toMatch(/ziek|medisch|diagnos/i)
    expect(JSON.stringify(context.fields)).not.toContain('employee-1')
  })

  it('does not fabricate optional actions when the permission is absent and keeps the invocation target server-side', async () => {
    vi.mocked(getEmployeeEmploymentDetail).mockResolvedValue({ employee: { firstName: 'Ada', birthName: 'Lovelace' }, status: 'ACTIVE', currentEmploymentSummary: { jobTitle: null, departmentName: null, managerName: null, hoursPerWeek: null } } as never)
    vi.mocked(listTalentGoals).mockResolvedValue({ goals: [] } as never)
    const context = await createEmployeeAiContextLoader(CONVERSATION_PREPARATION_FEATURE, 'employee-1', { locale: 'en' }).load({ authContext: { ...authContext, permissions: [] }, businessObject: { type: 'employee-conversation-preparation', id: 'employee-1' } })

    expect(context.fields).toMatchObject({ role: null, department: null, manager: null, hoursPerWeek: null, goals: [], openActions: [], recentActions: [] })
    expect(listEmployeeActivity).not.toHaveBeenCalled()
    const invocation = createEmployeeAiInvocationInput(CONVERSATION_PREPARATION_FEATURE, 'employee-1', { locale: 'en' }, 'idempotency-1')
    expect(invocation.businessPermissionCode).toBe('employee:read')
    expect(invocation.businessPermissionTargetId).toBe('employee-1')
    expect(invocation.businessObject).toEqual({ type: 'employee-conversation-preparation', id: expect.not.stringContaining('employee-1') })
  })
})
