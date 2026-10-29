export interface AbsenceRollingDateRange {
  startDate: string
  endDate: string
}

const DAY_IN_MILLISECONDS = 86_400_000
const ROLLING_ABSENCE_DAYS = 365

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Both absence frequency reports use the same inclusive, UTC calendar-day window. */
export function getAbsenceRollingDateRange(today: Date = new Date()): AbsenceRollingDateRange {
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const start = new Date(end.getTime())
  start.setUTCDate(start.getUTCDate() - (ROLLING_ABSENCE_DAYS - 1))
  return { startDate: isoDate(start), endDate: isoDate(end) }
}

export { DAY_IN_MILLISECONDS, ROLLING_ABSENCE_DAYS }
