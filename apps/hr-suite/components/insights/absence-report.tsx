'use client'

import Link from 'next/link'
import { ArrowRight, HeartPulse } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import type { BadgeTone } from '@/components/ui/badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { SectionHeader } from '@/components/patterns/section-header'
import { InsightsActiveFilters, InsightsExportAction, InsightsFilterBar, type InsightActiveFilter } from '@/components/insights/shared-controls'
import type { AbsenceInsightQuery, AbsenceInsightReport } from '@/lib/insights/absence-report'
import { absenceInsightQueryParams, parseAbsenceInsightQuery } from '@/lib/insights/absence-query'
import { buildInsightApplyHref, insightEmployeeDrilldownHref } from '@/lib/insights/query-seam'

interface AbsenceReportLabels {
  period: string; month: string; year: string; department: string; allDepartments: string; applyFilters: string; resetFilters: string; clearFilters: string; removeFilter: string; filterStatus: string; exportExcel: string; exportPreparing: string; exportSuccess: string; exportFailed: string; activeCases: string; reports: string; sickDays: string; sickHours: string; availableDays: string; absenceRate: string; currentData: string; employee: string; firstAbsenceOn: string; status: string; days: string; hours: string; dossier: string; active: string; recoveryWindow: string; closed: string; noResults: string; formulaHint: string; monthlyTrend: string; yearLabel: string; activeFilters?: string
  jan: string; feb: string; mar: string; apr: string; may: string; jun: string; jul: string; aug: string; sep: string; oct: string; nov: string; dec: string
}

export type ActiveReportFilter = InsightActiveFilter

export function ActiveFilters({ filters, label, onClear, onReset, clearLabel, resetLabel, removeLabel, selectedCountLabel }: { filters: readonly ActiveReportFilter[]; label?: string; onClear?: () => void; onReset?: () => void; clearLabel?: string; resetLabel?: string; removeLabel?: string; selectedCountLabel?: string }) {
  if (!label) return null
  return <InsightsActiveFilters clearLabel={clearLabel} filters={filters} label={label} onClear={onClear} onReset={onReset} removeLabel={removeLabel ?? '{filter}'} resetLabel={resetLabel} selectedCountLabel={selectedCountLabel} />
}

type ReportKpiTone = 'primary' | 'info' | 'neutral' | 'success' | 'warning' | 'danger'

const reportKpiClasses: Record<ReportKpiTone, { card: string; value: string }> = {
  primary: { card: 'border-primary/25 bg-primary/5', value: 'text-primary' },
  info: { card: 'border-info-border bg-info-surface/45', value: 'text-info' },
  neutral: { card: 'border-border-subtle bg-surface-subtle', value: 'text-foreground' },
  success: { card: 'border-success/25 bg-success-surface', value: 'text-success' },
  warning: { card: 'border-warning/30 bg-warning-surface', value: 'text-warning' },
  danger: { card: 'border-destructive/25 bg-destructive-surface', value: 'text-destructive' },
}

export function ReportKpi({ label, value, tone = 'neutral', featured = false }: { label: string; value: string; tone?: ReportKpiTone; featured?: boolean }) {
  const classes = reportKpiClasses[tone]
  return <article className={`rounded-[var(--radius-surface)] border p-4 ${classes.card} ${featured ? 'sm:p-5' : ''}`}>
    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
    <p className={`mt-2 font-semibold tabular-nums ${featured ? 'text-3xl' : 'text-2xl'} ${classes.value}`}>{value}</p>
  </article>
}

export function ReportEmpty({ title }: { title: string }) {
  return <EmptyState className="border-0 bg-transparent px-2 py-8" title={title} />
}

