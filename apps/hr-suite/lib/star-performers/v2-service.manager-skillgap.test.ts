import { beforeEach, describe, expect, it, vi } from 'vitest'

type QueryRow = Record<string, unknown>
type QueryResult = { data: QueryRow[]; error: null }
type Filter = { kind: 'eq' | 'in' | 'is'; column: string; value: unknown }

const mocks = vi.hoisted(() => ({
  getRequestAuthorizationContext: vi.fn(),
  requirePermissionInContext: vi.fn(),
  listDirectTeamEmployeeIds: vi.fn(),
  listContinuousAppraisalItemsForEmployees: vi.fn(),
  listTalentGoals: vi.fn(),
  listTalentProfilesForWorkforce: vi.fn(),
  listTalentEmployeeCapabilityRecords: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  AuthorizationError: class AuthorizationError extends Error {
    readonly status = 403
  },
  getRequestAuthorizationContext: mocks.getRequestAuthorizationContext,
  requirePermissionInContext: mocks.requirePermissionInContext,
}))

vi.mock('@/lib/organization/team-scope', () => ({ listDirectTeamEmployeeIds: mocks.listDirectTeamEmployeeIds }))
vi.mock('@/lib/continuous-appraisal/service', () => ({ listContinuousAppraisalItemsForEmployees: mocks.listContinuousAppraisalItemsForEmployees }))
vi.mock('@/lib/talent/goal-service', () => ({ listTalentGoals: mocks.listTalentGoals }))
vi.mock('@/lib/talent/service', () => ({ listTalentProfilesForWorkforce: mocks.listTalentProfilesForWorkforce }))
vi.mock('@/lib/talent/employee-capability-service', () => ({ listTalentEmployeeCapabilityRecords: mocks.listTalentEmployeeCapabilityRecords }))

function createQuery(rowsByTable: Readonly<Record<string, readonly QueryRow[]>>, table: string) {
  const filters: Filter[] = []
  const resolve = (): QueryResult => ({
    data: (rowsByTable[table] ?? []).filter((row) => filters.every((filter) => {
      if (filter.kind === 'eq') return row[filter.column] === filter.value
      if (filter.kind === 'is') return filter.value === null ? row[filter.column] === null : row[filter.column] === filter.value
      return Array.isArray(filter.value) && filter.value.includes(row[filter.column])
    })) as QueryRow[],
    error: null,
  })

  const builder = {
    select: (columns: string) => {
      void columns
      return builder
    },
    eq: (column: string, value: unknown) => {
      filters.push({ kind: 'eq', column, value })
      return builder
    },
    in: (column: string, value: readonly unknown[]) => {
      filters.push({ kind: 'in', column, value })
      return builder
    },
    lte: (column: string, value: unknown) => {
      void column
      void value
      return builder
    },
    is: (column: string, value: unknown) => {
      filters.push({ kind: 'is', column, value })
      return builder
    },
    or: (expression: string) => {
      void expression
      return builder
    },
    order: (column: string, options?: unknown) => {
      void column
      void options
      return builder
    },
    limit: (count: number) => {
      void count
      return builder
    },
    then: (onfulfilled: (value: QueryResult) => unknown) => Promise.resolve(resolve()).then(onfulfilled),
  }
  return builder
}

function createSupabase() {
  const rowsByTable: Readonly<Record<string, readonly QueryRow[]>> = {
    departments: [{ id: 'department-1', name: 'People', tenant_id: 'tenant-1', is_active: true }],
    jobs: [{ id: 'job-1', code: 'HR-ADVISOR', job_group_id: 'group-1', tenant_id: 'tenant-1', is_active: true }],
    job_groups: [{ id: 'group-1', name: 'Service', tenant_id: 'tenant-1', is_active: true }],
    job_revisions: [{ job_id: 'job-1', name: 'HR adviseur', valid_from: '2026-01-01', tenant_id: 'tenant-1' }],
    star_performer_tags: [],
    employees: [
      { id: 'employee-team', employee_number: 'TM001', first_name: 'Team', birth_name: 'Member', work_email: 'team@example.test', avatar_url: null, tenant_id: 'tenant-1', is_active: true, is_archived: false, deleted_at: null },
      { id: 'employee-outside', employee_number: 'OS001', first_name: 'Outside', birth_name: 'Member', work_email: 'outside@example.test', avatar_url: null, tenant_id: 'tenant-1', is_active: true, is_archived: false, deleted_at: null },
    ],
    employee_organizations: [
      { employee_id: 'employee-team', department_id: 'department-1', job_id: 'job-1', job_title: 'HR adviseur', effective_from: '2026-01-01', administration_id: 'administration-1' },
      { employee_id: 'employee-outside', department_id: 'department-1', job_id: 'job-1', job_title: 'HR adviseur', effective_from: '2026-01-01', administration_id: 'administration-1' },
    ],
    star_performer_assessments: [{ id: 'assessment-team', employee_id: 'employee-team', job_id: 'job-1', job_group_id: 'group-1', criticality_level: 4, updated_at: '2026-10-10T10:00:00.000Z', administration_id: 'administration-1' }],
    talent_review_campaigns: [{ id: 'campaign-1', name: '2026 H2', status: 'CLOSED', closed_at: '2026-10-10T10:00:00.000Z', starts_on: '2026-09-01', previous_campaign_id: null, tenant_id: 'tenant-1', administration_id: 'administration-1' }],
    talent_review_scores: [{ employee_id: 'employee-team', campaign_id: 'campaign-1', performance_score: 'HIGH', potential_score: 'HIGH', grid_cell: 'HIGH_HIGH', status: 'CLOSED', updated_at: '2026-10-10T10:00:00.000Z', tenant_id: 'tenant-1' }],
    talent_levels: [
      { id: 'level-basic', code: 'BASIC', sort_order: 1, tenant_id: 'tenant-1' },
      { id: 'level-advanced', code: 'ADVANCED', sort_order: 2, tenant_id: 'tenant-1' },
    ],
  }
  return { from: vi.fn((table: string) => createQuery(rowsByTable, table)) }
}

