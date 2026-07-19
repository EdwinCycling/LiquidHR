export class HeRaDateTimeError extends Error {
  constructor(readonly code: 'HERA_DATE_INPUT_INVALID' | 'HERA_DATE_IN_PAST') {
    super(code)
  }
}

interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value
    if (!value) throw new HeRaDateTimeError('HERA_DATE_INPUT_INVALID')
    return Number(value)
  }
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
  }
}

function sameLocalTime(left: ZonedParts, right: ZonedParts): boolean {
  return left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute
}

function localDateTimeToUtc(local: ZonedParts, timeZone: string): Date {
  const desiredTimestamp = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
  )
  let candidate = new Date(desiredTimestamp)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const represented = zonedParts(candidate, timeZone)
    const representedTimestamp = Date.UTC(
      represented.year,
      represented.month - 1,
      represented.day,
      represented.hour,
      represented.minute,
    )
    candidate = new Date(candidate.getTime() + desiredTimestamp - representedTimestamp)
  }
  if (!sameLocalTime(zonedParts(candidate, timeZone), local)) {
    throw new HeRaDateTimeError('HERA_DATE_INPUT_INVALID')
  }
  return candidate
}

function targetLocalDate(now: Date, timeZone: string, dayOffset: number): ZonedParts {
  const current = zonedParts(now, timeZone)
  const shifted = new Date(Date.UTC(current.year, current.month - 1, current.day + dayOffset))
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: 0,
    minute: 0,
  }
}

export function resolveHeRaDateTime(
  input: string,
  now: Date,
  timeZone: string,
  locale: 'nl' | 'en',
): { iso: string; display: string } {
  const normalized = input.trim().toLocaleLowerCase(locale === 'nl' ? 'nl-NL' : 'en-GB')
  const timeMatch = normalized.match(/\b(\d{1,2})[:.](\d{2})\b/)
  if (!timeMatch) throw new HeRaDateTimeError('HERA_DATE_INPUT_INVALID')
  const hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2])
  if (hour > 23 || minute > 59) throw new HeRaDateTimeError('HERA_DATE_INPUT_INVALID')

  const dayOffset = normalized.includes('morgen') || normalized.includes('tomorrow')
    ? 1
    : normalized.includes('vandaag') || normalized.includes('today')
      ? 0
      : null
  if (dayOffset === null) throw new HeRaDateTimeError('HERA_DATE_INPUT_INVALID')

  const target = targetLocalDate(now, timeZone, dayOffset)
  const resolved = localDateTimeToUtc({ ...target, hour, minute }, timeZone)
  if (resolved.getTime() <= now.getTime()) throw new HeRaDateTimeError('HERA_DATE_IN_PAST')

  const intlLocale = locale === 'nl' ? 'nl-NL' : 'en-GB'
  const dateLabel = new Intl.DateTimeFormat(intlLocale, {
    timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(resolved)
  const timeLabel = new Intl.DateTimeFormat(intlLocale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(resolved)
  const joiner = locale === 'nl' ? 'om' : 'at'

  return {
    iso: resolved.toISOString(),
    display: `${dateLabel} ${joiner} ${timeLabel} (${timeZone})`,
  }
}
