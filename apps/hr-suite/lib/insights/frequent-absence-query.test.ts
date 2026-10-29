import { describe, expect, it, vi } from 'vitest'
import { parseFrequentAbsenceQuery } from './frequent-absence-query'

describe('parseFrequentAbsenceQuery', () => {
  it('uses the shared inclusive 365-calendar-day window by default', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-29T12:00:00.000Z'))
    try {
      const query = parseFrequentAbsenceQuery(new URLSearchParams('report=absence-frequent&period=12-months'))
      expect(query).toMatchObject({ period: '12-months', startDate: '2025-10-30', endDate: '2026-10-29' })
      expect((Date.parse(`${query!.endDate}T00:00:00Z`) - Date.parse(`${query!.startDate}T00:00:00Z`)) / 86_400_000 + 1).toBe(365)
    } finally {
      vi.useRealTimers()
    }
  })

  it('supports this year, previous year and department', () => {
    const query = parseFrequentAbsenceQuery(new URLSearchParams('report=absence-frequent&period=previous-year&department=dept-1'))
    expect(query?.period).toBe('previous-year')
    expect(query?.departmentId).toBe('dept-1')
    expect(query?.startDate).toMatch(/^\d{4}-01-01$/)
    expect(query?.endDate).toMatch(/^\d{4}-12-31$/)
  })

  it('ignores other insight reports', () => {
    expect(parseFrequentAbsenceQuery(new URLSearchParams('report=absence'))).toBeNull()
  })
})
