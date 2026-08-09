import { describe, expect, it } from 'vitest'
import { AssignmentResolutionError, resolveAssignment, type AssignmentResolutionContext } from './assignment-resolver'
import type { ParticipantDefinition } from './definition-schemas'

const baseContext: AssignmentResolutionContext = {
  scope: { tenantId: 'tenant-a', hrGroupId: 'group-a', administrationId: 'admin-a' },
  subjectEmployeeId: 'subject',
  initiatorEmployeeId: 'initiator',
  processStartedAt: '2026-07-01T09:00:00Z',
  stepActivatedAt: '2026-07-14T09:00:00Z',
  businessEffectiveDate: '2026-08-01',
  fields: { 'target-department': 'department-b' },
  employees: [
    { employeeId: 'subject', userId: 'user-subject', tenantId: 'tenant-a', hrGroupId: 'group-a', administrationIds: ['admin-a'], isActive: true },
    { employeeId: 'initiator', userId: 'user-initiator', tenantId: 'tenant-a', hrGroupId: 'group-a', administrationIds: ['admin-a'], isActive: true },
    { employeeId: 'manager', userId: 'user-manager', tenantId: 'tenant-a', hrGroupId: 'group-a', administrationIds: ['admin-a'], isActive: true },
    { employeeId: 'manager-2', userId: 'user-manager-2', tenantId: 'tenant-a', hrGroupId: 'group-a', administrationIds: ['admin-a'], isActive: true },
    { employeeId: 'other-tenant', userId: 'user-other', tenantId: 'tenant-b', hrGroupId: 'group-b', administrationIds: ['admin-b'], isActive: true },
  ],
  placements: [
    { employeeId: 'subject', departmentId: 'department-a', directManagerId: 'manager', directManagerDeputyId: null, tenantId: 'tenant-a', hrGroupId: 'group-a', administrationId: 'admin-a', effectiveFrom: '2026-01-01', effectiveTo: null },
  ],
  departments: [
    { id: 'department-a', parentId: 'department-root', tenantId: 'tenant-a', hrGroupId: 'group-a', isActive: true },
    { id: 'department-root', parentId: null, tenantId: 'tenant-a', hrGroupId: 'group-a', isActive: true },
    { id: 'department-b', parentId: null, tenantId: 'tenant-a', hrGroupId: 'group-a', isActive: true },
  ],
  managementAssignments: [],
  queueCandidates: [],
  processOwnerCandidates: [],
  processVersionId: 'version-1',
  instanceVersion: 2,
}

const participant = (selector: ParticipantDefinition['selector'], assignmentMode: ParticipantDefinition['assignmentMode']): ParticipantDefinition => ({
  key: 'assignee',
  label: { nl: 'Toewijzer', en: 'Assignee' },
  selector,
  assignmentMode,
  permission: 'process-task:act',
})

