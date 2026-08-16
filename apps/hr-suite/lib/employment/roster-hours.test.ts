import { describe, expect, it } from 'vitest'
import { parseRosterHoursInput } from './roster-hours'

describe('parseRosterHoursInput', () => {
  it('interprets the fraction as minutes for roster hours', () => {
    expect(parseRosterHoursInput('7,30')).toBe(7.5)
    expect(parseRosterHoursInput('7:05')).toBeCloseTo(7 + 5 / 60)
    expect(parseRosterHoursInput('8.45')).toBe(8.75)
  })

  it('rejects invalid minute values and decimal hour notation', () => {
    expect(Number.isNaN(parseRosterHoursInput('7,60'))).toBe(true)
    expect(Number.isNaN(parseRosterHoursInput('7,5'))).toBe(true)
  })
})
