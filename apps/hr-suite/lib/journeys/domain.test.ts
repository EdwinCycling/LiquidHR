import { describe, expect, it } from 'vitest'
import {
  calculateJourneyDate,
  resolveJourneyRole,
  validateJourneyTemplate,
  type JourneyTemplateDraft,
} from './domain'

const validDraft: JourneyTemplateDraft = {
  name: { nl: 'Standaard onboarding', en: 'Standard onboarding' },
  description: { nl: 'Een rustige start', en: 'A calm start' },
  journeyType: 'ONBOARDING',
  anchorRule: 'EMPLOYMENT_START_DATE',
  phases: [{ key: 'before', name: { nl: 'Voor de start', en: 'Before the start' }, sortOrder: 10 }],
  roles: [
    { key: 'employee', name: { nl: 'Medewerker', en: 'Employee' }, required: true, cardinality: 'ONE', resolverType: 'TARGET_EMPLOYEE', resolverRoleCode: null, resolverEmployeeId: null, sortOrder: 10 },
    { key: 'manager', name: { nl: 'Manager', en: 'Manager' }, required: true, cardinality: 'ONE', resolverType: 'DIRECT_MANAGER', resolverRoleCode: null, resolverEmployeeId: null, sortOrder: 20 },
  ],
  moments: [{ key: 'welcome', phaseKey: 'before', name: { nl: 'Welkom', en: 'Welcome' }, dateOffsetDays: -7, availabilityOffsetDays: -14, sortOrder: 10 }],
  topics: [{
    key: 'introduction',
    momentKey: 'welcome',
    ownerRoleKey: 'manager',
    topicType: 'INFORMATION',
    title: { nl: 'Maak kennis', en: 'Get introduced' },
    body: { nl: 'Een korte introductie.', en: 'A short introduction.' },
    actionUrl: null,
    required: true,
    sortOrder: 10,
    audienceRoleKeys: ['employee', 'manager'],
  }],
}

describe('Journey domain', () => {
  it('berekent negatieve en positieve dagoffsets kalenderveilig', () => {
    expect(calculateJourneyDate('2026-03-29', -7)).toBe('2026-03-22')
    expect(calculateJourneyDate('2028-02-28', 1)).toBe('2028-02-29')
    expect(calculateJourneyDate('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('accepteert een volledige tweetalige, genormaliseerde template', () => {
    expect(validateJourneyTemplate(validDraft)).toEqual([])
  })

  it('blokkeert ongeldige verwijzingen, ontbrekende audiences en availability na het moment', () => {
    const issues = validateJourneyTemplate({
      ...validDraft,
      moments: [{ ...validDraft.moments[0]!, phaseKey: 'missing', availabilityOffsetDays: 1 }],
      topics: [{ ...validDraft.topics[0]!, ownerRoleKey: 'unknown', audienceRoleKeys: [] }],
    })
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'JOURNEY_TEMPLATE_PHASE_NOT_FOUND',
      'JOURNEY_TEMPLATE_AVAILABILITY_AFTER_MOMENT',
      'JOURNEY_TEMPLATE_OWNER_ROLE_NOT_FOUND',
      'JOURNEY_TEMPLATE_AUDIENCE_REQUIRED',
    ]))
  })

  it('kiest nooit stil de eerste kandidaat bij een ambigue resolver', () => {
    expect(resolveJourneyRole({ roleKey: 'manager', required: true, cardinality: 'ONE' }, [
      { employeeId: 'employee-a', source: 'DIRECT_MANAGER' },
      { employeeId: 'employee-b', source: 'DIRECT_MANAGER' },
    ])).toEqual({ status: 'AMBIGUOUS', roleKey: 'manager', candidateEmployeeIds: ['employee-a', 'employee-b'] })
  })

  it('maakt missing typed en laat een optionele rol niet blokkeren', () => {
    expect(resolveJourneyRole({ roleKey: 'buddy', required: true, cardinality: 'ONE' }, [])).toEqual({ status: 'MISSING', roleKey: 'buddy', blocking: true })
    expect(resolveJourneyRole({ roleKey: 'buddy', required: false, cardinality: 'ONE' }, [])).toEqual({ status: 'MISSING', roleKey: 'buddy', blocking: false })
  })

  it('dedupliceert dezelfde kandidaat en resolveert exact een persoon', () => {
    expect(resolveJourneyRole({ roleKey: 'manager', required: true, cardinality: 'ONE' }, [
      { employeeId: 'employee-a', source: 'DIRECT_MANAGER' },
      { employeeId: 'employee-a', source: 'DEPARTMENT_MANAGER' },
    ])).toEqual({ status: 'RESOLVED', roleKey: 'manager', employeeIds: ['employee-a'] })
  })
})
