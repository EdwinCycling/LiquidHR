'use client'

import Link from 'next/link'
import { AlertTriangle, Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { FrequentAbsenceQuery } from '@/lib/insights/frequent-absence-query'
import type { FrequentAbsenceReport } from '@/lib/insights/frequent-absence-report'

interface FrequentAbsenceLabels {
  title: string; description: string; exportExcel: string; period: string; last12Months: string; thisYear: string; previousYear: string; team: string; allDepartments: string; applyFilters: string; search: string; searchPlaceholder: string; employee: string; reportCount: string; sickDays: string; frequent: string; threshold: string; thresholdDescription: string; totalEmployees: string; frequentCount: string; totalReports: string; noResults: string; yearLabel: string
}

function periodLabel(query: FrequentAbsenceQuery, labels: FrequentAbsenceLabels): string {
  if (query.period === '12-months') return labels.last12Months
  if (query.period === 'this-year') return labels.thisYear
  return labels.previousYear
}

export function FrequentAbsenceReportView({ report, query, labels }: { report: FrequentAbsenceReport; query: FrequentAbsenceQuery; labels: FrequentAbsenceLabels }) {
  const [search, setSearch] = useState('')
  const [showFrequentOnly, setShowFrequentOnly] = useState(false)
  const exportParams = new URLSearchParams({ report: 'absence-frequent', period: query.period, format: 'excel' })
  if (query.departmentId) exportParams.set('department', query.departmentId)
  const rows = useMemo(() => report.rows.filter((row) => (!showFrequentOnly || row.isFrequent) && row.employeeName.toLocaleLowerCase('nl-NL').includes(search.trim().toLocaleLowerCase('nl-NL'))), [report.rows, search, showFrequentOnly])

  return <section className="space-y-5">
    <form action="/insights" className="flex flex-col gap-3 rounded-xl border bg-muted/35 p-4 lg:flex-row lg:items-end" method="get">
      <input name="report" type="hidden" value="absence-frequent" />
      <label className="flex min-w-44 flex-1 flex-col gap-1.5 text-sm font-medium"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.period}</span><select className="h-11 rounded-lg border bg-background px-3 font-normal" defaultValue={query.period} name="period"><option value="12-months">{labels.last12Months}</option><option value="this-year">{labels.thisYear}</option><option value="previous-year">{labels.previousYear}</option></select></label>
      <label className="flex min-w-52 flex-[1.4] flex-col gap-1.5 text-sm font-medium"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.team}</span><select className="h-11 rounded-lg border bg-background px-3 font-normal" defaultValue={query.departmentId ?? ''} name="department"><option value="">{labels.allDepartments}</option>{report.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
      <div className="flex min-w-52 flex-1 flex-col gap-1.5"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.search}</span><input className="h-11 rounded-lg border bg-background px-3 font-normal" onChange={(event) => setSearch(event.target.value)} placeholder={labels.searchPlaceholder} type="search" value={search} /></div>
      <button className="button-primary h-11 whitespace-nowrap" type="submit">{labels.applyFilters}</button>
      <a className="button-secondary inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap" download href={`/api/insights/absence?${exportParams.toString()}`}><Download aria-hidden="true" size={16} />{labels.exportExcel}</a>
    </form>

    <div className="grid gap-3 sm:grid-cols-3">
      <Kpi label={labels.totalEmployees} value={String(report.totalEmployees)} />
      <Kpi label={labels.totalReports} value={String(report.totalReports)} />
      <Kpi label={labels.frequentCount} value={String(report.frequentCount)} tone="rose" />
    </div>

    <div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive-surface p-4 text-sm leading-6 text-muted-foreground">
      <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0 text-destructive" size={16} />
      <p>{labels.thresholdDescription.replace('{threshold}', String(report.threshold))}</p>
    </div>

    <section className="overflow-hidden rounded-xl border bg-background">
      <header className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{periodLabel(query, labels)}</p><h3 className="mt-1 font-semibold">{labels.title}</h3></div>
        <div className="flex items-center gap-4"><label className="flex items-center gap-2 text-sm font-medium"><input checked={showFrequentOnly} className="size-4 accent-destructive" onChange={() => setShowFrequentOnly(!showFrequentOnly)} type="checkbox" />{labels.frequent}</label><span className="text-sm text-muted-foreground">{rows.length} / {report.rows.length}</span></div>
      </header>
      {rows.length ? <ul className="divide-y">{rows.map((row) => <li className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-6 ${row.isFrequent ? 'bg-destructive/5' : ''}`} key={row.employeeId}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link className="font-semibold text-primary hover:underline" href={`/employees/${row.employeeId}?tab=absence`}>{row.employeeName}</Link>
            {row.isFrequent ? <span className="inline-flex items-center rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">{labels.frequent}</span> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{row.departmentName ?? labels.allDepartments}</p>
        </div>
        <div className="flex items-center gap-6 text-sm sm:justify-end">
          <span className="tabular-nums"><strong className={row.isFrequent ? 'text-destructive' : ''}>{row.reportCount}</strong> {labels.reportCount.toLowerCase()}</span>
          <span className="tabular-nums"><strong>{row.totalSickDays.toFixed(1)}</strong> {labels.sickDays.toLowerCase()}</span>
        </div>
      </li>)}</ul> : <p className="p-8 text-center text-sm text-muted-foreground">{labels.noResults}</p>}
    </section>
  </section>
}

function Kpi({ label, value, tone = 'blue' }: { label: string; value: string; tone?: 'blue' | 'rose' }) {
  return <article className={`rounded-xl border p-4 ${tone === 'rose' ? 'border-destructive/25 bg-destructive-surface' : 'border-chart-1/25 bg-chart-1/10'}`}><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-semibold tabular-nums ${tone === 'rose' ? 'text-destructive' : 'text-chart-1'}`}>{value}</p></article>
}
