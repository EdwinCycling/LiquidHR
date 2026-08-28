'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight, Info, Search } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { BadgeTone } from '@/components/ui/badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { TextInput } from '@/components/ui/text-input'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { SectionHeader } from '@/components/patterns/section-header'
import { ActiveFilters, ReportEmpty, ReportKpi, type ActiveReportFilter } from '@/components/insights/absence-report'
import { InsightsExportAction, InsightsFilterBar } from '@/components/insights/shared-controls'
import { bradfordInsightQueryParams, parseBradfordInsightQuery, type BradfordInsightQuery } from '@/lib/insights/bradford-query'
import type { BradfordInsightReport, BradfordBand } from '@/lib/insights/bradford-report'
import { buildInsightApplyHref, insightEmployeeDrilldownHref } from '@/lib/insights/query-seam'

interface BradfordReportLabels {
  title: string; description: string; backToAbsence: string; exportExcel: string; exportPreparing: string; exportSuccess: string; exportFailed: string; period: string; last52Weeks: string; thisYear: string; previousYear: string; team: string; allDepartments: string; applyFilters: string; resetFilters: string; clearFilters: string; removeFilter: string; filterStatus: string; groupBy: string; person: string; search: string; searchPlaceholder: string; risk: string; allRisks: string; lowRisk: string; mediumRisk: string; highRisk: string; employee: string; distribution: string; score: string; occurrences: string; days: string; since: string; dossier: string; info: string; infoTitle: string; infoFormula: string; infoInterpretation: string; infoLow: string; infoMedium: string; infoHigh: string; infoCaveat: string; infoSource: string; close: string; noResults: string; activeFilters?: string
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

export function BradfordReportView({ report, query, labels, returnTo }: { report: BradfordInsightReport; query: BradfordInsightQuery; labels: BradfordReportLabels; returnTo: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [infoOpen, setInfoOpen] = useState(false)
  const [draft, setDraft] = useState(query)
  const defaultQuery = (): BradfordInsightQuery => {
    const parsed = parseBradfordInsightQuery(new URLSearchParams({ report: 'absence-bradford' }))
    if (!parsed) throw new Error('INSIGHTS_BRADFORD_DEFAULT_INVALID')
    return parsed
  }
  const apply = (next: BradfordInsightQuery): void => router.push(buildInsightApplyHref(searchParams, bradfordInsightQueryParams(next)), { scroll: false })
  const reset = (): void => { const next = defaultQuery(); setDraft(next); apply(next) }
  const maxScore = Math.max(1, ...report.rows.map((row) => row.score))
  const rows = useMemo(() => report.rows.filter((row) => (draft.risk === 'ALL' || row.band === draft.risk) && row.employeeName.toLocaleLowerCase('nl-NL').includes(draft.search.trim().toLocaleLowerCase('nl-NL'))), [draft.risk, draft.search, report.rows])
  const selectedDepartment = draft.departmentId ? report.departments.find((department) => department.id === draft.departmentId)?.name ?? draft.departmentId : null
  const activeFilters: ActiveReportFilter[] = [
    { key: 'period', label: labels.period, value: periodLabel(draft, labels), onRemove: reset },
    ...(selectedDepartment ? [{ key: 'department', label: labels.team, value: selectedDepartment, onRemove: () => setDraft((current) => ({ ...current, departmentId: null })) }] : []),
    ...(draft.risk !== 'ALL' ? [{ key: 'risk', label: labels.risk, value: bandLabel(draft.risk, labels), onRemove: () => setDraft((current) => ({ ...current, risk: 'ALL' })) }] : []),
    ...(draft.search.trim() ? [{ key: 'search', label: labels.search, value: draft.search.trim(), onRemove: () => setDraft((current) => ({ ...current, search: '' })) }] : []),
  ]
  const exportParams = bradfordInsightQueryParams(query, 'excel')

  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary" href="/insights?report=absence"><ArrowLeft aria-hidden="true" size={16} />{labels.backToAbsence}</Link>
      <p className="max-w-xl text-right text-sm text-muted-foreground">{labels.description}</p>
    </div>

    <InsightsFilterBar actions={<>
        <Button size="md" type="button" variant="secondary" onClick={() => setInfoOpen(true)}><Info aria-hidden="true" />{labels.info}</Button>
        <Button onClick={() => apply(draft)} size="md" type="button">{labels.applyFilters}</Button>
        <Button onClick={reset} size="md" type="button" variant="secondary">{labels.resetFilters}</Button>
        <InsightsExportAction fileName="absence-bradford.xlsx" href={`/api/insights/absence?${exportParams.toString()}`} label={labels.exportExcel} labels={{ error: labels.exportFailed, loading: labels.exportPreparing, success: labels.exportSuccess }} />
      </>}>
        <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-44"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.period}</span><DropdownSelect aria-label={labels.period} onChange={(event) => setDraft((current) => ({ ...current, period: event.currentTarget.value as BradfordInsightQuery['period'] }))} value={draft.period}><option value="52-weeks">{labels.last52Weeks}</option><option value="this-year">{labels.thisYear}</option><option value="previous-year">{labels.previousYear}</option></DropdownSelect></label>
        <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-52"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.team}</span><DropdownSelect aria-label={labels.team} onChange={(event) => setDraft((current) => ({ ...current, departmentId: event.currentTarget.value || null }))} searchable searchPlaceholder={labels.team} value={draft.departmentId ?? ''}><option value="">{labels.allDepartments}</option>{report.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</DropdownSelect></label>
        <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-44"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.risk}</span><DropdownSelect aria-label={labels.risk} onChange={(event) => setDraft((current) => ({ ...current, risk: event.currentTarget.value as BradfordInsightQuery['risk'] }))} value={draft.risk}><option value="ALL">{labels.allRisks}</option><option value="LOW">{labels.lowRisk}</option><option value="MEDIUM">{labels.mediumRisk}</option><option value="HIGH">{labels.highRisk}</option></DropdownSelect></label>
        <label className="flex min-w-0 basis-full flex-[1.2] flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-52"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.search}</span><TextInput leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))} placeholder={labels.searchPlaceholder} type="search" value={draft.search} /></label>
      </InsightsFilterBar>
    <ActiveFilters clearLabel={labels.clearFilters} filters={activeFilters} label={labels.activeFilters} onClear={reset} onReset={reset} removeLabel={labels.removeFilter} resetLabel={labels.resetFilters} selectedCountLabel={labels.filterStatus} />

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
          <td className="px-4 py-3 font-medium sm:px-5"><Link className="text-primary hover:underline" href={insightEmployeeDrilldownHref(row.employeeId, returnTo, 'absence')}>{row.employeeName}</Link></td>
          <td className="px-4 py-3 text-muted-foreground sm:px-5">{row.departmentName ?? labels.allDepartments}</td>
          <td className="px-4 py-3 sm:px-5">{dateLabel(row.firstAbsenceOn)}</td>
          <td className="px-4 py-3 text-right tabular-nums sm:px-5">{row.absenceOccurrences}</td>
          <td className="px-4 py-3 text-right tabular-nums sm:px-5">{row.sickDays.toFixed(1)}</td>
          <td className="min-w-56 px-4 py-3 sm:px-5"><div aria-label={`${labels.distribution}: ${row.score}`} className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${bandBarClass(row.band)}`} style={{ width: `${Math.max(row.score ? 2 : 0, row.score / maxScore * 100)}%` }} /></div></td>
          <td className="px-4 py-3 text-right sm:px-5"><div className="flex flex-col items-end gap-1"><strong className="text-lg tabular-nums">{row.score}</strong><Badge tone={bandTone(row.band)}>{bandLabel(row.band, labels)}</Badge></div></td>
          <td className="px-4 py-3 sm:px-5"><Link aria-label={`${labels.dossier}: ${row.employeeName}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" href={insightEmployeeDrilldownHref(row.employeeId, returnTo, 'absence')}>{labels.dossier}<ArrowRight aria-hidden="true" size={15} /></Link></td>
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
