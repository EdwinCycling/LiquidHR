import { describe, expect, it } from 'vitest'
import { addCalendarDays, projectWvpMilestones, summarizeWvpDossierEvidence, wvpCommandSchema, wvpUrgency } from './domain'

describe('WVP wettelijke kalender en privacycontract', () => {
  it('rekent kalenderweken over DST en schrikkeldag, zonder werkkalender', () => {
    expect(addCalendarDays('2024-02-29', 42)).toBe('2024-04-11')
    expect(projectWvpMilestones('2026-03-01').find(x => x.code === 'WVP_FIRST_YEAR_REVIEW')?.dueOn).toBe('2027-02-28')
  })
  it('ankert het plan aan een vroege probleemanalyse en verschuift nooit wegens late afronding', () => {
    expect(projectWvpMilestones('2026-01-01', '2026-01-20').find(x => x.code === 'WVP_WEEK_8')?.dueOn).toBe('2026-02-03')
    expect(projectWvpMilestones('2026-01-01', '2026-03-01').find(x => x.code === 'WVP_WEEK_8')?.dueOn).toBe('2026-02-26')
  })
  it('behoudt de 42-weekse signalering los van de meldwerkdag', () => {
    expect(projectWvpMilestones('2026-01-01').find(x => x.code === 'WVP_WEEK_42')).toMatchObject({ kind: 'SIGNAL', dueOn: '2026-10-22' })
  })
  it('koppelt mijlpaalgebeurtenissen aan de juiste taak en toont ontbrekende registratie', () => {
    const evidence = summarizeWvpDossierEvidence([
      { id: 'task-6', code: 'WVP_WEEK_6', dueOn: '2026-02-12', status: 'COMPLETED' },
      { id: 'task-8', code: 'WVP_WEEK_8', dueOn: '2026-02-26', status: 'COMPLETED' },
      { id: 'task-custom', code: 'CUSTOM_REVIEW', dueOn: '2026-03-01', status: 'OPEN' },
    ], [
      { taskId: 'task-6', type: 'MILESTONE', occurredOn: '2026-02-10' },
      { taskId: 'task-8', type: 'AGREEMENT', occurredOn: '2026-02-11' },
    ], '2026-01-01')

    expect(evidence[0]).toMatchObject({ owner: 'OCCUPATIONAL_PHYSICIAN', readiness: 'RECORDED', event: { occurredOn: '2026-02-10' } })
    expect(evidence[1]).toMatchObject({ owner: 'EMPLOYER_EMPLOYEE', readiness: 'MISSING_EVENT', event: null })
    expect(evidence[2]).toMatchObject({ owner: null, readiness: 'OPEN', event: null })
  })
  it('markeert verlopen en binnenkort inclusief de deadline', () => {
    expect(wvpUrgency('2026-01-01', '2026-01-02')).toBe('OVERDUE')
    expect(wvpUrgency('2026-01-09', '2026-01-02')).toBe('SOON')
    expect(wvpUrgency('2026-01-10', '2026-01-02')).toBe('PLANNED')
  })
  it.each(['diagnosis', 'medicalCause', 'treatment', 'note', 'completionNote'])('weigert extra gezondheids-/vrije tekstveld %s', (field) => {
    expect(wvpCommandSchema.safeParse({ action: 'START', caseId: '11111111-1111-4111-8111-111111111111', [field]: 'niet opslaan' }).success).toBe(false)
  })
  it('accepteert geldige PostgreSQL UUID-opslagwaarden zonder RFC-versiebit', () => {
    expect(wvpCommandSchema.safeParse({ action: 'START', caseId: 'd2aa7eb2-f236-b403-b0bb-16ead3e3f1b9' }).success).toBe(true)
  })
  it('weigert ongeldige kalenderdatums', () => { expect(() => addCalendarDays('2026-02-30', 1)).toThrow() })
})
