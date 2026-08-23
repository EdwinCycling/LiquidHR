'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import type { TalentReportWorkspace } from '@/lib/talent/report-service'
import type { TalentReportMode, TalentReportQuery } from '@/lib/talent/report-schemas'

type ReportType = NonNullable<TalentReportQuery['reportType']>
type ReportTimeframe = NonNullable<TalentReportQuery['timeframe']>

export type TalentReportLabels = {
  title: string
  subtitle: string
  export: string
  exportFailed: string
  exporting: string
  filterFailed: string
  periodInvalid: string
  goals: string
  capabilities: string
  empty: string
  noResults: string
  employee: string
  goalOrCapability: string
  status: string
  progress: string
  period: string
  validity: string
  type: string
  source: string
  evidence: string
  level: string
  all: string
  loading: string
  current: string
  history: string
  filterMode: string
  modeAll: string
  modeGoals: string
  modeCapabilities: string
  timeframe: string
  timeframeAll: string
  activeFilters: string
  resetFilters: string
  scopeTenant: string
  scopeManager: string
  scopeSelf: string
  employees: string
  rows: string
  notAvailable: string
  statusDraft: string
  statusActive: string
  statusCompleted: string
  statusCancelled: string
  statusArchived: string
  recordDraft: string
  recordReleased: string
  recordExpired: string
  recordArchived: string
  sourceSelf: string
  sourceHr: string
  sourceManager: string
  sourceImported: string
  periodFrom: string
  periodTo: string
  applyFilters: string
  population: string
}

type ReportFilters = {
  reportType: ReportType
  timeframe: ReportTimeframe
  goalStatus: string
  recordStatus: string
  periodFrom: string
  periodTo: string
}

type ReportMessage = { kind: 'error'; text: string } | null

function queryString(mode: TalentReportMode, filters: ReportFilters): string {
  const params = new URLSearchParams({ mode })
  if (filters.reportType !== 'all') params.set('reportType', filters.reportType)
  if (filters.timeframe !== 'all') params.set('timeframe', filters.timeframe)
  if (filters.goalStatus) params.set('goalStatus', filters.goalStatus)
  if (filters.recordStatus) params.set('recordStatus', filters.recordStatus)
  if (filters.periodFrom) params.set('periodFrom', filters.periodFrom)
  if (filters.periodTo) params.set('periodTo', filters.periodTo)
  return params.toString()
}

function initialFilters(initial: TalentReportWorkspace): ReportFilters {
  return {
    reportType: initial.query.reportType ?? 'all',
    timeframe: initial.query.timeframe ?? 'all',
    goalStatus: initial.query.goalStatus ?? '',
    recordStatus: initial.query.recordStatus ?? '',
    periodFrom: initial.query.periodFrom ?? '',
    periodTo: initial.query.periodTo ?? '',
  }
}

function statusTone(status: string): BadgeTone {
  if (status === 'ACTIVE' || status === 'RELEASED') return 'success'
  if (status === 'DRAFT') return 'info'
  if (status === 'EXPIRED' || status === 'CANCELLED') return 'warning'
  return 'neutral'
}

function goalStatusLabel(status: string, labels: TalentReportLabels): string {
  const statusLabels: Record<string, string> = {
    DRAFT: labels.statusDraft,
    ACTIVE: labels.statusActive,
    COMPLETED: labels.statusCompleted,
    CANCELLED: labels.statusCancelled,
    ARCHIVED: labels.statusArchived,
  }
  return statusLabels[status] ?? status
}

function recordStatusLabel(status: string, labels: TalentReportLabels): string {
  const statusLabels: Record<string, string> = {
    DRAFT: labels.recordDraft,
    RELEASED: labels.recordReleased,
    EXPIRED: labels.recordExpired,
    ARCHIVED: labels.recordArchived,
  }
  return statusLabels[status] ?? status
}

function sourceLabel(source: string, labels: TalentReportLabels): string {
  const sourceLabels: Record<string, string> = {
    SELF_ENTERED: labels.sourceSelf,
    HR_ENTERED: labels.sourceHr,
    MANAGER_ENTERED: labels.sourceManager,
    IMPORTED: labels.sourceImported,
  }
  return sourceLabels[source] ?? source
}

