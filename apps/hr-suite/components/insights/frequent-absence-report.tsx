'use client'

import Link from 'next/link'
import { AlertTriangle, Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { FilterBar } from '@/components/patterns/filter-bar'
import { SectionHeader } from '@/components/patterns/section-header'
import { ActiveFilters, ReportEmpty, ReportKpi, type ActiveReportFilter } from '@/components/insights/absence-report'
import type { FrequentAbsenceQuery } from '@/lib/insights/frequent-absence-query'
import type { FrequentAbsenceReport } from '@/lib/insights/frequent-absence-report'

interface FrequentAbsenceLabels {
  title: string; description: string; exportExcel: string; period: string; last12Months: string; thisYear: string; previousYear: string; team: string; allDepartments: string; applyFilters: string; search: string; searchPlaceholder: string; employee: string; reportCount: string; sickDays: string; frequent: string; threshold: string; thresholdDescription: string; totalEmployees: string; frequentCount: string; totalReports: string; noResults: string; yearLabel: string; activeFilters?: string
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
  const selectedDepartment = query.departmentId ? report.departments.find((department) => department.id === query.departmentId)?.name ?? query.departmentId : null
  const activeFilters: ActiveReportFilter[] = [
    { label: labels.period, value: periodLabel(query, labels) },
    ...(selectedDepartment ? [{ label: labels.team, value: selectedDepartment }] : []),
    ...(search.trim() ? [{ label: labels.search, value: search.trim() }] : []),
    ...(showFrequentOnly ? [{ text: labels.frequent }] : []),
  ]

  return <section className="space-y-5">
    <form action="/insights" method="get">
      <FilterBar actions={<div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <Button size="md" type="submit">{labels.applyFilters}</Button>
        <a className={buttonClasses({ size: 'md', variant: 'secondary' })} download href={`/api/insights/absence?${exportParams.toString()}`}><Download aria-hidden="true" />{labels.exportExcel}</a>
      </div>}>
        <input name="report" type="hidden" value="absence-frequent" />
        <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-44"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.period}</span><DropdownSelect aria-label={labels.period} defaultValue={query.period} name="period"><option value="12-months">{labels.last12Months}</option><option value="this-year">{labels.thisYear}</option><option value="previous-year">{labels.previousYear}</option></DropdownSelect></label>
        <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-52"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.team}</span><DropdownSelect aria-label={labels.team} defaultValue={query.departmentId ?? ''} name="department" searchable searchPlaceholder={labels.team}><option value="">{labels.allDepartments}</option>{report.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</DropdownSelect></label>
        <label className="flex min-w-0 basis-full flex-[1.2] flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-52"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.search}</span><TextInput leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setSearch(event.target.value)} placeholder={labels.searchPlaceholder} type="search" value={search} /></label>
        <div className="flex min-h-10 min-w-0 basis-full items-center sm:basis-auto sm:min-w-44"><Checkbox checked={showFrequentOnly} label={labels.frequent} onChange={(event) => setShowFrequentOnly(event.target.checked)} /></div>
      </FilterBar>
    </form>
    <ActiveFilters filters={activeFilters} label={labels.activeFilters} />

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
          <td className="px-4 py-3 font-medium sm:px-5"><Link className="text-primary hover:underline" href={`/employees/${row.employeeId}?tab=absence`}>{row.employeeName}</Link></td>
          <td className="px-4 py-3 text-muted-foreground sm:px-5">{row.departmentName ?? labels.allDepartments}</td>
          <td className="px-4 py-3 text-right font-semibold tabular-nums sm:px-5">{row.reportCount}</td>
          <td className="px-4 py-3 text-right tabular-nums sm:px-5">{row.totalSickDays.toFixed(1)}</td>
          <td className="px-4 py-3 sm:px-5">{row.isFrequent ? <Badge tone="danger">{labels.frequent}</Badge> : null}</td>
        </tr>)}</tbody>
      </DataTableShell>
    </div>
  </section>
}