import { getStarPerformersInsights } from './v2-service'

describe('Star Performers Manager skillgap readpath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const supabase = createSupabase()
    mocks.getRequestAuthorizationContext.mockResolvedValue({
      context: {
        tenantId: 'tenant-1',
        administrationId: 'administration-1',
        userId: 'manager-user',
        employeeId: 'manager-1',
        activeRoles: ['DIRECT_MANAGER'],
        permissions: ['star-performer:manager-read'],
      },
      supabase,
    })
    mocks.requirePermissionInContext.mockResolvedValue(undefined)
    mocks.listDirectTeamEmployeeIds.mockResolvedValue(['employee-team'])
    mocks.listTalentGoals.mockResolvedValue({ goals: [], employees: [], capabilities: [] })
    mocks.listContinuousAppraisalItemsForEmployees.mockResolvedValue([])
    mocks.listTalentProfilesForWorkforce.mockResolvedValue([{
      profile: {
        job_id: 'job-1',
        job_profile_id: 'profile-1',
        profile_version_id: 'profile-version-1',
        job_code: 'HR-ADVISOR',
        job_group_name: 'Service',
        version_number: 2,
        valid_from: '2026-01-01',
        valid_until: null,
      },
      requirements: [{
        id: 'requirement-1',
        capability_id: 'capability-1',
        capability: { name: 'Gesprek voeren', capability_type: 'COMPETENCY' },
        target_level_id: 'level-advanced',
        targetLevel: { name: 'Gevorderd', code: 'ADVANCED' },
        language_level: null,
      }],
      employees: [],
    }])
    mocks.listTalentEmployeeCapabilityRecords.mockResolvedValue([
      {
        id: 'record-team', employeeId: 'employee-team', employeeLabel: 'Team Member', employeeNumber: 'TM001', capabilityId: 'capability-1', capabilityCode: 'CONVERSATION', capabilityName: 'Gesprek voeren', capabilityType: 'COMPETENCY', talentLevelId: 'level-basic', talentLevelCode: 'BASIC', talentLevelName: 'Basis', languageLevel: null, languageIsNative: false, certificateStatus: null, certificateIssuingBody: null, certificateCode: null, certificateValidityMonths: null, certificateIsPermanent: false, certificateRenewalRequired: false, evidenceStatus: 'VERIFIED', qualificationResponsibleAssigned: false, sourceType: 'MANUAL', status: 'RELEASED', validFrom: '2026-01-01', validUntil: null, evidenceDocumentId: null, version: 1, updatedAt: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 'record-outside', employeeId: 'employee-outside', employeeLabel: 'Outside Member', employeeNumber: 'OS001', capabilityId: 'capability-1', capabilityCode: 'CONVERSATION', capabilityName: 'Gesprek voeren', capabilityType: 'COMPETENCY', talentLevelId: 'level-advanced', talentLevelCode: 'ADVANCED', talentLevelName: 'Gevorderd', languageLevel: null, languageIsNative: false, certificateStatus: null, certificateIssuingBody: null, certificateCode: null, certificateValidityMonths: null, certificateIsPermanent: false, certificateRenewalRequired: false, evidenceStatus: 'VERIFIED', qualificationResponsibleAssigned: false, sourceType: 'MANUAL', status: 'RELEASED', validFrom: '2026-01-01', validUntil: null, evidenceDocumentId: null, version: 1, updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ])
  })

  it('uses the server-derived direct-team scope and computes an evidenced level gap', async () => {
    const report = await getStarPerformersInsights({
      perspective: 'top-talent', area: 'insights', insight: 'skill-gaps', q: '', status: 'all', appraisalStatus: 'all', page: 1, pageSize: 20,
    })

    expect(mocks.listDirectTeamEmployeeIds).toHaveBeenCalledWith(expect.objectContaining({ employeeId: 'manager-1' }), expect.anything())
    expect(mocks.requirePermissionInContext).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ employeeId: 'manager-1' }), 'star-performer:manager-read')
    expect(mocks.requirePermissionInContext).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ employeeId: 'manager-1' }), 'talent:manager-read')
    expect(report.population.employeesInScope).toBe(1)
    expect(report.skillGaps).toMatchObject({ state: 'ready', relevantEmployees: 1, assessedEmployees: 1 })
    expect(report.skillGaps.rows).toHaveLength(1)
    expect(report.skillGaps.rows[0]).toMatchObject({ capabilityName: 'Gesprek voeren', requiredLevelLabel: 'Gevorderd', coveragePercent: 0, statusCounts: { INSUFFICIENT_LEVEL: 1, MATCH: 0, NOT_ASSESSED: 0 } })
    expect(report.skillGaps.rows[0]?.employees.map((employee) => employee.employeeId)).toEqual(['employee-team'])
    expect(JSON.stringify(report.skillGaps)).not.toContain('employee-outside')
  })

  it('uses the same server-derived direct-team scope for POP and development actions', async () => {
    mocks.listTalentGoals.mockResolvedValue({
      goals: [
        { id: 'plan-team', employee_id: 'employee-team', title: 'Teamplan', status: 'ACTIVE', progress_percent: 45, period_start: '2026-01-01', period_end: '2026-12-31', completed_at: null },
        { id: 'plan-outside', employee_id: 'employee-outside', title: 'Buiten scope', status: 'ACTIVE', progress_percent: 99, period_start: '2026-01-01', period_end: null, completed_at: null },
      ],
      employees: [],
      capabilities: [],
    })
    mocks.listContinuousAppraisalItemsForEmployees.mockResolvedValue([
      { id: 'action-team', employee_id: 'employee-team', item_type: 'ACTION', title: 'Teamactie', item_status: 'OPEN', due_on: '2026-10-25', next_meeting_on: null },
      { id: 'action-outside', employee_id: 'employee-outside', item_type: 'ACTION', title: 'Buiten scope', item_status: 'OPEN', due_on: '2026-10-25', next_meeting_on: null },
    ])

    const report = await getStarPerformersInsights({
      perspective: 'top-talent', area: 'insights', insight: 'development', q: '', status: 'all', appraisalStatus: 'all', page: 1, pageSize: 20,
    })

    expect(mocks.listTalentGoals).toHaveBeenCalledWith('manager', {}, expect.anything())
    expect(mocks.listContinuousAppraisalItemsForEmployees).toHaveBeenCalledWith(['employee-team'])
    expect(report.development).toMatchObject({ state: 'ready', relevantEmployees: 1, activePlansCount: 1, employeesWithActivePlans: 1, coveragePercent: 100, openActionCount: 1 })
    expect(report.development.plans.map((plan) => plan.employeeId)).toEqual(['employee-team'])
    expect(report.development.actions.map((action) => action.employeeId)).toEqual(['employee-team'])
    expect(JSON.stringify(report.development)).not.toContain('employee-outside')
  })

  it('uses the same server-derived direct-team scope for Continuous Appraisal insights', async () => {
    mocks.listContinuousAppraisalItemsForEmployees.mockResolvedValue([
      { id: 'meeting-team', employee_id: 'employee-team', item_type: 'MEETING_SUMMARY', title: 'Teamgesprek', occurred_on: '2026-10-10', due_on: null, next_meeting_on: null, item_status: 'DONE' },
      { id: 'meeting-outside', employee_id: 'employee-outside', item_type: 'MEETING_SUMMARY', title: 'Buiten scope', occurred_on: '2026-10-10', due_on: null, next_meeting_on: null, item_status: 'DONE' },
    ])

    const report = await getStarPerformersInsights({
      perspective: 'top-talent', area: 'insights', insight: 'appraisal', q: '', status: 'all', appraisalStatus: 'all', page: 1, pageSize: 20,
    })

    expect(mocks.listContinuousAppraisalItemsForEmployees).toHaveBeenCalledWith(['employee-team'])
    expect(report.appraisal).toMatchObject({ state: 'ready', relevantEmployees: 1, registeredConversationEmployees: 1, conversationCoveragePercent: 100 })
    expect(report.appraisal.items.map((item) => item.employeeId)).toEqual(['employee-team'])
    expect(JSON.stringify(report.appraisal)).not.toContain('employee-outside')
  })
})