function scopeLabel(scope: TalentReportWorkspace['population']['scope'], labels: TalentReportLabels): string {
  if (scope === 'tenant') return labels.scopeTenant
  if (scope === 'manager') return labels.scopeManager
  return labels.scopeSelf
}

function activeFilterCount(filters: ReportFilters): number {
  return [
    filters.reportType !== 'all',
    filters.timeframe !== 'all',
    Boolean(filters.goalStatus),
    Boolean(filters.recordStatus),
    Boolean(filters.periodFrom),
    Boolean(filters.periodTo),
  ].filter(Boolean).length
}

function updateUrl(mode: TalentReportMode, filters: ReportFilters): void {
  const url = new URL(window.location.href)
  url.search = queryString(mode, filters)
  window.history.replaceState(null, '', `${url.pathname}${url.search}`)
}

export function TalentReportWorkspace({ mode, initial, labels }: { mode: TalentReportMode; initial: TalentReportWorkspace; labels: TalentReportLabels }) {
  const [workspace, setWorkspace] = useState(initial)
  const [filters, setFilters] = useState<ReportFilters>(() => initialFilters(initial))
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState<ReportMessage>(null)
  const appliedFilters = initialFilters(workspace)
  const filterCount = activeFilterCount(appliedFilters)

  async function loadReport(nextFilters: ReportFilters): Promise<void> {
    if (nextFilters.periodFrom && nextFilters.periodTo && nextFilters.periodTo < nextFilters.periodFrom) {
      setMessage({ kind: 'error', text: labels.periodInvalid })
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/talent/reports?${queryString(mode, nextFilters)}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('REPORT_READ_FAILED')
      const payload = await response.json() as { data: TalentReportWorkspace }
      setWorkspace(payload.data)
      setFilters(nextFilters)
      updateUrl(mode, nextFilters)
    } catch {
      setMessage({ kind: 'error', text: labels.filterFailed })
    } finally {
      setLoading(false)
    }
  }

  async function exportReport(): Promise<void> {
    setExporting(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/talent/reports/export?${queryString(mode, appliedFilters)}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('EXPORT_FAILED')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'talent-report.csv'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      updateUrl(mode, appliedFilters)
    } catch {
      setMessage({ kind: 'error', text: labels.exportFailed })
    } finally {
      setExporting(false)
    }
  }

  function resetFilters(): void {
    void loadReport({ reportType: 'all', timeframe: 'all', goalStatus: '', recordStatus: '', periodFrom: '', periodTo: '' })
  }

  const scope = scopeLabel(workspace.population.scope, labels)
  const goalsVisible = appliedFilters.reportType !== 'capabilities'
  const capabilitiesVisible = appliedFilters.reportType !== 'goals'
  const hasResults = workspace.goals.length > 0 || workspace.capabilities.length > 0

  return (
    <section className="mt-6 space-y-5" aria-busy={loading || exporting}>
      <Surface className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{labels.title}</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{labels.subtitle}</p>
          </div>
          <Button className="shrink-0" loading={exporting} onClick={() => void exportReport()} type="button">{labels.export}</Button>
        </div>
        {message ? <p className="mt-3 text-sm text-destructive" role="alert">{message.text}</p> : null}
        {exporting ? <p className="mt-2 text-sm text-muted-foreground" role="status">{labels.exporting}</p> : null}
      </Surface>

      <Surface className="p-5">
        <form onSubmit={(event) => { event.preventDefault(); void loadReport(filters) }}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <fieldset className="sm:col-span-2 xl:col-span-2">
              <legend className="mb-2 text-sm font-semibold">{labels.filterMode}</legend>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label={labels.filterMode}>
                {([
                  ['all', labels.modeAll],
                  ['goals', labels.modeGoals],
                  ['capabilities', labels.modeCapabilities],
                ] as const).map(([value, label]) => <button aria-selected={filters.reportType === value} className={`min-h-10 rounded-[var(--radius-control)] border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${filters.reportType === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-foreground hover:bg-surface-raised'}`} key={value} onClick={() => setFilters((current) => ({ ...current, reportType: value }))} role="tab" type="button">{label}</button>)}
              </div>
            </fieldset>
            <label className="grid gap-1.5 text-sm font-medium"><span>{labels.timeframe}</span><select aria-label={labels.timeframe} className="form-field" onChange={(event) => setFilters((current) => ({ ...current, timeframe: event.target.value as ReportTimeframe }))} value={filters.timeframe}><option value="all">{labels.timeframeAll}</option><option value="current">{labels.current}</option><option value="history">{labels.history}</option></select></label>
            <label className="grid gap-1.5 text-sm font-medium"><span>{labels.goals} · {labels.status}</span><select aria-label={`${labels.goals} ${labels.status}`} className="form-field" onChange={(event) => setFilters((current) => ({ ...current, goalStatus: event.target.value }))} value={filters.goalStatus}><option value="">{labels.all}</option><option value="DRAFT">{labels.statusDraft}</option><option value="ACTIVE">{labels.statusActive}</option><option value="COMPLETED">{labels.statusCompleted}</option><option value="CANCELLED">{labels.statusCancelled}</option><option value="ARCHIVED">{labels.statusArchived}</option></select></label>
            <label className="grid gap-1.5 text-sm font-medium"><span>{labels.capabilities} · {labels.status}</span><select aria-label={`${labels.capabilities} ${labels.status}`} className="form-field" onChange={(event) => setFilters((current) => ({ ...current, recordStatus: event.target.value }))} value={filters.recordStatus}><option value="">{labels.all}</option><option value="DRAFT">{labels.recordDraft}</option><option value="RELEASED">{labels.recordReleased}</option><option value="EXPIRED">{labels.recordExpired}</option><option value="ARCHIVED">{labels.recordArchived}</option></select></label>
            <label className="grid gap-1.5 text-sm font-medium"><span>{labels.periodFrom}</span><input aria-label={labels.periodFrom} className="form-field" onChange={(event) => setFilters((current) => ({ ...current, periodFrom: event.target.value }))} type="date" value={filters.periodFrom} /></label>
            <label className="grid gap-1.5 text-sm font-medium"><span>{labels.periodTo}</span><input aria-label={labels.periodTo} className="form-field" onChange={(event) => setFilters((current) => ({ ...current, periodTo: event.target.value }))} type="date" value={filters.periodTo} /></label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border-subtle pt-4">
            <Button loading={loading} type="submit" variant="secondary">{labels.applyFilters}</Button>
            <Button disabled={loading || exporting || filterCount === 0} onClick={resetFilters} type="button" variant="ghost">{labels.resetFilters}</Button>
            {loading ? <span className="text-sm text-muted-foreground" role="status">{labels.loading}</span> : null}
          </div>
        </form>
        <div className="mt-4 flex flex-col gap-3 border-t border-border-subtle pt-4 text-sm md:flex-row md:items-start md:justify-between">
          <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            <span className="font-semibold">{labels.activeFilters}:</span>
            <Badge tone={filterCount > 0 ? 'info' : 'neutral'}>{filterCount}</Badge>
            {filterCount > 0 ? <span className="text-muted-foreground">{appliedFilters.reportType !== 'all' ? (appliedFilters.reportType === 'goals' ? labels.modeGoals : labels.modeCapabilities) : null}{appliedFilters.timeframe !== 'all' ? ` · ${appliedFilters.timeframe === 'current' ? labels.current : labels.history}` : null}{appliedFilters.goalStatus ? ` · ${goalStatusLabel(appliedFilters.goalStatus, labels)}` : null}{appliedFilters.recordStatus ? ` · ${recordStatusLabel(appliedFilters.recordStatus, labels)}` : null}{appliedFilters.periodFrom ? ` · ${appliedFilters.periodFrom}` : null}{appliedFilters.periodTo ? ` – ${appliedFilters.periodTo}` : null}</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end"><Badge tone="neutral">{scope}</Badge><span className="text-muted-foreground">{workspace.population.employeeCount} {labels.employees} · {workspace.population.rowCount} {labels.rows}</span></div>
        </div>
      </Surface>

      {!hasResults ? <EmptyState title={filterCount > 0 ? labels.noResults : labels.empty} description={`${scope} · ${workspace.population.employeeCount} ${labels.employees}`} actions={filterCount > 0 ? <Button onClick={resetFilters} type="button" variant="secondary">{labels.resetFilters}</Button> : undefined} /> : null}

      {goalsVisible ? <Surface className="p-5">
        <h3 className="text-base font-semibold">{labels.goals}</h3>
        {workspace.goals.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{filterCount > 0 ? labels.noResults : labels.empty}</p> : <div className="mt-4 overflow-x-auto rounded-[var(--radius-control)] border border-border-subtle"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-surface-subtle"><tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-muted-foreground"><th className="px-3 py-3">{labels.employee}</th><th className="px-3 py-3">{labels.goalOrCapability}</th><th className="px-3 py-3">{labels.status}</th><th className="px-3 py-3">{labels.progress}</th><th className="px-3 py-3">{labels.period}</th></tr></thead><tbody>{workspace.goals.map((goal) => <tr className="border-b border-border-subtle last:border-0" key={`${goal.employeeId}-${goal.title}-${goal.periodStart}`}><td className="px-3 py-3 align-top">{goal.employeeLabel ? <Link className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href={`/employees/${goal.employeeId}`} prefetch={false}>{goal.employeeLabel}</Link> : <Link className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href={`/employees/${goal.employeeId}`} prefetch={false}>{labels.notAvailable}</Link>}</td><td className="px-3 py-3 align-top"><span className="font-medium">{goal.title}</span><span className="block text-xs text-muted-foreground">{goal.capabilityLabel ?? labels.notAvailable}</span></td><td className="px-3 py-3 align-top"><Badge tone={statusTone(goal.status)}>{goalStatusLabel(goal.status, labels)}</Badge></td><td className="px-3 py-3 align-top"><div className="flex min-w-28 items-center gap-2"><progress aria-label={`${labels.progress}: ${goal.progressPercent}%`} className="h-2 w-20 accent-primary" max={100} value={goal.progressPercent} /><span className="font-medium tabular-nums">{goal.progressPercent}%</span></div></td><td className="px-3 py-3 align-top tabular-nums">{goal.periodStart} – {goal.periodEnd ?? labels.notAvailable}</td></tr>)}</tbody></table></div>}
      </Surface> : null}

      {capabilitiesVisible ? <Surface className="p-5">
        <h3 className="text-base font-semibold">{labels.capabilities}</h3>
        {workspace.capabilities.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{filterCount > 0 ? labels.noResults : labels.empty}</p> : <div className="mt-4 overflow-x-auto rounded-[var(--radius-control)] border border-border-subtle"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-surface-subtle"><tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-muted-foreground"><th className="px-3 py-3">{labels.employee}</th><th className="px-3 py-3">{labels.goalOrCapability}</th><th className="px-3 py-3">{labels.status}</th><th className="px-3 py-3">{labels.validity}</th><th className="px-3 py-3">{labels.type}</th><th className="px-3 py-3">{labels.source}</th><th className="px-3 py-3">{labels.evidence}</th><th className="px-3 py-3">{labels.level}</th></tr></thead><tbody>{workspace.capabilities.map((record) => <tr className="border-b border-border-subtle last:border-0" key={`${record.employeeId}-${record.capabilityCode}-${record.validFrom}`}><td className="px-3 py-3 align-top"><Link className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href={`/employees/${record.employeeId}`} prefetch={false}>{record.employeeLabel}</Link></td><td className="px-3 py-3 align-top"><span className="font-medium">{record.capabilityName}</span><span className="block text-xs text-muted-foreground">{record.capabilityCode}</span></td><td className="px-3 py-3 align-top"><Badge tone={statusTone(record.status)}>{recordStatusLabel(record.status, labels)}</Badge></td><td className="px-3 py-3 align-top tabular-nums">{record.validFrom} – {record.validUntil ?? labels.notAvailable}</td><td className="px-3 py-3 align-top">{record.capabilityType}</td><td className="px-3 py-3 align-top">{sourceLabel(record.sourceType, labels)}</td><td className="px-3 py-3 align-top">{record.evidenceStatus ?? labels.notAvailable}</td><td className="px-3 py-3 align-top">{record.talentLevelName ?? labels.notAvailable}</td></tr>)}</tbody></table></div>}
      </Surface> : null}

      <p className="text-xs text-muted-foreground">{labels.population}: {scope}; {workspace.population.employeeCount} {labels.employees}; {workspace.population.rowCount} {labels.rows}.</p>
    </section>
  )
}
