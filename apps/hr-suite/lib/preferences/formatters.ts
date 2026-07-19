import type { DateFormat, TimeFormat } from './user-preferences'

type DateFormatterOptions = { locale: string; dateFormat: DateFormat; timeFormat?: TimeFormat }

function dateParts(value: string | Date, locale: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).formatToParts(typeof value === 'string' ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : value)
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
}

export function formatDate(value: string | Date, options: Pick<DateFormatterOptions, 'locale' | 'dateFormat'>): string {
  const parts = dateParts(value, options.locale)
  if (options.dateFormat === 'YMD') return `${parts.year}-${parts.month}-${parts.day}`
  if (options.dateFormat === 'MDY') return `${parts.month}/${parts.day}/${parts.year}`
  return `${parts.day}-${parts.month}-${parts.year}`
}

export function formatTime(value: string | Date, options: Pick<DateFormatterOptions, 'locale' | 'timeFormat'>): string {
  return new Intl.DateTimeFormat(options.locale, { hour: '2-digit', minute: '2-digit', timeZone: undefined, hour12: options.timeFormat === '12H' }).format(typeof value === 'string' ? new Date(value) : value)
}

export function formatDateTime(value: string | Date, options: DateFormatterOptions): string {
  return `${formatDate(value, options)} ${formatTime(value, options)}`
}
