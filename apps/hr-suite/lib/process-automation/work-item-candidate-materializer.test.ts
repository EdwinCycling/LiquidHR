import { describe, expect, it } from 'vitest'
import { resolveAssignment, type AssignmentResolutionContext } from './assignment-resolver'
import { materializeWorkItemCandidates } from './work-item-candidate-materializer'

const context: AssignmentResolutionContext = {
  scope: { tenantId: 'tenant-a', hrGroupId: 'group-a', administrationId: 'admin-a' },
  subjectEmployeeId: 'subject',
  initiatorEmployeeId: 'initiator',
  processStartedAt: '2026-07-01T09:00:00Z',
  stepActivatedAt: '2026-07-14T09:00:00Z',
  businessEffectiveDate: '2026-08-01',
  fields: {},
  employees: [
    { employeeId: 'manager', userId: 'user-manager', tenantId: 'tenant-a', hrGroupId: 'group-a', administrationIds: ['admin-a'], isActive: true },
  ],
  placements: [],
  departments: [],
  managementAssignments: [],
  queueCandidates: [{ queueKey: 'hr', permission: 'process-task:act', employeeId: 'manager', source: 'queue' }],
  processOwnerCandidates: [],
  processVersionId: 'version-1',
  instanceVersion: 4,
}

describe('work-item candidate materializer', () => {
  it('keeps the resolver evidence and revision on every persisted candidate', () => {
    const resolution = resolveAssignment({
      key: 'assignee',
      label: { nl: 'Toewijzer', en: 'Assignee' },
      selector: { type: 'PERMISSION_WORK_QUEUE', permission: 'process-task:act', queueKey: 'hr', resolutionDatePolicy: 'STEP_ACTIVATED_AT' },
      assignmentMode: 'ANY_ONE',
      permission: 'process-task:act',
    }, context)

    const rows = materializeWorkItemCandidates('work-item-1', resolution, 3)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      workItemId: 'work-item-1',
      employeeId: 'manager',
      candidateUserId: 'user-manager',
      resolutionRevision: 3,
      resolutionDate: '2026-07-14',
      resolutionSource: 'queue',
      isEligible: true,
      ineligibleReason: null,
    })
    expect(rows[0]?.evidence.resolution.processVersionId).toBe('version-1')
    expect(rows[0]?.evidence.resolution.instanceVersion).toBe(4)
  })
})