describe('assignment resolver', () => {
  it('resolves the business effective date and direct manager with evidence', () => {
    const result = resolveAssignment(participant({ type: 'DIRECT_MANAGER_OF_SUBJECT', resolutionDatePolicy: 'BUSINESS_EFFECTIVE_DATE' }, 'EXACTLY_ONE'), baseContext)
    expect(result.selectedEmployeeId).toBe('manager')
    expect(result.evidence.asOfDate).toBe('2026-08-01')
    expect(result.evidence.source).toBe('direct')
    expect(result.evidence.scope).toEqual(baseContext.scope)
  })

  it('does not silently choose a first candidate for EXACTLY_ONE', () => {
    const context = { ...baseContext, queueCandidates: [
      { queueKey: 'hr', permission: 'process-task:act', employeeId: 'manager', source: 'queue' as const },
      { queueKey: 'hr', permission: 'process-task:act', employeeId: 'manager-2', source: 'queue' as const },
    ] }
    expect(() => resolveAssignment(participant({ type: 'PERMISSION_WORK_QUEUE', permission: 'process-task:act', queueKey: 'hr', resolutionDatePolicy: 'STEP_ACTIVATED_AT' }, 'EXACTLY_ONE'), context)).toThrowError(AssignmentResolutionError)
    try {
      resolveAssignment(participant({ type: 'PERMISSION_WORK_QUEUE', permission: 'process-task:act', queueKey: 'hr', resolutionDatePolicy: 'STEP_ACTIVATED_AT' }, 'EXACTLY_ONE'), context)
    } catch (error) {
      expect(error).toMatchObject({ code: 'AMBIGUOUS_ASSIGNEE' })
    }
  })

  it('returns a claimable pool for ANY_ONE and all candidates for ALL', () => {
    const context = { ...baseContext, queueCandidates: [
      { queueKey: 'hr', permission: 'process-task:act', employeeId: 'manager', source: 'queue' as const },
      { queueKey: 'hr', permission: 'process-task:act', employeeId: 'manager-2', source: 'queue' as const },
    ] }
    const queue = { type: 'PERMISSION_WORK_QUEUE' as const, permission: 'process-task:act', queueKey: 'hr', resolutionDatePolicy: 'STEP_ACTIVATED_AT' as const }
    expect(resolveAssignment(participant(queue, 'ANY_ONE'), context).selectedEmployeeId).toBeNull()
    expect(resolveAssignment(participant(queue, 'ALL'), context).candidates.map((candidate) => candidate.employeeId)).toEqual(['manager', 'manager-2'])
  })

  it('rejects out-of-scope candidates and inactive or unlinked users', () => {
    const context = { ...baseContext, queueCandidates: [
      { queueKey: 'hr', permission: 'process-task:act', employeeId: 'other-tenant', source: 'queue' as const },
    ] }
    expect(() => resolveAssignment(participant({ type: 'PERMISSION_WORK_QUEUE', permission: 'process-task:act', queueKey: 'hr', resolutionDatePolicy: 'STEP_ACTIVATED_AT' }, 'ANY_ONE'), context)).toThrowError(/CROSS_SCOPE_CANDIDATE/)
    const inactiveContext = { ...baseContext, employees: baseContext.employees.map((employee) => employee.employeeId === 'manager' ? { ...employee, isActive: false } : employee), queueCandidates: [{ queueKey: 'hr', permission: 'process-task:act', employeeId: 'manager', source: 'queue' as const }] }
    expect(() => resolveAssignment(participant({ type: 'PERMISSION_WORK_QUEUE', permission: 'process-task:act', queueKey: 'hr', resolutionDatePolicy: 'STEP_ACTIVATED_AT' }, 'ANY_ONE'), inactiveContext)).toThrowError(/INELIGIBLE_ASSIGNEE/)
  })

  it('blocks self-assignment and does not use a deputy when deputies are disabled', () => {
    const selfContext = { ...baseContext, actorEmployeeId: 'manager' }
    expect(() => resolveAssignment(participant({ type: 'DIRECT_MANAGER_OF_SUBJECT', resolutionDatePolicy: 'STEP_ACTIVATED_AT' }, 'EXACTLY_ONE'), selfContext)).toThrowError(/SELF_ASSIGNMENT_FORBIDDEN/)
    const subjectSelfContext = { ...baseContext, actorEmployeeId: 'subject' }
    expect(() => resolveAssignment(participant({ type: 'SUBJECT_EMPLOYEE', resolutionDatePolicy: 'STEP_ACTIVATED_AT' }, 'EXACTLY_ONE'), subjectSelfContext)).toThrowError(/SELF_ASSIGNMENT_FORBIDDEN/)
    const deputyContext = { ...baseContext, placements: [{ ...baseContext.placements[0], directManagerId: 'inactive-manager', directManagerDeputyId: 'manager' }], employees: [...baseContext.employees, { employeeId: 'inactive-manager', userId: 'user-inactive-manager', tenantId: 'tenant-a', hrGroupId: 'group-a', administrationIds: ['admin-a'], isActive: false }] }
    expect(() => resolveAssignment(participant({ type: 'DIRECT_MANAGER_OF_SUBJECT', resolutionDatePolicy: 'STEP_ACTIVATED_AT' }, 'EXACTLY_ONE'), deputyContext)).toThrowError(/INELIGIBLE_ASSIGNEE/)
  })

  it('uses a fixed date field for role resolution', () => {
    const context = { ...baseContext, fields: { ...baseContext.fields, effectiveDate: '2026-07-14' }, managementAssignments: [{ departmentId: 'department-root', roleCode: 'HR_MANAGER', employeeId: 'manager-2', effectiveFrom: '2026-01-01', effectiveTo: null, tenantId: 'tenant-a', hrGroupId: 'group-a', managementRoleId: 'role-hr' }] }
    const result = resolveAssignment(participant({ type: 'MANAGEMENT_ROLE_ON_SUBJECT_DEPARTMENT', roleCode: 'HR_MANAGER', resolutionDatePolicy: 'FIXED_DATE_FIELD', fixedDateFieldKey: 'effectiveDate' }, 'EXACTLY_ONE'), context)
    expect(result.selectedEmployeeId).toBe('manager-2')
    expect(result.evidence.asOfDate).toBe('2026-07-14')
  })
})
