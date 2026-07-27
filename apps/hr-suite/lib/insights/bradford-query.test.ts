import { describe, expect, it } from 'vitest'
import { parseBradfordInsightQuery } from './bradford-query'

describe('parseBradfordInsightQuery', () => {
  it('uses a rolling 52-week window by default', () => {
    const query = parseBradfordInsightQuery(new URLSearchParams('report=absence-bradford&period=52-weeks'))
    expect(query?.period).toBe('52-weeks')
    expect(query?.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(query?.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('supports this year, previous year and department', () => {
    const query = parseBradfordInsightQuery(new URLSearchParams('report=absence-bradford&period=previous-year&department=dept-1'))
    expect(query?.period).toBe('previous-year')
    expect(query?.departmentId).toBe('dept-1')
    expect(query?.startDate).toMatch(/^\d{4}-01-01$/)
    expect(query?.endDate).toMatch(/^\d{4}-12-31$/)
  })

  it('ignores other insight reports', () => {
    expect(parseBradfordInsightQuery(new URLSearchParams('report=absence'))).toBeNull()
  })
})
