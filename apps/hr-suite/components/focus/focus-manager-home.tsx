import Link from 'next/link'
import { ArrowRight, CalendarDays, CheckCircle2 } from 'lucide-react'
import { SectionHeader } from '@/components/patterns/section-header'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import type { Translator } from '@/lib/i18n/translator'
import { focusDate } from './focus-view'
import type { FocusManagerHomeData, FocusManagerVacationItem } from '@/lib/focus/manager-home-service'

const VACATION_PREVIEW_LIMIT = 5

function shortDate(value: string, locale: 'nl' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function weekdayDate(value: string, locale: 'nl' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    day: 'numeric', month: 'short', weekday: 'long', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function timeValue(value: string | null): string {
  return value ? value.slice(0, 5) : ''
}

function vacationDetail(item: FocusManagerVacationItem, locale: 'nl' | 'en', t: Translator): string {
  if (item.startDate === item.endDate) {
    const day = weekdayDate(item.startDate, locale)
    if (item.timeMode === 'MORNING') return `${day} · ${t('managerHome.morning')}`
    if (item.timeMode === 'AFTERNOON') return `${day} · ${t('managerHome.afternoon')}`
    if (item.timeMode === 'SPECIFIC_HOURS') return `${day} · ${t('managerHome.specificHours', { start: timeValue(item.specificStart), end: timeValue(item.specificEnd) })}`
    return day
  }

  const range = `${t('managerHome.from')} ${shortDate(item.startDate, locale)} ${t('managerHome.until')} ${shortDate(item.endDate, locale)}`
  if (item.timeMode === 'MORNING') return `${range} · ${t('managerHome.morning')}`
  if (item.timeMode === 'AFTERNOON') return `${range} · ${t('managerHome.afternoon')}`
  if (item.timeMode === 'SPECIFIC_HOURS') return `${range} · ${t('managerHome.specificHours', { start: timeValue(item.specificStart), end: timeValue(item.specificEnd) })}`
  return range
}

export function FocusManagerHome({ data, locale, t }: { data: FocusManagerHomeData; locale: 'nl' | 'en'; t: Translator }) {
  const vacationPreview = data.vacation.slice(0, VACATION_PREVIEW_LIMIT)
  return (
    <section aria-label={t('managerHome.title')} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader title={t('managerHome.title')} />
        <Link className={buttonClasses({ variant: 'secondary', className: 'whitespace-normal' })} href="/focus/werk" prefetch={false}>
          {t('managerHome.workLink')}<ArrowRight aria-hidden="true" />
        </Link>
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Surface className="min-w-0 space-y-4 p-4 sm:p-5">
          <SectionHeader title={t('managerHome.sickTitle')} />
          {data.sick.length === 0 ? (
            <EmptyState className="px-4 py-5" icon={<CheckCircle2 />} title={t('managerHome.sickEmpty')} />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {data.sick.map((item) => {
                const href = item.pendingConfirmation ? '/focus/werk' : '/focus/team'
                return (
                  <li key={item.employeeId}>
                    <Link className="flex min-w-0 items-start justify-between gap-3 py-3 first:pt-0 last:pb-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={href} prefetch={false}>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-foreground">{item.employeeName}</span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {t('managerHome.sickSince', { date: focusDate(item.firstAbsenceOn, locale) })} · {t(item.days === 1 ? 'managerHome.sickDay' : 'managerHome.sickDays', { days: item.days })}
                        </span>
                        {item.pendingConfirmation ? <span className="mt-2 inline-flex"><Badge tone="info">{t('managerHome.pending')}</Badge></span> : null}
                      </span>
                      <ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Surface>

        <Surface className="min-w-0 space-y-4 p-4 sm:p-5">
          <SectionHeader title={t('managerHome.vacationTitle')} />
          {vacationPreview.length === 0 ? (
            <EmptyState className="px-4 py-5" icon={<CalendarDays />} title={t('managerHome.vacationEmpty')} />
          ) : (
            <>
              <ul className="divide-y divide-border-subtle">
                {vacationPreview.map((item) => (
                  <li key={`${item.employeeId}-${item.startDate}-${item.endDate}-${item.timeMode}`}>
                    <Link className="flex min-w-0 items-start justify-between gap-3 py-3 first:pt-0 last:pb-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/focus/team" prefetch={false}>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-foreground">{item.employeeName}</span>
                        <span className="mt-1 block text-sm text-muted-foreground">{vacationDetail(item, locale, t)}</span>
                      </span>
                      <ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
              {data.vacationTotal > VACATION_PREVIEW_LIMIT ? <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/focus/team" prefetch={false}>{t('managerHome.vacationViewAll')}<ArrowRight aria-hidden="true" className="size-4" /></Link> : null}
            </>
          )}
        </Surface>
      </div>
    </section>
  )
}
