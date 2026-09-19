import Link from 'next/link'
import { ChevronLeft, ChevronRight, HeartPulse, UserRound } from 'lucide-react'
import { FocusActAsButton } from './focus-act-as-button'
import { Surface } from '@/components/ui/surface'
import { focusActAsHref } from '@/lib/focus/url'
import type { FocusTeamCalendar, FocusTeamCellStatus } from '@/lib/focus/team-service'

export interface FocusTeamCalendarLabels {
  month: string
  previous: string
  next: string
  today: string
  employee: string
  status: string
  present: string
  absent: string
  available: string
  off: string
  leave: string
  hours: string
  selectedDay: string
  reportAbsence: string
  reportRecovery: string
  actAs: string
  acting: string
}

function monthHref(month: string, offset: number): string {
  const date = new Date(`${month}-01T00:00:00.000Z`)
  date.setUTCMonth(date.getUTCMonth() + offset)
  return `/focus/team?month=${date.toISOString().slice(0, 7)}`
}

function dateHref(date: string): string {
  return `/focus/team?month=${date.slice(0, 7)}&day=${date}`
}

function shiftDateHref(date: string, offset: number): string {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + offset)
  return dateHref(value.toISOString().slice(0, 10))
}

function labelForStatus(status: FocusTeamCellStatus, labels: FocusTeamCalendarLabels): string {
  if (status === 'ABSENT') return labels.absent
  if (status === 'AVAILABLE' || status === 'PRESENT') return status === 'PRESENT' ? labels.present : labels.available
  if (status === 'LEAVE') return labels.leave
  return labels.off
}

