export type FrequentAbsencePeriod = '12-months' | 'this-year' | 'previous-year'

export interface FrequentAbsenceQuery {
  report: 'absence-frequent'
  period: FrequentAbsencePeriod
  year: number
  startDate: string
  endDate: string
  departmentId: string | null
  search: string
  frequentOnly: boolean
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

export function parseFrequentAbsenceQuery(params: URLSearchParams): FrequentAbsenceQuery | null {
  if (value(params, 'report') !== 'absence-frequent') return null
  const periodValue = value(params, 'period')
  const period: FrequentAbsencePeriod = periodValue === 'this-year' || periodValue === 'previous-year' ? periodValue : '12-months'
  const year = safeYear(params)
  const today = new Date()
  const todayDate = isoDate(today)
  const search = value(params, 'search') ?? ''
  const frequentOnly = value(params, 'frequentOnly') === '1'
  if (period === '12-months') {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    start.setUTCDate(start.getUTCDate() - 364)
    return { report: 'absence-frequent', period, year, startDate: isoDate(start), endDate: todayDate, departmentId: value(params, 'departmentId') ?? value(params, 'department') ?? null, search, frequentOnly }
  }
  if (period === 'this-year') return { report: 'absence-frequent', period, year, startDate: `${year}-01-01`, endDate: year === today.getUTCFullYear() ? todayDate : `${year}-12-31`, departmentId: value(params, 'departmentId') ?? value(params, 'department') ?? null, search, frequentOnly }
  return { report: 'absence-frequent', period, year: year - 1, startDate: `${year - 1}-01-01`, endDate: `${year - 1}-12-31`, departmentId: value(params, 'departmentId') ?? value(params, 'department') ?? null, search, frequentOnly }
}

export function frequentAbsenceQueryParams(query: FrequentAbsenceQuery, format?: 'excel'): URLSearchParams {
  const params = new URLSearchParams({ report: 'absence-frequent', period: query.period })
  if (query.departmentId) params.set('departmentId', query.departmentId)
  if (query.search) params.set('search', query.search)
  if (query.frequentOnly) params.set('frequentOnly', '1')
  if (format) params.set('format', format)
  return params
}
