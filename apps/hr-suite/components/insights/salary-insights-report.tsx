'use client'

import { ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select'
import { InsightsActiveFilters, InsightsExportAction, InsightsFilterBar, type InsightActiveFilter } from '@/components/insights/shared-controls'
import { formatDate } from '@/lib/preferences/formatters'
import type { DateFormat } from '@/lib/preferences/user-preferences'
import { defaultSalaryInsightFilters } from '@/lib/insights/salary-insights-calculations'
import { salaryInsightGroupByOptions, salaryInsightQueryParams, salaryInsightSortByOptions, type SalaryInsightQuery } from '@/lib/insights/salary-insights-query'
import type {
  SalaryInsightChart,
  SalaryInsightExceptionType,
  SalaryInsightFilterOptions,
  SalaryInsightFilters,
  SalaryInsightGroupBy,
  SalaryInsightOption,
  SalaryInsightReport,
  SalaryInsightRow,
  SalaryInsightSortBy,
} from '@/lib/insights/salary-insights-types'
import { buildInsightApplyHref, insightEmploymentDrilldownHref } from '@/lib/insights/query-seam'

export interface SalaryInsightsLabels {
  activeFilters: string
  applyFilters: string
  clearFilters: string
  authorizedData: string
  employee: string
  filterStatus: string
  groupBy: string
  groups: string
  noOptions: string
  noResults: string
  people: string
  search: string
  searchOptions: string
  selectAll: string
  selected: string
  salaryAdministration: string
  salaryAll: string
  salaryAsOfDate: string
  salaryBand: string
  salaryBandVisual: string
  salaryBandOpenMaximum: string
  salaryActionView: string
  salaryChartBandStatus: string
  salaryChartCompaDistribution: string
  salaryChartExcluded: string
  salaryChartFteSalary: string
  salaryChartGroupDistribution: string
  salaryChartPeerPosition: string
  salaryChartEligible: string
  salaryDistribution: string
  salaryEmploymentType: string
  salaryExceptionDisabledStructure: string
  salaryExceptionInvalidScaleStep: string
  salaryExceptionNoPublishedRevision: string
  salaryExceptionNoValidBand: string
  salaryExceptionType: string
  salaryExport: string
  exportPreparing: string
  exportSuccess: string
  exportFailed: string
  salaryFte: string
  salaryFteFullOrMore: string
  salaryFteHalfToFull: string
  salaryFteLessThanHalf: string
  salaryFunction: string
  salaryFunctionGroup: string
  salaryGroupAdministration: string
  salaryGroupBand: string
  salaryGroupDepartment: string
  salaryGroupExceptionType: string
  salaryGroupFunction: string
  salaryGroupFunctionGroup: string
  salaryGroupRoute: string
  salaryGroupScale: string
  salaryGroupSeverity: string
  salaryGroupStatus: string
  salaryGroupStep: string
  salaryGroupStructure: string
  salaryGroupTeam: string
  salaryGroupValidity: string
  salaryKpiAboveBand: string
  salaryKpiActionRequired: string
  salaryKpiAttention: string
  salaryKpiAverageCompa: string
  salaryKpiAverageFte: string
  salaryKpiAverageFulltimeSalary: string
  salaryKpiAverageMedianDelta: string
  salaryKpiBelowBand: string
  salaryKpiEmployees: string
  salaryKpiExceptions: string
  salaryKpiInsufficientGroups: string
  salaryKpiInvalidScaleStep: string
  salaryKpiMedianFulltimeSalary: string
  salaryKpiNoValidBand: string
  salaryKpiSalarySum: string
  salaryKpiScales: string
  salaryKpiSteps: string
  salaryKpiStructures: string
  salaryKpiSufficientGroups: string
  salaryKpiTotal: string
  salaryKpiWithinBand: string
  salaryLaborCondition: string
  salaryLessFilters: string
  salaryLoading: string
  salaryLoadFailed: string
  salaryNoEmployees: string
  salaryNoBandRows: string
  salaryNoExceptions: string
  salaryNoPeerGroup: string
  salaryLocation: string
  salaryManager: string
  salaryMoreFilters: string
  salaryNextMonth: string
  salaryNoRows: string
  salaryNotAvailable: string
  salaryPeerInsufficient: string
  salaryPeerSufficient: string
  salaryPreviousMonth: string
  salaryPrivacy: string
  salaryResetDate: string
  resetFilters: string
  removeFilter: string
  salaryRoute: string
  salaryRouteManual: string
  salaryRouteMinimumWage: string
  salaryRouteNoSalary: string
  salaryRouteSalaryBand: string
  salaryRouteScaleWithSteps: string
  salaryRows: string
  salaryScale: string
  salarySeverity: string
  salarySeverityActionRequired: string
  salarySeverityAttention: string
  salarySortCompaAsc: string
  salarySortCompaDesc: string
  salarySortDate: string
  salarySortDeviation: string
  salarySortFte: string
  salarySortMedianDelta: string
  salarySortName: string
  salarySortRelativePosition: string
  salarySortSalaryAsc: string
  salarySortSalaryDesc: string
  salarySortScale: string
  salarySortSeverity: string
  salarySortStatus: string
  salarySortStep: string
  salarySortStructure: string
  salarySortType: string
  salaryStatus: string
  salaryStatusAboveMaximum: string
  salaryStatusNoValidBand: string
  salaryStatusUnderMinimum: string
  salaryStatusValid: string
  salaryStatusWithinRange: string
  salaryStep: string
  salaryStructure: string
  salaryTableActualSalary: string
  salaryTableBandOrScale: string
  salaryTableCompa: string
  salaryTableComparisonStatus: string
  salaryTableDeviation: string
  salaryTableException: string
  salaryTableEmployment: string
  salaryTableFte: string
  salaryTableFulltimeSalary: string
  salaryTableFunction: string
  salaryTableMaximum: string
  salaryTableMedianDelta: string
  salaryTableMedianDeltaPercentage: string
  salaryTableMidpoint: string
  salaryTableMinimum: string
  salaryTablePeerAverage: string
  salaryTablePeerGroup: string
  salaryTablePeerMedian: string
  salaryTablePeerSize: string
  salaryTableRangePenetration: string
  salaryTableRelativePosition: string
  salaryTableRevisionDate: string
  salaryTableRoute: string
  salaryTableSalaryBand: string
  salaryTableScale: string
  salaryTableStep: string
  salaryTableStructure: string
  selectionClose: string
  selectionOpen: string
  sortBy: string
}

type FilterField = keyof Pick<SalaryInsightFilters, 'administrations' | 'departments' | 'teams' | 'managers' | 'functions' | 'functionGroups' | 'locations' | 'laborConditions' | 'structures' | 'bands' | 'scales' | 'steps' | 'fteBuckets' | 'employmentTypes' | 'salaryRoutes' | 'statuses' | 'severities' | 'exceptionTypes'>

const filterFields: readonly { key: FilterField; label: keyof SalaryInsightsLabels }[] = [
  { key: 'administrations', label: 'salaryAdministration' },
  { key: 'departments', label: 'salaryGroupDepartment' },
  { key: 'teams', label: 'salaryGroupTeam' },
  { key: 'managers', label: 'salaryManager' },
  { key: 'functions', label: 'salaryFunction' },
  { key: 'functionGroups', label: 'salaryFunctionGroup' },
  { key: 'locations', label: 'salaryLocation' },
  { key: 'laborConditions', label: 'salaryLaborCondition' },
  { key: 'structures', label: 'salaryStructure' },
  { key: 'bands', label: 'salaryBand' },
  { key: 'scales', label: 'salaryScale' },
  { key: 'steps', label: 'salaryStep' },
  { key: 'fteBuckets', label: 'salaryFte' },
  { key: 'employmentTypes', label: 'salaryEmploymentType' },
  { key: 'salaryRoutes', label: 'salaryRoute' },
  { key: 'statuses', label: 'salaryStatus' },
  { key: 'severities', label: 'salarySeverity' },
  { key: 'exceptionTypes', label: 'salaryExceptionType' },
]

const primaryFiltersByReport: Record<SalaryInsightReport['report'], readonly FilterField[]> = {
  'salary-overview': ['administrations', 'teams', 'departments', 'salaryRoutes'],
  'salary-band-position': ['structures', 'bands', 'teams', 'administrations'],
  'salary-band-status': ['statuses', 'structures', 'bands', 'teams'],
  'salary-scale-steps': ['structures', 'scales', 'steps', 'teams'],
  'salary-structure-exceptions': ['severities', 'exceptionTypes', 'structures', 'administrations'],
  'salary-internal-position': ['functions', 'functionGroups', 'bands', 'administrations'],
}

const secondaryFiltersByReport: Record<SalaryInsightReport['report'], readonly FilterField[]> = {
  'salary-overview': ['managers', 'functions', 'functionGroups', 'locations', 'laborConditions', 'employmentTypes'],
  'salary-band-position': ['departments', 'managers', 'functions', 'functionGroups', 'locations', 'laborConditions', 'fteBuckets'],
  'salary-band-status': ['administrations', 'departments', 'managers', 'functions', 'functionGroups', 'locations', 'laborConditions'],
  'salary-scale-steps': ['administrations', 'departments', 'managers', 'functions', 'functionGroups', 'locations', 'laborConditions', 'employmentTypes'],
  'salary-structure-exceptions': ['departments', 'teams', 'managers', 'salaryRoutes', 'bands', 'scales', 'steps'],
  'salary-internal-position': ['departments', 'teams', 'locations', 'laborConditions', 'structures', 'fteBuckets'],
}

const codeLabels: Record<string, keyof SalaryInsightsLabels> = {
  MANUAL: 'salaryRouteManual',
  MINIMUM_WAGE: 'salaryRouteMinimumWage',
  SCALE_WITH_STEPS: 'salaryRouteScaleWithSteps',
  SALARY_BAND: 'salaryRouteSalaryBand',
  NO_SALARY: 'salaryRouteNoSalary',
  UNDER_MINIMUM: 'salaryStatusUnderMinimum',
  WITHIN_RANGE: 'salaryStatusWithinRange',
  ABOVE_MAXIMUM: 'salaryStatusAboveMaximum',
  NO_VALID_BAND: 'salaryStatusNoValidBand',
  VALID: 'salaryStatusValid',
  ATTENTION: 'salarySeverityAttention',
  ACTION_REQUIRED: 'salarySeverityActionRequired',
  'lt0.5': 'salaryFteLessThanHalf',
  '0.5to1': 'salaryFteHalfToFull',
  gte1: 'salaryFteFullOrMore',
  DISABLED_STRUCTURE: 'salaryExceptionDisabledStructure',
  INVALID_SCALE_STEP: 'salaryExceptionInvalidScaleStep',
  NO_PUBLISHED_REVISION: 'salaryExceptionNoPublishedRevision',
  NO_DEPARTMENT: 'salaryNotAvailable',
  NO_FUNCTION: 'salaryNotAvailable',
  NO_FUNCTION_GROUP: 'salaryNotAvailable',
  NO_STRUCTURE: 'salaryNotAvailable',
  NO_BAND: 'salaryNotAvailable',
  NO_SCALE: 'salaryNotAvailable',
  NO_STEP: 'salaryNotAvailable',
  NONE: 'salaryNotAvailable',
  NO_COMPARISON: 'salaryNoPeerGroup',
}

const groupOptions: readonly { value: SalaryInsightGroupBy; label: keyof SalaryInsightsLabels }[] = [
  { value: 'salaryRoute', label: 'salaryGroupRoute' },
  { value: 'administration', label: 'salaryGroupAdministration' },
  { value: 'department', label: 'salaryGroupDepartment' },
  { value: 'team', label: 'salaryGroupTeam' },
  { value: 'functionGroup', label: 'salaryGroupFunctionGroup' },
  { value: 'salaryStructure', label: 'salaryGroupStructure' },
  { value: 'salaryBand', label: 'salaryGroupBand' },
  { value: 'salaryScale', label: 'salaryGroupScale' },
  { value: 'salaryStep', label: 'salaryGroupStep' },
  { value: 'status', label: 'salaryGroupStatus' },
  { value: 'validity', label: 'salaryGroupValidity' },
  { value: 'severity', label: 'salaryGroupSeverity' },
  { value: 'exceptionType', label: 'salaryGroupExceptionType' },
  { value: 'function', label: 'salaryGroupFunction' },
]

const sortOptions: readonly { value: SalaryInsightSortBy; label: keyof SalaryInsightsLabels }[] = [
  { value: 'name', label: 'salarySortName' },
  { value: 'salary-desc', label: 'salarySortSalaryDesc' },
  { value: 'salary-asc', label: 'salarySortSalaryAsc' },
  { value: 'fte', label: 'salarySortFte' },
  { value: 'status', label: 'salarySortStatus' },
  { value: 'compa-desc', label: 'salarySortCompaDesc' },
  { value: 'compa-asc', label: 'salarySortCompaAsc' },
  { value: 'deviation', label: 'salarySortDeviation' },
  { value: 'structure', label: 'salarySortStructure' },
  { value: 'scale', label: 'salarySortScale' },
  { value: 'step', label: 'salarySortStep' },
  { value: 'severity', label: 'salarySortSeverity' },
  { value: 'date', label: 'salarySortDate' },
  { value: 'type', label: 'salarySortType' },
  { value: 'median-delta', label: 'salarySortMedianDelta' },
  { value: 'relative-position', label: 'salarySortRelativePosition' },
]

function labelForCode(value: string | null | undefined, labels: SalaryInsightsLabels): string | null {
  if (!value) return null
  const key = codeLabels[value]
  return key ? labels[key] : null
}

function displayOption(option: SalaryInsightOption, labels: SalaryInsightsLabels): string {
  return labelForCode(option.value, labels) ?? option.label
}

function shiftMonth(value: string, amount: number): string {
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return value
  parsed.setUTCMonth(parsed.getUTCMonth() + amount)
  return parsed.toISOString().slice(0, 10)
}

function formatMoney(value: string | null, locale: string): string {
  if (value === null) return '—'
  const number = Number(value)
  return Number.isFinite(number) ? new Intl.NumberFormat(locale, { currency: 'EUR', maximumFractionDigits: 2, style: 'currency' }).format(number) : '—'
}

function formatPercentage(value: string | null): string {
  return value === null ? '—' : `${value}%`
}

function formatDeviation(row: SalaryInsightRow, labels: SalaryInsightsLabels, locale: string): string {
  if (row.bandDeviation === null) return labels.salaryNotAvailable
  const amount = formatMoney(String(Math.abs(Number(row.bandDeviation))), locale)
  if (row.bandStatus === 'UNDER_MINIMUM') return `${amount} ${labels.salaryStatusUnderMinimum.toLocaleLowerCase(locale)}`
  if (row.bandStatus === 'ABOVE_MAXIMUM') return `${amount} ${labels.salaryStatusAboveMaximum.toLocaleLowerCase(locale)}`
  return amount
}

function displayStatus(row: SalaryInsightRow, labels: SalaryInsightsLabels): string {
  const value = row.bandStatus ?? row.exceptionType ?? row.exceptionTypes[0] ?? 'VALID'
  return labelForCode(value, labels) ?? labels.salaryNotAvailable
}

function displayException(value: SalaryInsightExceptionType | null, labels: SalaryInsightsLabels): string {
  return value ? labelForCode(value, labels) ?? labels.salaryNotAvailable : labels.salaryNotAvailable
}

function DateControl({ date, labels, onChange }: { date: string; labels: SalaryInsightsLabels; onChange: (date: string) => void }) {
  return <div className="min-w-52 flex-1">
    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.salaryAsOfDate}</span>
    <div className="mt-1 flex items-center gap-1">
      <button aria-label={labels.salaryPreviousMonth} className="grid size-10 shrink-0 place-items-center rounded-xl border bg-background text-muted-foreground hover:text-primary" onClick={() => onChange(shiftMonth(date, -1))} type="button"><ChevronLeft aria-hidden="true" size={16} /></button>
      <input aria-label={labels.salaryAsOfDate} className="form-field min-h-10 min-w-0 flex-1" onChange={(event) => onChange(event.target.value)} type="date" value={date} />
      <button aria-label={labels.salaryNextMonth} className="grid size-10 shrink-0 place-items-center rounded-xl border bg-background text-muted-foreground hover:text-primary" onClick={() => onChange(shiftMonth(date, 1))} type="button"><ChevronRight aria-hidden="true" size={16} /></button>
      <button className="shrink-0 rounded-xl px-2 text-sm font-medium text-primary hover:bg-muted" onClick={() => onChange(new Date().toISOString().slice(0, 10))} type="button">{labels.salaryResetDate}</button>
    </div>
  </div>
}

