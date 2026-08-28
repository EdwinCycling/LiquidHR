'use client'

import { Gift, PartyPopper, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Button } from '@/components/ui/button'
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select'
import { InsightsActiveFilters, InsightsExportAction, InsightsFilterBar } from '@/components/insights/shared-controls'
import { formatDate } from '@/lib/preferences/formatters'
import type { DateFormat } from '@/lib/preferences/user-preferences'
import type { UpcomingEventType, UpcomingEventsQuery, UpcomingEventsReport } from '@/lib/insights/upcoming-events'
import { buildInsightApplyHref, insightEmployeeDrilldownHref } from '@/lib/insights/query-seam'
import { upcomingEventsQueryParams } from '@/lib/insights/upcoming-events-query'

interface Labels {
  title: string; backToInsights: string; event: string; department: string; period: string; birthdays: string; anniversaries: string; starters: string
  allEvents: string; selected: string; today: string; inDays: string; next7Days: string; next4Weeks: string; next12Weeks: string; next12Months: string
  allDepartments: string; searchDepartments: string; export: string; exportPreparing: string; exportSuccess: string; exportFailed: string; empty: string; years: string
  applyFilters: string; resetFilters: string; clearFilters: string; removeFilter: string; filterStatus: string; activeFilters?: string
}

const eventTypes: UpcomingEventType[] = ['BIRTHDAY', 'ANNIVERSARY', 'STARTER']
type PeriodDays = 7 | 28 | 84 | 365

