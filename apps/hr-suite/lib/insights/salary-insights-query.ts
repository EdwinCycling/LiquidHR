import { SALARY_INSIGHT_REPORT_IDS, type SalaryInsightFilters, type SalaryInsightGroupBy, type SalaryInsightReportId, type SalaryInsightSortBy } from './salary-insights-types'
import { defaultSalaryInsightFilters } from './salary-insights-calculations'

export interface SalaryInsightQuery extends SalaryInsightFilters {
  report: SalaryInsightReportId
}

type SalaryInsightArrayField = 'administrations' | 'departments' | 'teams' | 'managers' | 'functions' | 'functionGroups' | 'locations' | 'laborConditions' | 'structures' | 'bands' | 'scales' | 'steps' | 'fteBuckets' | 'employmentTypes' | 'salaryRoutes' | 'statuses' | 'severities' | 'exceptionTypes'

const groupByValues: Record<SalaryInsightReportId, readonly SalaryInsightGroupBy[]> = {
  'salary-overview': ['salaryRoute', 'administration', 'department', 'functionGroup'],
  'salary-band-position': ['salaryBand', 'salaryStructure', 'administration', 'department', 'team', 'functionGroup', 'status'],
  'salary-band-status': ['status', 'salaryBand', 'administration', 'team'],
  'salary-scale-steps': ['salaryStructure', 'salaryScale', 'salaryStep', 'administration', 'team', 'functionGroup', 'validity'],
  'salary-structure-exceptions': ['severity', 'exceptionType', 'administration', 'salaryStructure'],
  'salary-internal-position': ['function', 'functionGroup', 'salaryBand', 'administration'],
}

const sortByValues: Record<SalaryInsightReportId, readonly SalaryInsightSortBy[]> = {
  'salary-overview': ['name', 'salary-desc', 'salary-asc', 'fte', 'status'],
  'salary-band-position': ['compa-desc', 'compa-asc', 'band', 'name'],
  'salary-band-status': ['status', 'deviation', 'name'],
  'salary-scale-steps': ['structure', 'scale', 'step', 'name'],
  'salary-structure-exceptions': ['severity', 'date', 'type', 'name'],
  'salary-internal-position': ['median-delta', 'relative-position', 'name'],
}

export function salaryInsightGroupByOptions(report: SalaryInsightReportId): readonly SalaryInsightGroupBy[] {
  return groupByValues[report]
}

export function salaryInsightSortByOptions(report: SalaryInsightReportId): readonly SalaryInsightSortBy[] {
  return sortByValues[report]
}

function isReport(value: string | null): value is SalaryInsightReportId {
  return value !== null && (SALARY_INSIGHT_REPORT_IDS as readonly string[]).includes(value)
}

function list(params: URLSearchParams, key: string): string[] {
  return [...new Set((params.get(key) ?? '').split(',').map((value) => value.trim()).filter(Boolean))]
}

function validDate(value: string | null, fallback: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? fallback : value
}

export function parseSalaryInsightQuery(params: URLSearchParams): SalaryInsightQuery | null {
  const reportValue = params.get('report')
  if (!isReport(reportValue)) return null
  const defaults = defaultSalaryInsightFilters(reportValue)
  const asOfDate = validDate(params.get('asOfDate'), defaults.asOfDate)
  const group = params.get('groupBy')
  const sort = params.get('sortBy')
  return {
    report: reportValue,
    ...defaults,
    asOfDate,
    groupBy: salaryInsightGroupByOptions(reportValue).includes(group as SalaryInsightGroupBy) ? group as SalaryInsightGroupBy : defaults.groupBy,
    sortBy: salaryInsightSortByOptions(reportValue).includes(sort as SalaryInsightSortBy) ? sort as SalaryInsightSortBy : defaults.sortBy,
    administrations: list(params, 'administrations'),
    departments: list(params, 'departments'),
    teams: list(params, 'teams'),
    managers: list(params, 'managers'),
    functions: list(params, 'functions'),
    functionGroups: list(params, 'functionGroups'),
    locations: list(params, 'locations'),
    laborConditions: list(params, 'laborConditions'),
    structures: list(params, 'structures'),
    bands: list(params, 'bands'),
    scales: list(params, 'scales'),
    steps: list(params, 'steps'),
    fteBuckets: list(params, 'fteBuckets'),
    employmentTypes: list(params, 'employmentTypes'),
    salaryRoutes: list(params, 'salaryRoutes'),
    statuses: list(params, 'statuses'),
    severities: list(params, 'severities'),
    exceptionTypes: list(params, 'exceptionTypes'),
  }
}

export function salaryInsightQueryParams(query: SalaryInsightQuery, format?: 'csv'): URLSearchParams {
  const params = new URLSearchParams({ report: query.report, asOfDate: query.asOfDate, groupBy: query.groupBy, sortBy: query.sortBy })
  if (format) params.set('format', format)
  const fields: SalaryInsightArrayField[] = ['administrations', 'departments', 'teams', 'managers', 'functions', 'functionGroups', 'locations', 'laborConditions', 'structures', 'bands', 'scales', 'steps', 'fteBuckets', 'employmentTypes', 'salaryRoutes', 'statuses', 'severities', 'exceptionTypes']
  for (const field of fields) if (query[field].length) params.set(field, query[field].join(','))
  return params
}
