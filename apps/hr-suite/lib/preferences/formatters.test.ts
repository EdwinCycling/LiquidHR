import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatTime } from './formatters'

describe('preference formatters', () => {
  it('formats dates according to the selected order', () => {
    expect(formatDate('2026-12-31', { locale: 'nl-NL', dateFormat: 'DMY' })).toBe('31-12-2026')
    expect(formatDate('2026-12-31', { locale: 'en-US', dateFormat: 'MDY' })).toBe('12/31/2026')
    expect(formatDate('2026-12-31', { locale: 'nl-NL', dateFormat: 'YMD' })).toBe('2026-12-31')
  })

  it('formats time in 24 or 12 hour notation', () => {
    const value = '2026-12-31T16:05:00Z'
    expect(formatTime(value, { locale: 'nl-NL', timeFormat: '24H' })).toBe('17:05')
    expect(formatTime(value, { locale: 'en-US', timeFormat: '12H' })).toMatch(/05:05 PM/)
  })

  it('combines the selected date and time formats', () => {
    expect(formatDateTime('2026-12-31T16:05:00Z', { locale: 'en-US', dateFormat: 'MDY', timeFormat: '12H' })).toMatch(/^12\/31\/2026 05:05 PM$/)
  })
})
