'use client'

import Link from 'next/link'
import { AlertTriangle, Search } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { SectionHeader } from '@/components/patterns/section-header'
import { ActiveFilters, ReportEmpty, ReportKpi, type ActiveReportFilter } from '@/components/insights/absence-report'
import { InsightsExportAction, InsightsFilterBar } from '@/components/insights/shared-controls'
import { buildInsightApplyHref } from '@/lib/insights/query-seam'
import { frequentAbsenceQueryParams, parseFrequentAbsenceQuery, type FrequentAbsenceQuery } from '@/lib/insights/frequent-absence-query'
import type { FrequentAbsenceReport } from '@/lib/insights/frequent-absence-report'
import { insightEmployeeDrilldownHref } from '@/lib/insights/query-seam'

interface FrequentAbsenceLabels {
  title: string; description: string; exportExcel: string; exportPreparing: string; exportSuccess: string; exportFailed: string; period: string; last12Months: string; thisYear: string; previousYear: string; team: string; allDepartments: string; applyFilters: string; resetFilters: string; clearFilters: string; removeFilter: string; filterStatus: string; search: string; searchPlaceholder: string; employee: string; reportCount: string; sickDays: string; frequent: string; threshold: string; thresholdDescription: string; totalEmployees: string; frequentCount: string; totalReports: string; noResults: string; yearLabel: string; activeFilters?: string
}

function periodLabel(query: FrequentAbsenceQuery, labels: FrequentAbsenceLabels): string {
  if (query.period === '12-months') return labels.last12Months
  if (query.period === 'this-year') return labels.thisYear
  return labels.previousYear
}