function dateLabel(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T00:00:00Z`))
}

function statusLabel(status: string, labels: AbsenceReportLabels): string {
  if (status === 'RECOVERY_WINDOW') return labels.recoveryWindow
  if (status === 'CLOSED') return labels.closed
  return labels.active
}

function statusTone(status: string): BadgeTone {
  if (status === 'RECOVERY_WINDOW') return 'info'
  if (status === 'CLOSED') return 'success'
  return 'danger'
}

function periodLabel(query: AbsenceInsightQuery, locale: string): string {
  if (query.period === 'year') return String(query.year)
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(`${query.year}-${String(query.month).padStart(2, '0')}-01T00:00:00Z`))
}

export function AbsenceReportView({ report, query, labels, locale, returnTo }: { report: AbsenceInsightReport; query: AbsenceInsightQuery; labels: AbsenceReportLabels; locale: string; returnTo: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const months = [labels.jan, labels.feb, labels.mar, labels.apr, labels.may, labels.jun, labels.jul, labels.aug, labels.sep, labels.oct, labels.nov, labels.dec]
  const [draft, setDraft] = useState(query)
  const defaultQuery = (): AbsenceInsightQuery => {
    const parsed = parseAbsenceInsightQuery(new URLSearchParams({ report: 'absence' }))
    if (!parsed) throw new Error('INSIGHTS_ABSENCE_DEFAULT_INVALID')
    return parsed
  }
  const apply = (next: AbsenceInsightQuery): void => router.push(buildInsightApplyHref(searchParams, absenceInsightQueryParams(next)), { scroll: false })
  const reset = (): void => { const next = defaultQuery(); setDraft(next); apply(next) }
  const selectedDepartment = draft.departmentId ? report.departments.find((department) => department.id === draft.departmentId)?.name ?? draft.departmentId : null
  const selectedFilters: ActiveReportFilter[] = [
    { key: 'period', label: labels.period, value: periodLabel(draft, locale), onRemove: reset },
    ...(selectedDepartment ? [{ key: 'department', label: labels.department, value: selectedDepartment, onRemove: () => setDraft((current) => ({ ...current, departmentId: null })) }] : []),
  ]
  const exportParams = absenceInsightQueryParams(query, 'excel')

  return <section className="space-y-5">
      <InsightsFilterBar actions={<>
        <Button onClick={() => apply(draft)} size="md" type="button">{labels.applyFilters}</Button>
        <Button onClick={reset} size="md" type="button" variant="secondary">{labels.resetFilters}</Button>
        <InsightsExportAction fileName="absence.xlsx" href={`/api/insights/absence?${exportParams.toString()}`} label={labels.exportExcel} labels={{ error: labels.exportFailed, loading: labels.exportPreparing, success: labels.exportSuccess }} />
      </>}>
        <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-36"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.period}</span><DropdownSelect aria-label={labels.period} onChange={(event) => setDraft((current) => ({ ...current, period: event.currentTarget.value as AbsenceInsightQuery['period'] }))} value={draft.period}><option value="month">{labels.month}</option><option value="year">{labels.year}</option></DropdownSelect></label>
        <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-28"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.yearLabel}</span><DropdownSelect aria-label={labels.yearLabel} onChange={(event) => setDraft((current) => ({ ...current, year: Number(event.currentTarget.value) }))} value={String(draft.year)}>{Array.from({ length: 7 }, (_, index) => draft.year - 3 + index).map((year) => <option key={year} value={year}>{year}</option>)}</DropdownSelect></label>
        {draft.period === 'month' ? <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-36"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.month}</span><DropdownSelect aria-label={labels.month} onChange={(event) => setDraft((current) => ({ ...current, month: Number(event.currentTarget.value) }))} value={String(draft.month)}>{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</DropdownSelect></label> : null}
        <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-52"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.department}</span><DropdownSelect aria-label={labels.department} onChange={(event) => setDraft((current) => ({ ...current, departmentId: event.currentTarget.value || null }))} searchable searchPlaceholder={labels.department} value={draft.departmentId ?? ''}><option value="">{labels.allDepartments}</option>{report.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</DropdownSelect></label>
      </InsightsFilterBar>
      <ActiveFilters clearLabel={labels.clearFilters} filters={selectedFilters} label={labels.activeFilters} onClear={reset} onReset={reset} removeLabel={labels.removeFilter} resetLabel={labels.resetFilters} selectedCountLabel={labels.filterStatus} />

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <ReportKpi featured label={labels.absenceRate} tone="primary" value={`${report.absenceRate.toFixed(2)}%`} />
      <ReportKpi label={labels.activeCases} tone="info" value={String(report.activeCases)} />
      <ReportKpi label={labels.reports} value={String(report.absenceCases)} />
      <ReportKpi label={labels.sickDays} tone="warning" value={report.sickDays.toFixed(1)} />
      <ReportKpi label={labels.sickHours} value={report.sickHours.toFixed(1)} />
    </div>

    <Surface className="flex items-start gap-3 p-4 text-sm leading-6 text-muted-foreground" variant="subtle"><HeartPulse aria-hidden="true" className="mt-1 shrink-0 text-info" size={17} /><p>{labels.formulaHint}</p></Surface>

    {query.period === 'year' ? <Surface className="p-5">
      <SectionHeader description={String(query.year)} title={labels.monthlyTrend} />
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{report.trend.map((period) => <div className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3 text-sm" key={period.label}>
        <span className="text-muted-foreground">{months[Number(period.label.slice(5, 7)) - 1]}</span>
        <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-destructive" style={{ width: `${Math.min(period.absenceRate * 8, 100)}%` }} /></div>
        <strong className="tabular-nums">{period.absenceRate.toFixed(2)}%</strong>
      </div>)}</div>
    </Surface> : null}

    <div className="space-y-3">
      <SectionHeader actions={<span className="text-sm text-muted-foreground">{report.availableDays.toFixed(1)} {labels.availableDays.toLowerCase()}</span>} description={`${dateLabel(report.period.startDate, locale)} → ${dateLabel(report.period.endDate, locale)}`} title={labels.currentData} />
      <DataTableShell caption={labels.currentData} state={report.rows.length ? 'ready' : 'empty'} stateContent={<ReportEmpty title={labels.noResults} />}>
        <thead className="bg-surface-subtle text-xs uppercase tracking-[0.08em] text-muted-foreground"><tr>
          <th className="px-4 py-3 sm:px-5">{labels.employee}</th><th className="px-4 py-3 sm:px-5">{labels.department}</th><th className="px-4 py-3 sm:px-5">{labels.status}</th><th className="px-4 py-3 sm:px-5">{labels.firstAbsenceOn}</th><th className="px-4 py-3 text-right sm:px-5">{labels.days}</th><th className="px-4 py-3 text-right sm:px-5">{labels.hours}</th><th className="px-4 py-3 text-right sm:px-5">{labels.absenceRate}</th><th className="px-4 py-3 sm:px-5">{labels.dossier}</th>
        </tr></thead>
        <tbody className="divide-y divide-border-subtle">{report.rows.map((row) => <tr className="whitespace-nowrap" key={row.employeeId}>
          <td className="px-4 py-3 font-medium sm:px-5"><Link className="text-primary hover:underline" href={insightEmployeeDrilldownHref(row.employeeId, returnTo, 'absence')}>{row.employeeName}</Link></td>
          <td className="px-4 py-3 text-muted-foreground sm:px-5">{row.departmentName ?? labels.allDepartments}</td>
          <td className="px-4 py-3 sm:px-5"><Badge tone={statusTone(row.status)}>{statusLabel(row.status, labels)}</Badge></td>
          <td className="px-4 py-3 sm:px-5">{dateLabel(row.firstAbsenceOn, locale)}</td>
          <td className="px-4 py-3 text-right tabular-nums sm:px-5">{row.sickDays.toFixed(1)}</td>
          <td className="px-4 py-3 text-right tabular-nums sm:px-5">{row.sickHours.toFixed(1)}</td>
          <td className="px-4 py-3 text-right font-semibold tabular-nums sm:px-5">{row.absenceRate.toFixed(2)}%</td>
          <td className="px-4 py-3 sm:px-5"><Link aria-label={`${labels.dossier}: ${row.employeeName}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" href={insightEmployeeDrilldownHref(row.employeeId, returnTo, 'absence')}>{labels.dossier}<ArrowRight aria-hidden="true" size={15} /></Link></td>
        </tr>)}</tbody>
      </DataTableShell>
    </div>
  </section>
}
