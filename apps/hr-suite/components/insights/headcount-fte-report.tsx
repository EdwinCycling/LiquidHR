'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, type ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select'
import { Pagination } from '@/components/ui/pagination'
import { InsightsActiveFilters, InsightsExportAction, InsightsFilterBar } from '@/components/insights/shared-controls'
import { canonicalInsightHref, buildInsightApplyHref, insightEmployeeDrilldownHref } from '@/lib/insights/query-seam'
import { defaultHeadcountFteQuery, headcountFteExportParams, headcountFteQueryParams, isHeadcountFtePeriodValid, latestCompletedHeadcountMonth, paginateHeadcountFteRows, type HeadcountFteQuery } from '@/lib/insights/headcount-fte-query'
import type { HeadcountFteReport } from '@/lib/insights/headcount-fte-service'

type Labels = Record<string, string>

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
    <span>{label}</span>
    <select className="min-h-10 min-w-0 rounded-[var(--radius-control)] border border-subtle bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-focus" onChange={(event) => onChange(event.target.value)} value={value}>{children}</select>
  </label>
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="min-w-0 rounded-[var(--radius-surface)] border border-subtle bg-surface p-4">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="mt-2 break-words text-2xl font-semibold tabular-nums">{value}</p>
    {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
  </div>
}

function formatNumber(value: number | null, locale: string, maximumFractionDigits = 2): string {
  return value === null ? '—' : new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value)
}

