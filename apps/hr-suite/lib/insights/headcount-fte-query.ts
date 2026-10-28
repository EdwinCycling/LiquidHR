export interface HeadcountFteQuery {
  report: 'headcount-fte'
  fromMonth: string
  toMonth: string
  administrationIds: string[]
  departmentIds: string[]
  teamIds: string[]
  sortBy: 'employeeName' | 'administration' | 'fte'
  sortDirection: 'asc' | 'desc'
  page: number
}

const EARLIEST_VERIFIED_MONTH = '2021-01'
export const HEADCOUNT_FTE_PAGE_SIZE = 25

export function paginateHeadcountFteRows<T>(rows: readonly T[], requestedPage: number): { page: number; totalPages: number; rows: T[] } {
  const totalPages = Math.max(1, Math.ceil(rows.length / HEADCOUNT_FTE_PAGE_SIZE))
  const page = Math.max(1, Math.min(Number.isSafeInteger(requestedPage) ? requestedPage : 1, totalPages))
  return { page, totalPages, rows: rows.slice((page - 1) * HEADCOUNT_FTE_PAGE_SIZE, page * HEADCOUNT_FTE_PAGE_SIZE) }
}

export function latestCompletedHeadcountMonth(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).toISOString().slice(0, 7)
}

function isMonth(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false
  const year = Number(value.slice(0, 4))
  return year >= 2000 && year <= 2100
}

function monthDistance(fromMonth: string, toMonth: string): number {
  return (Number(toMonth.slice(0, 4)) - Number(fromMonth.slice(0, 4))) * 12
    + Number(toMonth.slice(5, 7)) - Number(fromMonth.slice(5, 7))
}

export function isHeadcountFtePeriodValid(fromMonth: string, toMonth: string, now = new Date()): boolean {
  return isMonth(fromMonth) && isMonth(toMonth) && fromMonth >= EARLIEST_VERIFIED_MONTH && fromMonth <= toMonth
    && toMonth <= latestCompletedHeadcountMonth(now)
    && monthDistance(fromMonth, toMonth) < 120
}

function values(params: URLSearchParams, key: string): string[] {
  return [...new Set(params.getAll(key).flatMap((value) => value.split(',').map((entry) => entry.trim()).filter(Boolean)))].slice(0, 100)
}

export function defaultHeadcountFteQuery(now = new Date()): HeadcountFteQuery {
  const lastCompleted = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
  const toMonth = latestCompletedHeadcountMonth(now)
  const firstMonth = new Date(Date.UTC(lastCompleted.getUTCFullYear(), lastCompleted.getUTCMonth() - 11, 1))
  return {
    report: 'headcount-fte',
    fromMonth: firstMonth.toISOString().slice(0, 7),
    toMonth,
    administrationIds: [],
    departmentIds: [],
    teamIds: [],
    sortBy: 'employeeName',
    sortDirection: 'asc',
    page: 1,
  }
}

export function canonicalizeHeadcountFteQuery(query: HeadcountFteQuery): HeadcountFteQuery {
  const defaults = defaultHeadcountFteQuery()
  const fromMonth = isMonth(query.fromMonth) ? query.fromMonth : defaults.fromMonth
  const toMonth = isMonth(query.toMonth) ? query.toMonth : defaults.toMonth
  const validRange = isHeadcountFtePeriodValid(fromMonth, toMonth)
  return {
    report: 'headcount-fte',
    fromMonth: validRange ? fromMonth : defaults.fromMonth,
    toMonth: validRange ? toMonth : defaults.toMonth,
    administrationIds: [...new Set(query.administrationIds)].slice(0, 100),
    departmentIds: [...new Set(query.departmentIds)].slice(0, 100),
    teamIds: [...new Set(query.teamIds)].slice(0, 100),
    sortBy: query.sortBy === 'administration' || query.sortBy === 'fte' ? query.sortBy : 'employeeName',
    sortDirection: query.sortDirection === 'desc' ? 'desc' : 'asc',
    page: Number.isSafeInteger(query.page) && query.page >= 1 ? Math.min(query.page, 400) : 1,
  }
}

export function parseHeadcountFteQuery(params: URLSearchParams): HeadcountFteQuery | null {
  if (params.get('report') !== 'headcount-fte') return null
  const defaults = defaultHeadcountFteQuery()
  const rawFrom = params.get('fromMonth')
  const rawTo = params.get('toMonth')
  const fromMonth = rawFrom && isMonth(rawFrom) ? rawFrom : defaults.fromMonth
  const toMonth = rawTo && isMonth(rawTo) ? rawTo : defaults.toMonth
  if (!isHeadcountFtePeriodValid(fromMonth, toMonth)) return null
  const sortBy = params.get('sortBy')
  return canonicalizeHeadcountFteQuery({
    report: 'headcount-fte',
    fromMonth,
    toMonth,
    administrationIds: values(params, 'administrations'),
    departmentIds: values(params, 'departmentIds'),
    teamIds: values(params, 'teamIds'),
    sortBy: sortBy === 'administration' || sortBy === 'fte' ? sortBy : 'employeeName',
    sortDirection: params.get('sortDirection') === 'desc' ? 'desc' : 'asc',
    page: Number(params.get('page')),
  })
}

export function headcountFteQueryParams(input: HeadcountFteQuery): URLSearchParams {
  const query = canonicalizeHeadcountFteQuery(input)
  const params = new URLSearchParams({
    report: query.report,
    fromMonth: query.fromMonth,
    toMonth: query.toMonth,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    page: String(query.page),
  })
  for (const value of query.administrationIds) params.append('administrations', value)
  for (const value of query.departmentIds) params.append('departmentIds', value)
  for (const value of query.teamIds) params.append('teamIds', value)
  return params
}

export function headcountFteExportParams(query: HeadcountFteQuery): URLSearchParams {
  const params = headcountFteQueryParams(query)
  params.delete('page')
  params.set('format', 'csv')
  return params
}