export function FrequentAbsenceReportView({ report, query, labels, returnTo }: { report: FrequentAbsenceReport; query: FrequentAbsenceQuery; labels: FrequentAbsenceLabels; returnTo: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [draft, setDraft] = useState(query)
  const defaultQuery = (): FrequentAbsenceQuery => {
    const parsed = parseFrequentAbsenceQuery(new URLSearchParams({ report: 'absence-frequent' }))
    if (!parsed) throw new Error('INSIGHTS_FREQUENT_DEFAULT_INVALID')
    return parsed
  }
  const apply = (next: FrequentAbsenceQuery): void => router.push(buildInsightApplyHref(searchParams, frequentAbsenceQueryParams(next)), { scroll: false })
  const reset = (): void => { const next = defaultQuery(); setDraft(next); apply(next) }
  const rows = useMemo(() => report.rows.filter((row) => (!draft.frequentOnly || row.isFrequent) && row.employeeName.toLocaleLowerCase('nl-NL').includes(draft.search.trim().toLocaleLowerCase('nl-NL'))), [draft.frequentOnly, draft.search, report.rows])
  const selectedDepartment = draft.departmentId ? report.departments.find((department) => department.id === draft.departmentId)?.name ?? draft.departmentId : null
  const activeFilters: ActiveReportFilter[] = [
    { key: 'period', label: labels.period, value: periodLabel(draft, labels), onRemove: reset },
    ...(selectedDepartment ? [{ key: 'department', label: labels.team, value: selectedDepartment, onRemove: () => setDraft((current) => ({ ...current, departmentId: null })) }] : []),
    ...(draft.search.trim() ? [{ key: 'search', label: labels.search, value: draft.search.trim(), onRemove: () => setDraft((current) => ({ ...current, search: '' })) }] : []),
    ...(draft.frequentOnly ? [{ key: 'frequentOnly', label: labels.frequent, onRemove: () => setDraft((current) => ({ ...current, frequentOnly: false })) }] : []),
  ]
  const exportParams = frequentAbsenceQueryParams(query, 'excel')

  return <section className="space-y-5">
    <InsightsFilterBar actions={<>
        <Button onClick={() => apply(draft)} size="md" type="button">{labels.applyFilters}</Button>
        <Button onClick={reset} size="md" type="button" variant="secondary">{labels.resetFilters}</Button>
        <InsightsExportAction fileName="absence-frequent.xlsx" href={`/api/insights/absence?${exportParams.toString()}`} label={labels.exportExcel} labels={{ error: labels.exportFailed, loading: labels.exportPreparing, success: labels.exportSuccess }} />
      </>}>
        <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-44"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.period}</span><DropdownSelect aria-label={labels.period} onChange={(event) => setDraft((current) => ({ ...current, period: event.currentTarget.value as FrequentAbsenceQuery['period'] }))} value={draft.period}><option value="12-months">{labels.last12Months}</option><option value="this-year">{labels.thisYear}</option><option value="previous-year">{labels.previousYear}</option></DropdownSelect></label>
        <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-52"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.team}</span><DropdownSelect aria-label={labels.team} onChange={(event) => setDraft((current) => ({ ...current, departmentId: event.currentTarget.value || null }))} searchable searchPlaceholder={labels.team} value={draft.departmentId ?? ''}><option value="">{labels.allDepartments}</option>{report.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</DropdownSelect></label>
        <label className="flex min-w-0 basis-full flex-[1.2] flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-52"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.search}</span><TextInput leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))} placeholder={labels.searchPlaceholder} type="search" value={draft.search} /></label>
        <div className="flex min-h-10 min-w-0 basis-full items-center sm:basis-auto sm:min-w-44"><Checkbox checked={draft.frequentOnly} label={labels.frequent} onChange={(event) => setDraft((current) => ({ ...current, frequentOnly: event.target.checked }))} /></div>
      </InsightsFilterBar>
    <ActiveFilters clearLabel={labels.clearFilters} filters={activeFilters} label={labels.activeFilters} onClear={reset} onReset={reset} removeLabel={labels.removeFilter} resetLabel={labels.resetFilters} selectedCountLabel={labels.filterStatus} />

    <div className="grid gap-3 sm:grid-cols-3">
      <ReportKpi featured label={labels.frequentCount} tone="danger" value={String(report.frequentCount)} />
      <ReportKpi label={labels.totalEmployees} tone="info" value={String(report.totalEmployees)} />
      <ReportKpi label={labels.totalReports} value={String(report.totalReports)} />
    </div>

    <Surface className="flex items-start gap-3 p-4 text-sm leading-6 text-muted-foreground" variant="subtle"><AlertTriangle aria-hidden="true" className="mt-1 shrink-0 text-warning" size={17} /><p>{labels.thresholdDescription.replace('{threshold}', String(report.threshold))}</p></Surface>

    <div className="space-y-3">
      <SectionHeader actions={<span className="text-sm text-muted-foreground">{rows.length} / {report.rows.length}</span>} description={periodLabel(query, labels)} title={labels.title} />
      <DataTableShell caption={labels.title} state={rows.length ? 'ready' : 'empty'} stateContent={<ReportEmpty title={labels.noResults} />}>
        <thead className="bg-surface-subtle text-xs uppercase tracking-[0.08em] text-muted-foreground"><tr>
          <th className="px-4 py-3 sm:px-5">{labels.employee}</th><th className="px-4 py-3 sm:px-5">{labels.team}</th><th className="px-4 py-3 text-right sm:px-5">{labels.reportCount}</th><th className="px-4 py-3 text-right sm:px-5">{labels.sickDays}</th><th className="px-4 py-3 sm:px-5">{labels.frequent}</th>
        </tr></thead>
        <tbody className="divide-y divide-border-subtle">{rows.map((row) => <tr className="whitespace-nowrap" key={row.employeeId}>
          <td className="px-4 py-3 font-medium sm:px-5"><Link className="text-primary hover:underline" href={insightEmployeeDrilldownHref(row.employeeId, returnTo, 'absence')}>{row.employeeName}</Link></td>
          <td className="px-4 py-3 text-muted-foreground sm:px-5">{row.departmentName ?? labels.allDepartments}</td>
          <td className="px-4 py-3 text-right font-semibold tabular-nums sm:px-5">{row.reportCount}</td>
          <td className="px-4 py-3 text-right tabular-nums sm:px-5">{row.totalSickDays.toFixed(1)}</td>
          <td className="px-4 py-3 sm:px-5">{row.isFrequent ? <Badge tone="danger">{labels.frequent}</Badge> : null}</td>
        </tr>)}</tbody>
      </DataTableShell>
    </div>
  </section>
}
