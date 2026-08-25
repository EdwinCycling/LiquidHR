'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent, type ReactElement } from 'react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import type { VacancyReport, VacancyReportQuery, VacancyReportStatusRow } from '@/lib/recruitment/vacancy-report-service'

export type VacancyReportLabels = {
  readonly title: string
  readonly description: string
  readonly back: string
  readonly filters: string
  readonly periodFrom: string
  readonly periodTo: string
  readonly status: string
  readonly allStatuses: string
  readonly activeStatus: string
  readonly rejectedStatus: string
  readonly hiredStatus: string
  readonly stage: string
  readonly allStages: string
  readonly source: string
  readonly allSources: string
  readonly manualSource: string
  readonly publicSource: string
  readonly applyFilters: string
  readonly resetFilters: string
  readonly activeFilters: string
  readonly loading: string
  readonly loadFailed: string
  readonly totalApplications: string
  readonly activeApplications: string
  readonly hiredApplications: string
  readonly rejectedApplications: string
  readonly conversionRate: string
  readonly statuses: string
  readonly sources: string
  readonly applications: string
  readonly noApplications: string
  readonly noResults: string
  readonly unassigned: string
  readonly outcomeRejected: string
  readonly outcomeHired: string
  readonly vacancyDraft: string
  readonly vacancyActive: string
  readonly vacancyClosed: string
  readonly vacancyArchived: string
  readonly notAvailable: string
}

type VacancyReportFilters = {
  readonly periodFrom: string
  readonly periodTo: string
  readonly status: VacancyReportQuery['status']
  readonly stageId: string
  readonly source: VacancyReportQuery['source']
}

function filtersFromReport(report: VacancyReport): VacancyReportFilters {
  return { periodFrom: report.query.periodFrom, periodTo: report.query.periodTo, status: report.query.status, stageId: report.query.stageId, source: report.query.source }
}

function queryString(filters: VacancyReportFilters): string {
  const params = new URLSearchParams()
  if (filters.periodFrom) params.set('periodFrom', filters.periodFrom)
  if (filters.periodTo) params.set('periodTo', filters.periodTo)
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.stageId !== 'all') params.set('stageId', filters.stageId)
  if (filters.source !== 'all') params.set('source', filters.source)
  return params.toString()
}

function filterCount(filters: VacancyReportFilters): number {
  return [filters.periodFrom, filters.periodTo, filters.status !== 'all', filters.stageId !== 'all', filters.source !== 'all'].filter(Boolean).length
}

function vacancyStatusLabel(status: VacancyReport['vacancy']['status'], labels: VacancyReportLabels): string {
  if (status === 'ACTIVE') return labels.vacancyActive
  if (status === 'CLOSED') return labels.vacancyClosed
  if (status === 'ARCHIVED') return labels.vacancyArchived
  return labels.vacancyDraft
}

function statusLabel(row: VacancyReportStatusRow, labels: VacancyReportLabels): string {
  if (row.kind === 'STAGE') return row.label ?? labels.notAvailable
  if (row.kind === 'UNASSIGNED') return labels.unassigned
  return row.key === 'AANGENOMEN' ? labels.outcomeHired : labels.outcomeRejected
}

function statusTone(row: VacancyReportStatusRow): BadgeTone {
  if (row.kind === 'OUTCOME' && row.key === 'AANGENOMEN') return 'success'
  if (row.kind === 'OUTCOME' && row.key === 'AFGEWEZEN') return 'danger'
  if (row.kind === 'UNASSIGNED') return 'warning'
  return 'info'
}

function sourceLabel(source: 'MANUAL' | 'PUBLIC', labels: VacancyReportLabels): string {
  return source === 'PUBLIC' ? labels.publicSource : labels.manualSource
}

