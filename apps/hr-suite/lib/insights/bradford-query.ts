import type { AbsenceInsightQuery } from './absence-report'

export type BradfordPeriod = '52-weeks' | 'this-year' | 'previous-year'

export interface BradfordInsightQuery {
  report: 'absence-bradford'
  period: BradfordPeriod
  year: number
  month: number
  startDate: string
  endDate: string
  departmentId: string | null
  risk: 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH'
  search: string
}

function value(params: URLSearchParams, key: string): string | undefined {
  const result = params.get(key)?.trim()
  return result || undefined
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function safeYear(params: URLSearchParams): number {
  const candidate = Number(value(params, 'year'))
  const current = new Date().getUTCFullYear()
  return Number.isInteger(candidate) && candidate >= 2000 && candidate <= 2100 ? candidate : current
}

export function parseBradfordInsightQuery(params: URLSearchParams): BradfordInsightQuery | null {
  if (value(params, 'report') !== 'absence-bradford') return null
  const periodValue = value(params, 'period')
  const period: BradfordPeriod = periodValue === 'this-year' || periodValue === 'previous-year' ? periodValue : '52-weeks'
  const year = safeYear(params)
  const today = new Date()
  const todayDate = isoDate(today)
  const riskValue = value(params, 'risk')
  const risk = riskValue === 'LOW' || riskValue === 'MEDIUM' || riskValue === 'HIGH' ? riskValue : 'ALL'
  const search = value(params, 'search') ?? ''
  if (period === '52-weeks') {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    start.setUTCDate(start.getUTCDate() - 363)
    return { report: 'absence-bradford', period, year, month: today.getUTCMonth() + 1, startDate: isoDate(start), endDate: todayDate, departmentId: value(params, 'departmentId') ?? value(params, 'department') ?? null, risk, search }
  }
  if (period === 'this-year') return { report: 'absence-bradford', period, year, month: today.getUTCMonth() + 1, startDate: `${year}-01-01`, endDate: year === today.getUTCFullYear() ? todayDate : `${year}-12-31`, departmentId: value(params, 'departmentId') ?? value(params, 'department') ?? null, risk, search }
  return { report: 'absence-bradford', period, year: year - 1, month: 12, startDate: `${year - 1}-01-01`, endDate: `${year - 1}-12-31`, departmentId: value(params, 'departmentId') ?? value(params, 'department') ?? null, risk, search }
}

export function bradfordInsightQueryParams(query: BradfordInsightQuery, format?: 'excel'): URLSearchParams {
  const params = new URLSearchParams({ report: 'absence-bradford', period: query.period })
  if (query.departmentId) params.set('departmentId', query.departmentId)
  if (query.risk !== 'ALL') params.set('risk', query.risk)
  if (query.search) params.set('search', query.search)
  if (format) params.set('format', format)
  return params
}

export function toAbsenceInsightQuery(query: BradfordInsightQuery): AbsenceInsightQuery {
  return { report: 'absence', period: query.period, year: query.year, month: query.month, startDate: query.startDate, endDate: query.endDate, departmentId: query.departmentId }
}
