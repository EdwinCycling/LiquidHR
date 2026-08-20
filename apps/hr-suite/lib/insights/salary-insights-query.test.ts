import { describe, expect, it } from 'vitest'
import { defaultSalaryInsightFilters } from './salary-insights-calculations'
import { parseSalaryInsightQuery, salaryInsightGroupByOptions, salaryInsightQueryParams, salaryInsightSortByOptions } from './salary-insights-query'

describe('salary insights query state', () => {
  it('rejects report-incompatible grouping and sorting instead of widening the report', () => {
    const query = parseSalaryInsightQuery(new URLSearchParams({ report: 'salary-band-position', groupBy: 'salaryRoute', sortBy: 'salary-desc' }))
    expect(query?.groupBy).toBe(defaultSalaryInsightFilters('salary-band-position').groupBy)
    expect(query?.sortBy).toBe(defaultSalaryInsightFilters('salary-band-position').sortBy)
    expect(salaryInsightGroupByOptions('salary-band-position')).not.toContain('salaryRoute')
    expect(salaryInsightSortByOptions('salary-band-position')).not.toContain('salary-desc')
  })

  it('preserves historical date and repeated filter state in the URL', () => {
    const query = parseSalaryInsightQuery(new URLSearchParams('report=salary-overview&asOfDate=2025-01-01&administrations=a1,a2,a1&salaryRoutes=SALARY_BAND'))
    expect(query?.asOfDate).toBe('2025-01-01')
    expect(query?.administrations).toEqual(['a1', 'a2'])
    expect(query?.salaryRoutes).toEqual(['SALARY_BAND'])
    expect(query ? salaryInsightQueryParams(query).toString() : '').toContain('asOfDate=2025-01-01')
    expect(query ? salaryInsightQueryParams(query).toString() : '').toContain('administrations=a1%2Ca2')
  })

  it('falls back safely for invalid dates and unknown reports', () => {
    expect(parseSalaryInsightQuery(new URLSearchParams({ report: 'salary-overview', asOfDate: '2025-02-31' }))?.asOfDate).not.toBe('2025-02-31')
    expect(parseSalaryInsightQuery(new URLSearchParams({ report: 'salary-review' }))).toBeNull()
  })
})
