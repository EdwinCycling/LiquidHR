import { AI_DEFAULT_HR_GROUP_TIME_ZONE } from '@/lib/ai/timezone'

export const AI_USAGE_PERIODS = ['this-month', 'last-7-days', 'last-30-days', 'last-90-days'] as const
export type AiUsagePeriod = (typeof AI_USAGE_PERIODS)[number]

export interface AiUsageQuery {
  report: 'ai-usage'
  period: AiUsagePeriod
}

export interface AiUsagePeriodWindow extends AiUsageQuery {
  startDate: string
  endDate: string
  startAt: string
  endAt: string
  timeZone: string
}

function first(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key)?.trim()
  return value || undefined
}

function isAiUsagePeriod(value: string | undefined): value is AiUsagePeriod {
  return value !== undefined && (AI_USAGE_PERIODS as readonly string[]).includes(value)
}

export function parseAiUsageQuery(params: URLSearchParams): AiUsageQuery | null {
  if (first(params, 'report') !== 'ai-usage') return null
  const requestedPeriod = first(params, 'period')
  return { report: 'ai-usage', period: isAiUsagePeriod(requestedPeriod) ? requestedPeriod : 'this-month' }
}

export function aiUsageQueryParams(query: AiUsageQuery): URLSearchParams {
  return new URLSearchParams({ report: query.report, period: query.period })
}

function dateParts(value: Date, timeZone: string): { year: string; month: string; day: string } {
  if (Number.isNaN(value.valueOf())) throw new Error('INSIGHTS_AI_USAGE_DATE_INVALID')
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: '2-digit',
      timeZone,
      year: 'numeric',
    }).formatToParts(value)
    const result = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
    if (typeof result.year !== 'string' || typeof result.month !== 'string' || typeof result.day !== 'string') throw new Error('INSIGHTS_AI_USAGE_DATE_INVALID')
    return { year: result.year, month: result.month, day: result.day }
  } catch {
    throw new Error('INSIGHTS_AI_USAGE_TIME_ZONE_INVALID')
  }
}

export function localDateForInstant(value: string | Date, timeZone: string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const parts = dateParts(date, timeZone)
  return `${parts.year}-${parts.month}-${parts.day}`
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.valueOf())) throw new Error('INSIGHTS_AI_USAGE_DATE_INVALID')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function nextMonthStart(value: string): string {
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const date = new Date(Date.UTC(year, month, 1))
  if (Number.isNaN(date.valueOf())) throw new Error('INSIGHTS_AI_USAGE_DATE_INVALID')
  return date.toISOString().slice(0, 10)
}

function localDateTimeToUtc(localDate: string, timeZone: string): Date {
  const wallClock = new Date(`${localDate}T00:00:00Z`)
  if (Number.isNaN(wallClock.valueOf())) throw new Error('INSIGHTS_AI_USAGE_DATE_INVALID')

  let candidate = wallClock
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = datePartsWithTime(candidate, timeZone)
    const candidateWallClock = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
    const difference = wallClock.valueOf() - candidateWallClock
    if (difference === 0) return candidate
    candidate = new Date(candidate.valueOf() + difference)
  }
  throw new Error('INSIGHTS_AI_USAGE_DATE_INVALID')
}

function datePartsWithTime(value: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number } {
  if (Number.isNaN(value.valueOf())) throw new Error('INSIGHTS_AI_USAGE_DATE_INVALID')
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit',
      month: '2-digit',
      timeZone,
      year: 'numeric',
    }).formatToParts(value)
    const result = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
    const year = Number(result.year)
    const month = Number(result.month)
    const day = Number(result.day)
    const hour = Number(result.hour)
    const minute = Number(result.minute)
    if (![year, month, day, hour, minute].every(Number.isInteger)) throw new Error('INSIGHTS_AI_USAGE_DATE_INVALID')
    return { year, month, day, hour, minute }
  } catch {
    throw new Error('INSIGHTS_AI_USAGE_TIME_ZONE_INVALID')
  }
}

export function resolveAiUsagePeriod(
  period: AiUsagePeriod,
  now: Date,
  timeZone = AI_DEFAULT_HR_GROUP_TIME_ZONE,
): AiUsagePeriodWindow {
  const today = localDateForInstant(now, timeZone)
  const startDate = period === 'this-month'
    ? `${today.slice(0, 7)}-01`
    : addDays(today, -(period === 'last-7-days' ? 6 : period === 'last-30-days' ? 29 : 89))
  const endExclusiveDate = period === 'this-month' ? nextMonthStart(startDate) : addDays(today, 1)
  const endDate = addDays(endExclusiveDate, -1)
  const startAt = localDateTimeToUtc(startDate, timeZone).toISOString()
  const endAt = localDateTimeToUtc(endExclusiveDate, timeZone).toISOString()
  return { report: 'ai-usage', period, startDate, endDate, startAt, endAt, timeZone }
}
