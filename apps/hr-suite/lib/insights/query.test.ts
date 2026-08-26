import { describe, expect, it } from 'vitest'
import { employeeInsightQueryParams, employeeInsightQueryToFilters, parseEmployeeInsightQuery } from './query'

describe('employee insight query', () => {
  it('normalises a full-year employee report and keeps scoped filters', () => {
    const query = parseEmployeeInsightQuery(new URLSearchParams('report=employee-age&year=2024&fullYear=1&teams=Marketing,IT%20%26%20Development&segments=Locatie%20Delft&group=age&sort=name'))
    expect(query).toMatchObject({
      report: 'employee-age',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      teams: ['Marketing', 'IT & Development'],
      segments: ['Locatie Delft'],
      groupBy: 'age',
      sortBy: 'name',
    })
  })

  it('uses the selected month and report-specific grouping defaults', () => {
    const query = parseEmployeeInsightQuery(new URLSearchParams('report=employee-gender&year=2024&month=7'))
    expect(query).toMatchObject({ report: 'employee-gender', startDate: '2024-07-01', endDate: '2024-07-31', groupBy: 'gender' })
  })

  it('supports a three-year period ending in the selected year', () => {
    const query = parseEmployeeInsightQuery(new URLSearchParams('report=employee-gender&year=2024&years=3'))
    expect(query).toMatchObject({ startDate: '2022-01-01', endDate: '2024-12-31', yearSpan: 3 })
  })

  it('does not create a report query for unknown report ids', () => {
    expect(parseEmployeeInsightQuery(new URLSearchParams('report=employees'))).toBeNull()
  })

  it('round-trips canonical repeated filters without corrupting labels', () => {
    const query = parseEmployeeInsightQuery(new URLSearchParams('report=employee-department&groupBy=team&sortBy=name&year=2024&fullYear=1&teams=IT%20%26%20Development&teams=Marketing&segments=Locatie%20Delft'))
    expect(query).not.toBeNull()
    expect(query ? employeeInsightQueryParams(query).getAll('teams') : []).toEqual(['IT & Development', 'Marketing'])
    expect(query ? employeeInsightQueryParams(query).getAll('segments') : []).toEqual(['Locatie Delft'])
    expect(query ? employeeInsightQueryToFilters(query).groupBy : null).toBe('team')
  })
})
