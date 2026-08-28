import { AiExecutionError, type AiScope, type HrGroupTimeZoneResolver } from './contracts'

export const AI_DEFAULT_HR_GROUP_TIME_ZONE = 'Europe/Amsterdam'

export const defaultHrGroupTimeZoneResolver: HrGroupTimeZoneResolver = {
  resolve: async () => AI_DEFAULT_HR_GROUP_TIME_ZONE,
}

export async function resolveHrGroupTimeZone(
  scope: AiScope,
  resolver: HrGroupTimeZoneResolver = defaultHrGroupTimeZoneResolver,
): Promise<string> {
  const timeZone = await resolver.resolve(scope)

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format()
  } catch {
    throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  }

  return timeZone
}

export function calendarMonthForTimeZone(now: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value

  if (!year || !month) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return `${year}-${month}`
}

export async function resolveHrGroupCalendarMonth(
  scope: AiScope,
  now: Date,
  resolver: HrGroupTimeZoneResolver = defaultHrGroupTimeZoneResolver,
): Promise<string> {
  const timeZone = await resolveHrGroupTimeZone(scope, resolver)
  return calendarMonthForTimeZone(now, timeZone)
}
