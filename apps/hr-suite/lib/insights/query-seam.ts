import type { ReactNode } from 'react'
import { INSIGHT_REPORTS, type InsightReportId } from './report-catalog'

export type InsightAudience = 'HR_ADMIN' | 'DIRECT_MANAGER' | 'EMPLOYEE'
export type InsightFilterKind = 'single' | 'multi' | 'date' | 'period' | 'search' | 'boolean'

export interface InsightFilterDescriptor {
  key: string
  kind: InsightFilterKind
  labelKey: string
  multiple: boolean
}

export interface InsightActiveFilterLabel {
  key: string
  label: string
  value: string
}

export interface InsightDrilldownContext {
  source: 'insights'
  returnTo: string
}

export interface InsightReportViewProps<TQuery, TReport> {
  query: TQuery
  report: TReport
}

export interface InsightReportView<TQuery, TReport> {
  key: string
  render: (props: InsightReportViewProps<TQuery, TReport>) => ReactNode
}

export interface InsightReportAdapter<TQuery, TReport = unknown> {
  id: InsightReportId
  audience: readonly InsightAudience[]
  permissions: readonly string[]
  query: {
    parse: (params: URLSearchParams) => TQuery | null
    serialize: (query: TQuery) => URLSearchParams
    defaults: () => TQuery
    canonicalize: (query: TQuery) => TQuery
  }
  ownedQueryKeys: readonly string[]
  filters: readonly InsightFilterDescriptor[]
  loader: (query: TQuery) => Promise<TReport>
  exporter: (query: TQuery) => URLSearchParams
  activeFilterLabels: (query: TQuery) => readonly InsightActiveFilterLabel[]
  drilldown: (query: TQuery) => InsightDrilldownContext
  view: InsightReportView<TQuery, TReport>
}

export function defineInsightReportAdapter<TQuery, TReport>(adapter: InsightReportAdapter<TQuery, TReport>): InsightReportAdapter<TQuery, TReport> {
  return adapter
}

const reportAliases: Readonly<Record<string, InsightReportId>> = {
  upcomingEvents: 'upcoming-events',
}

const reportQueryKeys: Readonly<Record<InsightReportId, readonly string[]>> = {
  'employee-department': ['groupBy', 'group', 'sortBy', 'sort', 'year', 'month', 'fullYear', 'years', 'teams', 'segments', 'reasons', 'employeeStatus'],
  'employee-gender': ['groupBy', 'group', 'sortBy', 'sort', 'year', 'month', 'fullYear', 'years', 'teams', 'segments', 'reasons', 'employeeStatus'],
  'employee-age': ['groupBy', 'group', 'sortBy', 'sort', 'year', 'month', 'fullYear', 'years', 'teams', 'segments', 'reasons', 'employeeStatus'],
  terminations: ['groupBy', 'group', 'sortBy', 'sort', 'year', 'month', 'fullYear', 'years', 'teams', 'segments', 'reasons', 'employeeStatus'],
  'upcoming-events': ['types', 'period', 'departmentIds', 'departmentId', 'departments'],
  leave: [],
  absence: ['period', 'year', 'month', 'departmentId', 'department'],
  'absence-bradford': ['period', 'year', 'month', 'departmentId', 'department', 'groupBy', 'group', 'risk', 'search'],
  'absence-frequent': ['period', 'year', 'month', 'departmentId', 'department', 'search', 'frequentOnly'],
  'salary-overview': salaryQueryKeys(),
  'salary-band-position': salaryQueryKeys(),
  'salary-band-status': salaryQueryKeys(),
  'salary-scale-steps': salaryQueryKeys(),
  'salary-structure-exceptions': salaryQueryKeys(),
  'salary-internal-position': salaryQueryKeys(),
  provision: [],
  wvp: [],
  'ai-usage': ['period'],
}

function salaryQueryKeys(): readonly string[] {
  return ['asOfDate', 'groupBy', 'sortBy', 'departmentId', 'departmentIds', 'departments', 'administrations', 'teams', 'managers', 'functions', 'functionGroups', 'locations', 'laborConditions', 'structures', 'bands', 'scales', 'steps', 'fteBuckets', 'employmentTypes', 'salaryRoutes', 'statuses', 'severities', 'exceptionTypes']
}

const allReportQueryKeys = [...new Set(Object.values(reportQueryKeys).flat())]
const arrayQueryKeys = new Set(['teams', 'segments', 'reasons', 'types', 'departmentIds', 'departments', 'administrations', 'managers', 'functions', 'functionGroups', 'locations', 'laborConditions', 'structures', 'bands', 'scales', 'steps', 'fteBuckets', 'employmentTypes', 'salaryRoutes', 'statuses', 'severities', 'exceptionTypes'])

