export type LeaveAccrualTiming = 'UPFRONT' | 'ARREARS'
export type LeaveAccrualFrequency = 'PAYROLL_PERIOD' | 'YEARLY'
export type LeaveWorkHourCategory = 'REGULAR_WORK' | 'OVERTIME' | 'INFORMATIONAL'
export type LeaveWorkHourStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED'
export type BonusAwardTiming = 'START_OF_YEAR' | 'ON_TRIGGER_DATE'

export class LeaveEngineError extends Error {
  constructor(public readonly code: 'LEAVE_PAYROLL_FREQUENCY_REQUIRED' | 'LEAVE_FEBRUARY_29_POLICY_REQUIRED') {
    super(code)
    this.name = 'LeaveEngineError'
  }
}

type DateParts = { year: number; month: number; day: number }

function parseDate(value: string): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new RangeError('Invalid date: ' + value)
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

function utcDate(value: string): Date {
  const parts = parseDate(value)
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function addDays(value: string, days: number): string {
  const result = utcDate(value)
  result.setUTCDate(result.getUTCDate() + days)
  return formatDate(result)
}

function addMonths(value: string, months: number): string {
  const result = utcDate(value)
  result.setUTCMonth(result.getUTCMonth() + months)
  return formatDate(result)
}

function isWeekday(value: Date): boolean {
  const day = value.getUTCDay()
  return day >= 1 && day <= 5
}

export function countWeekdays(start: string, endExclusive: string): number {
  const startDate = utcDate(start)
  const endDate = utcDate(endExclusive)
  let count = 0
  for (const cursor = new Date(startDate); cursor < endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (isWeekday(cursor)) count += 1
  }
  return count
}

export function calculateContractAccrual(input: {
  fullPeriodStart: string
  fullPeriodEnd: string
  sliceStart: string
  sliceEnd: string
  accrualAmount: number
  partTimeFactor: number
  employmentValid?: boolean
}): number {
  if (input.employmentValid === false) return 0
  const fullPeriodWeekdays = countWeekdays(input.fullPeriodStart, input.fullPeriodEnd)
  if (fullPeriodWeekdays === 0) return 0
  const sliceWeekdays = countWeekdays(input.sliceStart, input.sliceEnd)
  return (sliceWeekdays / fullPeriodWeekdays) * input.accrualAmount * input.partTimeFactor
}

export function calculateWorkedHoursAccrual(input: {
  hours: number
  accrualRate: number
  status: LeaveWorkHourStatus
  category: LeaveWorkHourCategory
  employmentValid?: boolean
}): number {
  if (input.employmentValid === false) return 0
  if (input.status !== 'APPROVED') return 0
  if (input.category !== 'REGULAR_WORK' && input.category !== 'OVERTIME') return 0
  return input.hours * input.accrualRate
}

export function applyAccrualPause(input: {
  baseAccrual: number
  plannedHours: number
  pausedHours: number
}): number {
  if (input.baseAccrual <= 0 || input.plannedHours <= 0) return 0
  const pauseRatio = Math.min(1, Math.max(0, input.pausedHours / input.plannedHours))
  return input.baseAccrual * (1 - pauseRatio)
}

export function getPeriodBookingDate(input: {
  periodStart: string
  periodEnd: string
  timing: LeaveAccrualTiming
  frequency?: LeaveAccrualFrequency
  payrollFrequency?: 'MONTHLY' | 'FOUR_WEEKLY' | null
}): string {
  if (input.frequency === 'PAYROLL_PERIOD' && !input.payrollFrequency) throw new LeaveEngineError('LEAVE_PAYROLL_FREQUENCY_REQUIRED')
  return input.timing === 'UPFRONT' ? input.periodStart : addDays(input.periodEnd, -1)
}

export function expirationDateForAccrualYear(accrualYear: number, expirationMonths: number): string {
  if (!Number.isInteger(accrualYear) || expirationMonths < 0 || !Number.isInteger(expirationMonths)) {
    throw new RangeError('Invalid expiration configuration')
  }
  return addMonths(String(accrualYear + 1) + '-01-01', expirationMonths)
}

export function resolveAnnualTriggerDate(baseDate: string, calendarYear: number): string {
  const parts = parseDate(baseDate)
  if (parts.month === 2 && parts.day === 29) {
    const isLeapYear = calendarYear % 4 === 0 && (calendarYear % 100 !== 0 || calendarYear % 400 === 0)
    if (!isLeapYear) throw new LeaveEngineError('LEAVE_FEBRUARY_29_POLICY_REQUIRED')
  }
  return String(calendarYear) + '-' + String(parts.month).padStart(2, '0') + '-' + String(parts.day).padStart(2, '0')
}

export function selectBonusTier(
  achievedYears: number,
  tiers: readonly { thresholdYears: number; bonusAmount: number }[],
): { thresholdYears: number; bonusAmount: number } | null {
  return [...tiers]
    .filter((tier) => tier.thresholdYears <= achievedYears)
    .sort((left, right) => right.thresholdYears - left.thresholdYears)[0] ?? null
}

function daysInYear(calendarYear: number): number {
  return Math.round((utcDate(String(calendarYear + 1) + '-01-01').getTime() - utcDate(String(calendarYear) + '-01-01').getTime()) / 86_400_000)
}

export function calculateBonusAward(input: {
  calendarYear: number
  triggerDate: string
  bonusAmount: number
  partTimeFactor: number
  awardTiming: BonusAwardTiming
  proRateFirstYear: boolean
}): number {
  const yearStart = String(input.calendarYear) + '-01-01'
  const yearEnd = String(input.calendarYear + 1) + '-01-01'
  if (input.triggerDate >= yearEnd) return 0
  const fullAward = input.bonusAmount * input.partTimeFactor
  if (input.awardTiming === 'START_OF_YEAR' || input.triggerDate < yearStart || !input.proRateFirstYear) return fullAward
  const remainingDays = Math.round((utcDate(yearEnd).getTime() - utcDate(input.triggerDate).getTime()) / 86_400_000)
  return fullAward * (remainingDays / daysInYear(input.calendarYear))
}

export type FifoBucket = {
  id: string
  accrualYear: number
  expirationDate: string
  remainingHours: number
}

export function sortBucketsForFifo(buckets: readonly FifoBucket[]): FifoBucket[] {
  return [...buckets].sort((left, right) =>
    left.expirationDate.localeCompare(right.expirationDate)
    || left.accrualYear - right.accrualYear
    || left.id.localeCompare(right.id),
  )
}