function kpiLabel(id: string, labels: SalaryInsightsLabels): string {
  const values: Record<string, string> = {
    employees: labels.salaryKpiEmployees,
    salarySum: labels.salaryKpiSalarySum,
    averageFulltimeSalary: labels.salaryKpiAverageFulltimeSalary,
    medianFulltimeSalary: labels.salaryKpiMedianFulltimeSalary,
    averageFte: labels.salaryKpiAverageFte,
    averageCompa: labels.salaryKpiAverageCompa,
    belowBand: labels.salaryKpiBelowBand,
    withinBand: labels.salaryKpiWithinBand,
    aboveBand: labels.salaryKpiAboveBand,
    noValidBand: labels.salaryKpiNoValidBand,
    exceptions: labels.salaryKpiExceptions,
    structures: labels.salaryKpiStructures,
    scales: labels.salaryKpiScales,
    steps: labels.salaryKpiSteps,
    invalidScaleStep: labels.salaryKpiInvalidScaleStep,
    total: labels.salaryKpiTotal,
    attention: labels.salaryKpiAttention,
    actionRequired: labels.salaryKpiActionRequired,
    sufficientGroups: labels.salaryKpiSufficientGroups,
    insufficientGroups: labels.salaryKpiInsufficientGroups,
    averageMedianDelta: labels.salaryKpiAverageMedianDelta,
  }
  return values[id] ?? labels.salaryRows
}

