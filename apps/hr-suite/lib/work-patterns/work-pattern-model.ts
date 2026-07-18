export type WorkPatternDay = {
  weekIndex: number
  isoWeekday: number
  isWorkingDay: boolean
  startsAt: string | null
  endsAt: string | null
  breakMinutes: number
  scheduledMinutes: number
  note: string | null
}

export type WorkPatternProjection = {
  anchorDate: string
  cycleWeeks: number
  days: readonly WorkPatternDay[]
}

export type WorkPatternValidation = {
  valid: boolean
  averageMinutesPerWeek: number | null
  error: 'INVALID_CYCLE' | 'ANCHOR_NOT_MONDAY' | 'INCOMPLETE_DAYS' | 'INVALID_DAY' | 'FRACTIONAL_AVERAGE' | null
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function isMonday(value: string): boolean {
  return parseDate(value).getUTCDay() === 1
}

export function validateWorkPattern(pattern: WorkPatternProjection): WorkPatternValidation {
  if (!Number.isInteger(pattern.cycleWeeks) || pattern.cycleWeeks < 1 || pattern.cycleWeeks > 4) {
    return { valid: false, averageMinutesPerWeek: null, error: 'INVALID_CYCLE' }
  }
  if (!isMonday(pattern.anchorDate)) {
    return { valid: false, averageMinutesPerWeek: null, error: 'ANCHOR_NOT_MONDAY' }
  }

  const keys = new Set(pattern.days.map((day) => `${day.weekIndex}:${day.isoWeekday}`))
  if (pattern.days.length !== pattern.cycleWeeks * 7 || keys.size !== pattern.cycleWeeks * 7) {
    return { valid: false, averageMinutesPerWeek: null, error: 'INCOMPLETE_DAYS' }
  }

  const hasInvalidDay = pattern.days.some((day) =>
    day.weekIndex < 1 || day.weekIndex > pattern.cycleWeeks || day.isoWeekday < 1 || day.isoWeekday > 7
    || day.scheduledMinutes < 0 || day.scheduledMinutes > 1440
    || (day.isWorkingDay ? day.scheduledMinutes === 0 : day.scheduledMinutes !== 0),
  )
  if (hasInvalidDay) {
    return { valid: false, averageMinutesPerWeek: null, error: 'INVALID_DAY' }
  }

  const totalMinutes = pattern.days.reduce((sum, day) => sum + day.scheduledMinutes, 0)
  if (totalMinutes % pattern.cycleWeeks !== 0) {
    return { valid: false, averageMinutesPerWeek: null, error: 'FRACTIONAL_AVERAGE' }
  }
  return { valid: true, averageMinutesPerWeek: totalMinutes / pattern.cycleWeeks, error: null }
}

export function getPatternDay(pattern: WorkPatternProjection, date: string): WorkPatternDay | null {
  const differenceInDays = Math.floor((parseDate(date).getTime() - parseDate(pattern.anchorDate).getTime()) / 86_400_000)
  const weekOffset = Math.floor(differenceInDays / 7)
  const weekIndex = ((weekOffset % pattern.cycleWeeks) + pattern.cycleWeeks) % pattern.cycleWeeks + 1
  const jsDay = parseDate(date).getUTCDay()
  const isoWeekday = jsDay === 0 ? 7 : jsDay
  return pattern.days.find((day) => day.weekIndex === weekIndex && day.isoWeekday === isoWeekday) ?? null
}
