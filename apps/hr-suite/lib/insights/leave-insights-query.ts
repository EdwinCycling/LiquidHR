import { LEAVE_INSIGHT_VIEWS, type LeaveInsightsQuery, type LeaveInsightsSeverity, type LeaveInsightsView } from './leave-insights-types'

const DEFAULT_RESERVOIR_THRESHOLD = 0.75

function value(params: URLSearchParams, key: string): string | null {
  const result = params.get(key)?.trim()
  return result || null
}

function validDate(candidate: string | null, fallback: string): string {
  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return fallback
  const parsed = new Date(`${candidate}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate ? fallback : candidate
}

function currentYear(): number {
  return new Date().getUTCFullYear()
}

function safeYear(candidate: string | null): number {
  const parsed = Number(candidate)
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : currentYear()
}

function isView(candidate: string | null): candidate is LeaveInsightsView {
  return candidate !== null && (LEAVE_INSIGHT_VIEWS as readonly string[]).includes(candidate)
}

function isSeverity(candidate: string | null): candidate is LeaveInsightsSeverity {
  return candidate === 'INFO' || candidate === 'ATTENTION' || candidate === 'ACTION_REQUIRED'
}

function safeThreshold(candidate: string | null): number {
  const parsed = Number(candidate)
  return Number.isFinite(parsed) && parsed >= 0.05 && parsed <= 1 ? Math.round(parsed * 100) / 100 : DEFAULT_RESERVOIR_THRESHOLD
}

export function defaultLeaveInsightsQuery(): LeaveInsightsQuery {
  const year = currentYear()
  const today = new Date().toISOString().slice(0, 10)
  return {
    report: 'leave',
    view: 'overview',
    year,
    asOfDate: today,
    periodStart: `${year}-01-01`,
    periodEnd: `${year}-12-31`,
    departmentId: null,
    managerId: null,
    leaveTypeId: null,
    profileId: null,
    severity: null,
    reservoirThreshold: DEFAULT_RESERVOIR_THRESHOLD,
  }
}

export function parseLeaveInsightsQuery(params: URLSearchParams): LeaveInsightsQuery | null {
  if (value(params, 'report') !== 'leave') return null
  const defaults = defaultLeaveInsightsQuery()
  const year = safeYear(value(params, 'year'))
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  const periodStart = validDate(value(params, 'periodStart'), yearStart)
  const periodEnd = validDate(value(params, 'periodEnd'), yearEnd)
  const view = value(params, 'view')
  const severity = value(params, 'severity')
  return {
    ...defaults,
    view: isView(view) ? view : defaults.view,
    year,
    asOfDate: validDate(value(params, 'asOfDate'), year === defaults.year ? defaults.asOfDate : yearEnd),
    periodStart: periodStart <= periodEnd ? periodStart : yearStart,
    periodEnd: periodStart <= periodEnd ? periodEnd : yearEnd,
    departmentId: value(params, 'departmentId'),
    managerId: value(params, 'managerId'),
    leaveTypeId: value(params, 'leaveTypeId'),
    profileId: value(params, 'profileId'),
    severity: isSeverity(severity) ? severity : null,
    reservoirThreshold: safeThreshold(value(params, 'reservoirThreshold')),
  }
}

export function leaveInsightsQueryParams(query: LeaveInsightsQuery, format?: 'csv'): URLSearchParams {
  const params = new URLSearchParams({
    report: 'leave',
    view: query.view,
    year: String(query.year),
    asOfDate: query.asOfDate,
    periodStart: query.periodStart,
    periodEnd: query.periodEnd,
    reservoirThreshold: String(query.reservoirThreshold),
  })
  for (const [key, value] of [
    ['departmentId', query.departmentId],
    ['managerId', query.managerId],
    ['leaveTypeId', query.leaveTypeId],
    ['profileId', query.profileId],
    ['severity', query.severity],
  ] as const) if (value) params.set(key, value)
  if (format) params.set('format', format)
  return params
}

export function leaveInsightsOwnedQueryKeys(): readonly string[] {
  return ['view', 'year', 'asOfDate', 'periodStart', 'periodEnd', 'departmentId', 'managerId', 'leaveTypeId', 'profileId', 'severity', 'reservoirThreshold']
}