function kpiValue(id: string, value: string, locale: string, dateFormat: DateFormat, labels: SalaryInsightsLabels): string {
  if (value === '—') return labels.salaryNotAvailable
  if (id === 'asOfDate') return formatDate(value, { dateFormat, locale })
  if (id === 'salarySum' || id === 'averageFulltimeSalary' || id === 'medianFulltimeSalary' || id === 'averageMedianDelta') return formatMoney(value, locale)
  if (id === 'averageCompa') return formatPercentage(value)
  return value
}

function Kpi({ id, labels, locale, value, dateFormat }: { id: string; labels: SalaryInsightsLabels; locale: string; value: string; dateFormat: DateFormat }) {
  return <div className="rounded-xl border border-chart-2/25 bg-chart-2/10 p-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{kpiLabel(id, labels)}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-chart-2">{kpiValue(id, value, locale, dateFormat, labels)}</p></div>
}

function chartTitle(kind: SalaryInsightChart['kind'], labels: SalaryInsightsLabels): string {
  if (kind === 'fte-salary') return labels.salaryChartFteSalary
  if (kind === 'compa-distribution') return labels.salaryChartCompaDistribution
  if (kind === 'band-status') return labels.salaryChartBandStatus
  if (kind === 'peer-position') return labels.salaryChartPeerPosition
  return labels.salaryChartGroupDistribution
}

