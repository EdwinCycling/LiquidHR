'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { SalaryExceptionReport } from '@/lib/insights/salary-exceptions'

type Labels = {
  employee: string
  administration: string
  employment: string
  route: string
  structure: string
  band: string
  scaleStep: string
  invalidFrom: string
  severity: string
  status: string
  action: string
  adjustSalary: string
  informative: string
  high: string
  open: string
  bandInvalid: string
  scaleStepInvalid: string
  noResults: string
  search: string
  total: string
  salaryRemainsValid: string
  manualAction: string
}

function displayDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00Z`))
}

export function SalaryExceptionsReport({ report, locale, labels }: { report: SalaryExceptionReport; locale: string; labels: Labels }) {
  const [search, setSearch] = useState('')
  const query = search.trim().toLocaleLowerCase()
  const rows = useMemo(() => query
    ? report.rows.filter((row) => `${row.employeeName} ${row.administrationName} ${row.employmentNumber} ${row.structureName} ${row.scaleCode ?? ''} ${row.stepCode ?? ''} ${row.bandCode ?? ''}`.toLocaleLowerCase().includes(query))
    : report.rows, [query, report.rows])
  const highCount = report.rows.filter((row) => row.severity === 'HIGH').length
  return <div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label={labels.total} value={String(report.rows.length)} />
      <Metric label={labels.high} value={String(highCount)} tone="danger" />
      <Metric label={labels.informative} value={String(report.rows.length - highCount)} tone="info" />
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3">
      <p className="text-sm text-muted-foreground">{labels.manualAction}</p>
      <input aria-label={labels.search} className="form-field w-full sm:w-72" placeholder={labels.search} value={search} onChange={(event) => setSearch(event.target.value)} />
    </div>
    {rows.length === 0 ? <p className="mt-4 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{labels.noResults}</p> : <>
      <div className="mt-4 hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-4 py-3">{labels.employee}</th><th className="px-4 py-3">{labels.administration}</th><th className="px-4 py-3">{labels.employment}</th><th className="px-4 py-3">{labels.structure}</th><th className="px-4 py-3">{labels.band} / {labels.scaleStep}</th><th className="px-4 py-3">{labels.invalidFrom}</th><th className="px-4 py-3">{labels.severity}</th><th className="px-4 py-3">{labels.action}</th></tr></thead>
          <tbody className="divide-y">{rows.map((row) => <tr key={row.id}>
            <td className="px-4 py-3"><Link className="font-semibold text-primary hover:underline" href={`/employees/${row.employeeId}`}>{row.employeeName}</Link></td>
            <td className="px-4 py-3">{row.administrationName}</td>
            <td className="px-4 py-3">{row.employmentNumber}</td>
            <td className="px-4 py-3">{row.structureCode ? `${row.structureCode} · ` : ''}{row.structureName}</td>
            <td className="px-4 py-3">{row.salaryRoute === 'SALARY_BAND' ? `${row.bandCode ?? ''} · ${row.bandName ?? '—'}` : `${row.scaleCode ?? ''} · ${row.stepCode ?? '—'}`}</td>
            <td className="px-4 py-3 tabular-nums">{displayDate(row.invalidFrom, locale)}</td>
            <td className="px-4 py-3"><Severity row={row} labels={labels} /></td>
            <td className="px-4 py-3"><Link className="font-semibold text-primary hover:underline" href={`/employees/${row.employeeId}/employments/${row.employmentId}?tab=salary&date=${row.invalidFrom}`}>{labels.adjustSalary}</Link></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="mt-4 grid gap-3 md:hidden">{rows.map((row) => <article className="rounded-xl border bg-background p-4" key={row.id}>
        <div className="flex items-start justify-between gap-3"><div><Link className="font-semibold text-primary hover:underline" href={`/employees/${row.employeeId}`}>{row.employeeName}</Link><p className="mt-1 text-sm text-muted-foreground">{row.administrationName} · {row.employmentNumber}</p></div><Severity row={row} labels={labels} /></div>
        <dl className="mt-4 grid gap-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">{labels.structure}</dt><dd className="text-right font-medium">{row.structureName}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">{row.salaryRoute === 'SALARY_BAND' ? labels.band : labels.scaleStep}</dt><dd className="text-right font-medium">{row.salaryRoute === 'SALARY_BAND' ? `${row.bandCode ?? ''} · ${row.bandName ?? '—'}` : `${row.scaleCode ?? ''} · ${row.stepCode ?? '—'}`}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">{labels.invalidFrom}</dt><dd className="font-medium tabular-nums">{displayDate(row.invalidFrom, locale)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">{labels.status}</dt><dd className="font-medium">{labels.open}</dd></div></dl>
        <Link className="button-secondary mt-4 inline-flex w-full justify-center" href={`/employees/${row.employeeId}/employments/${row.employmentId}?tab=salary&date=${row.invalidFrom}`}>{labels.adjustSalary}</Link>
      </article>)}</div>
    </>}
  </div>
}

function Severity({ row, labels }: { row: SalaryExceptionReport['rows'][number]; labels: Labels }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.severity === 'HIGH' ? 'bg-destructive/10 text-destructive' : 'bg-chart-2/10 text-chart-2'}`}>{row.severity === 'HIGH' ? labels.high : labels.informative}</span>
}

function Metric({ label, value, tone = 'info' }: { label: string; value: string; tone?: 'info' | 'danger' }) {
  return <div className={`rounded-xl border p-4 ${tone === 'danger' ? 'border-destructive/25 bg-destructive/5' : 'border-chart-2/25 bg-chart-2/5'}`}><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p></div>
}
