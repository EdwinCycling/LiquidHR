import type { EmployeeInsightGroupBy, EmployeeInsightQuery, EmployeeInsightReportId } from './types'

function first(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key)?.trim()
  return value || undefined
}

function list(params: URLSearchParams, key: string): string[] {
  return (first(params, key) ?? '').split(',').map((value) => value.trim()).filter(Boolean)
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
  const sortBy = first(params, 'sort')
  return {
    report,
    ...dates,
    teams: list(params, 'teams'),
    segments: list(params, 'segments'),
    reasons: list(params, 'reasons'),
    employeeStatus: status === 'active' || status === 'former' ? status : 'all',
    groupBy: groupBy(first(params, 'group'), report),
    sortBy: sortBy === 'name' || sortBy === 'trend' ? sortBy : 'total',
    yearSpan: yearsValue === 3 || yearsValue === 5 ? yearsValue : 1,
  }
}
