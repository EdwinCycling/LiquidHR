import { FixedDecimal } from '@liquid-hr/payroll-engine'

const WORKDAYS_PER_WEEK = 5
const MAX_COMPOSITE_WEEKS = 53
const MAX_COMPOSITE_DAILY_DAYS = 8

export interface Nl2026PeriodSegments {
  readonly periodStart: string
  readonly periodEndExclusive: string
  readonly paidStart: string
  readonly paidEndExclusive: string
  readonly periodWorkdays: number
  readonly paidWorkdays: number
  readonly fullWeeks: number
  readonly remainingDays: number
}

export interface Nl2026CompositePeriod {
  readonly fullWeeks: number
  readonly remainingDays: number
}

function epochDay(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) throw new RangeError('An ISO calendar date is required.')
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const value = Date.UTC(year, month - 1, day)
  const parsed = new Date(value)
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new RangeError('An ISO calendar date is required.')
  }
  return Math.floor(value / 86_400_000)
}

function isoDate(epoch: number): string {
  return new Date(epoch * 86_400_000).toISOString().slice(0, 10)
}

export function countDutchWorkdays(start: string, endExclusive: string): number {
  const startDay = epochDay(start)
  const endDay = epochDay(endExclusive)
  if (endDay < startDay) throw new RangeError('The period end must not precede the period start.')
  let count = 0
  for (let current = startDay; current < endDay; current += 1) {
    const weekday = new Date(current * 86_400_000).getUTCDay()
    if (weekday >= 1 && weekday <= 5) count += 1
  }
  return count
}

function countDutchWorkdaySegments(startDay: number, endDay: number): {
  readonly paidWorkdays: number
  readonly fullWeeks: number
  readonly remainingDays: number
} {
  const workdaysByWeekStart = new Map<number, number>()
  let paidWorkdays = 0
  for (let current = startDay; current < endDay; current += 1) {
    const weekday = new Date(current * 86_400_000).getUTCDay()
    if (weekday < 1 || weekday > 5) continue
    paidWorkdays += 1
    const monday = current - ((weekday + 6) % 7)
    workdaysByWeekStart.set(monday, (workdaysByWeekStart.get(monday) ?? 0) + 1)
  }

  let fullWeeks = 0
  let remainingDays = 0
  for (const workdays of workdaysByWeekStart.values()) {
    if (workdays === WORKDAYS_PER_WEEK) fullWeeks += 1
    else remainingDays += workdays
  }
  return { paidWorkdays, fullWeeks, remainingDays }
}

export function calculateNl2026PeriodSegments(input: {
  readonly periodStart: string
  readonly periodEndExclusive: string
  readonly paidStart: string
  readonly paidEndExclusive: string
}): Nl2026PeriodSegments {
  const periodStartDay = epochDay(input.periodStart)
  const periodEndDay = epochDay(input.periodEndExclusive)
  const paidStartDay = epochDay(input.paidStart)
  const paidEndDay = epochDay(input.paidEndExclusive)
  if (periodEndDay <= periodStartDay || paidEndDay <= paidStartDay
    || paidStartDay < periodStartDay || paidEndDay > periodEndDay) {
    throw new RangeError('The paid period must be a non-empty slice within the payroll period.')
  }
  const periodWorkdays = countDutchWorkdays(input.periodStart, input.periodEndExclusive)
  const paidSegments = countDutchWorkdaySegments(paidStartDay, paidEndDay)
  const paidWorkdays = paidSegments.paidWorkdays
  if (periodWorkdays <= 0 || paidWorkdays <= 0 || paidWorkdays > periodWorkdays) {
    throw new RangeError('The paid period must contain at least one Dutch workday.')
  }
  return {
    periodStart: input.periodStart,
    periodEndExclusive: input.periodEndExclusive,
    paidStart: input.paidStart,
    paidEndExclusive: input.paidEndExclusive,
    periodWorkdays,
    paidWorkdays,
    fullWeeks: paidSegments.fullWeeks,
    remainingDays: paidSegments.remainingDays,
  }
}

export function encodeNl2026CompositeTimePeriod(period: Nl2026CompositePeriod): string {
  if (!Number.isInteger(period.fullWeeks) || period.fullWeeks < 0 || period.fullWeeks > MAX_COMPOSITE_WEEKS
    || !Number.isInteger(period.remainingDays) || period.remainingDays < 0 || period.remainingDays > MAX_COMPOSITE_DAILY_DAYS
    || period.fullWeeks * WORKDAYS_PER_WEEK + period.remainingDays <= 0) {
    throw new RangeError('The composite Dutch 2026 time period is invalid.')
  }
  return `WEEK_DAY_${period.fullWeeks}_${period.remainingDays}`
}

/**
 * A broken monthly time period with at least 65/3 table days uses the monthly
 * table. Since the source count is an integer, the first qualifying count is 22.
 */
export function shouldUseDutchMonthlyTableForBrokenPeriod(paidWorkdays: number): boolean {
  if (!Number.isInteger(paidWorkdays) || paidWorkdays <= 0) {
    throw new RangeError('The paid workday count must be a positive integer.')
  }
  return paidWorkdays * 3 >= 65
}

export function parseNl2026CompositeTimePeriod(value: string): Nl2026CompositePeriod | null {
  const match = /^WEEK_DAY_(\d+)_(\d+)$/.exec(value)
  if (!match) return null
  const fullWeeks = Number(match[1])
  const remainingDays = Number(match[2])
  if (!Number.isSafeInteger(fullWeeks) || !Number.isSafeInteger(remainingDays)) return null
  try {
    encodeNl2026CompositeTimePeriod({ fullWeeks, remainingDays })
  } catch {
    return null
  }
  return { fullWeeks, remainingDays }
}

export function prorateMonthlySalary(
  monthlyAmount: FixedDecimal,
  paidWorkdays: number,
  periodWorkdays: number,
): FixedDecimal {
  if (!Number.isInteger(paidWorkdays) || !Number.isInteger(periodWorkdays)
    || paidWorkdays <= 0 || periodWorkdays <= 0 || paidWorkdays > periodWorkdays) {
    throw new RangeError('The workday proration is invalid.')
  }
  return monthlyAmount
    .multiply(FixedDecimal.fromInteger(BigInt(paidWorkdays)))
    .divideToScale(FixedDecimal.fromInteger(BigInt(periodWorkdays)), 2, 'ARITHMETIC')
}

export function compositePaidWorkdays(period: Nl2026CompositePeriod): number {
  return period.fullWeeks * WORKDAYS_PER_WEEK + period.remainingDays
}

export function isoDateAfter(date: string): string {
  return isoDate(epochDay(date) + 1)
}
