import { describe, expect, it } from 'vitest'
import { formatExactHours, formatExactTime, parseExactHours, parseExactTime } from './exact-hours'

describe('actual work exact quantities', () => {
  it('keeps four decimal hour precision without a floating point conversion', () => {
    const value = parseExactHours('8.1250')
    expect(value).toBe(BigInt('81250'))
    expect(formatExactHours(value)).toBe('8.125')
  })

  it('round-trips the smallest supported time unit', () => {
    const value = parseExactTime('00:00:00.36')
    expect(value).toBe(BigInt('1'))
    expect(formatExactTime(value)).toBe('00:00:00.36')
  })

  it('rejects time values that are not exact multiples of 0.36 seconds', () => {
    expect(() => parseExactTime('00:00:00.37')).toThrowError('ACTUAL_WORK_TIME_PRECISION_INVALID')
  })

  it('rejects more than four decimal places', () => {
    expect(() => parseExactHours('8.12501')).toThrowError('ACTUAL_WORK_HOURS_FORMAT_INVALID')
  })
})
