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

  it('gebruikt Engelse labels voor een Engelse locale', () => {
    expect(formatReminderCountdown(now, new Date('2026-07-16T10:05:00.000Z'), 'en-GB'))
      .toBe('in 5 min')
  })

  it('toont morgen voor een reminder op de volgende kalenderdag', () => {
    expect(formatReminderCountdown(now, new Date('2026-07-17T09:00:00.000Z'), 'nl-NL'))
      .toBe('morgen')
  })

  it('toont nu binnen dezelfde afgeronde minuut', () => {
    expect(formatReminderCountdown(now, new Date('2026-07-16T10:00:20.000Z'), 'nl-NL'))
      .toBe('nu')
  })
})

describe('clockHandAngles', () => {
  it('zet alle wijzers op twaalf uur bij middernacht', () => {
    expect(clockHandAngles(new Date('2026-07-16T00:00:00.000Z'))).toEqual({
      hour: 0,
      minute: 0,
      second: 0,
    })
  })

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

  it('telt iedereen en self als één logische doelgroep', () => {
    expect(summarizeTarget({ type: 'EVERYONE' })).toEqual({ type: 'EVERYONE', count: 1 })
    expect(summarizeTarget({ type: 'SELF' })).toEqual({ type: 'SELF', count: 1 })
  })
})
