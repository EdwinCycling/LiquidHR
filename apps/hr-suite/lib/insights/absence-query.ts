import type { AbsenceInsightQuery } from './absence-report'

function value(params: URLSearchParams, key: string): string | undefined {
  const result = params.get(key)?.trim()
  return result || undefined
}

function safeYear(params: URLSearchParams): number {
  const candidate = Number(value(params, 'year'))
  const current = new Date().getUTCFullYear()
  return Number.isInteger(candidate) && candidate >= 2000 && candidate <= 2100 ? candidate : current
}

function safeMonth(params: URLSearchParams): number {
  const candidate = Number(value(params, 'month'))
  const current = new Date().getUTCMonth() + 1
  return Number.isInteger(candidate) && candidate >= 1 && candidate <= 12 ? candidate : current
}

export function parseAbsenceInsightQuery(params: URLSearchParams): AbsenceInsightQuery | null {
  if (value(params, 'report') !== 'absence') return null
  const year = safeYear(params)
  const month = safeMonth(params)
  const period = value(params, 'period') === 'year' ? 'year' : 'month'
  const startDate = period === 'year' ? `${year}-01-01` : `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = period === 'year'
    ? `${year}-12-31`
    : new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  const departmentId = value(params, 'departmentId') ?? value(params, 'department') ?? null
  return { report: 'absence', period, year, month, startDate, endDate, departmentId }
}

export function absenceInsightQueryParams(query: AbsenceInsightQuery, format?: 'excel'): URLSearchParams {
  const params = new URLSearchParams({ report: 'absence', period: query.period, year: String(query.year), month: String(query.month) })
  if (query.departmentId) params.set('departmentId', query.departmentId)
  if (format) params.set('format', format)
  return params
}
