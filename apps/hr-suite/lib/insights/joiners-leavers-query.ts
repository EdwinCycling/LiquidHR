export const JOINERS_LEAVERS_EVENT_TYPES = ['employment-start', 'employment-end', 'termination', 'reconciliation'] as const
export type JoinersLeaversEventType = typeof JOINERS_LEAVERS_EVENT_TYPES[number]

export interface JoinersLeaversQuery {
  report: 'joiners-leavers'
  fromMonth: string
  toMonth: string
  administrationIds: string[]
  departmentIds: string[]
  teamIds: string[]
  eventTypes: JoinersLeaversEventType[]
  sortBy: 'eventDate' | 'employeeName' | 'eventType' | 'administration'
  sortDirection: 'asc' | 'desc'
  page: number
}

export const JOINERS_LEAVERS_PAGE_SIZE = 25
const EARLIEST_REPORT_MONTH = '2021-01'

export function latestCompletedJoinersLeaversMonth(now = new Date()): string {
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

export function isJoinersLeaversPeriodValid(fromMonth: string, toMonth: string, now = new Date()): boolean {
  return isMonth(fromMonth) && isMonth(toMonth) && fromMonth >= EARLIEST_REPORT_MONTH && fromMonth <= toMonth
    && toMonth <= latestCompletedJoinersLeaversMonth(now)
    && monthDistance(fromMonth, toMonth) < 120
}

function values(params: URLSearchParams, key: string): string[] {
  return [...new Set(params.getAll(key).flatMap((value) => value.split(',').map((entry) => entry.trim()).filter(Boolean)))].slice(0, 100)
}

export function defaultJoinersLeaversQuery(now = new Date()): JoinersLeaversQuery {
  const lastCompleted = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
  const toMonth = latestCompletedJoinersLeaversMonth(now)
  const firstMonth = new Date(Date.UTC(lastCompleted.getUTCFullYear(), lastCompleted.getUTCMonth() - 11, 1)).toISOString().slice(0, 7)
  return {
    report: 'joiners-leavers',
    fromMonth: firstMonth < EARLIEST_REPORT_MONTH ? EARLIEST_REPORT_MONTH : firstMonth,
    toMonth,
    administrationIds: [],
    departmentIds: [],
    teamIds: [],
    eventTypes: [],
    sortBy: 'eventDate',
    sortDirection: 'desc',
    page: 1,
  }
}

export function paginateJoinersLeaversRows<T>(rows: readonly T[], requestedPage: number): { page: number; totalPages: number; rows: T[] } {
  const totalPages = Math.max(1, Math.ceil(rows.length / JOINERS_LEAVERS_PAGE_SIZE))
  const page = Math.max(1, Math.min(Number.isSafeInteger(requestedPage) ? requestedPage : 1, totalPages))
  return { page, totalPages, rows: rows.slice((page - 1) * JOINERS_LEAVERS_PAGE_SIZE, page * JOINERS_LEAVERS_PAGE_SIZE) }
}

export function canonicalizeJoinersLeaversQuery(query: JoinersLeaversQuery): JoinersLeaversQuery {
  const defaults = defaultJoinersLeaversQuery()
  const fromMonth = isMonth(query.fromMonth) ? query.fromMonth : defaults.fromMonth
  const toMonth = isMonth(query.toMonth) ? query.toMonth : defaults.toMonth
  const validRange = isJoinersLeaversPeriodValid(fromMonth, toMonth)
  return {
    report: 'joiners-leavers',
    fromMonth: validRange ? fromMonth : defaults.fromMonth,
    toMonth: validRange ? toMonth : defaults.toMonth,
    administrationIds: [...new Set(query.administrationIds)].slice(0, 100),
    departmentIds: [...new Set(query.departmentIds)].slice(0, 100),
    teamIds: [...new Set(query.teamIds)].slice(0, 100),
    eventTypes: [...new Set(query.eventTypes)].filter((value): value is JoinersLeaversEventType => JOINERS_LEAVERS_EVENT_TYPES.includes(value)).slice(0, JOINERS_LEAVERS_EVENT_TYPES.length),
    sortBy: query.sortBy === 'employeeName' || query.sortBy === 'eventType' || query.sortBy === 'administration' ? query.sortBy : 'eventDate',
    sortDirection: query.sortDirection === 'asc' ? 'asc' : 'desc',
    page: Number.isSafeInteger(query.page) && query.page >= 1 ? Math.min(query.page, 400) : 1,
  }
}

export function parseJoinersLeaversQuery(params: URLSearchParams): JoinersLeaversQuery | null {
  if (params.get('report') !== 'joiners-leavers') return null
  const defaults = defaultJoinersLeaversQuery()
  const rawFrom = params.get('fromMonth')
  const rawTo = params.get('toMonth')
  const fromMonth = rawFrom && isMonth(rawFrom) ? rawFrom : defaults.fromMonth
  const toMonth = rawTo && isMonth(rawTo) ? rawTo : defaults.toMonth
  if (!isJoinersLeaversPeriodValid(fromMonth, toMonth)) return null
  const sortBy = params.get('sortBy')
  const eventTypes = values(params, 'eventTypes').filter((value): value is JoinersLeaversEventType => JOINERS_LEAVERS_EVENT_TYPES.includes(value as JoinersLeaversEventType))
  return canonicalizeJoinersLeaversQuery({
    report: 'joiners-leavers',
    fromMonth,
    toMonth,
    administrationIds: values(params, 'administrations'),
    departmentIds: values(params, 'departmentIds'),
    teamIds: values(params, 'teamIds'),
    eventTypes,
    sortBy: sortBy === 'employeeName' || sortBy === 'eventType' || sortBy === 'administration' ? sortBy : 'eventDate',
    sortDirection: params.get('sortDirection') === 'asc' ? 'asc' : 'desc',
    page: Number(params.get('page')),
  })
}

export function joinersLeaversQueryParams(input: JoinersLeaversQuery): URLSearchParams {
  const query = canonicalizeJoinersLeaversQuery(input)
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
  for (const value of query.eventTypes) params.append('eventTypes', value)
  return params
}

export function joinersLeaversExportParams(query: JoinersLeaversQuery): URLSearchParams {
  const params = joinersLeaversQueryParams(query)
  params.delete('page')
  params.set('format', 'csv')
  return params
}
