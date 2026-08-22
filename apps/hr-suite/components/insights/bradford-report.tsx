'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight, Download, Info, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { BadgeTone } from '@/components/ui/badge'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { TextInput } from '@/components/ui/text-input'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { FilterBar } from '@/components/patterns/filter-bar'
import { SectionHeader } from '@/components/patterns/section-header'
import { ActiveFilters, ReportEmpty, ReportKpi, type ActiveReportFilter } from '@/components/insights/absence-report'
import type { BradfordInsightQuery } from '@/lib/insights/bradford-query'
import type { BradfordInsightReport, BradfordBand } from '@/lib/insights/bradford-report'

interface BradfordReportLabels {
  title: string; description: string; backToAbsence: string; exportExcel: string; period: string; last52Weeks: string; thisYear: string; previousYear: string; team: string; allDepartments: string; applyFilters: string; groupBy: string; person: string; search: string; searchPlaceholder: string; risk: string; allRisks: string; lowRisk: string; mediumRisk: string; highRisk: string; employee: string; distribution: string; score: string; occurrences: string; days: string; since: string; dossier: string; info: string; infoTitle: string; infoFormula: string; infoInterpretation: string; infoLow: string; infoMedium: string; infoHigh: string; infoCaveat: string; infoSource: string; close: string; noResults: string; activeFilters?: string
}

function periodLabel(query: BradfordInsightQuery, labels: BradfordReportLabels): string {
  if (query.period === '52-weeks') return labels.last52Weeks
  if (query.period === 'this-year') return labels.thisYear
  return labels.previousYear
}

function bandLabel(band: BradfordBand, labels: BradfordReportLabels): string {
  if (band === 'HIGH') return labels.highRisk
  if (band === 'MEDIUM') return labels.mediumRisk
  return labels.lowRisk
}

function bandTone(band: BradfordBand): BadgeTone {
  if (band === 'HIGH') return 'danger'
  if (band === 'MEDIUM') return 'warning'
  return 'success'
}

function bandBarClass(band: BradfordBand): string {
  if (band === 'HIGH') return 'bg-destructive'
  if (band === 'MEDIUM') return 'bg-warning'
  return 'bg-success'
}

