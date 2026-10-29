import { describe, expect, it } from 'vitest'
import { DAY_IN_MILLISECONDS, getAbsenceRollingDateRange, ROLLING_ABSENCE_DAYS } from './absence-period'

describe('getAbsenceRollingDateRange', () => {
  it('includes the first and last dates in a 365-calendar-day window', () => {
    const range = getAbsenceRollingDateRange(new Date('2026-10-29T23:59:59.000Z'))
    expect(range).toEqual({ startDate: '2025-10-30', endDate: '2026-10-29' })
    expect((Date.parse(`${range.endDate}T00:00:00Z`) - Date.parse(`${range.startDate}T00:00:00Z`)) / DAY_IN_MILLISECONDS + 1).toBe(ROLLING_ABSENCE_DAYS)
  })

  it('keeps a leap-day date within the inclusive calendar range', () => {
    const range = getAbsenceRollingDateRange(new Date('2024-03-01T12:00:00.000Z'))
    expect(range).toEqual({ startDate: '2023-03-03', endDate: '2024-03-01' })
  })
})
