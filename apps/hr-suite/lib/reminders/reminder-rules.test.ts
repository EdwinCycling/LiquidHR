import { describe, expect, it } from 'vitest'
import { clockHandAngles, formatReminderCountdown, formatReminderDaysUntil, summarizeTarget } from './reminder-rules'

describe('formatReminderCountdown', () => {
  const now = new Date('2026-07-16T10:00:00.000Z')

  it('rondt een reminder op dezelfde dag af en toont de datum', () => {
    expect(formatReminderCountdown(now, new Date('2026-07-16T10:05:00.000Z'), 'nl-NL'))
      .toBe('16-07-2026 · vandaag')
  })

  it('markeert een verlopen reminder', () => {
    expect(formatReminderCountdown(now, new Date('2026-07-16T09:59:00.000Z'), 'nl-NL'))
      .toBe('16-07-2026 · 1 dag geleden')
  })

  it('gebruikt Engelse labels voor een Engelse locale', () => {
    expect(formatReminderCountdown(now, new Date('2026-07-16T10:05:00.000Z'), 'en-GB'))
      .toBe('16/07/2026 · today')
  })

  it('toont morgen voor een reminder op de volgende kalenderdag', () => {
    expect(formatReminderCountdown(now, new Date('2026-07-17T09:00:00.000Z'), 'nl-NL'))
      .toBe('17-07-2026 · morgen')
  })

  it('toont vandaag binnen dezelfde afgeronde minuut', () => {
    expect(formatReminderCountdown(now, new Date('2026-07-16T10:00:20.000Z'), 'nl-NL'))
      .toBe('16-07-2026 · vandaag')
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

describe('formatReminderDaysUntil', () => {
  const now = new Date('2026-07-16T10:00:00.000Z')

  it('toont hoeveel dagen het nog duurt', () => {
    expect(formatReminderDaysUntil(now, new Date('2026-07-17T09:00:00.000Z'), 'nl-NL')).toBe('nog 1 dag')
    expect(formatReminderDaysUntil(now, new Date('2026-07-21T10:00:00.000Z'), 'nl-NL')).toBe('nog 5 dagen')
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
