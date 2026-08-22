'use client'

import Link from 'next/link'
import { ArrowRight, Download, HeartPulse } from 'lucide-react'
import type { BadgeTone } from '@/components/ui/badge'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { FilterBar } from '@/components/patterns/filter-bar'
import { SectionHeader } from '@/components/patterns/section-header'
import type { AbsenceInsightQuery, AbsenceInsightReport } from '@/lib/insights/absence-report'

interface AbsenceReportLabels {
  period: string; month: string; year: string; department: string; allDepartments: string; applyFilters: string; exportExcel: string; activeCases: string; reports: string; sickDays: string; sickHours: string; availableDays: string; absenceRate: string; currentData: string; employee: string; firstAbsenceOn: string; status: string; days: string; hours: string; dossier: string; active: string; recoveryWindow: string; closed: string; noResults: string; formulaHint: string; monthlyTrend: string; yearLabel: string; activeFilters?: string
  jan: string; feb: string; mar: string; apr: string; may: string; jun: string; jul: string; aug: string; sep: string; oct: string; nov: string; dec: string
}

export type ActiveReportFilter = { text: string } | { label: string; value: string }

export function ActiveFilters({ filters, label }: { filters: readonly ActiveReportFilter[]; label?: string }) {
  if (!filters.length) return null
  return <div aria-label={label || undefined} className="flex flex-wrap items-center gap-2 text-sm">
    {label ? <span className="font-medium text-muted-foreground">{label}</span> : null}
    {filters.map((filter, index) => <Badge key={`${'text' in filter ? filter.text : filter.label}-${index}`} tone="info">{'text' in filter ? filter.text : `${filter.label}: ${filter.value}`}</Badge>)}
  </div>
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

export function AbsenceReportView({ report, query, labels, locale }: { report: AbsenceInsightReport; query: AbsenceInsightQuery; labels: AbsenceReportLabels; locale: string }) {
  const months = [labels.jan, labels.feb, labels.mar, labels.apr, labels.may, labels.jun, labels.jul, labels.aug, labels.sep, labels.oct, labels.nov, labels.dec]
  const exportParams = new URLSearchParams({ report: 'absence', period: query.period, year: String(query.year), month: String(query.month), format: 'excel' })
  if (query.departmentId) exportParams.set('department', query.departmentId)
  const selectedDepartment = query.departmentId ? report.departments.find((department) => department.id === query.departmentId)?.name ?? query.departmentId : null
  const selectedFilters: ActiveReportFilter[] = [
    { label: labels.period, value: periodLabel(query, locale) },
    ...(selectedDepartment ? [{ label: labels.department, value: selectedDepartment }] : []),
  ]

  return <section className="space-y-5">
    <form action="/insights" method="get">
      <FilterBar actions={<div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <Button size="md" type="submit">{labels.applyFilters}</Button>
        <a className={buttonClasses({ size: 'md', variant: 'secondary' })} download href={`/api/insights/absence?${exportParams.toString()}`}><Download aria-hidden="true" />{labels.exportExcel}</a>
      </div>}>
        <input name="report" type="hidden" value="absence" />
        <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-36"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.period}</span><DropdownSelect aria-label={labels.period} defaultValue={query.period} name="period"><option value="month">{labels.month}</option><option value="year">{labels.year}</option></DropdownSelect></label>
        <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-28"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.yearLabel}</span><DropdownSelect aria-label={labels.yearLabel} defaultValue={String(query.year)} name="year">{Array.from({ length: 7 }, (_, index) => query.year - 3 + index).map((year) => <option key={year} value={year}>{year}</option>)}</DropdownSelect></label>
        {query.period === 'month' ? <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-36"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.month}</span><DropdownSelect aria-label={labels.month} defaultValue={String(query.month)} name="month">{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</DropdownSelect></label> : null}
        <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-52"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.department}</span><DropdownSelect aria-label={labels.department} defaultValue={query.departmentId ?? ''} name="department" searchable searchPlaceholder={labels.department}><option value="">{labels.allDepartments}</option>{report.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</DropdownSelect></label>
      </FilterBar>
    </form>
    <ActiveFilters filters={selectedFilters} label={labels.activeFilters} />

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
          <td className="px-4 py-3 font-medium sm:px-5"><Link className="text-primary hover:underline" href={`/employees/${row.employeeId}?tab=absence`}>{row.employeeName}</Link></td>
          <td className="px-4 py-3 text-muted-foreground sm:px-5">{row.departmentName ?? labels.allDepartments}</td>
          <td className="px-4 py-3 sm:px-5"><Badge tone={statusTone(row.status)}>{statusLabel(row.status, labels)}</Badge></td>
          <td className="px-4 py-3 sm:px-5">{dateLabel(row.firstAbsenceOn, locale)}</td>
          <td className="px-4 py-3 text-right tabular-nums sm:px-5">{row.sickDays.toFixed(1)}</td>
          <td className="px-4 py-3 text-right tabular-nums sm:px-5">{row.sickHours.toFixed(1)}</td>
          <td className="px-4 py-3 text-right font-semibold tabular-nums sm:px-5">{row.absenceRate.toFixed(2)}%</td>
          <td className="px-4 py-3 sm:px-5"><Link aria-label={`${labels.dossier}: ${row.employeeName}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" href={`/employees/${row.employeeId}?tab=absence`}>{labels.dossier}<ArrowRight aria-hidden="true" size={15} /></Link></td>
        </tr>)}</tbody>
      </DataTableShell>
    </div>
  </section>
}
