import { describe, expect, it } from 'vitest'
import { availableJourneyManagementActions, buildJourneyManagementOverview, isJourneyTerminal } from './management-overview'
import type { JourneyRuntimeDetail } from './runtime-service'

const detail: JourneyRuntimeDetail = {
  id: '11111111-1111-4111-8111-111111111111',
  templateName: { nl: 'Onboarding', en: 'Onboarding' },
  templateVersionNumber: 2,
  targetEmployeeId: '22222222-2222-4222-8222-222222222222',
  targetEmployeeName: 'Noah Hendriks',
  targetEmployeeNumber: 'DEMO-035',
  anchorDate: '2026-08-01',
  status: 'ACTIVE',
  version: 3,
  nextMomentOn: '2026-08-20',
  nextMomentName: { nl: 'Eerste week', en: 'First week' },
  overdueRequiredTopics: 1,
  progress: { completed: 1, total: 2 },
  participantNames: ['Noah Hendriks', 'Yara Meijer'],
  employmentId: null,
  phases: [{ id: '33333333-3333-4333-8333-333333333333', key: 'start', name: { nl: 'Start', en: 'Start' }, sortOrder: 1 }],
  participants: [
    { id: '44444444-4444-4444-8444-444444444444', roleKey: 'employee', roleName: { nl: 'Medewerker', en: 'Employee' }, employeeId: '22222222-2222-4222-8222-222222222222', employeeName: 'Noah Hendriks', source: 'TARGET_EMPLOYEE', status: 'ACTIVE', resolutionNote: null },
    { id: '55555555-5555-4555-8555-555555555555', roleKey: 'buddy', roleName: { nl: 'Buddy', en: 'Buddy' }, employeeId: '66666666-6666-4666-8666-666666666666', employeeName: 'Yara Meijer', source: 'MANUAL', status: 'ASSIGNED', resolutionNote: null },
  ],
  moments: [{ id: '77777777-7777-4777-8777-777777777777', phaseId: '33333333-3333-4333-8333-333333333333', key: 'welcome', name: { nl: 'Welkom', en: 'Welcome' }, scheduledOn: '2026-08-10', availableOn: '2026-08-03', sortOrder: 1 }],
  topics: [
    { id: '88888888-8888-4888-8888-888888888888', momentId: '77777777-7777-4777-8777-777777777777', key: 'intro', title: { nl: 'Kennismaken', en: 'Meet' }, body: { nl: 'Kennismaken', en: 'Meet' }, topicType: 'ACTION', isRequired: true, status: 'PENDING', actionUrl: null, ownerRoleKey: 'buddy', ownerNames: ['Yara Meijer'] },
    { id: '99999999-9999-4999-8999-999999999999', momentId: '77777777-7777-4777-8777-777777777777', key: 'info', title: { nl: 'Informatie', en: 'Information' }, body: { nl: 'Informatie', en: 'Information' }, topicType: 'INFORMATION', isRequired: false, status: 'COMPLETED', actionUrl: null, ownerRoleKey: 'employee', ownerNames: ['Noah Hendriks'] },
  ],
  changes: [],
}

describe('journey management overview', () => {
  it('derives progress, attention and grouped overdue topics from the runtime detail', () => {
    const overview = buildJourneyManagementOverview(detail, '2026-08-12')

    expect(overview.progress).toEqual({ completed: 1, total: 2, percent: 50 })
    expect(overview.attention).toBe('ATTENTION')
    expect(overview.activeParticipantCount).toBe(2)
    expect(overview.phases[0]?.moments[0]?.topics[0]?.overdue).toBe(true)
  })

  it('keeps lifecycle actions aligned with the existing legal transition contract', () => {
    expect(availableJourneyManagementActions('PLANNED')).toEqual(['PAUSE', 'COMPLETE', 'CANCEL'])
    expect(availableJourneyManagementActions('ACTIVE')).toEqual(['PAUSE', 'COMPLETE', 'CANCEL'])
    expect(availableJourneyManagementActions('PAUSED')).toEqual(['RESUME', 'CANCEL'])
    expect(availableJourneyManagementActions('COMPLETED')).toEqual([])
    expect(isJourneyTerminal('CANCELLED')).toBe(true)
  })
})
