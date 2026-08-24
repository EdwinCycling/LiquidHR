import { describe, expect, it } from 'vitest'
import {
  buildJourneyActivationPreview,
  deriveJourneyAttention,
  deriveJourneyProgress,
  validateJourneyActivation,
  type JourneyActivationTemplate,
} from './runtime-domain'

const template: JourneyActivationTemplate = {
  templateId: '10000000-0000-4000-8000-000000000001',
  templateVersionId: '10000000-0000-4000-8000-000000000002',
  templateVersionNumber: 3,
  name: { nl: 'Onboarding', en: 'Onboarding' },
  description: { nl: 'Test', en: 'Test' },
  journeyType: 'ONBOARDING',
  anchorRule: 'MANUAL_DATE',
  phases: [{ key: 'before', name: { nl: 'Vooraf', en: 'Before' }, sortOrder: 10 }],
  roles: [
    { key: 'employee', name: { nl: 'Medewerker', en: 'Employee' }, required: true, cardinality: 'ONE', resolverType: 'TARGET_EMPLOYEE', resolverRoleCode: null, resolverEmployeeId: null, sortOrder: 10 },
    { key: 'manager', name: { nl: 'Manager', en: 'Manager' }, required: true, cardinality: 'ONE', resolverType: 'DIRECT_MANAGER', resolverRoleCode: null, resolverEmployeeId: null, sortOrder: 20 },
    { key: 'buddy', name: { nl: 'Buddy', en: 'Buddy' }, required: false, cardinality: 'ONE', resolverType: 'MANUAL', resolverRoleCode: null, resolverEmployeeId: null, sortOrder: 30 },
  ],
  moments: [{ key: 'welcome', phaseKey: 'before', name: { nl: 'Welkom', en: 'Welcome' }, dateOffsetDays: -7, availabilityOffsetDays: -14, sortOrder: 10 }],
  topics: [{ key: 'intro', momentKey: 'welcome', ownerRoleKey: 'manager', topicType: 'INFORMATION', title: { nl: 'Kennismaken', en: 'Meet' }, body: { nl: 'Plan een gesprek.', en: 'Plan a meeting.' }, actionUrl: null, required: true, sortOrder: 10, audienceRoleKeys: ['employee', 'manager'] }],
}

describe('Journey runtime domain', () => {
  it('materialiseert een gepinde preview zonder de template te muteren', () => {
    const preview = buildJourneyActivationPreview({
      template,
      targetEmployeeId: '20000000-0000-4000-8000-000000000001',
      targetEmployeeName: 'Noah Hendriks',
      employmentId: null,
      anchorDate: '2026-09-01',
      resolutions: [
        { roleKey: 'employee', status: 'RESOLVED', employees: [{ employeeId: '20000000-0000-4000-8000-000000000001', name: 'Noah Hendriks', source: 'TARGET_EMPLOYEE' }] },
        { roleKey: 'manager', status: 'RESOLVED', employees: [{ employeeId: '20000000-0000-4000-8000-000000000002', name: 'Yara Meijer', source: 'DIRECT_MANAGER' }] },
        { roleKey: 'buddy', status: 'MISSING', blocking: false, employees: [] },
      ],
    })

    expect(preview.templateVersionNumber).toBe(3)
    expect(preview.participants[0]?.roleName).toEqual({ nl: 'Medewerker', en: 'Employee' })
    expect(preview.moments[0]).toMatchObject({ scheduledOn: '2026-08-25', availableOn: '2026-08-18' })
    expect(preview.blockingIssues).toEqual([])
    expect(preview.warnings).toEqual(['JOURNEY_OPTIONAL_PARTICIPANT_MISSING:buddy'])
    expect(template.moments[0]?.dateOffsetDays).toBe(-7)
  })

  it('blokkeert ontbrekende en ambigue vereiste rollen maar niet een optionele buddy', () => {
    const issues = validateJourneyActivation(template.roles, [
      { roleKey: 'employee', status: 'RESOLVED', employees: [{ employeeId: 'employee', name: 'Employee', source: 'TARGET_EMPLOYEE' }] },
      { roleKey: 'manager', status: 'AMBIGUOUS', employees: [], candidateEmployeeIds: ['manager-a', 'manager-b'] },
      { roleKey: 'buddy', status: 'MISSING', blocking: false, employees: [] },
    ])
    expect(issues.blocking).toEqual(['JOURNEY_PARTICIPANT_AMBIGUOUS:manager'])
    expect(issues.warnings).toEqual(['JOURNEY_OPTIONAL_PARTICIPANT_MISSING:buddy'])
  })

  it('leidt operationele aandacht af zonder een workflow-state-machine te maken', () => {
    expect(deriveJourneyAttention({ status: 'ACTIVE', nextMomentOn: '2026-08-20', overdueRequiredTopics: 1, today: '2026-08-12' })).toBe('ATTENTION')
    expect(deriveJourneyAttention({ status: 'ACTIVE', nextMomentOn: '2026-08-20', overdueRequiredTopics: 0, today: '2026-08-12' })).toBe('UPCOMING')
    expect(deriveJourneyAttention({ status: 'PAUSED', nextMomentOn: null, overdueRequiredTopics: 4, today: '2026-08-12' })).toBe('PAUSED')
    expect(deriveJourneyAttention({ status: 'COMPLETED', nextMomentOn: null, overdueRequiredTopics: 0, today: '2026-08-12' })).toBe('COMPLETED')
  })

  it('berekent HR-overviewprogress uit de bestaande topicstatussen', () => {
    expect(deriveJourneyProgress([{ status: 'COMPLETED' }, { status: 'PENDING' }, { status: 'SKIPPED' }])).toEqual({ completed: 1, total: 3 })
  })
})