export function UpcomingEventsReportView({ report, query, labels, locale, dateFormat, returnTo }: { report: UpcomingEventsReport; query: UpcomingEventsQuery; labels: Labels; locale: string; dateFormat: DateFormat; returnTo: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [draft, setDraft] = useState(query)
  const eventLabel: Record<UpcomingEventType, string> = { BIRTHDAY: labels.birthdays, ANNIVERSARY: labels.anniversaries, STARTER: labels.starters }
  const eventIcon: Record<UpcomingEventType, typeof Gift> = { BIRTHDAY: PartyPopper, ANNIVERSARY: Gift, STARTER: UserPlus }
  const periodLabel: Record<PeriodDays, string> = { 7: labels.next7Days, 28: labels.next4Weeks, 84: labels.next12Weeks, 365: labels.next12Months }
  const sortedRows = [...report.rows].sort((left, right) => left.date.localeCompare(right.date) || left.employeeName.localeCompare(right.employeeName, 'nl'))
  const todayRows = sortedRows.filter((row) => row.date === report.startDate && query.types.includes(row.type))
  const apply = (next: UpcomingEventsQuery): void => router.push(buildInsightApplyHref(searchParams, upcomingEventsQueryParams(next)), { scroll: false })
  const reset = (): void => {
    const next: UpcomingEventsQuery = { types: [...eventTypes], periodDays: 84, departmentIds: [] }
    setDraft(next)
    apply(next)
  }
  const selectedDepartments = draft.departmentIds.map((id) => report.departments.find((department) => department.id === id)?.name ?? id)
  const activeFilters = [
    { key: 'period', label: labels.period, value: periodLabel[draft.periodDays], onRemove: reset },
    ...(draft.types.length < eventTypes.length ? [{ key: 'types', label: labels.event, value: draft.types.map((type) => eventLabel[type]).join(', '), onRemove: () => setDraft((current) => ({ ...current, types: [...eventTypes] })) }] : []),
    ...selectedDepartments.map((name, index) => ({ key: `department-${draft.departmentIds[index]}`, label: labels.department, value: name, onRemove: () => setDraft((current) => ({ ...current, departmentIds: current.departmentIds.filter((_, itemIndex) => itemIndex !== index) })) })),
  ]
  const eventOptions: MultiSelectOption[] = eventTypes.map((type) => ({ label: eventLabel[type], searchLabel: eventLabel[type], value: type }))
  const departmentOptions: MultiSelectOption[] = report.departments.map((department) => ({ label: department.name, value: department.id }))
  const exportParams = upcomingEventsQueryParams(query)
  exportParams.set('format', 'csv')
  const displayDate = (value: string) => formatDate(value, { locale, dateFormat })
  const daysUntil = (value: string) => Math.max(0, Math.round((Date.parse(`${value}T00:00:00Z`) - Date.parse(`${report.startDate}T00:00:00Z`)) / 86400000))
  const relativeDate = (value: string) => daysUntil(value) === 0 ? labels.today : labels.inDays.replace('{days}', String(daysUntil(value)))
  const renderRow = (row: UpcomingEventsReport['rows'][number]) => <li className="grid gap-1 border-t border-border/70 py-3 text-sm sm:grid-cols-[1fr_auto]" key={row.id}><span><Link className="font-medium text-primary hover:underline" href={insightEmployeeDrilldownHref(row.employeeId, returnTo)}>{row.employeeName}</Link>{row.type === 'ANNIVERSARY' && row.years !== null ? ` (${row.years} ${labels.years})` : ''}{row.departmentName ? <span className="text-muted-foreground"> · {row.departmentName}</span> : null}</span><span className="text-right"><time className="block font-medium tabular-nums text-muted-foreground">{displayDate(row.date)}</time><span className="text-xs text-muted-foreground">{relativeDate(row.date)}</span></span></li>

  return <section className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10"><p className="eyebrow">{labels.title}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{labels.title}</h1><div className="mt-7">
    <InsightsFilterBar actions={<><Button onClick={() => apply(draft)} size="md" type="button">{labels.applyFilters}</Button><Button onClick={reset} size="md" type="button" variant="secondary">{labels.resetFilters}</Button><InsightsExportAction fileName="upcoming-events.csv" href={`/api/insights/upcoming-events?${exportParams.toString()}`} label={labels.export} labels={{ error: labels.exportFailed, loading: labels.exportPreparing, success: labels.exportSuccess }} /></>}>
      <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-52"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.event}</span><MultiSelect aria-label={labels.event} emptySelectionLabel={labels.allEvents} listLabel={labels.event} loadingLabel={labels.allEvents} noOptionsLabel={labels.allEvents} onChange={(types) => setDraft((current) => ({ ...current, types: types as UpcomingEventType[] }))} options={eventOptions} searchPlaceholder={labels.event} selectAllLabel={labels.allEvents} selectedCountLabel={labels.filterStatus} showSelectAll value={draft.types} /></label>
      <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-52"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.department}</span><MultiSelect aria-label={labels.department} emptySelectionLabel={labels.allDepartments} listLabel={labels.department} loadingLabel={labels.allDepartments} noOptionsLabel={labels.allDepartments} onChange={(departmentIds) => setDraft((current) => ({ ...current, departmentIds }))} options={departmentOptions} searchPlaceholder={labels.searchDepartments} selectAllLabel={labels.allDepartments} selectedCountLabel={labels.filterStatus} showSelectAll value={draft.departmentIds} /></label>
      <label className="flex min-w-0 basis-full flex-1 flex-col gap-1.5 text-sm font-medium sm:basis-auto sm:min-w-44"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.period}</span><DropdownSelect aria-label={labels.period} onChange={(event) => setDraft((current) => ({ ...current, periodDays: Number(event.currentTarget.value) as PeriodDays }))} value={String(draft.periodDays)}>{([7, 28, 84, 365] as const).map((days) => <option key={days} value={days}>{periodLabel[days]}</option>)}</DropdownSelect></label>
    </InsightsFilterBar>
    <div className="mt-3"><InsightsActiveFilters clearLabel={labels.clearFilters} filters={activeFilters} label={labels.activeFilters ?? labels.event} onClear={reset} onReset={reset} removeLabel={labels.removeFilter} resetLabel={labels.resetFilters} selectedCountLabel={labels.filterStatus} /></div>
  </div><div className="mt-6 rounded-[var(--radius-surface)] border border-border bg-surface p-5"><div className="flex flex-wrap items-center justify-between gap-4"><p className="text-sm font-medium text-muted-foreground">{displayDate(report.startDate)} → {displayDate(report.endDate)}</p></div>{report.rows.length ? <div className="mt-5 space-y-5">{todayRows.length ? <section className="rounded-[var(--radius-surface)] border-2 border-primary/35 bg-primary/10 p-5"><h2 className="flex items-center gap-2 text-lg font-semibold text-primary"><PartyPopper size={20} />{labels.today}<span className="ml-auto rounded-full bg-background/80 px-2.5 py-1 text-xs tabular-nums">{todayRows.length}</span></h2><ul className="mt-2">{todayRows.map(renderRow)}</ul></section> : null}<div className="grid gap-5 md:grid-cols-2">{eventTypes.filter((type) => query.types.includes(type)).map((type) => { const rows = sortedRows.filter((row) => row.type === type); const Icon = eventIcon[type]; const color = type === 'BIRTHDAY' ? 'border-chart-1/30 bg-chart-1/10' : type === 'ANNIVERSARY' ? 'border-chart-2/30 bg-chart-2/10' : 'border-chart-3/30 bg-chart-3/10'; return <section className={`rounded-[var(--radius-surface)] border p-5 ${color}`} key={type}><h2 className="flex items-center gap-2 font-semibold"><Icon className="text-primary" size={18} />{eventLabel[type]}<span className="ml-auto rounded-full bg-background/70 px-2 py-1 text-xs tabular-nums">{rows.length}</span></h2>{rows.length ? <ul className="mt-2">{rows.map(renderRow)}</ul> : <p className="mt-3 text-sm text-muted-foreground">{labels.empty}</p>}</section> })}</div></div> : <p className="mt-5 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{labels.empty}</p>}</div></section>
}
