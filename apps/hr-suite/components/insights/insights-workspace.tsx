'use client'

import { BarChart3, BriefcaseBusiness, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, FileSpreadsheet, HeartPulse, SlidersHorizontal, UsersRound } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { InsightReportDefinition, InsightReportId } from '@/lib/insights/report-catalog'
import type { EmployeeInsightReport, EmployeeInsightReportId } from '@/lib/insights/types'
import type { InsightsPreferences, StoredInsightFilters } from '@/lib/preferences/insights'
import { formatDate } from '@/lib/preferences/formatters'
import type { DateFormat } from '@/lib/preferences/user-preferences'
import { UpcomingEventsReportView } from '@/components/insights/upcoming-events-report'
import type { UpcomingEventsQuery, UpcomingEventsReport } from '@/lib/insights/upcoming-events'
import { AbsenceReportView } from '@/components/insights/absence-report'
import type { AbsenceInsightQuery, AbsenceInsightReport } from '@/lib/insights/absence-report'
import { BradfordReportView } from '@/components/insights/bradford-report'
import type { BradfordInsightQuery } from '@/lib/insights/bradford-query'
import type { BradfordInsightReport } from '@/lib/insights/bradford-report'
import { FrequentAbsenceReportView } from '@/components/insights/frequent-absence-report'
import type { FrequentAbsenceQuery } from '@/lib/insights/frequent-absence-query'
import type { FrequentAbsenceReport } from '@/lib/insights/frequent-absence-report'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { SalaryExceptionsReport } from '@/components/insights/salary-exceptions-report'
import type { SalaryExceptionReport } from '@/lib/insights/salary-exceptions'

export interface InsightsLabels { [key: string]: string }

type InsightVisualReportId = EmployeeInsightReportId | 'salary-exceptions'
type InsightVisualReport = EmployeeInsightReport | SalaryExceptionReport
const employeeReportIds = new Set<InsightVisualReportId>(['employee-department', 'employee-gender', 'employee-age', 'terminations', 'salary-exceptions'])
const chartColors = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5']
const icons = { employees: UsersRound, leave: BriefcaseBusiness, absence: HeartPulse, other: BarChart3 } as const
const emptySelection: string[] = []

function isEmployeeReport(id: InsightReportId): id is InsightVisualReportId {
  return employeeReportIds.has(id as InsightVisualReportId)
}

function isPersistedEmployeeReport(id: InsightReportId): id is EmployeeInsightReportId {
  return id !== 'salary-exceptions' && isEmployeeReport(id)
}

function reportDefaults(report: InsightReportId): StoredInsightFilters {
  return {
    groupBy: report === 'employee-department' ? 'team' : report === 'employee-gender' ? 'gender' : report === 'employee-age' ? 'age' : report === 'terminations' ? 'reason' : 'person',
    year: new Date().getFullYear(), month: new Date().getMonth() + 1, fullYear: false,
    sortBy: 'total', teams: [], segments: [], reasons: [], employeeStatus: 'all',
  }
}

function labelFor(value: string, labels: InsightsLabels): string {
  const values: Record<string, string | undefined> = {
    MALE: labels.genderMale, FEMALE: labels.genderFemale, OTHER: labels.genderOther,
    PREFER_NOT_TO_SAY: labels.genderUndisclosed, under20: labels.under20, '20to30': labels.age20to30,
    '30to40': labels.age30to40, '40to50': labels.age40to50, '50to60': labels.age50to60,
    over60: labels.over60, 'no-team': labels.noTeam, 'no-reason': labels.noReason, unknown: labels.unknown,
  }
  return values[value] ?? value
}

function selectionLabel(selected: string[], allLabel: string, labels: InsightsLabels): string {
  return selected.length ? labels.filterStatus.replace('{count}', String(selected.length)) : allLabel
}