export function HeadcountFteReportView({ query, report, labels, locale, returnTo }: {
  query: HeadcountFteQuery
  report: HeadcountFteReport
  labels: Labels
  locale: string
  returnTo: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [draft, setDraft] = useState<HeadcountFteQuery>(query)
  const currentHref = canonicalInsightHref(new URLSearchParams(searchParams.toString()))
  const exportHref = `/api/insights/headcount-fte?${headcountFteExportParams(query).toString()}`
  const numberLocale = locale === 'nl-NL' ? 'nl-NL' : 'en-US'
  const periodValid = isHeadcountFtePeriodValid(draft.fromMonth, draft.toMonth)
  const administrationOptions: MultiSelectOption[] = useMemo(() => report.administrationOptions.map((option) => ({ value: option.id, label: option.label })), [report.administrationOptions])
  const departmentOptions: MultiSelectOption[] = useMemo(() => report.departmentOptions.map((option) => ({ value: option.id, label: option.label })), [report.departmentOptions])
  const teamOptions: MultiSelectOption[] = useMemo(() => report.teamOptions.map((option) => ({ value: option.id, label: option.label })), [report.teamOptions])

  function apply(next = draft): void {
    if (!isHeadcountFtePeriodValid(next.fromMonth, next.toMonth)) return
    const applied = { ...next, page: 1 }
    setDraft(applied)
    router.push(buildInsightApplyHref(new URLSearchParams(searchParams.toString()), headcountFteQueryParams(applied)))
  }

  function sortBy(sortBy: HeadcountFteQuery['sortBy']): void {
    const next = { ...query, sortBy, sortDirection: query.sortBy === sortBy && query.sortDirection === 'asc' ? 'desc' as const : 'asc' as const }
    setDraft(next)
    apply(next)
  }

  const activeFilters = [
    ...(query.fromMonth !== defaultHeadcountFteQuery().fromMonth || query.toMonth !== defaultHeadcountFteQuery().toMonth ? [{ key: 'period', label: labels.period, value: `${query.fromMonth} – ${query.toMonth}` }] : []),
    ...query.administrationIds.map((id) => ({ key: `admin-${id}`, label: labels.headcountFteAdministration, value: report.administrationOptions.find((option) => option.id === id)?.label ?? id })),
    ...query.departmentIds.map((id) => ({ key: `department-${id}`, label: labels.department, value: report.departmentOptions.find((option) => option.id === id)?.label ?? id })),
    ...query.teamIds.map((id) => ({ key: `team-${id}`, label: labels.team, value: report.teamOptions.find((option) => option.id === id)?.label ?? id })),
  ]

  const exportQuery = new URLSearchParams(exportHref.split('?')[1] ?? '')
  exportQuery.set('locale', numberLocale === 'nl-NL' ? 'nl' : 'en')
  const exportUrl = `/api/insights/headcount-fte?${exportQuery.toString()}`
  const page = paginateHeadcountFteRows(report.rows, query.page)

  function pageHref(nextPage: number): string {
    return canonicalInsightHref(headcountFteQueryParams({ ...query, page: nextPage }))
  }

  return <main className="w-full min-w-0 px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto w-full max-w-screen-2xl min-w-0 space-y-6">
      <header className="flex min-w-0 flex-col gap-4 border-b border-subtle pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link className="text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-focus" href={returnTo}>{labels.backToInsights}</Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.headcountFteEyebrow}</p>
          <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{labels.headcountFteTitle}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{labels.headcountFteDescription}</p>
        </div>
        <InsightsExportAction fileName={`headcount-fte-${query.toMonth}.csv`} href={exportUrl} label={labels.exportCsv} labels={{ loading: labels.exportPreparing, success: labels.exportSuccess, error: labels.exportFailed }} />
      </header>

      <InsightsFilterBar aria-label={labels.headcountFteFilters} className="rounded-[var(--radius-surface)]">
        <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium"><span>{labels.headcountFteFrom}</span><input className="min-h-10 min-w-0 rounded-[var(--radius-control)] border border-subtle bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-focus" max={latestCompletedHeadcountMonth()} min="2021-01" onChange={(event) => setDraft({ ...draft, fromMonth: event.target.value })} type="month" value={draft.fromMonth} /></label>
        <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium"><span>{labels.headcountFteTo}</span><input className="min-h-10 min-w-0 rounded-[var(--radius-control)] border border-subtle bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-focus" max={latestCompletedHeadcountMonth()} min="2021-01" onChange={(event) => setDraft({ ...draft, toMonth: event.target.value })} type="month" value={draft.toMonth} /></label>
        <MultiSelect aria-label={labels.headcountFteAdministration} emptySelectionLabel={labels.headcountFteAllAdministrations} listLabel={labels.headcountFteAdministration} loadingLabel={labels.headcountFteLoading} noOptionsLabel={labels.noOptions} onChange={(administrationIds) => setDraft({ ...draft, administrationIds })} options={administrationOptions} searchPlaceholder={labels.searchOptions} selectedCountLabel={labels.selected} value={draft.administrationIds} />
        <MultiSelect aria-label={labels.department} emptySelectionLabel={labels.headcountFteAllDepartments} listLabel={labels.department} loadingLabel={labels.headcountFteLoading} noOptionsLabel={labels.noOptions} onChange={(departmentIds) => setDraft({ ...draft, departmentIds })} options={departmentOptions} searchPlaceholder={labels.searchOptions} selectedCountLabel={labels.selected} value={draft.departmentIds} />
        <MultiSelect aria-label={labels.team} emptySelectionLabel={labels.headcountFteAllTeams} listLabel={labels.team} loadingLabel={labels.headcountFteLoading} noOptionsLabel={labels.noOptions} onChange={(teamIds) => setDraft({ ...draft, teamIds })} options={teamOptions} searchPlaceholder={labels.searchOptions} selectedCountLabel={labels.selected} value={draft.teamIds} />
        <Button disabled={!periodValid} onClick={() => apply()} size="md" type="button">{labels.applyFilters}</Button>
        <Button onClick={() => { const next = defaultHeadcountFteQuery(); setDraft(next); apply(next) }} size="md" type="button" variant="secondary">{labels.resetFilters}</Button>
      </InsightsFilterBar>
      {!periodValid ? <p className="text-sm text-destructive" role="alert">{labels.headcountFteRangeInvalid}</p> : null}

      <InsightsActiveFilters clearLabel={labels.clearFilters} filters={activeFilters} label={labels.activeFilters} onClear={() => { const next = defaultHeadcountFteQuery(); setDraft(next); apply(next) }} removeLabel={labels.removeFilter} />

      <section aria-label={labels.headcountFteSummary} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={labels.headcountFteHeadcount} value={formatNumber(report.headcount, numberLocale, 0)} note={`${labels.headcountFteAsOf} ${report.period.asOf}`} />
        <Metric label={labels.headcountFteFte} value={formatNumber(report.fte, numberLocale, 4)} note={report.fte === null ? labels.headcountFteFteIncomplete : labels.headcountFteComplete} />
        <Metric label={labels.headcountFteKnownFte} value={formatNumber(report.knownFte, numberLocale, 4)} note={labels.headcountFteKnownSubtotal} />
        <Metric label={labels.headcountFteEmployments} value={formatNumber(report.activeEmploymentCount, numberLocale, 0)} note={`${report.incompleteScheduleCount} ${labels.headcountFteIncompleteSchedules}`} />
      </section>

      {report.incompleteScheduleCount || report.unassignedPlacementCount ? <aside className="rounded-[var(--radius-surface)] border border-warning-border bg-warning-surface p-4 text-sm text-warning-foreground" role="status">
        <p className="font-semibold">{labels.headcountFteDataQuality}</p>
        {report.incompleteScheduleCount ? <p className="mt-1">{labels.headcountFteIncompleteSchedules}: {report.incompleteScheduleCount}/{report.activeEmploymentCount}. {labels.headcountFteNoZeroFallback}</p> : null}
        {report.unassignedPlacementCount ? <p className="mt-1">{labels.headcountFteUnassignedPlacements}: {report.unassignedPlacementCount}</p> : null}
      </aside> : null}

      <section aria-label={labels.headcountFteTrend} className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-[var(--radius-surface)] border border-subtle bg-surface p-4">
          <h2 className="font-semibold">{labels.headcountFteHeadcountTrend}</h2>
          <div className="mt-3 h-64 min-w-0">
            <ResponsiveContainer height="100%" minWidth={0} width="100%">
              <LineChart data={report.trend} margin={{ top: 12, right: 8, bottom: 4, left: -18 }}>
                <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <XAxis dataKey="month" interval={Math.max(0, Math.ceil(report.trend.length / 10) - 1)} tick={{ fontSize: 11 }} tickMargin={8} />
                <YAxis allowDecimals={false} width={44} />
                <Tooltip />
                <Line dataKey="headcount" dot={false} name={labels.headcountFteHeadcount} stroke="var(--chart-2)" strokeWidth={2.5} type="monotone" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="min-w-0 rounded-[var(--radius-surface)] border border-subtle bg-surface p-4">
          <h2 className="font-semibold">{labels.headcountFteFteTrend}</h2>
          <div className="mt-3 h-64 min-w-0">
            <ResponsiveContainer height="100%" minWidth={0} width="100%">
              <LineChart data={report.trend} margin={{ top: 12, right: 8, bottom: 4, left: -18 }}>
                <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <XAxis dataKey="month" interval={Math.max(0, Math.ceil(report.trend.length / 10) - 1)} tick={{ fontSize: 11 }} tickMargin={8} />
                <YAxis width={52} />
                <Tooltip />
                <Line connectNulls={false} dataKey="fte" dot={false} name={labels.headcountFteFte} stroke="var(--chart-4)" strokeWidth={2.5} type="monotone" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="min-w-0 space-y-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{labels.headcountFteDetails} <span className="font-normal text-muted-foreground">({query.toMonth})</span></h2>
          <SelectField label={labels.sortBy} onChange={(value) => sortBy(value as HeadcountFteQuery['sortBy'])} value={query.sortBy}>
            <option value="employeeName">{labels.employee}</option><option value="administration">{labels.headcountFteAdministration}</option><option value="fte">FTE</option>
          </SelectField>
        </div>
        <div className="space-y-3 lg:hidden">
          {page.rows.map((row) => <article className="min-w-0 rounded-[var(--radius-surface)] border border-subtle bg-surface p-4" key={row.employmentId}>
            <Link className="break-words font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href={insightEmployeeDrilldownHref(row.employeeId, currentHref)}>{row.employeeName || row.employeeNumber}</Link>
            <dl className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.headcountFteEmployment}</dt><dd className="break-words">{row.employmentNumber || '—'}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.headcountFteAdministration}</dt><dd className="break-words">{row.administrationName || '—'}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.department}</dt><dd className="break-words">{row.departmentName || labels.headcountFteUnassigned}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.team}</dt><dd className="break-words">{row.teamName || labels.headcountFteUnassigned}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">FTE</dt><dd>{formatNumber(row.partTimeFactor, numberLocale, 4)}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.headcountFteScheduleStatus}</dt><dd>{labels[`headcountFteStatus${row.scheduleStatus}`]}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.headcountFtePlacementStatus}</dt><dd>{labels[`headcountFteStatus${row.placementStatus}`]}</dd></div>
            </dl>
          </article>)}
          {!report.rows.length ? <p className="rounded-[var(--radius-surface)] border border-dashed p-8 text-center text-sm text-muted-foreground">{labels.noResults}</p> : null}
        </div>
        <div className="hidden min-w-0 overflow-hidden rounded-[var(--radius-surface)] border border-subtle lg:block">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-surface-subtle"><tr>
              <th className="w-[16%] p-3"><button className="font-semibold hover:text-primary focus-visible:outline-2 focus-visible:outline-focus" onClick={() => sortBy('employeeName')} type="button">{labels.employee}</button></th>
              <th className="w-[12%] p-3">{labels.headcountFteEmployment}</th><th className="w-[13%] p-3"><button className="font-semibold hover:text-primary focus-visible:outline-2 focus-visible:outline-focus" onClick={() => sortBy('administration')} type="button">{labels.headcountFteAdministration}</button></th><th className="w-[13%] p-3">{labels.department}</th><th className="w-[13%] p-3">{labels.team}</th><th className="w-[8%] p-3"><button className="font-semibold hover:text-primary focus-visible:outline-2 focus-visible:outline-focus" onClick={() => sortBy('fte')} type="button">FTE</button></th><th className="w-[13%] p-3">{labels.headcountFteScheduleStatus}</th><th className="w-[12%] p-3">{labels.headcountFtePlacementStatus}</th>
            </tr></thead>
            <tbody className="divide-y divide-subtle bg-surface">
              {page.rows.map((row) => <tr key={row.employmentId}>
                <td className="break-words p-3"><Link className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href={insightEmployeeDrilldownHref(row.employeeId, currentHref)}>{row.employeeName || row.employeeNumber}</Link><span className="mt-0.5 block text-xs text-muted-foreground">{row.employeeNumber}</span></td>
                <td className="break-words p-3">{row.employmentNumber || '—'}</td><td className="break-words p-3">{row.administrationName || '—'}</td><td className="break-words p-3">{row.departmentName || labels.headcountFteUnassigned}</td><td className="break-words p-3">{row.teamName || labels.headcountFteUnassigned}</td><td className="p-3 tabular-nums">{formatNumber(row.partTimeFactor, numberLocale, 4)}</td><td className="break-words p-3">{labels[`headcountFteStatus${row.scheduleStatus}`]}</td><td className="break-words p-3">{labels[`headcountFteStatus${row.placementStatus}`]}</td>
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
