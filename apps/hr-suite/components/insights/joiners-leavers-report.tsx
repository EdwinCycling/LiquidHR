'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, type ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select'
import { Pagination } from '@/components/ui/pagination'
import { InsightsActiveFilters, InsightsExportAction, InsightsFilterBar } from '@/components/insights/shared-controls'
import { buildInsightApplyHref, canonicalInsightHref, insightEmployeeDrilldownHref } from '@/lib/insights/query-seam'
import { defaultJoinersLeaversQuery, isJoinersLeaversPeriodValid, joinersLeaversExportParams, joinersLeaversQueryParams, latestCompletedJoinersLeaversMonth, paginateJoinersLeaversRows, type JoinersLeaversEventType, type JoinersLeaversQuery } from '@/lib/insights/joiners-leavers-query'
import type { JoinersLeaversMonthlyMetrics } from '@/lib/insights/joiners-leavers-calculation'
import type { JoinersLeaversReport } from '@/lib/insights/joiners-leavers-service'

export interface JoinersLeaversLabels {
  title: string
  description: string
  eyebrow: string
  backToInsights: string
  filters: string
  from: string
  to: string
  rangeInvalid: string
  administration: string
  allAdministrations: string
  allDepartments: string
  allTeams: string
  allEventTypes: string
  employmentStart: string
  employmentEnd: string
  termination: string
  reconciliation: string
  applyFilters: string
  resetFilters: string
  clearFilters: string
  removeFilter: string
  activeFilters: string
  selected: string
  loading: string
  noOptions: string
  searchOptions: string
  exportCsv: string
  exportPreparing: string
  exportSuccess: string
  exportFailed: string
  period: string
  employee: string
  employeeNumber: string
  employment: string
  department: string
  team: string
  summary: string
  employeesWithStart: string
  employeesEnteringScope: string
  employmentStarts: string
  employeesWithEnd: string
  employeesLeavingScope: string
  employmentEnds: string
  dataPolicyTitle: string
  dataPolicyDescription: string
  managerScopeNote: string
  reconciliationTitle: string
  reconciliationDescription: string
  softDeletedTerminations: string
  unavailableTerminations: string
  trend: string
  monthlyEmploymentStarts: string
  monthlyEmployeesEntering: string
  monthlyEmploymentEnds: string
  monthlyEmployeesLeaving: string
  monthlyTerminationEvents: string
  monthlyReconciliation: string
  details: string
  eventDate: string
  eventType: string
  flow: string
  enteredScope: string
  leftScope: string
  employmentChange: string
  notApplicable: string
  placement: string
  assigned: string
  unassigned: string
  ambiguous: string
  unavailable: string
  terminationStatus: string
  terminationConfirmed: string
  terminationPayrollReady: string
  terminationReported: string
  terminationDateMatch: string
  dateMatches: string
  dateMismatch: string
  softDeletedEmployment: string
  unavailableEmployment: string
  sortBy: string
  sortDate: string
  sortEmployee: string
  sortEvent: string
  sortAdministration: string
  noResults: string
  pagination: string
  previous: string
  next: string
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
    <span>{label}</span>
    <select className="min-h-10 min-w-0 rounded-[var(--radius-control)] border border-subtle bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-focus" onChange={(event) => onChange(event.target.value)} value={value}>{children}</select>
  </label>
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="min-w-0 rounded-[var(--radius-surface)] border border-subtle bg-surface p-4">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="mt-2 break-words text-2xl font-semibold tabular-nums">{value}</p>
    <p className="mt-1 text-xs text-muted-foreground">{note}</p>
  </div>
}

function formatMonth(month: string, locale: string): string {
  const date = new Date(`${month}-01T00:00:00Z`)
  return new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date)
}

function eventTypeLabel(eventType: JoinersLeaversEventType, labels: JoinersLeaversLabels): string {
  if (eventType === 'employment-start') return labels.employmentStart
  if (eventType === 'employment-end') return labels.employmentEnd
  if (eventType === 'termination') return labels.termination
  return labels.reconciliation
}