function PeriodPicker({ labels, year, month, fullYear, yearSpan, onChange, open, onOpenChange }: {
  labels: InsightsLabels; year: number; month: number; fullYear: boolean; yearSpan: 1 | 3 | 5
  onChange: (values: Partial<StoredInsightFilters>) => void; open: boolean; onOpenChange: (open: boolean) => void
}) {
  const currentYear = new Date().getFullYear()
  const months = [labels.jan, labels.feb, labels.mar, labels.apr, labels.may, labels.jun, labels.jul, labels.aug, labels.sep, labels.oct, labels.nov, labels.dec]
  return <div className="filter-dropdown relative flex min-w-40 flex-1 flex-col gap-1.5 text-sm font-medium">
    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.period}</span>
    <button aria-expanded={open} className="dropdown-trigger font-normal" onClick={() => onOpenChange(!open)} type="button">
      <span>{yearSpan > 1 ? `${year - yearSpan + 1} → ${year}` : fullYear ? String(year) : `${months[month - 1]} ${year}`}</span><ChevronDown aria-hidden="true" className={`size-4 text-muted-foreground ${open ? 'rotate-180' : ''}`} />
    </button>
    {open ? <div className="dropdown-menu absolute left-0 top-full z-30 mt-2 w-80 p-3">
      <div className="flex items-center justify-between border-b pb-3">
        <button aria-label={labels.previousYear} className="grid size-8 place-items-center rounded-xl hover:bg-muted" onClick={() => onChange({ year: Math.max(2000, year - 1) })} type="button">‹</button>
        <strong className="text-sm tabular-nums">{year}</strong>
        <button aria-label={labels.nextYear} className="grid size-8 place-items-center rounded-xl hover:bg-muted" onClick={() => onChange({ year: Math.min(currentYear, year + 1) })} type="button">›</button>
        <button className="text-sm font-medium text-primary" onClick={() => { onChange({ year: currentYear, month: new Date().getMonth() + 1, fullYear: false, yearSpan: 1 }); onOpenChange(false) }} type="button">{labels.today}</button>
      </div>
      <div className="grid grid-cols-4 gap-1.5 py-4">{months.map((name, index) => <button className={`dropdown-option justify-center ${index + 1 === month && !fullYear && yearSpan === 1 ? 'bg-accent font-semibold text-accent-foreground' : ''}`} key={name} onClick={() => { onChange({ month: index + 1, fullYear: false, yearSpan: 1 }); onOpenChange(false) }} type="button">{name}</button>)}</div>
      <label className="dropdown-option border-t pt-3 font-normal"><input checked={fullYear && yearSpan === 1} className="size-4 accent-primary" onChange={(event) => onChange({ fullYear: event.target.checked, yearSpan: 1 })} type="checkbox" />{labels.fullYear}</label>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3"><button className={`dropdown-option justify-center ${yearSpan === 3 ? 'bg-accent font-semibold text-accent-foreground' : ''}`} onClick={() => { onChange({ fullYear: true, yearSpan: 3 }); onOpenChange(false) }} type="button">{labels.threeYears}</button><button className={`dropdown-option justify-center ${yearSpan === 5 ? 'bg-accent font-semibold text-accent-foreground' : ''}`} onClick={() => { onChange({ fullYear: true, yearSpan: 5 }); onOpenChange(false) }} type="button">{labels.fiveYears}</button></div>
    </div> : null}
  </div>
}

