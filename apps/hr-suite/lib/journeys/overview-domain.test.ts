import { describe, expect, it } from 'vitest'
import { filterJourneyProjections, filterJourneyRuntimeItems, parseJourneyOverviewQuery } from './overview-domain'

const runtimeItems = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    templateName: { nl: 'Welkom bij LiquidHR', en: 'Welcome to LiquidHR' },
    templateVersionNumber: 1,
    targetEmployeeId: '22222222-2222-4222-8222-222222222222',
    targetEmployeeName: 'Een medewerker met een uitzonderlijk lange naam die natuurlijk moet afbreken',
    targetEmployeeNumber: 'DEMO-001',
    anchorDate: '2026-08-24',
    status: 'ACTIVE' as const,
    version: 1,
    nextMomentOn: '2026-08-30',
    nextMomentName: { nl: 'Eerste dag', en: 'First day' },
    overdueRequiredTopics: 0,
    progress: { completed: 2, total: 4 },
    participantNames: ['Yara Meijer'],
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    templateName: { nl: 'Interne overstap', en: 'Internal transfer' },
    templateVersionNumber: 1,
    targetEmployeeId: '44444444-4444-4444-8444-444444444444',
    targetEmployeeName: 'Noah Hendriks',
    targetEmployeeNumber: 'DEMO-002',
    anchorDate: '2026-08-20',
    status: 'PAUSED' as const,
    version: 2,
    nextMomentOn: null,
    nextMomentName: null,
    overdueRequiredTopics: 0,
    progress: { completed: 1, total: 3 },
    participantNames: ['Maya Vermeer'],
  },
] as const

const projectionItems = [{
  id: '55555555-5555-4555-8555-555555555555',
  templateName: { nl: 'Welkom bij LiquidHR', en: 'Welcome to LiquidHR' },
  status: 'ACTIVE' as const,
  anchorDate: '2026-08-24',
  targetEmployeeName: 'Noah Hendriks',
  relationship: 'PARTICIPANT' as const,
  progress: { completed: 1, total: 2 },
  nextAction: null,
  participants: [{ roleKey: 'manager', roleName: { nl: 'Manager', en: 'Manager' }, employeeName: 'Yara Meijer', status: 'ACTIVE' as const }],
  phases: [],
}]

describe('journey overview query', () => {
  it('normalizes URL state and rejects unknown statuses', () => {
    expect(parseJourneyOverviewQuery({ q: '  Noah  ', status: 'UNKNOWN' })).toEqual({ q: 'Noah', status: 'ALL' })
    expect(parseJourneyOverviewQuery({ status: 'ACTIVE' })).toEqual({ q: '', status: 'ACTIVE' })
  })

  it('searches the management projection across target and participants', () => {
    expect(filterJourneyRuntimeItems(runtimeItems, { q: 'Yara', status: 'ALL' })).toHaveLength(1)
    expect(filterJourneyRuntimeItems(runtimeItems, { q: '', status: 'PAUSED' }).map((item) => item.id)).toEqual([runtimeItems[1].id])
  })

  it('keeps participant filtering inside the actor-safe projection', () => {
    expect(filterJourneyProjections(projectionItems, { q: 'Manager', status: 'ALL' })).toHaveLength(1)
    expect(filterJourneyProjections(projectionItems, { q: 'salary', status: 'ALL' })).toHaveLength(0)
  })
})
