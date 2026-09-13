'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Clock3, Umbrella } from 'lucide-react'
import { Drawer } from '@/components/ui/drawer'
import { Surface } from '@/components/ui/surface'
import { colorCodeToCssValue } from '@/lib/leave/colors'
import type { LeaveBalanceReport } from '@/lib/leave/report'
import type { LeaveOverviewDay } from '@/lib/leave/overview-service'

export type LeaveYearOverviewLabels = {
  title: string
  description: string
  back: string
  year: string
  previous: string
  next: string
  legend: string
  past: string
  today: string
  future: string
  approved: string
  hours: string
  details: string
  noLeave: string
  requestMode: string
  direct: string
  priority: string
  timeMode: string
  fullDay: string
  morning: string
  afternoon: string
  specificHours: string
  from: string
  until: string
  beginningBalance: string
  currentBalance: string
  taken: string
  planned: string
  projectedEnd: string
  openingBalance: string
  accrual: string
  contractEnd: string
  employment: string
  notRecorded: string
  unlimited: string
}

function monthDates(year: number, month: number): string[] {
  const dates: string[] = []
  const date = new Date(Date.UTC(year, month, 1))
  while (date.getUTCMonth() === month) {
    dates.push(date.toISOString().slice(0, 10))
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return dates
}

function formatHours(value: number | null, locale: string, unlimited: string, hoursLabel: string): string {
  return value === null ? unlimited : `${value.toLocaleString(locale === 'en' ? 'en-GB' : 'nl-NL', { maximumFractionDigits: 4 })}${hoursLabel}`
}

function timeModeLabel(mode: LeaveOverviewDay['timeMode'], labels: LeaveYearOverviewLabels): string {
  return mode === 'FULL_DAY' ? labels.fullDay : mode === 'MORNING' ? labels.morning : mode === 'AFTERNOON' ? labels.afternoon : labels.specificHours
}

export function LeaveYearOverview({ report, days, employment, locale, labels }: { report: LeaveBalanceReport; days: readonly LeaveOverviewDay[]; employment: { employmentNumber: string | null; startsOn: string; endsOn: string | null }; locale: string; labels: LeaveYearOverviewLabels }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const dayMap = useMemo(() => {
    const map = new Map<string, LeaveOverviewDay[]>()
    for (const day of days) map.set(day.date, [...(map.get(day.date) ?? []), day])
    return map
  }, [days])
  const today = new Date().toISOString().slice(0, 10)
  const dateFormatter = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', { dateStyle: 'long', timeZone: 'UTC' })
  const monthFormatter = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', { month: 'long', timeZone: 'UTC' })
  const selectedEvents = selectedDate ? dayMap.get(selectedDate) ?? [] : []

  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {report.leaveTypes.map((type) => <Surface className="p-4" key={type.leaveTypeId}><div className="flex items-center gap-2 text-sm font-semibold"><span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: colorCodeToCssValue(type.colorCode) }} />{type.name}</div><dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs"><div><dt className="text-muted-foreground">{labels.beginningBalance}</dt><dd className="font-semibold tabular-nums">{formatHours(type.startOfYearBalance, locale, labels.unlimited, labels.hours)}</dd></div><div><dt className="text-muted-foreground">{labels.currentBalance}</dt><dd className="font-semibold tabular-nums">{formatHours(type.currentBalance, locale, labels.unlimited, labels.hours)}</dd></div><div><dt className="text-muted-foreground">{labels.taken}</dt><dd className="font-semibold tabular-nums">{formatHours(type.taken.reduce((sum, item) => sum + Math.abs(item.amount), 0), locale, labels.unlimited, labels.hours)}</dd></div><div><dt className="text-muted-foreground">{labels.planned}</dt><dd className="font-semibold tabular-nums">{formatHours(type.planned, locale, labels.unlimited, labels.hours)}</dd></div><div><dt className="text-muted-foreground">{labels.projectedEnd}</dt><dd className="font-semibold tabular-nums">{formatHours(type.projectedEndBalance, locale, labels.unlimited, labels.hours)}</dd></div><div><dt className="text-muted-foreground">{labels.openingBalance}</dt><dd className="font-semibold tabular-nums">{formatHours(type.openingBalance, locale, labels.unlimited, labels.hours)}</dd></div></dl></Surface>)}
    </div>
    <Surface className="overflow-hidden p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.description}</p></div><div className="text-right text-sm text-muted-foreground"><p>{labels.employment}: {employment.employmentNumber ?? labels.notRecorded}</p><p>{employment.startsOn} — {employment.endsOn ?? labels.notRecorded}</p></div></div>
      <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label={labels.legend}><span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border bg-muted/60" />{labels.past}</span><span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border border-focus bg-accent" />{labels.today}</span><span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border bg-surface" />{labels.future}</span><span className="inline-flex items-center gap-1.5"><Umbrella aria-hidden="true" size={13} />{labels.approved}</span></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 12 }, (_, month) => {
          const dates = monthDates(report.calendarYear, month)
          const firstWeekday = (new Date(`${dates[0]}T00:00:00Z`).getUTCDay() + 6) % 7
          return <section className="min-w-0 rounded-[var(--radius-control)] border border-subtle p-3" key={month} aria-labelledby={`leave-month-${month}`}><h3 className="text-sm font-semibold capitalize" id={`leave-month-${month}`}>{monthFormatter.format(new Date(`${dates[0]}T00:00:00Z`))}</h3><div className="mt-2 grid grid-cols-7 gap-1 text-center">{Array.from({ length: firstWeekday }, (_, index) => <span aria-hidden="true" className="min-h-16" key={`empty-${index}`} />)}{dates.map((date) => { const events = dayMap.get(date) ?? []; const stateClass = date < today ? 'bg-muted/45' : date === today ? 'border-focus bg-accent' : 'bg-surface'; return <button aria-label={`${dateFormatter.format(new Date(`${date}T00:00:00Z`))}${events.length ? ` · ${events.map((event) => `${event.typeName} ${event.hours}${labels.hours}`).join(', ')}` : ` · ${labels.noLeave}`}`} className={`min-h-16 min-w-0 rounded-[var(--radius-control)] border border-subtle p-1 text-left transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus ${stateClass}`} key={date} onClick={() => setSelectedDate(date)} type="button"><span className="text-xs font-semibold tabular-nums">{date.slice(8, 10)}</span>{events.length ? <span className="mt-1 block space-y-1">{events.map((event) => <span className="flex items-center gap-1 truncate text-[10px] font-semibold" key={event.id}><span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colorCodeToCssValue(event.colorCode) }} /><span className="truncate">{event.typeName}</span></span>)}</span> : <span className="mt-1 block text-[10px] text-muted-foreground">—</span>}</button> })}</div></section>
        })}
      </div>
    </Surface>
    {selectedDate ? <Drawer closeLabel={labels.back} description={dateFormatter.format(new Date(`${selectedDate}T00:00:00Z`))} onOpenChange={(open) => { if (!open) setSelectedDate(null) }} open title={labels.details}>{selectedEvents.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">{labels.noLeave}</p> : <div className="mt-5 space-y-3">{selectedEvents.map((event) => <div className="rounded-[var(--radius-control)] border border-subtle p-4" key={event.id}><div className="flex items-start justify-between gap-3"><span className="flex min-w-0 items-center gap-2 font-semibold"><span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: colorCodeToCssValue(event.colorCode) }} />{event.typeName}</span><span className="shrink-0 font-semibold tabular-nums">{event.hours}{labels.hours}</span></div><dl className="mt-3 grid gap-2 text-sm"><div><dt className="text-muted-foreground">{labels.approved}</dt><dd className="flex items-center gap-1 font-medium"><CheckCircle2 aria-hidden="true" size={14} />{labels.approved}</dd></div><div><dt className="text-muted-foreground">{labels.requestMode}</dt><dd>{event.requestMode === 'PRIORITY' ? labels.priority : labels.direct}</dd></div><div><dt className="text-muted-foreground">{labels.timeMode}</dt><dd className="flex items-center gap-1"><Clock3 aria-hidden="true" size={14} />{timeModeLabel(event.timeMode, labels)}</dd></div>{event.specificStart || event.specificEnd ? <div><dt className="text-muted-foreground">{labels.from} — {labels.until}</dt><dd>{event.specificStart ?? labels.notRecorded} — {event.specificEnd ?? labels.notRecorded}</dd></div> : null}</dl></div>)}</div>}</Drawer> : null}
  </div>
}
