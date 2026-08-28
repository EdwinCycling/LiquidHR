import { describe, expect, it } from 'vitest'

import { absenceInsightQueryParams, parseAbsenceInsightQuery } from './absence-query'
import { bradfordInsightQueryParams, parseBradfordInsightQuery } from './bradford-query'
import { frequentAbsenceQueryParams, parseFrequentAbsenceQuery } from './frequent-absence-query'

describe('Insights report filter URL contracts', () => {
  it('serializes absence filters as the canonical applied query', () => {
    const query = parseAbsenceInsightQuery(new URLSearchParams('report=absence&period=year&year=2025&month=3&departmentId=dept-1'))
    expect(query).not.toBeNull()
    expect(absenceInsightQueryParams(query!, 'excel').toString()).toBe('report=absence&period=year&year=2025&month=3&departmentId=dept-1&format=excel')
  })

  it('round-trips Bradford presentation filters and export format', () => {
    const query = parseBradfordInsightQuery(new URLSearchParams('report=absence-bradford&period=this-year&risk=HIGH&search=Fin'))
    expect(query?.risk).toBe('HIGH')
    expect(query?.search).toBe('Fin')
    expect(bradfordInsightQueryParams(query!, 'excel').toString()).toContain('risk=HIGH')
    expect(bradfordInsightQueryParams(query!, 'excel').toString()).toContain('search=Fin')
    expect(bradfordInsightQueryParams(query!, 'excel').get('format')).toBe('excel')
  })

  it('keeps frequent-only and search filters in the applied URL', () => {
    const query = parseFrequentAbsenceQuery(new URLSearchParams('report=absence-frequent&period=12-months&search=Ada&frequentOnly=1'))
    expect(query?.search).toBe('Ada')
    expect(query?.frequentOnly).toBe(true)
    expect(frequentAbsenceQueryParams(query!, 'excel').get('frequentOnly')).toBe('1')
    expect(frequentAbsenceQueryParams(query!, 'excel').get('search')).toBe('Ada')
  })
})
