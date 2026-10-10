export class HeRaDateTimeError extends Error {
  constructor(readonly code: 'HERA_DATE_INPUT_INVALID' | 'HERA_DATE_IN_PAST' | 'HERA_DATE_TIME_AMBIGUOUS') {
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
  const offsets = new Set<number>()
  for (const hours of [-36, -18, -6, 0, 6, 18, 36]) {
    const probe = new Date(desiredTimestamp + hours * 3_600_000)
    const represented = zonedParts(probe, timeZone)
    const representedTimestamp = Date.UTC(
      represented.year,
      represented.month - 1,
      represented.day,
      represented.hour,
      represented.minute,
    )
    offsets.add(representedTimestamp - probe.getTime())
  }
  const candidates = [...offsets]
    .map((offset) => new Date(desiredTimestamp - offset))
    .filter((candidate) => sameLocalTime(zonedParts(candidate, timeZone), local))
  if (candidates.length === 0) throw new HeRaDateTimeError('HERA_DATE_INPUT_INVALID')
  if (candidates.length > 1) throw new HeRaDateTimeError('HERA_DATE_TIME_AMBIGUOUS')
  return candidates[0]!
}

function validLocalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.toISOString().slice(0, 10) === value
}

export function resolveHeRaDate(
  input: string,
  now: Date,
  timeZone: string,
  locale: 'nl' | 'en',
): { date: string; display: string } {
  const normalized = input.trim().toLocaleLowerCase(locale === 'nl' ? 'nl-NL' : 'en-GB')
  const explicitDate = normalized.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0]
  let targetDate: string

  if (explicitDate) {
    if (!validLocalDate(explicitDate)) throw new HeRaDateTimeError('HERA_DATE_INPUT_INVALID')
    targetDate = explicitDate
  } else {
    const today = zonedParts(now, timeZone)
    const todayDate = `${String(today.year).padStart(4, '0')}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`
    const relativeOffset = /(?:^|\b)(?:morgen|tomorrow)(?:$|\b)/u.test(normalized)
      ? 1
      : /(?:^|\b)(?:vandaag|today)(?:$|\b)/u.test(normalized)
        ? 0
        : null
    let dayOffset = relativeOffset
    if (dayOffset === null) {
      const weekdayLabels: ReadonlyArray<{ day: number; labels: readonly string[] }> = [
        { day: 0, labels: ['zondag', 'sunday'] },
        { day: 1, labels: ['maandag', 'monday'] },
        { day: 2, labels: ['dinsdag', 'tuesday'] },
        { day: 3, labels: ['woensdag', 'wednesday'] },
        { day: 4, labels: ['donderdag', 'thursday'] },
        { day: 5, labels: ['vrijdag', 'friday'] },
        { day: 6, labels: ['zaterdag', 'saturday'] },
      ]
      const matched = weekdayLabels.flatMap((entry) => entry.labels
        .filter((label) => new RegExp(`(?:^|\\b)${label}(?:$|\\b)`, 'u').test(normalized))
        .map(() => entry.day))
      if (matched.length !== 1) throw new HeRaDateTimeError('HERA_DATE_INPUT_INVALID')
      const todayWeekday = new Date(`${todayDate}T00:00:00Z`).getUTCDay()
      dayOffset = ((matched[0]! - todayWeekday + 7) % 7) || 7
    }
    const shifted = new Date(Date.UTC(today.year, today.month - 1, today.day + dayOffset))
    targetDate = shifted.toISOString().slice(0, 10)
  }

  const today = zonedParts(now, timeZone)
  const todayDate = `${String(today.year).padStart(4, '0')}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`
  if (targetDate < todayDate) throw new HeRaDateTimeError('HERA_DATE_IN_PAST')
  const displayDate = new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${targetDate}T12:00:00.000Z`))
  return { date: targetDate, display: displayDate }
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

  if ([...normalized.matchAll(/\b\d{1,2}[:.]\d{2}\b/g)].length !== 1) throw new HeRaDateTimeError('HERA_DATE_INPUT_INVALID')
  const date = resolveHeRaDate(normalized, now, timeZone, locale)
  const [year, month, day] = date.date.split('-').map(Number)
  if (!year || !month || !day) throw new HeRaDateTimeError('HERA_DATE_INPUT_INVALID')
  const target: ZonedParts = { year, month, day, hour: 0, minute: 0 }
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
