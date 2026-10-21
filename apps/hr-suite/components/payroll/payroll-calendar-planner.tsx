'use client'

import { CalendarDays, CircleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import type { Locale } from '@/lib/i18n/config'
import {
  assertPayrollPeriodsDoNotOverlap,
  generatePayrollCalendar,
  PAYROLL_CALENDAR_PERIODICITIES,
  PayrollCalendarError,
  type GeneratedPayrollPeriod,
  type PayrollCalendarDateOffsetRule,
  type PayrollCalendarPeriodicity,
  type PayrollCalendarYearAssignment,
} from '@/lib/payroll/payroll-calendar'

export type PayrollCalendarPeriodView = {
  readonly year: number
  readonly month: number | null
  readonly periodNumber: number | null
  readonly periodicity: PayrollCalendarPeriodicity | 'AD_HOC'
  readonly periodKind: 'REGULAR' | 'ADDITIONAL' | 'CORRECTION'
  readonly startsOn: string
  readonly endsOn: string
  readonly status: string
  readonly plannedPaymentDate: string | null
}

type PayrollCalendarPlannerProps = {
  readonly defaultYear: number
  readonly locale: Locale
  readonly periods: readonly PayrollCalendarPeriodView[]
  readonly labels: Readonly<Record<string, string>>
}

type DateAnchor = 'NONE' | 'PERIOD_START' | 'PERIOD_END'

function isWeekBased(periodicity: PayrollCalendarPeriodicity): boolean {
  return periodicity === 'FOUR_WEEKLY' || periodicity === 'WEEKLY' || periodicity === 'BIWEEKLY'
}

function dateLabel(value: string | null, locale: Locale): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00.000Z`)
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function errorLabel(error: unknown, labels: Readonly<Record<string, string>>): string {
  const code = error instanceof PayrollCalendarError ? error.code : ''
  const key = `calendarError_${code}`
  return labels[key] ?? labels.calendarErrorFallback ?? ''
}

function offsetRule(anchor: DateAnchor, daysText: string): PayrollCalendarDateOffsetRule | undefined {
  if (anchor === 'NONE' || daysText.trim() === '') return undefined
  return {
    kind: anchor === 'PERIOD_START' ? 'PERIOD_START_OFFSET_DAYS' : 'PERIOD_END_OFFSET_DAYS',
    days: Number(daysText),
  }
}

export function PayrollCalendarPlanner({ defaultYear, locale, periods, labels }: PayrollCalendarPlannerProps) {
  const [calendarYear, setCalendarYear] = useState(String(defaultYear))
  const [periodicity, setPeriodicity] = useState<PayrollCalendarPeriodicity>('MONTHLY')
  const [anchorDate, setAnchorDate] = useState('')
  const [yearAssignment, setYearAssignment] = useState<PayrollCalendarYearAssignment>('PERIOD_START')
  const [paymentAnchor, setPaymentAnchor] = useState<DateAnchor>('NONE')
  const [paymentOffset, setPaymentOffset] = useState('')
  const [deadlineAnchor, setDeadlineAnchor] = useState<DateAnchor>('NONE')
  const [deadlineOffset, setDeadlineOffset] = useState('')
  const [preview, setPreview] = useState<readonly GeneratedPayrollPeriod[]>([])
  const [error, setError] = useState('')

  function createPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    try {
      const year = Number(calendarYear)
      const paymentDateRule = offsetRule(paymentAnchor, paymentOffset)
      const processingDeadlineRule = offsetRule(deadlineAnchor, deadlineOffset)
      const definition = {
        scopeKey: 'ACTIVE_ADMINISTRATION',
        calendarCode: 'REGULAR_SALARY',
        name: labels.calendarRegularName,
        version: 1,
        periodicity,
        calendarYear: year,
        status: 'DRAFT' as const,
        effectiveFrom: `${calendarYear}-01-01`,
        effectiveTo: `${calendarYear}-12-31`,
        ...(isWeekBased(periodicity) ? { anchorDate, yearAssignment } : {}),
        ...(paymentDateRule ? { paymentDateRule } : {}),
        ...(processingDeadlineRule ? { processingDeadlineRule } : {}),
      }
      const generated = generatePayrollCalendar(definition)
      assertPayrollPeriodsDoNotOverlap(generated)
      setPreview(generated)
    } catch (caught) {
      setPreview([])
      setError(errorLabel(caught, labels))
    }
  }

  return <div className="space-y-6">
    <Surface className="space-y-5 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-accent text-primary"><CalendarDays className="size-5" /></span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{labels.calendarTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{labels.calendarDescription}</p>
        </div>
      </div>

      <div className="rounded-[var(--radius-control)] border border-border-subtle bg-surface-raised px-3 py-2.5">
        <p className="text-sm font-medium">{labels.calendarConfigTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{labels.calendarConfigNotRecorded}</p>
      </div>

      <div className="border-t border-border-subtle pt-4">
        <h3 className="font-medium">{labels.calendarCurrentPeriods}</h3>
        {periods.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{labels.calendarNoSavedPeriods}</p> :
          <ul className="mt-3 divide-y divide-border-subtle" aria-label={labels.calendarCurrentPeriods}>
            {periods.map((period) => <li className="grid min-w-0 gap-x-4 gap-y-2 py-3 text-sm sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-center" key={`${period.year}-${period.periodNumber ?? period.month}-${period.startsOn}`}>
              <span className="font-medium">
                {period.periodKind === 'CORRECTION'
                  ? labels.calendarCorrection
                  : period.periodKind === 'ADDITIONAL'
                    ? labels.calendarAdditional
                    : period.periodicity === 'MONTHLY' && period.periodNumber === null && period.month !== null
                      ? `${labels.calendarMonth} ${period.month} · ${period.year}`
                      : `${labels[`calendarFrequency_${period.periodicity}`] ?? labels.calendarPeriodNumber} · ${labels.calendarPeriodNumber} ${period.periodNumber ?? ''} · ${period.year}`}
              </span>
              <span className="text-muted-foreground">{dateLabel(period.startsOn, locale)} – {dateLabel(period.endsOn, locale)}</span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground"><span>{labels.status}: {labels[`period_${period.status}`] ?? labels.periodStatusUnknown}</span><span>{labels.calendarPaymentDate}: {dateLabel(period.plannedPaymentDate, locale)}</span></span>
            </li>)}
          </ul>}
      </div>
    </Surface>

    <Surface className="space-y-5 p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{labels.calendarPlanTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{labels.calendarPlanDescription}</p>
      </div>
      <p className="rounded-[var(--radius-control)] border border-border-subtle bg-surface-raised px-3 py-2.5 text-sm text-muted-foreground">{labels.calendarNotPersisted}</p>

      <form className="space-y-5" onSubmit={createPreview}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="calendar-year">{labels.calendarYear}</label>
            <TextInput id="calendar-year" max="2200" min="2000" onChange={(event) => setCalendarYear(event.target.value)} required type="number" value={calendarYear} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="calendar-periodicity">{labels.calendarPeriodicity}</label>
            <DropdownSelect id="calendar-periodicity" onChange={(event) => setPeriodicity(event.target.value as PayrollCalendarPeriodicity)} value={periodicity}>
              {PAYROLL_CALENDAR_PERIODICITIES.map((value) => <option key={value} value={value}>{labels[`calendarFrequency_${value}`]}</option>)}
            </DropdownSelect>
          </div>
        </div>

        {isWeekBased(periodicity) ? <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="calendar-anchor-date">{labels.calendarAnchorDate}</label>
            <TextInput id="calendar-anchor-date" onChange={(event) => setAnchorDate(event.target.value)} required type="date" value={anchorDate} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="calendar-year-assignment">{labels.calendarYearAssignment}</label>
            <DropdownSelect id="calendar-year-assignment" onChange={(event) => setYearAssignment(event.target.value as PayrollCalendarYearAssignment)} value={yearAssignment}>
              <option value="PERIOD_START">{labels.calendarYearByStart}</option>
              <option value="PERIOD_END">{labels.calendarYearByEnd}</option>
            </DropdownSelect>
          </div>
        </div> : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <DateRuleFields anchor={paymentAnchor} days={paymentOffset} id="calendar-payment" labels={labels} onAnchorChange={setPaymentAnchor} onDaysChange={setPaymentOffset} title={labels.calendarPaymentRule} />
          <DateRuleFields anchor={deadlineAnchor} days={deadlineOffset} id="calendar-deadline" labels={labels} onAnchorChange={setDeadlineAnchor} onDaysChange={setDeadlineOffset} title={labels.calendarDeadlineRule} />
        </div>

        {error ? <p className="flex items-start gap-2 text-sm text-destructive" role="alert"><CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{error}</p> : null}
        <Button type="submit">{labels.calendarGenerate}</Button>
      </form>

      {preview.length ? <section aria-live="polite" className="space-y-4 border-t border-border-subtle pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">{labels.calendarPreviewTitle}</h3>
          <span className="text-sm text-muted-foreground">{preview.length} {labels.calendarPeriodCount}</span>
        </div>
        <p className="text-sm text-muted-foreground">{periodicity === 'MONTHLY' ? labels.calendarMonthlyCalculationScope : labels.calendarFrequencyNotValidated}</p>
        <ol className="divide-y divide-border-subtle rounded-[var(--radius-control)] border border-border-subtle" aria-label={labels.calendarPreviewTitle}>
          {preview.map((period) => <li className="grid min-w-0 gap-x-4 gap-y-2 p-3 text-sm sm:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:px-4" key={`${period.calendarYear}-${period.periodNumber}`}>
            <span className="font-semibold">{labels.calendarPeriodNumber} {period.periodNumber}</span>
            <span>{dateLabel(period.startsOn, locale)} – {dateLabel(period.endsOn, locale)}</span>
            <span className="text-muted-foreground">{labels.calendarPaymentDate}: {dateLabel(period.plannedPaymentDate, locale)}</span>
            <span className="text-muted-foreground">{labels.calendarDeadline}: {dateLabel(period.processingDeadline, locale)}</span>
          </li>)}
        </ol>
      </section> : null}
    </Surface>
  </div>
}

function DateRuleFields({
  anchor,
  days,
  id,
  labels,
  onAnchorChange,
  onDaysChange,
  title,
}: {
  readonly anchor: DateAnchor
  readonly days: string
  readonly id: string
  readonly labels: Readonly<Record<string, string>>
  readonly onAnchorChange: (value: DateAnchor) => void
  readonly onDaysChange: (value: string) => void
  readonly title: string
}) {
  return <fieldset className="grid min-w-0 gap-3 rounded-[var(--radius-control)] border border-border-subtle p-3 sm:p-4">
    <legend className="px-1 text-sm font-medium">{title}</legend>
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
      <div className="grid gap-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor={`${id}-anchor`}>{labels.calendarDateAnchor}</label>
        <DropdownSelect id={`${id}-anchor`} onChange={(event) => onAnchorChange(event.target.value as DateAnchor)} value={anchor}>
          <option value="NONE">{labels.calendarUnspecified}</option>
          <option value="PERIOD_START">{labels.calendarPeriodStart}</option>
          <option value="PERIOD_END">{labels.calendarPeriodEnd}</option>
        </DropdownSelect>
      </div>
      <div className="grid gap-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor={`${id}-offset`}>{labels.calendarOffsetDays}</label>
        <TextInput disabled={anchor === 'NONE'} id={`${id}-offset`} max="90" min="-31" onChange={(event) => onDaysChange(event.target.value)} placeholder="0" type="number" value={days} />
      </div>
    </div>
  </fieldset>
}