function FacetFilter({ label, options, selected, allLabel, labels, onChange, open, onOpenChange }: {
  label: string; options: string[]; selected: string[]; allLabel: string; labels: InsightsLabels
  onChange: (value: string[]) => void; open: boolean; onOpenChange: (open: boolean) => void
}) {
  const [search, setSearch] = useState('')
  const visible = options.filter((option) => option.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  const allSelected = options.length > 0 && selected.length === options.length
  return <div className="filter-dropdown relative flex min-w-40 flex-1 flex-col gap-1.5 text-sm font-medium">
    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
    <button aria-expanded={open} className="dropdown-trigger font-normal" onClick={() => onOpenChange(!open)} type="button">
      <span>{selectionLabel(selected, allLabel, labels)}</span><ChevronDown aria-hidden="true" className={`size-4 text-muted-foreground ${open ? 'rotate-180' : ''}`} />
    </button>
    {open ? <div className="dropdown-menu absolute left-0 top-full z-30 mt-2 w-72 p-3">
      <input aria-label={labels.search} className="form-field mb-2 min-h-10 font-normal" onChange={(event) => setSearch(event.target.value)} placeholder={labels.searchOptions} value={search} />
      <label className="dropdown-option border-b pb-2 font-medium"><input checked={allSelected} className="size-4 accent-primary" onChange={() => onChange(allSelected ? [] : options)} type="checkbox" />{labels.selectAll}</label>
      <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">{visible.map((option) => <label className="dropdown-option font-normal" key={option}><input checked={selected.includes(option)} className="size-4 accent-primary" onChange={() => onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option])} type="checkbox" />{option}</label>)}{visible.length === 0 ? <p className="px-3 py-3 text-sm font-normal text-muted-foreground">{labels.noOptions}</p> : null}</div>
    </div> : null}
  </div>
}

function SelectControl({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="flex min-w-36 flex-1 flex-col gap-1.5 text-sm font-medium"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span><DropdownSelect aria-label={label} onChange={(event) => onChange(event.target.value)} value={value}>{children}</DropdownSelect></label>
}

function EmployeeReportVisual({ data, labels, display, locale, dateFormat }: { data: InsightVisualReport; labels: InsightsLabels; display: 'distribution' | 'trend'; locale: string; dateFormat: DateFormat }) {
  if (data.report === 'salary-exceptions') return <SalaryExceptionsReport locale={locale} report={data} labels={{ employee: labels.employee, administration: labels.salaryExceptionsAdministration, employment: labels.salaryExceptionsEmployment, route: labels.salaryExceptionsRoute, structure: labels.salaryExceptionsStructure, band: labels.salaryExceptionsBand, scaleStep: labels.salaryExceptionsScaleStep, invalidFrom: labels.salaryExceptionsInvalidFrom, severity: labels.salaryExceptionsSeverity, status: labels.salaryExceptionsStatus, action: labels.salaryExceptionsAction, adjustSalary: labels.salaryExceptionsAdjustSalary, informative: labels.salaryExceptionsInformative, high: labels.salaryExceptionsHigh, open: labels.salaryExceptionsOpen, bandInvalid: labels.salaryExceptionsBandInvalid, scaleStepInvalid: labels.salaryExceptionsScaleStepInvalid, noResults: labels.noResults, search: labels.search, total: labels.salaryExceptionsTotal, salaryRemainsValid: labels.salaryExceptionsSalaryRemainsValid, manualAction: labels.salaryExceptionsManualAction }} />
  const largest = Math.max(...data.groups.map((group) => group.count), 1)
  const displayDate = (value: string | null) => value ? formatDate(value, { locale, dateFormat }) : labels.unknown
  return <>
    <div className="grid gap-3 sm:grid-cols-3"><Metric color="chart-1" label={labels.employee} value={String(data.total)} description={labels.people} /><Metric color="chart-2" label={labels.groupBy} value={String(data.groups.length)} description={labels.groups} /><Metric color="chart-3" label={labels.selectedPeriod} value={`${displayDate(data.period.startDate)} → ${displayDate(data.period.endDate)}`} description="" /></div>
    <section className="mt-4 rounded-xl border bg-background p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{display === 'trend' ? labels.trend : labels.distribution}</p><h3 className="mt-1 font-semibold">{labels.actualDataTitle}</h3></div><span className="text-sm text-muted-foreground">{labels.authorizedData}</span></div>{display === 'trend' ? <TrendChart data={data.trend} labels={labels} /> : data.groups.length ? <div className="mt-5 space-y-3">{data.groups.map((group, index) => <div className="grid grid-cols-[minmax(7rem,12rem)_1fr_auto] items-center gap-3 text-sm" key={group.label}><span className="truncate text-right text-muted-foreground" title={labelFor(group.label, labels)}>{labelFor(group.label, labels)}</span><div className="h-7 overflow-hidden rounded-md bg-muted"><div className={`h-full rounded-md ${chartColors[index % chartColors.length]}`} style={{ width: `${Math.max((group.count / largest) * 100, 4)}%` }} /></div><span className="min-w-24 text-right tabular-nums">{group.percentage}% · {group.count} {labels.people}</span></div>)}</div> : <p className="mt-5 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{labels.noResults}</p>}</section>
    <section className="mt-4 overflow-hidden rounded-xl border bg-background"><div className="border-b px-5 py-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.table}</p></div>{data.rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/40 text-xs uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-5 py-3">{labels.employee}</th><th className="px-5 py-3">{labels.gender}</th>{data.report === 'employee-age' ? <th className="px-5 py-3">{labels.age}</th> : null}<th className="px-5 py-3">{labels.team}</th><th className="px-5 py-3">{labels.segment}</th>{data.report === 'terminations' ? <><th className="px-5 py-3">{labels.endDate}</th><th className="px-5 py-3">{labels.reason}</th></> : null}</tr></thead><tbody className="divide-y">{data.rows.map((row) => <tr key={`${row.employeeId}-${row.endDate ?? 'active'}`}><td className="px-5 py-3 font-medium"><Link className="text-primary hover:underline" href={`/employees/${row.employeeId}`}>{row.employeeName}</Link></td><td className="px-5 py-3">{labelFor(row.gender, labels)}</td>{data.report === 'employee-age' ? <td className="px-5 py-3 tabular-nums">{row.age ?? labels.unknown}</td> : null}<td className="px-5 py-3">{row.team ?? labels.noTeam}</td><td className="px-5 py-3">{row.segment ?? labels.unknown}</td>{data.report === 'terminations' ? <><td className="px-5 py-3">{displayDate(row.endDate)}</td><td className="px-5 py-3">{row.reason ?? labels.noReason}</td></> : null}</tr>)}</tbody></table></div> : <p className="p-6 text-center text-sm text-muted-foreground">{labels.noResults}</p>}</section>
  </>
}

