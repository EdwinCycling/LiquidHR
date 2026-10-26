import { describe, expect, it } from 'vitest'
import { addCalendarDays, projectWvpMilestones, wvpCommandSchema, wvpUrgency } from './domain'

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
  it('markeert verlopen en binnenkort inclusief de deadline', () => {
    expect(wvpUrgency('2026-01-01', '2026-01-02')).toBe('OVERDUE')
    expect(wvpUrgency('2026-01-09', '2026-01-02')).toBe('SOON')
    expect(wvpUrgency('2026-01-10', '2026-01-02')).toBe('PLANNED')
  })
  it.each(['diagnosis', 'medicalCause', 'treatment', 'note', 'completionNote'])('weigert extra gezondheids-/vrije tekstveld %s', (field) => {
    expect(wvpCommandSchema.safeParse({ action: 'START', caseId: '11111111-1111-4111-8111-111111111111', [field]: 'niet opslaan' }).success).toBe(false)
  })
  it('weigert ongeldige kalenderdatums', () => { expect(() => addCalendarDays('2026-02-30', 1)).toThrow() })
})
