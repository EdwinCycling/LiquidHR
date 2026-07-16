export type EmploymentStatus =
  | 'NEVER_EMPLOYED'
  | 'FUTURE_EMPLOYEE'
  | 'ACTIVE_EMPLOYEE'
  | 'FORMER_EMPLOYEE'

export interface EmploymentPeriod {
  startsOn: string
  endsOn: string | null
  recordStatus?: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
}

function assertDateOnly(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error('DATE_ONLY_INVALID')
  }
}

export function deriveEmploymentStatus(
  periods: readonly EmploymentPeriod[],
  today: string,
): EmploymentStatus {
  assertDateOnly(today)
  const relevant = periods.filter((period) => period.recordStatus !== 'CANCELLED')
  if (relevant.length === 0) return 'NEVER_EMPLOYED'

  let hasFuture = false
  for (const period of relevant) {
    assertDateOnly(period.startsOn)
    if (period.endsOn) assertDateOnly(period.endsOn)

    if (period.startsOn > today) hasFuture = true
    if (period.startsOn <= today && (period.endsOn === null || period.endsOn >= today)) {
      return 'ACTIVE_EMPLOYEE'
    }
  }

  return hasFuture ? 'FUTURE_EMPLOYEE' : 'FORMER_EMPLOYEE'
}

export function isRehire(periods: readonly EmploymentPeriod[], newStartDate: string): boolean {
  assertDateOnly(newStartDate)
  return periods.some(
    (period) =>
      period.recordStatus !== 'CANCELLED' &&
      period.endsOn !== null &&
      period.endsOn < newStartDate,
  )
}