function dateLabel(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T00:00:00.000Z`))
}

function statusClasses(status: FocusTeamCellStatus): string {
  if (status === 'ABSENT') return 'bg-destructive/10 text-destructive'
  if (status === 'LEAVE') return 'bg-warning/15 text-warning-foreground'
  if (status === 'OFF') return 'bg-surface-subtle text-muted-foreground'
  return 'bg-success/10 text-success'
}

function hoursLabel(minutes: number, labels: FocusTeamCalendarLabels): string | null {
  if (minutes <= 0) return null
  return `${Math.round(minutes / 60 * 100) / 100} ${labels.hours}`
}

function reportHref(calendar: FocusTeamCalendar, employeeId: string): string {
  return `/focus/team?month=${calendar.month}&day=${calendar.selectedDate}&reportEmployee=${employeeId}`
}

function recoveryHref(calendar: FocusTeamCalendar, employeeId: string): string {
  return `/focus/team?month=${calendar.month}&day=${calendar.selectedDate}&recoverEmployee=${employeeId}`
}

export function FocusTeamCalendarView({ calendar, labels, actAsToken, locale = 'nl' }: { calendar: FocusTeamCalendar; labels: FocusTeamCalendarLabels; actAsToken?: string | null; locale?: string }) {
  const visibleDates = calendar.dates.filter((date) => date.startsWith(calendar.month))
  const selectedDate = calendar.selectedDate
  const selectedDateLabel = dateLabel(selectedDate, locale)
  const selectedCells = calendar.members.map((member) => ({ member, cell: member.cells.find((item) => item.date === selectedDate) ?? null }))
  const commonTodayHref = focusActAsHref('/focus/team', actAsToken)
  return (
    <section className="space-y-4" aria-labelledby="focus-team-calendar-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-semibold" id="focus-team-calendar-title">{labels.month}: {calendar.month}</h2><p className="mt-1 text-sm text-muted-foreground">{calendar.viewerMode === 'EMPLOYEE' ? `${labels.present} / ${labels.absent}` : `${labels.available} / ${labels.leave} / ${labels.absent}`}</p></div>
        <div className="flex flex-wrap gap-2">
          <Link aria-label={labels.previous} className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-focus" href={focusActAsHref(monthHref(calendar.month, -1), actAsToken)}><ChevronLeft aria-hidden="true" /></Link>
          <Link className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-focus" href={commonTodayHref}>{labels.today}</Link>
          <Link aria-label={labels.next} className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-focus" href={focusActAsHref(monthHref(calendar.month, 1), actAsToken)}><ChevronRight aria-hidden="true" /></Link>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        <div className="flex items-center justify-between gap-2 rounded-[var(--radius-surface)] border border-border bg-surface p-2">
          <Link aria-label={labels.previous} className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] text-muted-foreground hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-focus" href={focusActAsHref(shiftDateHref(selectedDate, -1), actAsToken)}><ChevronLeft aria-hidden="true" /></Link>
          <p className="text-center text-sm font-semibold">{labels.selectedDay}: {selectedDateLabel}</p>
          <Link aria-label={labels.next} className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] text-muted-foreground hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-focus" href={focusActAsHref(shiftDateHref(selectedDate, 1), actAsToken)}><ChevronRight aria-hidden="true" /></Link>
        </div>
        {selectedCells.length ? selectedCells.map(({ member, cell }) => cell ? <Surface className="space-y-3 p-4" key={member.employeeId}>
          <div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary"><UserRound aria-hidden="true" className="size-5" /></div><div className="min-w-0 flex-1"><p className="font-semibold">{member.employeeName}</p><div className="mt-2 flex flex-wrap items-center gap-2"><span className={`rounded-[var(--radius-control)] px-2 py-1 text-xs font-semibold ${statusClasses(cell.status)}`}>{labelForStatus(cell.status, labels)}</span>{calendar.viewerMode === 'MANAGER' && cell.scheduledMinutes > 0 ? <span className="text-xs text-muted-foreground">{hoursLabel(cell.scheduledMinutes, labels)}</span> : null}</div></div></div>
          {calendar.viewerMode === 'MANAGER' ? <div className="flex flex-wrap gap-3 text-sm">{calendar.canReportAbsence ? <Link className="inline-flex min-h-10 items-center gap-2 font-medium text-primary hover:underline" href={focusActAsHref(reportHref(calendar, member.employeeId), actAsToken)}><HeartPulse aria-hidden="true" className="size-4" />{labels.reportAbsence}</Link> : null}{member.activeAbsenceCaseId && calendar.canRecoverAbsence ? <Link className="inline-flex min-h-10 items-center gap-2 font-medium text-primary hover:underline" href={focusActAsHref(recoveryHref(calendar, member.employeeId), actAsToken)}>{labels.reportRecovery}</Link> : null}{calendar.canActAs && !actAsToken ? <FocusActAsButton employeeId={member.employeeId} label={labels.actAs} loadingLabel={labels.acting} errorLabel={labels.actAs} /> : null}</div> : null}
        </Surface> : null) : null}
        {selectedCells.length === 0 ? <Surface className="p-6"><p className="text-center text-sm text-muted-foreground">{labels.employee}: —</p></Surface> : null}
      </div>

      <div className="hidden overflow-x-auto rounded-[var(--radius-surface)] border border-border bg-surface md:block">
        <table className="min-w-[860px] w-full table-fixed text-left text-sm">
          <thead className="border-b border-border-subtle bg-surface-subtle text-xs text-muted-foreground"><tr><th className="sticky left-0 z-10 w-48 bg-surface-subtle px-3 py-3">{labels.employee}</th>{visibleDates.map((date) => <th className={`px-2 py-3 text-center font-medium ${date === selectedDate ? 'bg-accent/50 text-foreground' : ''}`} key={date}>{dateLabel(date, locale)}</th>)}</tr></thead>
          <tbody className="divide-y divide-border-subtle">
            {calendar.members.map((member) => <tr key={member.employeeId}><th className="sticky left-0 z-10 bg-surface px-3 py-3 align-top"><div className="flex items-start gap-2"><UserRound aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><span>{member.employeeName}</span></div><div className="mt-2 flex flex-wrap gap-2">{calendar.canReportAbsence ? <Link className="text-xs font-medium text-primary hover:underline" href={focusActAsHref(reportHref(calendar, member.employeeId), actAsToken)}>{labels.reportAbsence}</Link> : null}{member.activeAbsenceCaseId && calendar.canRecoverAbsence ? <Link className="text-xs font-medium text-primary hover:underline" href={focusActAsHref(recoveryHref(calendar, member.employeeId), actAsToken)}>{labels.reportRecovery}</Link> : null}{calendar.canActAs && !actAsToken ? <FocusActAsButton employeeId={member.employeeId} label={labels.actAs} loadingLabel={labels.acting} errorLabel={labels.actAs} /> : null}</div></th>{visibleDates.map((date) => { const cell = member.cells.find((item) => item.date === date); if (!cell) return <td className="px-2 py-3" key={date}>—</td>; return <td className={`px-1 py-3 text-center ${date === selectedDate ? 'bg-accent/30' : ''}`} key={date}><span aria-label={`${dateLabel(date, locale)}: ${labelForStatus(cell.status, labels)}`} className={`mx-auto block max-w-20 rounded-[var(--radius-control)] px-1 py-2 text-xs font-semibold ${statusClasses(cell.status)}`}>{calendar.viewerMode === 'MANAGER' && cell.scheduledMinutes > 0 ? hoursLabel(cell.scheduledMinutes, labels) : labelForStatus(cell.status, labels)}</span></td> })}</tr>)}
          </tbody>
        </table>
        {calendar.members.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">{labels.employee}: —</p> : null}
      </div>
      {calendar.canReportAbsence ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><HeartPulse aria-hidden="true" className="size-4" />{labels.reportAbsence}</p> : null}
    </section>
  )
}
