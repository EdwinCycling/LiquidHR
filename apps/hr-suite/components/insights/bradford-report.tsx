'use client'

import Link from 'next/link'
import { ArrowLeft, Download, Info, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { BradfordInsightQuery } from '@/lib/insights/bradford-query'
import type { BradfordInsightReport, BradfordBand } from '@/lib/insights/bradford-report'

interface BradfordReportLabels {
  title: string; description: string; backToAbsence: string; exportExcel: string; period: string; last52Weeks: string; thisYear: string; previousYear: string; team: string; allDepartments: string; applyFilters: string; groupBy: string; person: string; search: string; searchPlaceholder: string; risk: string; allRisks: string; lowRisk: string; mediumRisk: string; highRisk: string; employee: string; distribution: string; score: string; occurrences: string; days: string; since: string; dossier: string; info: string; infoTitle: string; infoFormula: string; infoInterpretation: string; infoLow: string; infoMedium: string; infoHigh: string; infoCaveat: string; infoSource: string; close: string; noResults: string
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

function bandStyle(band: BradfordBand): string {
  if (band === 'HIGH') return 'bg-destructive text-destructive-foreground'
  if (band === 'MEDIUM') return 'bg-chart-4 text-white'
  return 'bg-chart-2 text-white'
}

export function BradfordReportView({ report, query, labels }: { report: BradfordInsightReport; query: BradfordInsightQuery; labels: BradfordReportLabels }) {
  const [infoOpen, setInfoOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [risk, setRisk] = useState<'ALL' | BradfordBand>('ALL')
  const exportParams = new URLSearchParams({ report: 'absence-bradford', period: query.period, format: 'excel' })
  if (query.departmentId) exportParams.set('department', query.departmentId)
  const maxScore = Math.max(1, ...report.rows.map((row) => row.score))
  const rows = useMemo(() => report.rows.filter((row) => (risk === 'ALL' || row.band === risk) && row.employeeName.toLocaleLowerCase('nl-NL').includes(search.trim().toLocaleLowerCase('nl-NL'))), [report.rows, risk, search])
  useEffect(() => {
    if (!infoOpen) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setInfoOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [infoOpen])
  return <section className="space-y-5">
    <header className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-start lg:justify-between"><div><Link className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary" href="/insights?report=absence"><ArrowLeft aria-hidden="true" size={16} />{labels.backToAbsence}</Link><h1 className="text-3xl font-semibold tracking-tight">{labels.title}</h1><p className="mt-2 max-w-2xl text-muted-foreground">{labels.description}</p></div><div className="flex flex-wrap gap-2"><button aria-controls="bradford-info" aria-expanded={infoOpen} className="button-secondary inline-flex items-center gap-2" onClick={() => setInfoOpen(true)} type="button"><Info aria-hidden="true" size={16} />{labels.info}</button><a className="button-primary inline-flex items-center gap-2" download href={`/api/insights/absence?${exportParams.toString()}`}><Download aria-hidden="true" size={16} />{labels.exportExcel}</a></div></header>

    <form action="/insights" className="flex flex-col gap-3 rounded-xl border bg-muted/35 p-4 lg:flex-row lg:items-end" method="get"><input name="report" type="hidden" value="absence-bradford" /><label className="flex min-w-44 flex-1 flex-col gap-1.5 text-sm font-medium"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.period}</span><select className="h-11 rounded-lg border bg-background px-3 font-normal" name="period" defaultValue={query.period}><option value="52-weeks">{labels.last52Weeks}</option><option value="this-year">{labels.thisYear}</option><option value="previous-year">{labels.previousYear}</option></select></label><label className="flex min-w-52 flex-[1.4] flex-col gap-1.5 text-sm font-medium"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.team}</span><select className="h-11 rounded-lg border bg-background px-3 font-normal" name="department" defaultValue={query.departmentId ?? ''}><option value="">{labels.allDepartments}</option>{report.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label className="flex min-w-44 flex-1 flex-col gap-1.5 text-sm font-medium"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.risk}</span><select className="h-11 rounded-lg border bg-background px-3 font-normal" onChange={(event) => setRisk(event.target.value as 'ALL' | BradfordBand)} value={risk}><option value="ALL">{labels.allRisks}</option><option value="LOW">{labels.lowRisk}</option><option value="MEDIUM">{labels.mediumRisk}</option><option value="HIGH">{labels.highRisk}</option></select></label><div className="flex min-w-52 flex-1 flex-col gap-1.5"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.search}</span><input className="h-11 rounded-lg border bg-background px-3 font-normal" onChange={(event) => setSearch(event.target.value)} placeholder={labels.searchPlaceholder} type="search" value={search} /></div><button className="button-primary h-11 whitespace-nowrap" type="submit">{labels.applyFilters}</button></form>

    <div className="grid gap-3 sm:grid-cols-3"><Kpi label={labels.period} value={periodLabel(query, labels)} /><Kpi label={labels.occurrences} value={String(report.totalOccurrences)} /><Kpi label={labels.days} value={report.totalSickDays.toFixed(1)} /></div>
    <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-background px-4 py-3 text-sm"><span className="font-medium">{labels.distribution}</span><Legend band="LOW" labels={labels} /><Legend band="MEDIUM" labels={labels} /><Legend band="HIGH" labels={labels} /></div>

    <section className="overflow-hidden rounded-xl border bg-background"><header className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.groupBy}</p><h2 className="mt-1 font-semibold">{labels.person}</h2></div><span className="text-sm text-muted-foreground">{rows.length} / {report.rows.length}</span></header>{rows.length ? <ul className="divide-y">{rows.map((row) => <li className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1.8fr)_6rem] sm:items-center" key={row.employeeId}><div className="min-w-0"><Link className="font-semibold text-primary hover:underline" href={`/employees/${row.employeeId}?tab=absence`}>{row.employeeName}</Link><p className="mt-1 text-sm text-muted-foreground">{row.departmentName ?? labels.allDepartments} · {labels.occurrences}: {row.absenceOccurrences} · {labels.days}: {row.sickDays.toFixed(1)}</p></div><div><div aria-label={`${labels.distribution}: ${row.score}`} className="h-5 overflow-hidden rounded-md bg-muted"><div className={`h-full min-w-1 rounded-md ${bandStyle(row.band)}`} style={{ width: `${Math.max(row.score ? 2 : 0, row.score / maxScore * 100)}%` }} /></div><span className="sr-only">{bandLabel(row.band, labels)}</span></div><div className="text-right"><strong className="block text-lg tabular-nums">{row.score}</strong><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${bandStyle(row.band)}`}>{bandLabel(row.band, labels)}</span></div></li>)}</ul> : <p className="p-8 text-center text-sm text-muted-foreground">{labels.noResults}</p>}</section>

    {infoOpen ? <div aria-labelledby="bradford-info-title" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" id="bradford-info" role="dialog"><div className="max-h-[min(85vh,42rem)] w-full max-w-xl overflow-y-auto rounded-2xl border bg-background p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><h2 className="text-xl font-semibold" id="bradford-info-title">{labels.infoTitle}</h2><button aria-label={labels.close} className="grid size-9 place-items-center rounded-full border hover:bg-muted" onClick={() => setInfoOpen(false)} type="button"><X aria-hidden="true" size={17} /></button></div><div className="mt-5 space-y-4 text-sm leading-6 text-muted-foreground"><p>{labels.infoFormula}</p><p>{labels.infoInterpretation}</p><ul className="list-disc space-y-1 pl-5"><li>{labels.infoLow}</li><li>{labels.infoMedium}</li><li>{labels.infoHigh}</li></ul><p>{labels.infoCaveat}</p><a className="font-medium text-primary underline" href="https://www.ucu.org.uk/media/5329/Sickness-absence-the-Bradford-Factor---UCU-factsheet/pdf/ucufactsheet_sicknessabsence_theBradfordFactor_jul12.pdf" rel="noreferrer" target="_blank">{labels.infoSource}</a></div><div className="mt-6 flex justify-end"><button className="button-primary" onClick={() => setInfoOpen(false)} type="button">{labels.close}</button></div></div></div> : null}
  </section>
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <article className="rounded-xl border border-chart-1/25 bg-chart-1/10 p-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-chart-1">{value}</p></article>
}

function Legend({ band, labels }: { band: BradfordBand; labels: BradfordReportLabels }) {
  return <span className="inline-flex items-center gap-2"><span aria-hidden="true" className={`size-3 rounded-full ${bandStyle(band)}`} />{bandLabel(band, labels)}</span>
}
