import type { EmployeeInsightGroupBy, EmployeeInsightQuery, EmployeeInsightReportId } from './types'

function first(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key)?.trim()
  return value || undefined
}

function list(params: URLSearchParams, key: string): string[] {
  return [...new Set(params.getAll(key).flatMap((value) => value.split(',').map((item) => item.trim()).filter(Boolean)))]
}

function reportId(value: string | undefined): EmployeeInsightReportId | null {
  return value === 'employee-department' || value === 'employee-gender' || value === 'employee-age' || value === 'terminations' ? value : null
}

function groupBy(value: string | undefined, report: EmployeeInsightReportId): EmployeeInsightGroupBy {
  if (value === 'team' || value === 'gender' || value === 'age' || value === 'reason' || value === 'person') return value
  return report === 'employee-department' ? 'team' : report === 'employee-gender' ? 'gender' : report === 'employee-age' ? 'age' : 'reason'
}

function dateRange(params: URLSearchParams): { startDate: string; endDate: string } {
  const today = new Date()
  const yearValue = Number(first(params, 'year'))
  const year = Number.isInteger(yearValue) && yearValue >= 2000 && yearValue <= 2100 ? yearValue : today.getUTCFullYear()
  const fullYear = first(params, 'fullYear') === '1'
  const yearsValue = Number(first(params, 'years'))
  const years = yearsValue === 3 || yearsValue === 5 ? yearsValue : 1
  const monthValue = Number(first(params, 'month'))
  const month = Number.isInteger(monthValue) && monthValue >= 1 && monthValue <= 12 ? monthValue : today.getUTCMonth() + 1
  if (fullYear || years > 1) return { startDate: `${year - years + 1}-01-01`, endDate: `${year}-12-31` }
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  return { startDate: `${year}-${String(month).padStart(2, '0')}-01`, endDate }
}

export function parseEmployeeInsightQuery(params: URLSearchParams): EmployeeInsightQuery | null {
  const report = reportId(first(params, 'report'))
  if (!report) return null
  const dates = dateRange(params)
  const yearsValue = Number(first(params, 'years'))
  const status = first(params, 'employeeStatus')
  const sortBy = first(params, 'sortBy') ?? first(params, 'sort')
  return {
    report,
    ...dates,
    teams: list(params, 'teams'),
    segments: list(params, 'segments'),
    reasons: list(params, 'reasons'),
    employeeStatus: status === 'active' || status === 'former' ? status : 'all',
    groupBy: groupBy(first(params, 'groupBy') ?? first(params, 'group'), report),
    sortBy: sortBy === 'name' || sortBy === 'trend' ? sortBy : 'total',
    yearSpan: yearsValue === 3 || yearsValue === 5 ? yearsValue : 1,
  }
}

export interface EmployeeInsightFilterState {
  groupBy?: string
  year?: number
  month?: number
  fullYear?: boolean
  yearSpan?: 1 | 3 | 5
  sortBy?: string
  teams?: string[]
  segments?: string[]
  reasons?: string[]
  employeeStatus?: 'all' | 'active' | 'former'
}

export function employeeInsightQueryParams(query: EmployeeInsightQuery): URLSearchParams {
  const endYear = Number(query.endDate.slice(0, 4))
  const params = new URLSearchParams({
    report: query.report,
    groupBy: query.groupBy,
    sortBy: query.sortBy,
    year: String(endYear),
  })
  if (query.yearSpan > 1) {
    params.set('fullYear', '1')
    params.set('years', String(query.yearSpan))
  } else if (query.startDate.endsWith('-01-01') && query.endDate.endsWith('-12-31')) {
    params.set('fullYear', '1')
  } else {
    params.set('month', String(Number(query.startDate.slice(5, 7))))
  }
  if (query.teams.length) for (const value of query.teams) params.append('teams', value)
  if (query.segments.length) for (const value of query.segments) params.append('segments', value)
  if (query.reasons.length) for (const value of query.reasons) params.append('reasons', value)
  if (query.employeeStatus !== 'all') params.set('employeeStatus', query.employeeStatus)
  return params
}

export function employeeInsightQueryFromFilters(report: EmployeeInsightReportId, filters: EmployeeInsightFilterState): EmployeeInsightQuery {
  const params = new URLSearchParams({
    report,
    groupBy: filters.groupBy ?? 'person',
    sortBy: filters.sortBy ?? 'total',
    year: String(filters.year ?? new Date().getFullYear()),
    month: String(filters.month ?? new Date().getMonth() + 1),
  })
  if (filters.fullYear) params.set('fullYear', '1')
  if (filters.yearSpan && filters.yearSpan > 1) params.set('years', String(filters.yearSpan))
  for (const [key, values] of [['teams', filters.teams], ['segments', filters.segments], ['reasons', filters.reasons]] as const) {
    for (const value of values ?? []) params.append(key, value)
  }
  if (filters.employeeStatus && filters.employeeStatus !== 'all') params.set('employeeStatus', filters.employeeStatus)
  const query = parseEmployeeInsightQuery(params)
  if (!query) throw new Error('INSIGHTS_EMPLOYEE_QUERY_INVALID')
  return query
}

export function employeeInsightQueryToFilters(query: EmployeeInsightQuery): EmployeeInsightFilterState {
  const year = Number(query.endDate.slice(0, 4))
  const fullYear = query.startDate.endsWith('-01-01') && query.endDate.endsWith('-12-31')
  return {
    groupBy: query.groupBy,
    year,
    month: Number(query.startDate.slice(5, 7)),
    fullYear,
    yearSpan: query.yearSpan,
    sortBy: query.sortBy,
    teams: query.teams,
    segments: query.segments,
    reasons: query.reasons,
    employeeStatus: query.employeeStatus,
  }
}