export function RecruitmentVacancyReport({ initial, labels }: { readonly initial: VacancyReport; readonly labels: VacancyReportLabels }): ReactElement {
  const router = useRouter()
  const [report, setReport] = useState(initial)
  const [filters, setFilters] = useState<VacancyReportFilters>(() => filtersFromReport(initial))
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function load(nextFilters: VacancyReportFilters): Promise<void> {
    if (nextFilters.periodFrom && nextFilters.periodTo && nextFilters.periodTo < nextFilters.periodFrom) {
      setMessage(labels.loadFailed)
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const query = queryString(nextFilters)
      const response = await fetch(`/api/recruitment/vacancies/${initial.vacancy.id}/report${query ? `?${query}` : ''}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('RECRUITMENT_REPORT_READ_FAILED')
      const payload = await response.json() as { readonly data: VacancyReport }
      setReport(payload.data)
      setFilters(nextFilters)
      router.replace(`/recruitment/vacancies/${initial.vacancy.id}/report${query ? `?${query}` : ''}`, { scroll: false })
    } catch {
      setMessage(labels.loadFailed)
    } finally {
      setLoading(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    void load(filters)
  }

  function reset(): void {
    const nextFilters: VacancyReportFilters = { periodFrom: '', periodTo: '', status: 'all', stageId: 'all', source: 'all' }
    setFilters(nextFilters)
    void load(nextFilters)
  }

  const activeFilterCount = filterCount(filters)
  const hasResults = report.metrics.totalApplications > 0
  const metrics = [
    { key: 'totalApplications', label: labels.totalApplications, value: report.metrics.totalApplications },
    { key: 'activeApplications', label: labels.activeApplications, value: report.metrics.activeApplications },
    { key: 'hiredApplications', label: labels.hiredApplications, value: report.metrics.hiredApplications },
    { key: 'rejectedApplications', label: labels.rejectedApplications, value: report.metrics.rejectedApplications },
  ] as const

  return <section aria-busy={loading} className="mt-6 space-y-5">
    <Surface className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{labels.title}</h2><Badge tone={report.vacancy.status === 'ACTIVE' ? 'success' : 'neutral'}>{vacancyStatusLabel(report.vacancy.status, labels)}</Badge></div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{labels.description}</p>
        </div>
        <p className="shrink-0 text-sm text-muted-foreground">{activeFilterCount} {labels.activeFilters}</p>
      </div>
      {message ? <p className="mt-3 text-sm text-destructive" role="alert">{message}</p> : null}
    </Surface>

    <Surface className="p-5">
      <h3 className="text-sm font-semibold">{labels.filters}</h3>
      <form className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5" onSubmit={submit}>
        <label className="grid min-w-0 gap-1.5 text-sm font-medium"><span>{labels.periodFrom}</span><TextInput aria-label={labels.periodFrom} onChange={(event) => setFilters((current) => ({ ...current, periodFrom: event.target.value }))} type="date" value={filters.periodFrom} /></label>
        <label className="grid min-w-0 gap-1.5 text-sm font-medium"><span>{labels.periodTo}</span><TextInput aria-label={labels.periodTo} onChange={(event) => setFilters((current) => ({ ...current, periodTo: event.target.value }))} type="date" value={filters.periodTo} /></label>
        <label className="grid min-w-0 gap-1.5 text-sm font-medium"><span>{labels.status}</span><DropdownSelect aria-label={labels.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as VacancyReportQuery['status'] }))} value={filters.status}><option value="all">{labels.allStatuses}</option><option value="active">{labels.activeStatus}</option><option value="rejected">{labels.rejectedStatus}</option><option value="hired">{labels.hiredStatus}</option></DropdownSelect></label>
        <label className="grid min-w-0 gap-1.5 text-sm font-medium"><span>{labels.stage}</span><DropdownSelect aria-label={labels.stage} onChange={(event) => setFilters((current) => ({ ...current, stageId: event.target.value }))} searchable searchPlaceholder={labels.stage} value={filters.stageId}><option value="all">{labels.allStages}</option>{report.stageOptions.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</DropdownSelect></label>
        <label className="grid min-w-0 gap-1.5 text-sm font-medium"><span>{labels.source}</span><DropdownSelect aria-label={labels.source} onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value as VacancyReportQuery['source'] }))} value={filters.source}><option value="all">{labels.allSources}</option><option value="MANUAL">{labels.manualSource}</option><option value="PUBLIC">{labels.publicSource}</option></DropdownSelect></label>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-5"><Button loading={loading} type="submit">{labels.applyFilters}</Button><Button disabled={loading || activeFilterCount === 0} onClick={reset} type="button" variant="ghost">{labels.resetFilters}</Button>{loading ? <span className="text-sm text-muted-foreground" role="status">{labels.loading}</span> : null}</div>
      </form>
    </Surface>

    <Surface className="p-5">
      <div className="grid grid-cols-2 divide-x divide-y divide-border-subtle sm:grid-cols-4 sm:divide-y-0">
        {metrics.map((metric) => <div className="min-w-0 px-3 py-2 first:pl-0 sm:px-4 sm:first:pl-0" data-testid={`recruitment-report-${metric.key}`} key={metric.key}><p className="text-sm leading-5 text-muted-foreground">{metric.label}</p><p className="mt-1 break-words text-3xl font-semibold tabular-nums">{metric.value.toLocaleString()}</p></div>)}
      </div>
      <div className="mt-5 border-t border-border-subtle pt-4"><dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm"><div className="flex gap-2"><dt className="text-muted-foreground">{labels.conversionRate}</dt><dd className="font-semibold tabular-nums" data-testid="recruitment-report-conversion-rate">{report.metrics.conversionRate === null ? labels.notAvailable : `${report.metrics.conversionRate.toLocaleString()}%`}</dd></div><div className="flex gap-2"><dt className="text-muted-foreground">{labels.applications}</dt><dd className="font-semibold tabular-nums">{report.metrics.totalApplications.toLocaleString()}</dd></div></dl></div>
    </Surface>

    {!hasResults ? <EmptyState title={activeFilterCount > 0 ? labels.noResults : labels.noApplications} description={report.vacancy.title} actions={activeFilterCount > 0 ? <Button onClick={reset} type="button" variant="secondary">{labels.resetFilters}</Button> : undefined} /> : <div className="grid gap-5 lg:grid-cols-2">
      <Surface className="min-w-0 p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{labels.statuses}</h3><span className="text-sm tabular-nums text-muted-foreground">{report.metrics.totalApplications} {labels.applications}</span></div><div className="mt-4 space-y-2">{report.statusBreakdown.map((row) => <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border-subtle py-2 last:border-0" key={row.key}><span className="min-w-0 break-words text-sm">{statusLabel(row, labels)}</span><Badge className="shrink-0 tabular-nums" tone={statusTone(row)}>{row.count.toLocaleString()}</Badge></div>)}</div></Surface>
      <Surface className="min-w-0 p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{labels.sources}</h3><span className="text-sm tabular-nums text-muted-foreground">{report.metrics.totalApplications} {labels.applications}</span></div><div className="mt-4 space-y-2">{report.sourceBreakdown.map((row) => <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border-subtle py-2 last:border-0" key={row.source}><span className="min-w-0 break-words text-sm">{sourceLabel(row.source, labels)}</span><Badge className="shrink-0 tabular-nums" tone="neutral">{row.count.toLocaleString()}</Badge></div>)}</div></Surface>
    </div>}
  </section>
}
