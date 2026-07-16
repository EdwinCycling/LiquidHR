import { describe, expect, it } from 'vitest'
import { clockHandAngles, formatReminderCountdown, summarizeTarget } from './reminder-rules'

describe('formatReminderCountdown', () => {
  const now = new Date('2026-07-16T10:00:00.000Z')

  it('geeft een compacte label voor een reminder over enkele minuten', () => {
    expect(formatReminderCountdown(now, new Date('2026-07-16T10:05:00.000Z'), 'nl-NL'))
      .toBe('over 5 min.')
  })

  it('markeert een verlopen reminder', () => {
    expect(formatReminderCountdown(now, new Date('2026-07-16T09:59:00.000Z'), 'nl-NL'))
      .toBe('1 min. geleden')
  })
})

describe('clockHandAngles', () => {
  it('berekent de wijzers op half zeven', () => {
    expect(clockHandAngles(new Date('2026-07-16T06:30:00.000Z'))).toEqual({
      hour: 195,
      minute: 180,
      second: 0,
    })
  })
})

describe('summarizeTarget', () => {
  it('verwijdert dubbele ontvangerselecties', () => {
    expect(summarizeTarget({ type: 'EMPLOYEES', ids: ['a', 'b', 'a'] }))
      .toEqual({ type: 'EMPLOYEES', count: 2 })
  })
})
