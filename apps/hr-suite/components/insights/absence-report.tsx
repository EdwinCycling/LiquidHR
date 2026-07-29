'use client'

import Link from 'next/link'
import { ArrowRight, Download, HeartPulse } from 'lucide-react'
import type { AbsenceInsightQuery, AbsenceInsightReport } from '@/lib/insights/absence-report'

interface AbsenceReportLabels {
  period: string; month: string; year: string; department: string; allDepartments: string; applyFilters: string; exportExcel: string; activeCases: string; reports: string; sickDays: string; sickHours: string; availableDays: string; absenceRate: string; currentData: string; employee: string; firstAbsenceOn: string; status: string; days: string; hours: string; dossier: string; active: string; recoveryWindow: string; closed: string; noResults: string; formulaHint: string; monthlyTrend: string; yearLabel: string
  jan: string; feb: string; mar: string; apr: string; may: string; jun: string; jul: string; aug: string; sep: string; oct: string; nov: string; dec: string
}

function dateLabel(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T00:00:00Z`))
}

function statusLabel(status: string, labels: AbsenceReportLabels): string {
  if (status === 'RECOVERY_WINDOW') return labels.recoveryWindow
  if (status === 'CLOSED') return labels.closed
  return labels.active
}

export function AbsenceReportView({ report, query, labels, locale }: { report: AbsenceInsightReport; query: AbsenceInsightQuery; labels: AbsenceReportLabels; locale: string }) {
  const months = [labels.jan, labels.feb, labels.mar, labels.apr, labels.may, labels.jun, labels.jul, labels.aug, labels.sep, labels.oct, labels.nov, labels.dec]
  const exportParams = new URLSearchParams({ report: 'absence', period: query.period, year: String(query.year), month: String(query.month), format: 'excel' })
  if (query.departmentId) exportParams.set('department', query.departmentId)
  return <section className="space-y-5">
    <form action="/insights" className="flex flex-col gap-3 rounded-xl border bg-muted/35 p-4 lg:flex-row lg:items-end" method="get">
      <input name="report" type="hidden" value="absence" />
      <label className="flex min-w-36 flex-1 flex-col gap-1.5 text-sm font-medium"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.period}</span><select className="h-11 rounded-lg border bg-background px-3 font-normal" name="period" defaultValue={query.period}><option value="month">{labels.month}</option><option value="year">{labels.year}</option></select></label>
      <label className="flex min-w-28 flex-1 flex-col gap-1.5 text-sm font-medium"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.yearLabel}</span><select className="h-11 rounded-lg border bg-background px-3 font-normal" name="year" defaultValue={String(query.year)}>{Array.from({ length: 7 }, (_, index) => query.year - 3 + index).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
      {query.period === 'month' ? <label className="flex min-w-36 flex-1 flex-col gap-1.5 text-sm font-medium"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.month}</span><select className="h-11 rounded-lg border bg-background px-3 font-normal" name="month" defaultValue={String(query.month)}>{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label> : null}
      <label className="flex min-w-52 flex-[1.4] flex-col gap-1.5 text-sm font-medium"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.department}</span><select className="h-11 rounded-lg border bg-background px-3 font-normal" name="department" defaultValue={query.departmentId ?? ''}><option value="">{labels.allDepartments}</option>{report.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
      <button className="button-primary h-11 whitespace-nowrap" type="submit">{labels.applyFilters}</button>
      <a className="button-secondary inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap" download href={`/api/insights/absence?${exportParams.toString()}`}><Download aria-hidden="true" size={16} />{labels.exportExcel}</a>
    </form>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi label={labels.activeCases} value={String(report.activeCases)} />
      <Kpi label={labels.reports} value={String(report.absenceCases)} />
      <Kpi label={labels.absenceRate} value={`${report.absenceRate.toFixed(2)}%`} tone="rose" />
      <Kpi label={labels.sickDays} value={report.sickDays.toFixed(1)} />
      <Kpi label={labels.sickHours} value={report.sickHours.toFixed(1)} />
    </div>

    <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground"><HeartPulse aria-hidden="true" className="mr-2 inline-block text-primary" size={16} />{labels.formulaHint}</div>

    {query.period === 'year' ? <section className="rounded-xl border bg-background p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{labels.monthlyTrend}</h3><span className="text-sm text-muted-foreground">{query.year}</span></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{report.trend.map((period) => <div className="rounded-lg border bg-muted/25 p-3" key={period.label}><div className="flex items-center justify-between text-sm"><span>{months[Number(period.label.slice(5, 7)) - 1]}</span><strong>{period.absenceRate.toFixed(2)}%</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-destructive" style={{ width: `${Math.min(period.absenceRate * 8, 100)}%` }} /></div></div>)}</div></section> : null}

    <section className="overflow-hidden rounded-xl border bg-background"><header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.currentData}</p><h3 className="mt-1 font-semibold">{dateLabel(report.period.startDate, locale)} – {dateLabel(report.period.endDate, locale)}</h3></div><span className="text-sm text-muted-foreground">{report.availableDays.toFixed(1)} {labels.availableDays.toLowerCase()}</span></header>{report.rows.length ? <ul className="divide-y">{report.rows.map((row) => <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-6" key={row.employeeId}><div className="min-w-0 flex-1"><Link className="font-semibold text-primary hover:underline" href={`/employees/${row.employeeId}?tab=absence`}>{row.employeeName}</Link><p className="mt-1 text-sm text-muted-foreground">{row.departmentName ?? labels.allDepartments} · {statusLabel(row.status, labels)} · {labels.firstAbsenceOn} {dateLabel(row.firstAbsenceOn, locale)}</p></div><div className="flex items-center gap-5 text-sm sm:justify-end"><span className="tabular-nums"><strong>{row.sickDays.toFixed(1)}</strong> {labels.days}</span><span className="tabular-nums"><strong>{row.absenceRate.toFixed(2)}%</strong></span><Link aria-label={`${labels.dossier}: ${row.employeeName}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" href={`/employees/${row.employeeId}?tab=absence`}>{labels.dossier}<ArrowRight aria-hidden="true" size={15} /></Link></div></li>)}</ul> : <p className="p-8 text-center text-sm text-muted-foreground">{labels.noResults}</p>}</section>
  </section>
}

function Kpi({ label, value, tone = 'blue' }: { label: string; value: string; tone?: 'blue' | 'rose' }) {
  return <article className={`rounded-xl border p-4 ${tone === 'rose' ? 'border-destructive/25 bg-destructive-surface' : 'border-chart-1/25 bg-chart-1/10'}`}><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-semibold tabular-nums ${tone === 'rose' ? 'text-destructive' : 'text-chart-1'}`}>{value}</p></article>
}