function ChartView({ chart, labels }: { chart: SalaryInsightChart; labels: SalaryInsightsLabels }) {
  const largest = Math.max(...chart.buckets.map((bucket) => bucket.count), 1)
  const title = chartTitle(chart.kind, labels)
  return <section aria-labelledby="salary-insight-chart-title" className="mt-4 rounded-xl border bg-background p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.salaryDistribution}</p><h3 className="mt-1 font-semibold" id="salary-insight-chart-title">{title}</h3></div><div className="text-right text-sm text-muted-foreground"><span className="block tabular-nums">{chart.population} {labels.salaryChartEligible}</span>{chart.excluded > 0 ? <span className="block tabular-nums">{chart.excluded} {labels.salaryChartExcluded}</span> : null}</div></div>
    {chart.buckets.length ? <div aria-label={title} className="mt-5 space-y-3" role="img">
      {chart.buckets.map((bucket) => <div className="grid grid-cols-[minmax(7rem,12rem)_1fr_auto] items-center gap-3 text-sm" key={bucket.value}><span className="truncate text-right text-muted-foreground" title={labelForCode(bucket.value, labels) ?? bucket.label}>{labelForCode(bucket.value, labels) ?? bucket.label}</span><div className="h-7 overflow-hidden rounded-md bg-muted"><div className="h-full rounded-md bg-chart-2" style={{ width: `${Math.max((bucket.count / largest) * 100, bucket.count ? 4 : 0)}%` }} /></div><span className="min-w-24 text-right tabular-nums">{bucket.percentage}% · {bucket.count} {labels.people}</span></div>)}
    </div> : <p className="mt-5 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{labels.salaryNoRows}</p>}
    <ul aria-label={title} className="sr-only">{chart.buckets.map((bucket) => <li key={`text-${bucket.value}`}>{labelForCode(bucket.value, labels) ?? bucket.label}: {bucket.count} {labels.people}</li>)}</ul>
  </section>
}

function BandPositionVisual({ labels, locale, rows }: { labels: SalaryInsightsLabels; locale: string; rows: readonly SalaryInsightRow[] }) {
  const row = rows.find((candidate) => candidate.bandMinimum !== null && candidate.bandMidpoint !== null && candidate.fulltimeSalary !== null)
  if (!row || row.bandMinimum === null || row.bandMidpoint === null || row.fulltimeSalary === null) return null
  const minimum = Number(row.bandMinimum)
  const midpoint = Number(row.bandMidpoint)
  const maximum = row.bandMaximum === null ? null : Number(row.bandMaximum)
  const scaleMaximum = maximum ?? Math.max(midpoint * 1.2, minimum + 1)
  const position = Math.min(100, Math.max(0, ((Number(row.fulltimeSalary) - minimum) / (scaleMaximum - minimum)) * 100))
  return <section aria-label={labels.salaryBandVisual} className="mt-4 rounded-xl border bg-background p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{labels.salaryBandVisual}</h3><span className="text-sm text-muted-foreground">{row.salaryBandName ?? labels.salaryNotAvailable}</span></div><div className="relative mt-8 h-3 rounded-full bg-muted"><div className="absolute inset-y-0 left-0 rounded-full bg-chart-2/45" style={{ width: `${position}%` }} /><span aria-label={`${labels.salaryTableFulltimeSalary}: ${formatMoney(row.fulltimeSalary, locale)}`} className="absolute -top-2 size-7 -translate-x-1/2 rounded-full border-2 border-background bg-chart-2 shadow-sm" style={{ left: `${position}%` }} /></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground"><span>{labels.salaryTableMinimum}: {formatMoney(row.bandMinimum, locale)}</span><span className="text-center">{labels.salaryTableMidpoint}: {formatMoney(row.bandMidpoint, locale)}</span><span className="text-right">{maximum === null ? labels.salaryBandOpenMaximum : `${labels.salaryTableMaximum}: ${formatMoney(row.bandMaximum, locale)}`}</span></div></section>
}

function tableHeaders(report: SalaryInsightReport['report'], labels: SalaryInsightsLabels): ReactNode[] {
  const common = report === 'salary-internal-position'
    ? [<th className="px-5 py-3" key="employee">{labels.employee}</th>, <th className="px-5 py-3" key="function">{labels.salaryTableFunction}</th>]
    : [<th className="px-5 py-3" key="employee">{labels.employee}</th>, <th className="px-5 py-3" key="administration">{labels.salaryAdministration}</th>, <th className="px-5 py-3" key="department">{labels.salaryGroupDepartment}</th>, <th className="px-5 py-3" key="function">{labels.salaryTableFunction}</th>, <th className="px-5 py-3" key="fte">{labels.salaryTableFte}</th>]
  if (report === 'salary-overview') return [...common, <th className="px-5 py-3" key="route">{labels.salaryTableRoute}</th>, <th className="px-5 py-3" key="actual">{labels.salaryTableActualSalary}</th>, <th className="px-5 py-3" key="fulltime">{labels.salaryTableFulltimeSalary}</th>, <th className="px-5 py-3" key="structure">{labels.salaryTableStructure}</th>, <th className="px-5 py-3" key="band-scale">{labels.salaryTableBandOrScale}</th>, <th className="px-5 py-3" key="step">{labels.salaryTableStep}</th>, <th className="px-5 py-3" key="status">{labels.salaryTableComparisonStatus}</th>]
  if (report === 'salary-band-position') return [...common, <th className="px-5 py-3" key="structure">{labels.salaryTableStructure}</th>, <th className="px-5 py-3" key="band">{labels.salaryBand}</th>, <th className="px-5 py-3" key="fulltime">{labels.salaryTableFulltimeSalary}</th>, <th className="px-5 py-3" key="minimum">{labels.salaryTableMinimum}</th>, <th className="px-5 py-3" key="midpoint">{labels.salaryTableMidpoint}</th>, <th className="px-5 py-3" key="maximum">{labels.salaryTableMaximum}</th>, <th className="px-5 py-3" key="compa">{labels.salaryTableCompa}</th>, <th className="px-5 py-3" key="penetration">{labels.salaryTableRangePenetration}</th>, <th className="px-5 py-3" key="status">{labels.salaryTableComparisonStatus}</th>]
  if (report === 'salary-band-status') return [...common, <th className="px-5 py-3" key="structure">{labels.salaryTableStructure}</th>, <th className="px-5 py-3" key="band">{labels.salaryBand}</th>, <th className="px-5 py-3" key="fulltime">{labels.salaryTableFulltimeSalary}</th>, <th className="px-5 py-3" key="minimum">{labels.salaryTableMinimum}</th>, <th className="px-5 py-3" key="midpoint">{labels.salaryTableMidpoint}</th>, <th className="px-5 py-3" key="maximum">{labels.salaryTableMaximum}</th>, <th className="px-5 py-3" key="deviation">{labels.salaryTableDeviation}</th>, <th className="px-5 py-3" key="status">{labels.salaryTableComparisonStatus}</th>]
  if (report === 'salary-scale-steps') return [...common, <th className="px-5 py-3" key="structure">{labels.salaryTableStructure}</th>, <th className="px-5 py-3" key="scale">{labels.salaryTableScale}</th>, <th className="px-5 py-3" key="step">{labels.salaryTableStep}</th>, <th className="px-5 py-3" key="revision">{labels.salaryTableRevisionDate}</th>, <th className="px-5 py-3" key="fulltime">{labels.salaryTableFulltimeSalary}</th>, <th className="px-5 py-3" key="exception">{labels.salaryTableException}</th>]
  if (report === 'salary-structure-exceptions') return [...common, <th className="px-5 py-3" key="employment">{labels.salaryTableEmployment}</th>, <th className="px-5 py-3" key="route">{labels.salaryTableRoute}</th>, <th className="px-5 py-3" key="structure">{labels.salaryTableStructure}</th>, <th className="px-5 py-3" key="band-scale">{labels.salaryTableBandOrScale}</th>, <th className="px-5 py-3" key="step">{labels.salaryTableStep}</th>, <th className="px-5 py-3" key="exception">{labels.salaryTableException}</th>, <th className="px-5 py-3" key="revision">{labels.salaryTableRevisionDate}</th>, <th className="px-5 py-3" key="severity">{labels.salarySeverity}</th>, <th className="px-5 py-3" key="action">{labels.salaryActionView}</th>]
  return [...common, <th className="px-5 py-3" key="peer-group">{labels.salaryTablePeerGroup}</th>, <th className="px-5 py-3" key="peer-size">{labels.salaryTablePeerSize}</th>, <th className="px-5 py-3" key="fulltime">{labels.salaryTableFulltimeSalary}</th>, <th className="px-5 py-3" key="median">{labels.salaryTablePeerMedian}</th>, <th className="px-5 py-3" key="average">{labels.salaryTablePeerAverage}</th>, <th className="px-5 py-3" key="delta">{labels.salaryTableMedianDelta}</th>, <th className="px-5 py-3" key="delta-percent">{labels.salaryTableMedianDeltaPercentage}</th>, <th className="px-5 py-3" key="position">{labels.salaryTableRelativePosition}</th>, <th className="px-5 py-3" key="status">{labels.salaryTableComparisonStatus}</th>]
}

function tableCells(report: SalaryInsightReport['report'], row: SalaryInsightRow, labels: SalaryInsightsLabels, locale: string, dateFormat: DateFormat, returnTo: string): ReactNode[] {
  const salaryHref = insightEmploymentDrilldownHref(row.employeeId, row.employmentId, returnTo, 'salary')
  const employeeCell = <td className="px-5 py-3 font-medium" key="employee"><Link className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href={salaryHref}>{row.employeeName}</Link></td>
  const common: ReactNode[] = report === 'salary-internal-position'
    ? [employeeCell, <td className="px-5 py-3" key="function">{row.functionName ?? labels.salaryNotAvailable}</td>]
    : [employeeCell, <td className="px-5 py-3" key="administration">{row.administrationName ?? labels.salaryNotAvailable}</td>, <td className="px-5 py-3" key="department">{row.departmentName ?? labels.salaryNotAvailable}</td>, <td className="px-5 py-3" key="function">{row.functionName ?? labels.salaryNotAvailable}</td>, <td className="px-5 py-3 tabular-nums" key="fte">{row.fte ?? labels.salaryNotAvailable}</td>]
  const bandOrScale = row.salaryBandName ?? row.salaryBandCode ?? row.salaryScaleName ?? row.salaryScaleCode ?? labels.salaryNotAvailable
  const date = row.revisionEffectiveFrom ? formatDate(row.revisionEffectiveFrom, { dateFormat, locale }) : labels.salaryNotAvailable
  if (report === 'salary-overview') return [...common, <td className="px-5 py-3" key="route">{labelForCode(row.salaryRoute, labels) ?? labels.salaryNotAvailable}</td>, <td className="px-5 py-3" key="actual">{formatMoney(row.actualSalary, locale)}</td>, <td className="px-5 py-3" key="fulltime">{formatMoney(row.fulltimeSalary, locale)}</td>, <td className="px-5 py-3" key="structure">{row.salaryStructureName ?? labels.salaryNotAvailable}</td>, <td className="px-5 py-3" key="band-scale">{bandOrScale}</td>, <td className="px-5 py-3" key="step">{row.salaryStepName ?? row.salaryStepCode ?? labels.salaryNotAvailable}</td>, <td className="px-5 py-3" key="status">{displayStatus(row, labels)}</td>]
  if (report === 'salary-band-position') return [...common, <td className="px-5 py-3" key="structure">{row.salaryStructureName ?? labels.salaryNotAvailable}</td>, <td className="px-5 py-3" key="band">{row.salaryBandName ?? labels.salaryNotAvailable}</td>, <td className="px-5 py-3" key="fulltime">{formatMoney(row.fulltimeSalary, locale)}</td>, <td className="px-5 py-3" key="minimum">{formatMoney(row.bandMinimum, locale)}</td>, <td className="px-5 py-3" key="midpoint">{formatMoney(row.bandMidpoint, locale)}</td>, <td className="px-5 py-3" key="maximum">{formatMoney(row.bandMaximum, locale)}</td>, <td className="px-5 py-3" key="compa">{formatPercentage(row.compaRatio)}</td>, <td className="px-5 py-3" key="penetration">{formatPercentage(row.rangePenetration)}</td>, <td className="px-5 py-3" key="status">{displayStatus(row, labels)}</td>]
  if (report === 'salary-band-status') return [...common, <td className="px-5 py-3" key="structure">{row.salaryStructureName ?? labels.salaryNotAvailable}</td>, <td className="px-5 py-3" key="band">{row.salaryBandName ?? labels.salaryNotAvailable}</td>, <td className="px-5 py-3" key="fulltime">{formatMoney(row.fulltimeSalary, locale)}</td>, <td className="px-5 py-3" key="minimum">{formatMoney(row.bandMinimum, locale)}</td>, <td className="px-5 py-3" key="midpoint">{formatMoney(row.bandMidpoint, locale)}</td>, <td className="px-5 py-3" key="maximum">{formatMoney(row.bandMaximum, locale)}</td>, <td className="px-5 py-3" key="deviation">{formatDeviation(row, labels, locale)}</td>, <td className="px-5 py-3" key="status">{displayStatus(row, labels)}</td>]
  if (report === 'salary-scale-steps') return [...common, <td className="px-5 py-3" key="structure">{row.salaryStructureName ?? labels.salaryNotAvailable}</td>, <td className="px-5 py-3" key="scale">{row.salaryScaleName ?? row.salaryScaleCode ?? labels.salaryNotAvailable}</td>, <td className="px-5 py-3" key="step">{row.salaryStepName ?? row.salaryStepCode ?? labels.salaryNotAvailable}</td>, <td className="px-5 py-3" key="revision">{date}</td>, <td className="px-5 py-3" key="fulltime">{formatMoney(row.fulltimeSalary, locale)}</td>, <td className="px-5 py-3" key="exception">{row.exceptionTypes.length ? row.exceptionTypes.map((type) => displayException(type, labels)).join(', ') : labels.salaryNotAvailable}</td>]
  if (report === 'salary-structure-exceptions') return [...common, <td className="px-5 py-3" key="employment">{row.employmentNumber ?? row.employmentId}</td>, <td className="px-5 py-3" key="route">{labelForCode(row.salaryRoute, labels) ?? labels.salaryNotAvailable}</td>, <td className="px-5 py-3" key="structure">{row.salaryStructureName ?? labels.salaryNotAvailable}</td>, <td className="px-5 py-3" key="band-scale">{bandOrScale}</td>, <td className="px-5 py-3" key="step">{row.salaryStepName ?? row.salaryStepCode ?? labels.salaryNotAvailable}</td>, <td className="px-5 py-3" key="exception">{displayException(row.exceptionType, labels)}</td>, <td className="px-5 py-3" key="revision">{date}</td>, <td className="px-5 py-3" key="severity">{labelForCode(row.exceptionSeverity, labels) ?? labels.salaryNotAvailable}</td>, <td className="px-5 py-3" key="action"><Link className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href={salaryHref}>{labels.salaryActionView}</Link></td>]
  return [...common, <td className="px-5 py-3" key="peer-group">{row.peerGroupDefinition ?? labels.salaryNotAvailable}</td>, <td className="px-5 py-3 tabular-nums" key="peer-size">{row.peerGroupSize ?? labels.salaryNotAvailable}</td>, <td className="px-5 py-3" key="fulltime">{formatMoney(row.fulltimeSalary, locale)}</td>, <td className="px-5 py-3" key="median">{formatMoney(row.peerMedian, locale)}</td>, <td className="px-5 py-3" key="average">{formatMoney(row.peerAverage, locale)}</td>, <td className="px-5 py-3" key="delta">{formatMoney(row.medianDelta, locale)}</td>, <td className="px-5 py-3" key="delta-percent">{formatPercentage(row.medianDeltaPercentage)}</td>, <td className="px-5 py-3" key="position">{formatPercentage(row.relativePosition)}</td>, <td className="px-5 py-3" key="status">{row.peerStatus === 'SUFFICIENT' ? labels.salaryPeerSufficient : labels.salaryPeerInsufficient}</td>]
}

function SalaryTable({ dateFormat, labels, locale, report, returnTo }: { dateFormat: DateFormat; labels: SalaryInsightsLabels; locale: string; report: SalaryInsightReport; returnTo: string }) {
  const emptyLabel = report.report === 'salary-structure-exceptions' ? labels.salaryNoExceptions : report.report === 'salary-internal-position' ? labels.salaryNoPeerGroup : report.report === 'salary-band-position' ? labels.salaryNoBandRows : labels.salaryNoEmployees
  return <section className="mt-4 overflow-hidden rounded-xl border bg-background"><div className="border-b px-5 py-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.salaryRows}</p><span className="text-sm text-muted-foreground">{report.total} {labels.people}</span></div></div>{report.rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-left text-sm"><thead className="bg-muted/40 text-xs uppercase tracking-[0.08em] text-muted-foreground"><tr>{tableHeaders(report.report, labels)}</tr></thead><tbody className="divide-y">{report.rows.map((row, index) => <tr key={`${row.employeeId}-${row.employmentId}-${row.exceptionType ?? row.salaryStepCode ?? index}`}>{tableCells(report.report, row, labels, locale, dateFormat, returnTo)}</tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>}</section>
}

export function SalaryInsightsReportView({ dateFormat, initialQuery, labels, locale, report, returnTo }: { dateFormat: DateFormat; initialQuery: SalaryInsightQuery | null; labels: SalaryInsightsLabels; locale: string; report: SalaryInsightReport | null; returnTo: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fallbackQuery = initialQuery ?? (report ? { report: report.report, ...defaultSalaryInsightFilters(report.report, report.asOfDate) } : null)
  const [query, setQuery] = useState<SalaryInsightQuery | null>(fallbackQuery)
  const [data] = useState<SalaryInsightReport | null>(report)
  const [selectionOpen, setSelectionOpen] = useState(true)
  const [isApplying, startTransition] = useTransition()
  const options = data?.filterOptions ?? emptyFilterOptions
  const selectedFilterCount = useMemo(() => query ? filterFields.reduce((total, field) => total + query[field.key].length, 0) : 0, [query])
  const updateQuery = (patch: Partial<SalaryInsightFilters>): void => setQuery((current) => current ? { ...current, ...patch } : current)
  const applyQuery = (next: SalaryInsightQuery): void => startTransition(() => router.push(buildInsightApplyHref(searchParams, salaryInsightQueryParams(next)), { scroll: false }))
  const resetQuery = (): void => {
    if (!query) return
    const next: SalaryInsightQuery = { report: query.report, ...defaultSalaryInsightFilters(query.report) }
    setQuery(next)
    applyQuery(next)
  }
  const clearFilters = (): void => {
    const cleared = Object.fromEntries(filterFields.map((field) => [field.key, []])) as unknown as Pick<SalaryInsightFilters, FilterField>
    setQuery((current) => current ? { ...current, ...cleared } : current)
  }
  const removeFilterValue = (field: FilterField, value: string): void => setQuery((current) => current ? { ...current, [field]: current[field].filter((item) => item !== value) } : current)

  if (!query) return <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{labels.salaryLoading}</p>
  if (!data) return <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center"><p className="font-medium">{labels.salaryLoadFailed}</p></div>

  const activeQuery: SalaryInsightQuery = query
  const availableGroupBy = salaryInsightGroupByOptions(activeQuery.report)
  const availableSortBy = salaryInsightSortByOptions(activeQuery.report)
  const reportGroupOptions = groupOptions.filter((option) => availableGroupBy.includes(option.value))
  const reportSortOptions = sortOptions.filter((option) => availableSortBy.includes(option.value))
  const groupLabel = reportGroupOptions.find((option) => option.value === activeQuery.groupBy)
  const sortLabel = reportSortOptions.find((option) => option.value === activeQuery.sortBy)
  const renderFilterMenus = (fields: readonly FilterField[]) => fields.map((key) => {
    const field = filterFields.find((item) => item.key === key)
    if (!field) return null
    const multiOptions: MultiSelectOption[] = options[field.key].map((option) => ({ label: displayOption(option, labels), searchLabel: displayOption(option, labels), value: option.value }))
    return <label className="flex min-w-0 min-w-44 flex-1 flex-col gap-1.5 text-sm font-medium" key={field.key}><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels[field.label]}</span><MultiSelect aria-label={labels[field.label]} emptySelectionLabel={labels.salaryAll} listLabel={labels[field.label]} loadingLabel={labels.salaryLoading} noOptionsLabel={labels.noOptions} onChange={(values) => updateQuery({ [field.key]: values } as Partial<SalaryInsightFilters>)} options={multiOptions} searchPlaceholder={labels.searchOptions} selectAllLabel={labels.selectAll} selectedCountLabel={labels.filterStatus} showSelectAll value={activeQuery[field.key]} /></label>
  })

  const appliedQuery: SalaryInsightQuery | null = report ? { report: report.report, ...report.filters } : initialQuery
  const exportHref = `/api/insights/salary?${salaryInsightQueryParams(appliedQuery ?? activeQuery, 'csv').toString()}`
  const activeFilters: InsightActiveFilter[] = [
    { key: 'asOfDate', label: labels.salaryAsOfDate, value: formatDate(activeQuery.asOfDate, { dateFormat, locale }), onRemove: () => updateQuery({ asOfDate: defaultSalaryInsightFilters(activeQuery.report).asOfDate }) },
    { key: 'groupBy', label: labels.groupBy, value: groupLabel ? labels[groupLabel.label] : activeQuery.groupBy, onRemove: () => updateQuery({ groupBy: defaultSalaryInsightFilters(activeQuery.report).groupBy }) },
    { key: 'sortBy', label: labels.sortBy, value: sortLabel ? labels[sortLabel.label] : activeQuery.sortBy, onRemove: () => updateQuery({ sortBy: defaultSalaryInsightFilters(activeQuery.report).sortBy }) },
    ...filterFields.flatMap((field) => activeQuery[field.key].map((value) => ({ key: `${field.key}-${value}`, label: labels[field.label], value: displayOption(options[field.key].find((option) => option.value === value) ?? { value, label: value }, labels), onRemove: () => removeFilterValue(field.key, value) }))),
  ]

  return <>
    <InsightsFilterBar actions={<><Button loading={isApplying} onClick={() => applyQuery(activeQuery)} size="md" type="button">{labels.applyFilters}</Button><Button onClick={resetQuery} size="md" type="button" variant="secondary">{labels.resetFilters}</Button><InsightsExportAction fileName={`${activeQuery.report}.csv`} href={exportHref} label={labels.salaryExport} labels={{ error: labels.exportFailed, loading: labels.exportPreparing, success: labels.exportSuccess }} /></>}>
      <DateControl date={activeQuery.asOfDate} labels={labels} onChange={(asOfDate) => updateQuery({ asOfDate })} />
      <label className="min-w-52 flex-1"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.groupBy}</span><DropdownSelect aria-label={labels.groupBy} className="mt-1" onChange={(event) => updateQuery({ groupBy: event.target.value as SalaryInsightGroupBy })} value={activeQuery.groupBy}>{reportGroupOptions.map((option) => <option key={option.value} value={option.value}>{labels[option.label]}</option>)}</DropdownSelect></label>
      <label className="min-w-52 flex-1"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.sortBy}</span><DropdownSelect aria-label={labels.sortBy} className="mt-1" onChange={(event) => updateQuery({ sortBy: event.target.value as SalaryInsightSortBy })} value={activeQuery.sortBy}>{reportSortOptions.map((option) => <option key={option.value} value={option.value}>{labels[option.label]}</option>)}</DropdownSelect></label>
      {renderFilterMenus(primaryFiltersByReport[activeQuery.report])}
    </InsightsFilterBar>
    <InsightsActiveFilters clearLabel={labels.clearFilters} filters={activeFilters} label={labels.activeFilters} onClear={clearFilters} onReset={resetQuery} removeLabel={labels.removeFilter} resetLabel={labels.resetFilters} selectedCountLabel={labels.filterStatus} />
    <div className="mt-4 rounded-[var(--radius-surface)] border border-border bg-surface-subtle p-4"><details><summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium"><span>{labels.salaryMoreFilters}{selectedFilterCount ? ` · ${selectedFilterCount} ${labels.selected}` : ''}</span><ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" /></summary><div className="mt-4 grid gap-4 border-t border-border-subtle pt-4 sm:grid-cols-2 xl:grid-cols-3">{renderFilterMenus(secondaryFiltersByReport[activeQuery.report])}</div></details></div>
    <div className={`mt-4 grid gap-4 ${selectionOpen ? 'xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]' : 'xl:grid-cols-[minmax(0,1.5fr)_3rem]'}`}>
      <section className="min-w-0 rounded-xl border bg-background p-5"><div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><SlidersHorizontal aria-hidden="true" className="size-4 text-chart-2" />{labels.authorizedData}</div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{data.kpis.map((kpi) => <Kpi dateFormat={dateFormat} id={kpi.id} key={kpi.id} labels={labels} locale={locale} value={kpi.value} />)}</div><ChartView chart={data.chart} labels={labels} />{data.report === 'salary-band-position' && data.filters.bands.length === 1 ? <BandPositionVisual labels={labels} locale={locale} rows={data.rows} /> : null}<p className="mt-4 text-sm text-muted-foreground">{labels.salaryPrivacy}</p><SalaryTable dateFormat={dateFormat} labels={labels} locale={locale} report={data} returnTo={returnTo} />{isApplying ? <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">{labels.salaryLoading}</p> : null}</section>
      {selectionOpen ? <aside className="relative rounded-xl border bg-background p-5"><button aria-label={labels.selectionClose} className="absolute -left-3 top-5 grid size-7 place-items-center rounded-full border bg-surface text-muted-foreground shadow-sm hover:text-primary" onClick={() => setSelectionOpen(false)} type="button"><ChevronRight aria-hidden="true" size={16} /></button><InsightsActiveFilters clearLabel={labels.clearFilters} filters={activeFilters} label={labels.activeFilters} onClear={clearFilters} onReset={resetQuery} removeLabel={labels.removeFilter} resetLabel={labels.resetFilters} selectedCountLabel={labels.filterStatus} /></aside> : <button aria-label={labels.selectionOpen} className="grid min-h-28 place-items-start rounded-xl border bg-background p-3 text-muted-foreground shadow-sm hover:text-primary" onClick={() => setSelectionOpen(true)} type="button"><ChevronLeft aria-hidden="true" size={18} /></button>}
    </div>
  </>
}

const emptyFilterOptions: SalaryInsightFilterOptions = {
  administrations: [], departments: [], teams: [], managers: [], functions: [], functionGroups: [], locations: [], laborConditions: [], structures: [], bands: [], scales: [], steps: [], fteBuckets: [], employmentTypes: [], salaryRoutes: [], statuses: [], severities: [], exceptionTypes: [],
}