function flowLabel(value: JoinersLeaversReport['rows'][number]['employeeFlow'], labels: JoinersLeaversLabels): string {
  if (value === 'ENTERED_SCOPE') return labels.enteredScope
  if (value === 'LEFT_SCOPE') return labels.leftScope
  if (value === 'EMPLOYMENT_CHANGE') return labels.employmentChange
  return labels.notApplicable
}

function placementLabel(value: JoinersLeaversReport['rows'][number]['placementStatus'], labels: JoinersLeaversLabels): string {
  if (value === 'ASSIGNED') return labels.assigned
  if (value === 'AMBIGUOUS') return labels.ambiguous
  return labels.unassigned
}

function terminationStatusLabel(value: string | null, labels: JoinersLeaversLabels): string {
  if (!value) return ''
  return value.split(', ').map((status) => status === 'CONFIRMED'
    ? labels.terminationConfirmed
    : status === 'PAYROLL_READY'
      ? labels.terminationPayrollReady
      : status === 'REPORTED' ? labels.terminationReported : status).join(', ')
}

function MetricTrendChart({ data, labels, locale }: { data: readonly JoinersLeaversMonthlyMetrics[]; labels: JoinersLeaversLabels; locale: string }) {
  const series: Array<{ key: keyof JoinersLeaversMonthlyMetrics; label: string; color: string }> = [
    { key: 'employmentStarts', label: labels.monthlyEmploymentStarts, color: 'var(--chart-2)' },
    { key: 'employeesEnteringScope', label: labels.monthlyEmployeesEntering, color: 'var(--chart-1)' },
    { key: 'employmentEnds', label: labels.monthlyEmploymentEnds, color: 'var(--chart-4)' },
    { key: 'employeesLeavingScope', label: labels.monthlyEmployeesLeaving, color: 'var(--chart-3)' },
    { key: 'terminationWorkflowEvents', label: labels.monthlyTerminationEvents, color: 'var(--chart-5)' },
    { key: 'softDeletedReconciliations', label: labels.monthlyReconciliation, color: 'var(--warning-foreground)' },
  ]
  return <div className="min-w-0 rounded-[var(--radius-surface)] border border-subtle bg-surface p-4">
    <h2 className="font-semibold">{labels.trend}</h2>
    <div className="mt-3 h-72 min-w-0">
      <ResponsiveContainer height="100%" minWidth={0} width="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: -16 }}>
          <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
          <XAxis dataKey="month" interval={Math.max(0, Math.ceil(data.length / 10) - 1)} tick={{ fontSize: 11 }} tickFormatter={(value: string) => formatMonth(value, locale)} tickMargin={8} />
          <YAxis allowDecimals={false} width={42} />
          <Tooltip labelFormatter={(value) => formatMonth(String(value), locale)} />
          {series.map((item) => <Line connectNulls={false} dataKey={item.key} dot={false} key={item.key} name={item.label} stroke={item.color} strokeWidth={2.25} type="monotone" />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {series.map((item) => <li className="flex items-center gap-1.5" key={item.key}><span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</li>)}
    </ul>
  </div>
}

export function JoinersLeaversReportView({ query, report, labels, locale, returnTo }: {
  query: JoinersLeaversQuery
  report: JoinersLeaversReport
  labels: JoinersLeaversLabels
  locale: string
  returnTo: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [draft, setDraft] = useState<JoinersLeaversQuery>(query)
  const numberLocale = locale === 'nl-NL' ? 'nl-NL' : 'en-US'
  const currentHref = canonicalInsightHref(new URLSearchParams(searchParams.toString()))
  const periodValid = isJoinersLeaversPeriodValid(draft.fromMonth, draft.toMonth)
  const administrationOptions: MultiSelectOption[] = useMemo(() => report.administrationOptions.map((option) => ({ value: option.id, label: option.label })), [report.administrationOptions])
  const departmentOptions: MultiSelectOption[] = useMemo(() => report.departmentOptions.map((option) => ({ value: option.id, label: option.label })), [report.departmentOptions])
  const teamOptions: MultiSelectOption[] = useMemo(() => report.teamOptions.map((option) => ({ value: option.id, label: option.label })), [report.teamOptions])
  const eventTypeOptions: MultiSelectOption[] = useMemo(() => [
    { value: 'employment-start', label: labels.employmentStart },
    { value: 'employment-end', label: labels.employmentEnd },
    { value: 'termination', label: labels.termination },
    { value: 'reconciliation', label: labels.reconciliation },
  ], [labels.employmentStart, labels.employmentEnd, labels.termination, labels.reconciliation])

  function apply(next = draft): void {
    if (!isJoinersLeaversPeriodValid(next.fromMonth, next.toMonth)) return
    const applied = { ...next, page: 1 }
    setDraft(applied)
    router.push(buildInsightApplyHref(new URLSearchParams(searchParams.toString()), joinersLeaversQueryParams(applied)))
  }

  function update(next: Partial<JoinersLeaversQuery>): void {
    setDraft({ ...draft, ...next })
  }

  function sortBy(sortBy: JoinersLeaversQuery['sortBy']): void {
    const next = { ...query, sortBy, sortDirection: query.sortBy === sortBy && query.sortDirection === 'asc' ? 'desc' as const : 'asc' as const }
    setDraft(next)
    apply(next)
  }

  const activeFilters = [
    ...(query.fromMonth !== defaultJoinersLeaversQuery().fromMonth || query.toMonth !== defaultJoinersLeaversQuery().toMonth ? [{ key: 'period', label: labels.period, value: `${query.fromMonth} – ${query.toMonth}`, onRemove: reset }] : []),
    ...query.administrationIds.map((id) => ({ key: `admin-${id}`, label: labels.administration, value: report.administrationOptions.find((option) => option.id === id)?.label ?? id, onRemove: () => removeFilter(`admin-${id}`) })),
    ...query.departmentIds.map((id) => ({ key: `department-${id}`, label: labels.department, value: report.departmentOptions.find((option) => option.id === id)?.label ?? id, onRemove: () => removeFilter(`department-${id}`) })),
    ...query.teamIds.map((id) => ({ key: `team-${id}`, label: labels.team, value: report.teamOptions.find((option) => option.id === id)?.label ?? id, onRemove: () => removeFilter(`team-${id}`) })),
    ...query.eventTypes.map((eventType) => ({ key: `event-${eventType}`, label: labels.eventType, value: eventTypeLabel(eventType, labels), onRemove: () => removeFilter(`event-${eventType}`) })),
  ]
  const exportParams = joinersLeaversExportParams(query)
  exportParams.set('locale', numberLocale === 'nl-NL' ? 'nl' : 'en')
  const exportUrl = `/api/insights/joiners-leavers?${exportParams.toString()}`
  const page = paginateJoinersLeaversRows(report.rows, query.page)
  const number = (value: number) => new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 }).format(value)

  function pageHref(nextPage: number): string {
    return canonicalInsightHref(joinersLeaversQueryParams({ ...query, page: nextPage }))
  }

  function reset(): void {
    const next = defaultJoinersLeaversQuery()
    setDraft(next)
    apply(next)
  }

  function removeFilter(key: string): void {
    if (key === 'period') return reset()
    if (key.startsWith('admin-')) return apply({ ...query, administrationIds: query.administrationIds.filter((id) => `admin-${id}` !== key) })
    if (key.startsWith('department-')) return apply({ ...query, departmentIds: query.departmentIds.filter((id) => `department-${id}` !== key) })
    if (key.startsWith('team-')) return apply({ ...query, teamIds: query.teamIds.filter((id) => `team-${id}` !== key) })
    if (key.startsWith('event-')) return apply({ ...query, eventTypes: query.eventTypes.filter((value) => `event-${value}` !== key) })
  }

  return <main className="w-full min-w-0 px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto w-full max-w-screen-2xl min-w-0 space-y-6">
      <header className="flex min-w-0 flex-col gap-4 border-b border-subtle pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link className="text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-focus" href={returnTo}>{labels.backToInsights}</Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.eyebrow}</p>
          <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{labels.title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{labels.description}</p>
        </div>
        <InsightsExportAction fileName={`joiners-leavers-${query.toMonth}.csv`} href={exportUrl} label={labels.exportCsv} labels={{ loading: labels.exportPreparing, success: labels.exportSuccess, error: labels.exportFailed }} />
      </header>

      <InsightsFilterBar aria-label={labels.filters} className="rounded-[var(--radius-surface)]">
        <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium"><span>{labels.from}</span><input className="min-h-10 min-w-0 rounded-[var(--radius-control)] border border-subtle bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-focus" max={latestCompletedJoinersLeaversMonth()} min="2021-01" onChange={(event) => update({ fromMonth: event.target.value })} type="month" value={draft.fromMonth} /></label>
        <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium"><span>{labels.to}</span><input className="min-h-10 min-w-0 rounded-[var(--radius-control)] border border-subtle bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-focus" max={latestCompletedJoinersLeaversMonth()} min="2021-01" onChange={(event) => update({ toMonth: event.target.value })} type="month" value={draft.toMonth} /></label>
        <MultiSelect aria-label={labels.administration} emptySelectionLabel={labels.allAdministrations} listLabel={labels.administration} loadingLabel={labels.loading} noOptionsLabel={labels.noOptions} onChange={(administrationIds) => update({ administrationIds })} options={administrationOptions} searchPlaceholder={labels.searchOptions} selectedCountLabel={labels.selected} value={draft.administrationIds} />
        <MultiSelect aria-label={labels.department} emptySelectionLabel={labels.allDepartments} listLabel={labels.department} loadingLabel={labels.loading} noOptionsLabel={labels.noOptions} onChange={(departmentIds) => update({ departmentIds })} options={departmentOptions} searchPlaceholder={labels.searchOptions} selectedCountLabel={labels.selected} value={draft.departmentIds} />
        <MultiSelect aria-label={labels.team} emptySelectionLabel={labels.allTeams} listLabel={labels.team} loadingLabel={labels.loading} noOptionsLabel={labels.noOptions} onChange={(teamIds) => update({ teamIds })} options={teamOptions} searchPlaceholder={labels.searchOptions} selectedCountLabel={labels.selected} value={draft.teamIds} />
        <MultiSelect aria-label={labels.eventType} emptySelectionLabel={labels.allEventTypes} listLabel={labels.eventType} loadingLabel={labels.loading} noOptionsLabel={labels.noOptions} onChange={(values) => update({ eventTypes: values as JoinersLeaversEventType[] })} options={eventTypeOptions} searchPlaceholder={labels.searchOptions} selectedCountLabel={labels.selected} value={draft.eventTypes} />
        <Button disabled={!periodValid} onClick={() => apply()} size="md" type="button">{labels.applyFilters}</Button>
        <Button onClick={reset} size="md" type="button" variant="secondary">{labels.resetFilters}</Button>
      </InsightsFilterBar>
      {!periodValid ? <p className="text-sm text-destructive" role="alert">{labels.rangeInvalid}</p> : null}
      <InsightsActiveFilters clearLabel={labels.clearFilters} filters={activeFilters} label={labels.activeFilters} onClear={reset} removeLabel={labels.removeFilter} />

      <section aria-label={labels.summary} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={labels.employeesWithStart} value={number(report.summary.employeesWithStart)} note={`${number(report.summary.employmentStarts)} ${labels.employmentStarts}`} />
        <Metric label={labels.employeesEnteringScope} value={number(report.summary.employeesEnteringScope)} note={labels.employeesEnteringScope} />
        <Metric label={labels.employeesWithEnd} value={number(report.summary.employeesWithEnd)} note={`${number(report.summary.employmentEnds)} ${labels.employmentEnds}`} />
        <Metric label={labels.employeesLeavingScope} value={number(report.summary.employeesLeavingScope)} note={labels.employeesLeavingScope} />
      </section>

      <aside className="rounded-[var(--radius-surface)] border border-subtle bg-surface-subtle p-4 text-sm" role="note">
        <p className="font-semibold">{labels.dataPolicyTitle}</p>
        <p className="mt-1">{labels.dataPolicyDescription}</p>
        {report.audience === 'DIRECT_MANAGER' ? <p className="mt-1">{labels.managerScopeNote}</p> : null}
      </aside>

      <aside className="rounded-[var(--radius-surface)] border border-warning-border bg-warning-surface p-4 text-sm text-warning-foreground" role="status">
        <p className="font-semibold">{labels.reconciliationTitle}</p>
        <p className="mt-1">{labels.reconciliationDescription.replace('{month}', report.period.allHistoryThroughMonth)}</p>
        <p className="mt-2">{labels.softDeletedTerminations}: <strong className="tabular-nums">{number(report.reconciliation.softDeletedEmploymentTerminations)}</strong></p>
        {report.reconciliation.unavailableEmploymentTerminations ? <p className="mt-1">{labels.unavailableTerminations}: <strong className="tabular-nums">{number(report.reconciliation.unavailableEmploymentTerminations)}</strong></p> : null}
      </aside>

      <MetricTrendChart data={report.trend} labels={labels} locale={numberLocale} />

      <section className="min-w-0 space-y-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{labels.details} <span className="font-normal text-muted-foreground">({query.fromMonth} – {query.toMonth})</span></h2>
          <SelectField label={labels.sortBy} onChange={(value) => sortBy(value as JoinersLeaversQuery['sortBy'])} value={query.sortBy}>
            <option value="eventDate">{labels.sortDate}</option><option value="employeeName">{labels.sortEmployee}</option><option value="eventType">{labels.sortEvent}</option><option value="administration">{labels.sortAdministration}</option>
          </SelectField>
        </div>
        <div className="space-y-3 lg:hidden">
          {page.rows.map((row) => <article className="min-w-0 rounded-[var(--radius-surface)] border border-subtle bg-surface p-4" key={row.id}>
            <div className="flex flex-wrap items-start justify-between gap-2"><strong>{row.eventDate}</strong><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{eventTypeLabel(row.eventType, labels)}</span></div>
            <Link className="mt-2 inline-block break-words font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href={insightEmployeeDrilldownHref(row.employeeId, currentHref)}>{row.employeeName || row.employeeNumber}</Link>
            <dl className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.employment}</dt><dd className="break-words">{row.employmentNumber || '—'}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.administration}</dt><dd className="break-words">{row.administrationName || '—'}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.department}</dt><dd className="break-words">{row.departmentName || (row.placementStatus === 'ASSIGNED' ? labels.unavailable : labels.unassigned)}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.team}</dt><dd className="break-words">{row.teamName || (row.placementStatus === 'ASSIGNED' ? labels.unavailable : labels.unassigned)}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.flow}</dt><dd className="break-words">{flowLabel(row.employeeFlow, labels)}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.placement}</dt><dd className="break-words">{placementLabel(row.placementStatus, labels)}</dd></div>
              {row.terminationWorkflowStatus ? <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.terminationStatus}</dt><dd className="break-words">{terminationStatusLabel(row.terminationWorkflowStatus, labels)}</dd></div> : null}
              {row.reconciliationReason ? <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.reconciliation}</dt><dd className="break-words">{row.reconciliationReason === 'SOFT_DELETED_EMPLOYMENT' ? labels.softDeletedEmployment : labels.unavailableEmployment}</dd></div> : null}
              {row.terminationDateMatchesEmploymentEnd !== null ? <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.terminationDateMatch}</dt><dd>{row.terminationDateMatchesEmploymentEnd ? labels.dateMatches : labels.dateMismatch}</dd></div> : null}
            </dl>
          </article>)}
          {!report.rows.length ? <p className="rounded-[var(--radius-surface)] border border-dashed p-8 text-center text-sm text-muted-foreground">{labels.noResults}</p> : null}
        </div>
        <div className="hidden min-w-0 overflow-x-auto rounded-[var(--radius-surface)] border border-subtle lg:block">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-surface-subtle"><tr>
              <th className="p-3"><button className="font-semibold hover:text-primary focus-visible:outline-2 focus-visible:outline-focus" onClick={() => sortBy('eventDate')} type="button">{labels.eventDate}</button></th>
              <th className="p-3"><button className="font-semibold hover:text-primary focus-visible:outline-2 focus-visible:outline-focus" onClick={() => sortBy('eventType')} type="button">{labels.eventType}</button></th>
              <th className="p-3"><button className="font-semibold hover:text-primary focus-visible:outline-2 focus-visible:outline-focus" onClick={() => sortBy('employeeName')} type="button">{labels.employee}</button></th>
              <th className="p-3">{labels.employment}</th><th className="p-3"><button className="font-semibold hover:text-primary focus-visible:outline-2 focus-visible:outline-focus" onClick={() => sortBy('administration')} type="button">{labels.administration}</button></th>
              <th className="p-3">{labels.department}</th><th className="p-3">{labels.team}</th><th className="p-3">{labels.flow}</th><th className="p-3">{labels.placement}</th><th className="p-3">{labels.terminationStatus}</th><th className="p-3">{labels.terminationDateMatch}</th>
            </tr></thead>
            <tbody className="divide-y divide-subtle bg-surface">
              {page.rows.map((row) => <tr key={row.id}>
                <td className="whitespace-nowrap p-3">{row.eventDate}</td><td className="p-3">{eventTypeLabel(row.eventType, labels)}</td>
                <td className="p-3"><Link className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href={insightEmployeeDrilldownHref(row.employeeId, currentHref)}>{row.employeeName || row.employeeNumber}</Link><span className="mt-0.5 block text-xs text-muted-foreground">{row.employeeNumber}</span></td>
                <td className="p-3">{row.employmentNumber || '—'}</td><td className="p-3">{row.administrationName || '—'}</td><td className="p-3">{row.departmentName || (row.placementStatus === 'ASSIGNED' ? labels.unavailable : labels.unassigned)}</td><td className="p-3">{row.teamName || (row.placementStatus === 'ASSIGNED' ? labels.unavailable : labels.unassigned)}</td>
                <td className="p-3">{flowLabel(row.employeeFlow, labels)}</td><td className="p-3">{placementLabel(row.placementStatus, labels)}</td><td className="p-3">{terminationStatusLabel(row.terminationWorkflowStatus, labels) || (row.reconciliationReason === 'SOFT_DELETED_EMPLOYMENT' ? labels.softDeletedEmployment : row.reconciliationReason === 'EMPLOYMENT_NOT_AVAILABLE' ? labels.unavailableEmployment : '—')}</td>
                <td className="p-3">{row.terminationDateMatchesEmploymentEnd === null ? labels.notApplicable : row.terminationDateMatchesEmploymentEnd ? labels.dateMatches : labels.dateMismatch}</td>
              </tr>)}
            </tbody>
          </table>
          {!report.rows.length ? <p className="p-8 text-center text-sm text-muted-foreground">{labels.noResults}</p> : null}
        </div>
        {page.totalPages > 1 ? <div className="flex justify-center"><Pagination ariaLabel={labels.pagination} currentPage={page.page} nextLabel={labels.next} onPageChange={(nextPage) => router.push(pageHref(nextPage))} previousLabel={labels.previous} totalPages={page.totalPages} /></div> : null}
      </section>
    </div>
  </main>
}
