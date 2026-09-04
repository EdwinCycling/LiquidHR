import { describe, expect, it } from 'vitest'
import { convertRosterHoursInput, parseRosterHoursInput, parseRosterHoursValue } from './roster-hours'

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

describe('roster input modes', () => {
  it('supports decimal hours and hours/minutes without changing the stored value', () => {
    expect(parseRosterHoursValue('7,5', 'DECIMAL')).toBe(7.5)
    expect(parseRosterHoursValue('7,30', 'HOURS_MINUTES')).toBe(7.5)
    expect(convertRosterHoursInput('7.5', 'DECIMAL', 'HOURS_MINUTES')).toBe('7,30')
    expect(convertRosterHoursInput('7,30', 'HOURS_MINUTES', 'DECIMAL')).toBe('7.5')
  })
})