function dateLabel(value: string): string {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

export function BradfordReportView({ report, query, labels }: { report: BradfordInsightReport; query: BradfordInsightQuery; labels: BradfordReportLabels }) {
  const [infoOpen, setInfoOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [risk, setRisk] = useState<'ALL' | BradfordBand>('ALL')
  const exportParams = new URLSearchParams({ report: 'absence-bradford', period: query.period, format: 'excel' })
  if (query.departmentId) exportParams.set('department', query.departmentId)
  const maxScore = Math.max(1, ...report.rows.map((row) => row.score))
  const rows = useMemo(() => report.rows.filter((row) => (risk === 'ALL' || row.band === risk) && row.employeeName.toLocaleLowerCase('nl-NL').includes(search.trim().toLocaleLowerCase('nl-NL'))), [report.rows, risk, search])
  const selectedDepartment = query.departmentId ? report.departments.find((department) => department.id === query.departmentId)?.name ?? query.departmentId : null
  const activeFilters: ActiveReportFilter[] = [
    { label: labels.period, value: periodLabel(query, labels) },
    ...(selectedDepartment ? [{ label: labels.team, value: selectedDepartment }] : []),
    ...(risk !== 'ALL' ? [{ label: labels.risk, value: bandLabel(risk, labels) }] : []),
    ...(search.trim() ? [{ label: labels.search, value: search.trim() }] : []),
  ]

  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary" href="/insights?report=absence"><ArrowLeft aria-hidden="true" size={16} />{labels.backToAbsence}</Link>
      <p className="max-w-xl text-right text-sm text-muted-foreground">{labels.description}</p>
    </div>

    <form action="/insights" method="get">
      <FilterBar actions={<div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <Button size="md" type="button" variant="secondary" onClick={() => setInfoOpen(true)}><Info aria-hidden="true" />{labels.info}</Button>
        <Button size="md" type="submit">{labels.applyFilters}</Button>
        <a className={buttonClasses({ size: 'md', variant: 'secondary' })} download href={`/api/insights/absence?${exportParams.toString()}`}><Download aria-hidden="true" />{labels.exportExcel}</a>
      </div>}>
        <input name="report" type="hidden" value="absence-bradford" />
        <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-44"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.period}</span><DropdownSelect aria-label={labels.period} defaultValue={query.period} name="period"><option value="52-weeks">{labels.last52Weeks}</option><option value="this-year">{labels.thisYear}</option><option value="previous-year">{labels.previousYear}</option></DropdownSelect></label>
        <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-52"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.team}</span><DropdownSelect aria-label={labels.team} defaultValue={query.departmentId ?? ''} name="department" searchable searchPlaceholder={labels.team}><option value="">{labels.allDepartments}</option>{report.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</DropdownSelect></label>
        <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-44"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.risk}</span><DropdownSelect aria-label={labels.risk} onChange={(event) => setRisk(event.target.value as 'ALL' | BradfordBand)} value={risk}><option value="ALL">{labels.allRisks}</option><option value="LOW">{labels.lowRisk}</option><option value="MEDIUM">{labels.mediumRisk}</option><option value="HIGH">{labels.highRisk}</option></DropdownSelect></label>
        <label className="flex min-w-0 basis-full flex-[1.2] flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-52"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.search}</span><TextInput leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setSearch(event.target.value)} placeholder={labels.searchPlaceholder} type="search" value={search} /></label>
      </FilterBar>
    </form>
    <ActiveFilters filters={activeFilters} label={labels.activeFilters} />

    <div className="grid gap-3 sm:grid-cols-3">
      <ReportKpi featured label={labels.period} tone="primary" value={periodLabel(query, labels)} />
      <ReportKpi label={labels.occurrences} tone="info" value={String(report.totalOccurrences)} />
      <ReportKpi label={labels.days} tone="warning" value={report.totalSickDays.toFixed(1)} />
    </div>

    <div className="flex flex-wrap items-center gap-2 text-sm"><span className="mr-1 font-medium text-muted-foreground">{labels.distribution}</span><BradfordLegend band="LOW" labels={labels} /><BradfordLegend band="MEDIUM" labels={labels} /><BradfordLegend band="HIGH" labels={labels} /></div>

    <div className="space-y-3">
      <SectionHeader actions={<span className="text-sm text-muted-foreground">{rows.length} / {report.rows.length}</span>} description={periodLabel(query, labels)} title={labels.person} />
      <DataTableShell caption={labels.title} state={rows.length ? 'ready' : 'empty'} stateContent={<ReportEmpty title={labels.noResults} />}>
        <thead className="bg-surface-subtle text-xs uppercase tracking-[0.08em] text-muted-foreground"><tr>
          <th className="px-4 py-3 sm:px-5">{labels.employee}</th><th className="px-4 py-3 sm:px-5">{labels.team}</th><th className="px-4 py-3 sm:px-5">{labels.since}</th><th className="px-4 py-3 text-right sm:px-5">{labels.occurrences}</th><th className="px-4 py-3 text-right sm:px-5">{labels.days}</th><th className="min-w-56 px-4 py-3 sm:px-5">{labels.distribution}</th><th className="px-4 py-3 text-right sm:px-5">{labels.score}</th><th className="px-4 py-3 sm:px-5">{labels.dossier}</th>
        </tr></thead>
        <tbody className="divide-y divide-border-subtle">{rows.map((row) => <tr className="whitespace-nowrap" key={row.employeeId}>
          <td className="px-4 py-3 font-medium sm:px-5"><Link className="text-primary hover:underline" href={`/employees/${row.employeeId}?tab=absence`}>{row.employeeName}</Link></td>
          <td className="px-4 py-3 text-muted-foreground sm:px-5">{row.departmentName ?? labels.allDepartments}</td>
          <td className="px-4 py-3 sm:px-5">{dateLabel(row.firstAbsenceOn)}</td>
          <td className="px-4 py-3 text-right tabular-nums sm:px-5">{row.absenceOccurrences}</td>
          <td className="px-4 py-3 text-right tabular-nums sm:px-5">{row.sickDays.toFixed(1)}</td>
          <td className="min-w-56 px-4 py-3 sm:px-5"><div aria-label={`${labels.distribution}: ${row.score}`} className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${bandBarClass(row.band)}`} style={{ width: `${Math.max(row.score ? 2 : 0, row.score / maxScore * 100)}%` }} /></div></td>
          <td className="px-4 py-3 text-right sm:px-5"><div className="flex flex-col items-end gap-1"><strong className="text-lg tabular-nums">{row.score}</strong><Badge tone={bandTone(row.band)}>{bandLabel(row.band, labels)}</Badge></div></td>
          <td className="px-4 py-3 sm:px-5"><Link aria-label={`${labels.dossier}: ${row.employeeName}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" href={`/employees/${row.employeeId}?tab=absence`}>{labels.dossier}<ArrowRight aria-hidden="true" size={15} /></Link></td>
        </tr>)}</tbody>
      </DataTableShell>
    </div>

    <Dialog closeLabel={labels.close} description={labels.infoInterpretation} footer={<div className="flex justify-end"><Button type="button" onClick={() => setInfoOpen(false)}>{labels.close}</Button></div>} onOpenChange={setInfoOpen} open={infoOpen} title={labels.infoTitle}>
      <div className="space-y-4 text-sm leading-6 text-muted-foreground"><p>{labels.infoFormula}</p><ul className="list-disc space-y-1 pl-5"><li>{labels.infoLow}</li><li>{labels.infoMedium}</li><li>{labels.infoHigh}</li></ul><p>{labels.infoCaveat}</p><a className="font-medium text-primary underline" href="https://www.ucu.org.uk/media/5329/Sickness-absence-the-Bradford-Factor---UCU-factsheet/pdf/ucufactsheet_sicknessabsence_theBradfordFactor_jul12.pdf" rel="noreferrer" target="_blank">{labels.infoSource}</a></div>
    </Dialog>
  </section>
}

function BradfordLegend({ band, labels }: { band: BradfordBand; labels: BradfordReportLabels }) {
  return <Badge tone={bandTone(band)}>{bandLabel(band, labels)}</Badge>
}