function Metric({ color, label, value, description }: { color: string; label: string; value: string; description: string }) {
  const colors: Record<string, { card: string; value: string }> = {
    'chart-1': { card: 'border-chart-1/25 bg-chart-1/10', value: 'text-chart-1' },
    'chart-2': { card: 'border-chart-2/25 bg-chart-2/10', value: 'text-chart-2' },
    'chart-3': { card: 'border-chart-3/25 bg-chart-3/10', value: 'text-chart-3' },
  }
  const classes = colors[color] ?? colors['chart-1']
  return <div className={`rounded-xl border p-4 ${classes.card}`}><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-semibold tabular-nums ${classes.value}`}>{value}</p>{description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}</div>
}

function TrendChart({ data, labels }: { data: readonly { month: string; total: number }[]; labels: InsightsLabels }) {
  const max = Math.max(...data.map((point) => point.total), 1)
  const midpoint = Math.ceil(max / 2)
  const labelInterval = Math.max(1, Math.ceil((data.length - 1) / 9))
  const points = data.map((point, index) => `${data.length === 1 ? 376 : 60 + (index / (data.length - 1)) * 632},${184 - (point.total / max) * 150}`).join(' ')
  return <div className="mt-5 overflow-x-auto rounded-xl border bg-background p-3"><svg aria-label={labels.trend} className="h-64 min-w-[42rem] w-full" role="img" viewBox="0 0 720 220"><line stroke="currentColor" strokeOpacity=".15" x1="60" x2="692" y1="184" y2="184" /><line stroke="currentColor" strokeOpacity=".12" x1="60" x2="692" y1="109" y2="109" /><line stroke="currentColor" strokeOpacity=".12" x1="60" x2="692" y1="34" y2="34" /><text fill="currentColor" fontSize="11" textAnchor="end" x="52" y="188">0</text><text fill="currentColor" fontSize="11" textAnchor="end" x="52" y="113">{midpoint}</text><text fill="currentColor" fontSize="11" textAnchor="end" x="52" y="38">{max}</text><polyline fill="none" points={points} stroke="var(--chart-2)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />{data.map((point, index) => { const x = data.length === 1 ? 376 : 60 + (index / (data.length - 1)) * 632; const y = 184 - (point.total / max) * 150; const showLabel = index === 0 || index === data.length - 1 || index % labelInterval === 0; return <g key={point.month}><circle cx={x} cy={y} fill="var(--chart-2)" r="5" />{showLabel ? <text fill="currentColor" fontSize="10" textAnchor="middle" x={x} y="207">{point.month}</text> : null}<title>{`${point.month}: ${point.total} ${labels.people}`}</title></g> })}</svg></div>
}

function reportLabelPrefix(id: InsightReportId): string {
  if (id === 'employee-department') return 'employeesDepartment'
  if (id === 'employee-gender') return 'employeesGender'
  if (id === 'employee-age') return 'employeesAge'
  if (id === 'absence-bradford') return 'absenceBradford'
  if (id === 'absence-frequent') return 'absenceFrequent'
  if (id === 'salary-exceptions') return 'salaryExceptions'
  return id
}

export function InsightsWorkspace({ labels, reports, reportData, upcomingReport, upcomingQuery, absenceReport, absenceQuery, bradfordReport, bradfordQuery, frequentReport, frequentQuery, preferences, locale, dateFormat }: { labels: InsightsLabels; reports: readonly InsightReportDefinition[]; reportData: InsightVisualReport | null; upcomingReport: UpcomingEventsReport | null; upcomingQuery: UpcomingEventsQuery; absenceReport: AbsenceInsightReport | null; absenceQuery: AbsenceInsightQuery | null; bradfordReport: BradfordInsightReport | null; bradfordQuery: BradfordInsightQuery | null; frequentReport: FrequentAbsenceReport | null; frequentQuery: FrequentAbsenceQuery | null; preferences: InsightsPreferences; locale: string; dateFormat: DateFormat }) {
  const router = useRouter(); const pathname = usePathname(); const searchParams = useSearchParams()
  const requested = searchParams.get('report'); const initialReport = reports.some((report) => report.id === requested) ? requested as InsightReportId : null
  const [openReport, setOpenReport] = useState<InsightReportId | null>(initialReport)
  const initial = initialReport && isPersistedEmployeeReport(initialReport) && preferences.preserveFilters ? { ...reportDefaults(initialReport), ...preferences.filters[initialReport] } : reportDefaults(initialReport ?? 'employee-department')
  const [filters, setFilters] = useState<StoredInsightFilters>(initial)
  const [preserveFilters, setPreserveFilters] = useState(preferences.preserveFilters)
  const [selectionPanelOpen, setSelectionPanelOpen] = useState(preferences.selectionPanelOpen)
  const [display, setDisplay] = useState<'distribution' | 'trend'>(searchParams.get('view') === 'trend' ? 'trend' : 'distribution')
  const [openFilter, setOpenFilter] = useState<string | null>(null); const [toastMessage, setToastMessage] = useState<string | null>(null); const toastTimeout = useRef<number | null>(null)
  const groupBy = filters.groupBy ?? 'person'; const year = filters.year ?? new Date().getFullYear(); const month = filters.month ?? new Date().getMonth() + 1; const yearSpan = filters.yearSpan ?? 1; const fullYear = filters.fullYear === true || yearSpan > 1; const sortBy = filters.sortBy ?? 'total'; const teams = filters.teams ?? emptySelection; const segments = filters.segments ?? emptySelection; const reasons = filters.reasons ?? emptySelection; const employeeStatus = filters.employeeStatus ?? 'all'
  const reportCategories = useMemo(() => [{ id: 'employees', label: labels.employeesCategory }, { id: 'leave', label: labels.leaveCategory }, { id: 'absence', label: labels.absenceCategory }, { id: 'other', label: labels.otherCategory }] as const, [labels])

  useEffect(() => { const close = (event: MouseEvent) => { if (!(event.target instanceof Element) || !event.target.closest('.filter-dropdown')) setOpenFilter(null) }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close) }, [])
  useEffect(() => { if (!initialReport) return; requestAnimationFrame(() => document.getElementById(`report-card-${initialReport}`)?.scrollIntoView({ block: 'start' })) }, [initialReport])
  useEffect(() => () => { if (toastTimeout.current !== null) window.clearTimeout(toastTimeout.current) }, [])
  useEffect(() => { const params = new URLSearchParams(searchParams.toString()); const set = (key: string, value: string | null) => value ? params.set(key, value) : params.delete(key); set('report', openReport); set('view', display === 'trend' ? 'trend' : null); if (openReport && isEmployeeReport(openReport)) { set('group', groupBy === 'person' ? null : groupBy); set('year', String(year)); set('month', String(month)); set('fullYear', fullYear ? '1' : null); set('years', yearSpan > 1 ? String(yearSpan) : null); set('sort', sortBy === 'total' ? null : sortBy); set('teams', teams.join(',')); set('segments', segments.join(',')); set('reasons', reasons.join(',')); set('employeeStatus', employeeStatus === 'all' ? null : employeeStatus) } const next = params.toString(); if (next !== searchParams.toString()) router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false }) }, [display, employeeStatus, fullYear, groupBy, month, openReport, pathname, reasons, router, searchParams, segments, sortBy, teams, year, yearSpan])
  useEffect(() => { if (!preserveFilters || !openReport || !isPersistedEmployeeReport(openReport)) return; void fetch('/api/preferences/insights', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preserveFilters, selectionPanelOpen, report: openReport, filters }) }) }, [filters, openReport, preserveFilters, selectionPanelOpen])
  function updateFilters(next: Partial<StoredInsightFilters>) { setFilters((current) => ({ ...current, ...next })) }
  function togglePanel() { const next = !selectionPanelOpen; setSelectionPanelOpen(next); void fetch('/api/preferences/insights', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preserveFilters, selectionPanelOpen: next }) }) }
  function showToast(message: string): void {
    setToastMessage(message)
    if (toastTimeout.current !== null) window.clearTimeout(toastTimeout.current)
    toastTimeout.current = window.setTimeout(() => { setToastMessage(null); toastTimeout.current = null }, 4000)
  }
  async function exportCsv(): Promise<void> {
    showToast(labels.exportPreparing)
    try {
      const response = await fetch(`/api/insights/employees?${exportParams.toString()}`)
      if (!response.ok) throw new Error('EXPORT_FAILED')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${openReport}-${year}-${String(month).padStart(2, '0')}.csv`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      showToast(labels.exportSuccess)
    } catch {
      showToast(labels.exportFailed)
    }
  }
  function togglePreservation() { const next = !preserveFilters; setPreserveFilters(next); void fetch('/api/preferences/insights', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preserveFilters: next, selectionPanelOpen, ...(next && openReport && isPersistedEmployeeReport(openReport) ? { report: openReport, filters } : {}) }) }) }
  function open(id: InsightReportId) { const next = openReport === id ? null : id; setOpenReport(next); setOpenFilter(null); if (next && isPersistedEmployeeReport(next)) setFilters(preserveFilters ? { ...reportDefaults(next), ...preferences.filters[next] } : reportDefaults(next)); if (next) requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(`report-card-${next}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))) }
  const periodLabel = yearSpan > 1 ? `${year - yearSpan + 1} → ${year}` : fullYear ? String(year) : `${[labels.jan, labels.feb, labels.mar, labels.apr, labels.may, labels.jun, labels.jul, labels.aug, labels.sep, labels.oct, labels.nov, labels.dec][month - 1]} ${year}`
  const exportParams = new URLSearchParams({ report: openReport ?? '', format: 'csv', year: String(year), month: String(month), group: groupBy, sort: sortBy }); if (fullYear) exportParams.set('fullYear', '1'); if (yearSpan > 1) exportParams.set('years', String(yearSpan)); if (teams.length) exportParams.set('teams', teams.join(',')); if (segments.length) exportParams.set('segments', segments.join(',')); if (reasons.length) exportParams.set('reasons', reasons.join(',')); if (employeeStatus !== 'all') exportParams.set('employeeStatus', employeeStatus)

  return <section className="w-full px-4 py-7 sm:px-6 lg:px-8"><header className="border-b pb-6"><p className="eyebrow">{labels.eyebrow}</p><div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-3xl font-semibold tracking-tight">{labels.title}</h1><p className="mt-2 max-w-2xl text-muted-foreground">{labels.intro}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-chart-2/10 px-3 py-1.5 text-sm font-medium text-chart-2">{labels.reportsAvailable.replace('{count}', String(reports.length))}</span><label className="flex items-center gap-2 text-sm font-medium"><input checked={preserveFilters} className="size-4 accent-primary" onChange={togglePreservation} type="checkbox" />{labels.preserveFilters}</label></div></div></header><div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-5 z-50 flex justify-center px-4">{toastMessage ? <p className="rounded-xl border bg-surface px-4 py-3 text-sm font-medium text-foreground shadow-lg">{toastMessage}</p> : null}</div><div className="mt-6 space-y-8">{reportCategories.map((category) => { const categoryReports = reports.filter((report) => report.category === category.id); if (!categoryReports.length) return null; const CategoryIcon = icons[category.id]; return <section key={category.id}><div className="mb-3 flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-chart-2/10 text-chart-2"><CategoryIcon aria-hidden="true" size={17} /></span><h2 className="font-semibold">{category.label}</h2></div><div className="space-y-3">{categoryReports.map((report) => { const isOpen = openReport === report.id; const Icon = icons[report.category]; const prefix = reportLabelPrefix(report.id); return <article className={`scroll-mt-6 overflow-visible rounded-2xl border bg-surface shadow-sm ${isOpen ? 'border-primary/35 shadow-md' : ''}`} id={`report-card-${report.id}`} key={report.id}><button aria-controls={`report-${report.id}`} aria-expanded={isOpen} className="flex w-full items-center gap-4 p-5 text-left" onClick={() => open(report.id)} type="button"><span className={`grid size-11 shrink-0 place-items-center rounded-xl ${report.available ? 'bg-chart-2 text-white' : 'bg-muted text-muted-foreground'}`}><Icon aria-hidden="true" size={21} /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-base font-semibold">{labels[`${prefix}Title`]}</span>{!report.available ? <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{labels.planned}</span> : null}</span><span className="mt-1 block text-sm text-muted-foreground">{labels[`${prefix}Description`]}</span></span>{isOpen ? <ChevronUp aria-hidden="true" className="shrink-0 text-muted-foreground" /> : <ChevronDown aria-hidden="true" className="shrink-0 text-muted-foreground" />}</button>{isOpen ? <div className="border-t p-5" id={`report-${report.id}`}>{report.id === 'upcomingEvents' && upcomingReport ? <UpcomingEventsReportView dateFormat={dateFormat} locale={locale} labels={{ title: labels.upcomingEventsTitle, backToInsights: labels.backToInsights, event: labels.upcomingEventsEvent, department: labels.department, period: labels.period, birthdays: labels.upcomingEventsBirthdays, anniversaries: labels.upcomingEventsAnniversaries, starters: labels.upcomingEventsStarters, allEvents: labels.allEvents, selected: labels.selected, today: labels.today, inDays: labels.inDays, next7Days: labels.upcomingEventsNext7Days, next4Weeks: labels.upcomingEventsNext4Weeks, next12Weeks: labels.upcomingEventsNext12Weeks, next12Months: labels.upcomingEventsNext12Months, allDepartments: labels.allDepartments, searchDepartments: labels.searchDepartments, export: labels.exportExcel, empty: labels.upcomingEventsEmpty, years: labels.seniority }} query={upcomingQuery} report={upcomingReport} /> : report.id === 'absence' && absenceReport && absenceQuery ? <AbsenceReportView locale={locale} query={absenceQuery} report={absenceReport} labels={{ period: labels.period, month: labels.month, year: labels.year, department: labels.department, allDepartments: labels.allDepartments, applyFilters: labels.applyFilters, exportExcel: labels.exportExcel, activeCases: labels.absenceActiveCases, reports: labels.absenceReports, sickDays: labels.absenceSickDays, sickHours: labels.absenceSickHours, availableDays: labels.absenceAvailableDays, absenceRate: labels.absenceRate, currentData: labels.absenceCurrentData, employee: labels.employee, firstAbsenceOn: labels.absenceFirstDay, status: labels.absenceStatus, days: labels.absenceDays, hours: labels.absenceHours, dossier: labels.absenceDossier, active: labels.statusActive, recoveryWindow: labels.absenceRecoveryWindow, closed: labels.absenceClosed, noResults: labels.noResults, formulaHint: labels.absenceFormulaHint, monthlyTrend: labels.absenceMonthlyTrend, yearLabel: labels.year, jan: labels.jan, feb: labels.feb, mar: labels.mar, apr: labels.apr, may: labels.may, jun: labels.jun, jul: labels.jul, aug: labels.aug, sep: labels.sep, oct: labels.oct, nov: labels.nov, dec: labels.dec }} /> : report.id === 'absence-bradford' && bradfordReport && bradfordQuery ? <BradfordReportView query={bradfordQuery} report={bradfordReport} labels={{ title: labels.absenceBradfordTitle, description: labels.absenceBradfordDescription, backToAbsence: labels.backToAbsence, exportExcel: labels.exportExcel, period: labels.period, last52Weeks: labels.absenceLast52Weeks, thisYear: labels.absenceThisYear, previousYear: labels.absencePreviousYear, team: labels.team, allDepartments: labels.allDepartments, applyFilters: labels.applyFilters, groupBy: labels.groupBy, person: labels.person, search: labels.search, searchPlaceholder: labels.searchOptions, risk: labels.absenceRisk, allRisks: labels.absenceAllRisks, lowRisk: labels.absenceRiskLow, mediumRisk: labels.absenceRiskMedium, highRisk: labels.absenceRiskHigh, employee: labels.employee, distribution: labels.distribution, score: labels.absenceBradfordScore, occurrences: labels.absenceOccurrences, days: labels.absenceDays, since: labels.absenceFirstDay, dossier: labels.absenceDossier, info: labels.absenceInfo, infoTitle: labels.absenceBradfordInfoTitle, infoFormula: labels.absenceBradfordInfoFormula, infoInterpretation: labels.absenceBradfordInfoInterpretation, infoLow: labels.absenceBradfordInfoLow, infoMedium: labels.absenceBradfordInfoMedium, infoHigh: labels.absenceBradfordInfoHigh, infoCaveat: labels.absenceBradfordInfoCaveat, infoSource: labels.absenceBradfordInfoSource, close: labels.close, noResults: labels.noResults }} /> : report.id === 'absence-frequent' && frequentReport && frequentQuery ? <FrequentAbsenceReportView query={frequentQuery} report={frequentReport} labels={{ title: labels.absenceFrequentTitle, description: labels.absenceFrequentDescription, exportExcel: labels.exportExcel, period: labels.period, last12Months: labels.absenceLast12Months, thisYear: labels.absenceThisYear, previousYear: labels.absencePreviousYear, team: labels.team, allDepartments: labels.allDepartments, applyFilters: labels.applyFilters, search: labels.search, searchPlaceholder: labels.searchOptions, employee: labels.employee, reportCount: labels.absenceFrequentReportCount, sickDays: labels.absenceDays, frequent: labels.absenceFrequentLabel, threshold: labels.absenceFrequentThreshold, thresholdDescription: labels.absenceFrequentThresholdDescription, totalEmployees: labels.absenceFrequentTotalEmployees, frequentCount: labels.absenceFrequentCount, totalReports: labels.absenceFrequentTotalReports, noResults: labels.noResults, yearLabel: labels.year }} /> : report.available && isEmployeeReport(report.id) ? <><div className="rounded-xl border bg-muted/35 p-4"><div className="flex flex-col gap-4 xl:flex-row xl:flex-wrap"><SelectControl label={labels.groupBy} onChange={(value) => updateFilters({ groupBy: value })} value={groupBy}><option value="team">{labels.team}</option><option value="person">{labels.person}</option><option value="gender">{labels.gender}</option><option value="age">{labels.age}</option>{report.id === 'terminations' ? <option value="reason">{labels.reason}</option> : null}</SelectControl><PeriodPicker fullYear={fullYear} yearSpan={yearSpan} labels={labels} month={month} onChange={updateFilters} onOpenChange={(value) => setOpenFilter(value ? 'period' : null)} open={openFilter === 'period'} year={year} /><FacetFilter allLabel={labels.allTeams} label={labels.team} labels={labels} onChange={(value) => updateFilters({ teams: value })} onOpenChange={(value) => setOpenFilter(value ? 'teams' : null)} open={openFilter === 'teams'} options={reportData?.filterOptions.teams ?? []} selected={teams} /><FacetFilter allLabel={labels.allSegments} label={labels.segment} labels={labels} onChange={(value) => updateFilters({ segments: value })} onOpenChange={(value) => setOpenFilter(value ? 'segments' : null)} open={openFilter === 'segments'} options={reportData?.filterOptions.segments ?? []} selected={segments} />{report.id === 'terminations' ? <><SelectControl label={labels.statusEmployee} onChange={(value) => updateFilters({ employeeStatus: value as StoredInsightFilters['employeeStatus'] })} value={employeeStatus}><option value="all">{labels.statusAll}</option><option value="active">{labels.statusActive}</option><option value="former">{labels.statusFormer}</option></SelectControl><FacetFilter allLabel={labels.noReason} label={labels.reason} labels={labels} onChange={(value) => updateFilters({ reasons: value })} onOpenChange={(value) => setOpenFilter(value ? 'reasons' : null)} open={openFilter === 'reasons'} options={reportData?.filterOptions.reasons ?? []} selected={reasons} /></> : null}<SelectControl label={labels.sortBy} onChange={(value) => updateFilters({ sortBy: value })} value={sortBy}><option value="total">{labels.sortTotal}</option><option value="name">{labels.sortName}</option><option value="trend">{labels.sortTrend}</option></SelectControl></div></div><div className={`mt-4 grid gap-4 ${selectionPanelOpen ? 'xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]' : 'xl:grid-cols-[minmax(0,1.5fr)_3rem]'}`}><section className="min-w-0 rounded-xl border bg-background p-5"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm text-muted-foreground"><SlidersHorizontal aria-hidden="true" className="size-4 text-chart-2" />{labels.authorizedData}</div><div className="flex flex-wrap items-center justify-end gap-2"><button className={`rounded-lg px-3 py-2 text-sm font-medium ${display === 'distribution' ? 'bg-chart-1 text-white' : 'bg-muted text-muted-foreground'}`} onClick={() => setDisplay('distribution')} type="button">{labels.distribution}</button><button className={`rounded-lg px-3 py-2 text-sm font-medium ${display === 'trend' ? 'bg-chart-2 text-white' : 'bg-muted text-muted-foreground'}`} onClick={() => setDisplay('trend')} type="button">{labels.trend}</button><button className="button-primary inline-flex items-center gap-2" onClick={exportCsv} type="button"><FileSpreadsheet aria-hidden="true" size={16} />{labels.exportCsv}</button></div></div>{reportData?.report === report.id ? <EmployeeReportVisual data={reportData} dateFormat={dateFormat} display={display} labels={labels} locale={locale} /> : <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{labels.noResults}</p>}</section>{selectionPanelOpen ? <aside className="relative rounded-xl border bg-background p-5"><button aria-label={labels.selectionClose} className="absolute -left-3 top-5 grid size-7 place-items-center rounded-full border bg-surface text-muted-foreground shadow-sm hover:text-primary" onClick={togglePanel} type="button"><ChevronRight aria-hidden="true" size={16} /></button><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.activeFilters}</p><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">{labels.groupBy}</dt><dd className="font-medium">{labelFor(groupBy, labels)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">{labels.period}</dt><dd className="font-medium">{periodLabel}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">{labels.team}</dt><dd className="font-medium">{selectionLabel(teams, labels.allTeams, labels)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">{labels.segment}</dt><dd className="font-medium">{selectionLabel(segments, labels.allSegments, labels)}</dd></div></dl></aside> : <button aria-label={labels.selectionOpen} className="grid min-h-28 place-items-start rounded-xl border bg-background p-3 text-muted-foreground shadow-sm hover:text-primary" onClick={togglePanel} type="button"><ChevronLeft aria-hidden="true" size={18} /></button>}</div></> : <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground"><Icon aria-hidden="true" size={22} /></span><h3 className="mt-4 font-semibold">{labels.noDataSourceTitle}</h3><p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{labels.noDataSourceDescription}</p></div>}</div> : null}</article> })}</div></section> })}</div></section>
}