export function canonicalInsightReportId(value: string | null | undefined): InsightReportId | null {
  if (!value) return null
  const aliased = reportAliases[value]
  if (aliased) return aliased
  return INSIGHT_REPORTS.some((report) => report.id === value) ? value as InsightReportId : null
}

export function insightReportQueryKeys(report: InsightReportId): readonly string[] {
  return reportQueryKeys[report]
}

function splitValues(values: readonly string[]): string[] {
  return [...new Set(values.flatMap((value) => value.split(',').map((item) => item.trim()).filter(Boolean)))]
}

function rewriteArray(params: URLSearchParams, canonicalKey: string, aliases: readonly string[] = [canonicalKey]): void {
  const values = splitValues(aliases.flatMap((key) => params.getAll(key)))
  for (const key of aliases) params.delete(key)
  for (const value of values) params.append(canonicalKey, value)
}

function rewriteAlias(params: URLSearchParams, canonicalKey: string, legacyKey: string): void {
  if (!params.has(canonicalKey) && params.has(legacyKey)) params.set(canonicalKey, params.get(legacyKey) ?? '')
  params.delete(legacyKey)
}

function canonicalizeReportParams(params: URLSearchParams, report: InsightReportId): void {
  rewriteAlias(params, 'groupBy', 'group')
  rewriteAlias(params, 'sortBy', 'sort')

  if (report === 'absence' || report === 'absence-bradford' || report === 'absence-frequent') {
    rewriteAlias(params, 'departmentId', 'department')
    params.delete('departmentIds')
    params.delete('departments')
  } else if (report === 'upcoming-events') {
    rewriteArray(params, 'departmentIds', ['departmentIds', 'departmentId', 'departments'])
  } else if (report.startsWith('salary-')) {
    rewriteArray(params, 'departmentIds', ['departmentIds', 'departmentId', 'departments'])
  }

  for (const key of arrayQueryKeys) {
    if (key !== 'departments' && key !== 'departmentIds' && key !== 'departmentId') rewriteArray(params, key)
  }
}

export function canonicalizeInsightParams(input: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(input.toString())
  const report = canonicalInsightReportId(params.get('report'))
  if (!report) {
    params.delete('report')
    for (const key of allReportQueryKeys) params.delete(key)
    return params
  }
  params.set('report', report)
  const ownedKeys = new Set(reportQueryKeys[report])
  for (const key of allReportQueryKeys) if (!ownedKeys.has(key)) params.delete(key)
  canonicalizeReportParams(params, report)
  return params
}

function insightHref(params: URLSearchParams): string {
  const query = params.toString()
  return query ? `/insights?${query}` : '/insights'
}

export function canonicalInsightHref(input: URLSearchParams): string {
  return insightHref(canonicalizeInsightParams(input))
}

function clearReportQueryState(params: URLSearchParams): void {
  params.delete('report')
  for (const key of allReportQueryKeys) params.delete(key)
}

export function buildInsightReportNavigationHref(current: URLSearchParams, nextReport: InsightReportId | null): string {
  const params = canonicalizeInsightParams(current)
  clearReportQueryState(params)
  if (nextReport) params.set('report', nextReport)
  return insightHref(params)
}

export function buildInsightApplyHref(current: URLSearchParams, serializedQuery: URLSearchParams): string {
  const params = canonicalizeInsightParams(current)
  clearReportQueryState(params)
  const next = canonicalizeInsightParams(serializedQuery)
  for (const [key, value] of next.entries()) params.append(key, value)
  return insightHref(params)
}

export function normalizeInsightReturnPath(value: string | null | undefined): string {
  if (!value || value.startsWith('//') || !value.startsWith('/')) return '/insights'
  try {
    const parsed = new URL(value, 'https://liquidhr.invalid')
    if (parsed.origin !== 'https://liquidhr.invalid' || parsed.pathname !== '/insights') return '/insights'
    return canonicalInsightHref(parsed.searchParams)
  } catch {
    return '/insights'
  }
}

function returnContextParams(returnTo: string, extras: Readonly<Record<string, string>>): URLSearchParams {
  const params = new URLSearchParams({ from: 'insights', returnTo: normalizeInsightReturnPath(returnTo) })
  for (const [key, value] of Object.entries(extras)) params.set(key, value)
  return params
}

export function insightEmployeeDrilldownHref(employeeId: string, returnTo: string, tab?: string): string {
  const query = returnContextParams(returnTo, tab ? { tab } : {})
  return `/employees/${encodeURIComponent(employeeId)}?${query.toString()}`
}

export function insightEmploymentDrilldownHref(employeeId: string, employmentId: string, returnTo: string, tab: string): string {
  const query = returnContextParams(returnTo, { tab, fromTab: 'overview' })
  return `/employees/${encodeURIComponent(employeeId)}/employments/${encodeURIComponent(employmentId)}?${query.toString()}`
}
