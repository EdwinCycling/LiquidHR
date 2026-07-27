import { describe, expect, it } from 'vitest'
import { parseAbsenceInsightQuery } from './absence-query'

describe('parseAbsenceInsightQuery', () => {
  it('maakt een maandperiode met inclusieve einddatum', () => {
    const result = parseAbsenceInsightQuery(new URLSearchParams('report=absence&year=2026&month=2&period=month&department=dept-1'))
    expect(result).toMatchObject({ period: 'month', year: 2026, month: 2, startDate: '2026-02-01', endDate: '2026-02-28', departmentId: 'dept-1' })
  })

  it('maakt een volledig kalenderjaar', () => {
    const result = parseAbsenceInsightQuery(new URLSearchParams('report=absence&period=year&year=2025'))
    expect(result).toMatchObject({ period: 'year', year: 2025, startDate: '2025-01-01', endDate: '2025-12-31' })
  })

  it('negeert onveilige datums en andere rapporten', () => {
    expect(parseAbsenceInsightQuery(new URLSearchParams('report=employees'))).toBeNull()
    expect(parseAbsenceInsightQuery(new URLSearchParams('report=absence&year=1900&month=99'))?.year).toBe(new Date().getUTCFullYear())
  })
})
