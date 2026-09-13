import { capPartTimeFactor } from '@/lib/employment/fulltime-reference'

export type LeaveAccrualTiming = 'UPFRONT' | 'ARREARS'
export type LeaveAccrualFrequency = 'PAYROLL_PERIOD' | 'FOUR_WEEKLY' | 'MONTHLY' | 'YEARLY'
export type LeavePayrollFrequency = 'MONTHLY' | 'FOUR_WEEKLY'
export type LeaveWorkHourCategory = 'REGULAR_WORK' | 'OVERTIME' | 'INFORMATIONAL'
export type LeaveWorkHourStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED'
export type BonusAwardTiming = 'START_OF_YEAR' | 'ON_TRIGGER_DATE'
export type BonusTriggerType = 'AGE' | 'SENIORITY'

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

export function addDays(value: string, days: number): string {
  const result = utcDate(value)
  result.setUTCDate(result.getUTCDate() + days)
  return formatDate(result)
}

export type LeaveAccrualPeriod = { start: string; end: string }

export type MigrationStartBalanceTransaction = {
  employmentId: string
  leaveTypeId: string
  transactionType: string
  sourceType: string
  transactionDate: string
}

export type LeaveAccrualLedgerTransaction = {
  transactionType: string
  sourceType: string
  sourceKey: string | null
  amount: number
}

export function generateAccrualPeriods(input: {
  calendarYear: number
  frequency: LeaveAccrualFrequency
  payrollFrequency?: LeavePayrollFrequency | null
}): LeaveAccrualPeriod[] {
  const frequency = input.frequency === 'PAYROLL_PERIOD'
    ? (input.payrollFrequency ?? (() => { throw new LeaveEngineError('LEAVE_PAYROLL_FREQUENCY_REQUIRED') })())
    : input.frequency
  const yearStart = `${input.calendarYear}-01-01`
  const yearEnd = `${input.calendarYear + 1}-01-01`

  if (frequency === 'YEARLY') return [{ start: yearStart, end: yearEnd }]
  if (frequency === 'MONTHLY') {
    return Array.from({ length: 12 }, (_, index) => {
      const start = addMonths(yearStart, index)
      return { start, end: addMonths(start, 1) }
    })
  }

  return Array.from({ length: 13 }, (_, index) => {
    const start = addDays(yearStart, index * 28)
    return { start, end: addDays(start, 28) }
  })
}

export function roundAccrualHours(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Number(value.toFixed(4))
}

function addMonths(value: string, months: number): string {
  const result = utcDate(value)
  result.setUTCMonth(result.getUTCMonth() + months)
  return formatDate(result)
}

export function countCalendarDays(start: string, endExclusive: string): number {
  const startDate = utcDate(start)
  const endDate = utcDate(endExclusive)
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000))
}

export function clipAccrualSliceToCutover(input: {
  sliceStart: string
  sliceEnd: string
  cutoverDate: string | null
}): LeaveAccrualPeriod | null {
  const start = input.cutoverDate && input.cutoverDate > input.sliceStart ? input.cutoverDate : input.sliceStart
  return start < input.sliceEnd ? { start, end: input.sliceEnd } : null
}

export function getMigrationCutoverDate(
  transactions: readonly MigrationStartBalanceTransaction[],
  employmentId: string,
  leaveTypeId: string,
): string | null {
  return transactions
    .filter((transaction) => transaction.employmentId === employmentId
      && transaction.leaveTypeId === leaveTypeId
      && transaction.transactionType === 'OPENING_BALANCE'
      && transaction.sourceType === 'MIGRATION_START_BALANCE')
    .map((transaction) => transaction.transactionDate)
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()[0] ?? null
}

export function getPostedAutomaticAccrualAmounts(
  transactions: readonly LeaveAccrualLedgerTransaction[],
): Map<string, number> {
  const amounts = new Map<string, number>()
  for (const transaction of transactions) {
    if (transaction.transactionType !== 'ACCRUAL' || transaction.sourceType !== 'LEAVE_ACCRUAL' || !transaction.sourceKey) continue
    const separator = transaction.sourceKey.lastIndexOf(':')
    if (separator <= 0) continue
    const baseKey = transaction.sourceKey.slice(0, separator)
    const amount = Number(transaction.amount)
    if (!Number.isFinite(amount)) continue
    amounts.set(baseKey, (amounts.get(baseKey) ?? 0) + amount)
  }
  return amounts
}

function periodsPerYear(frequency: LeaveAccrualFrequency, payrollFrequency?: LeavePayrollFrequency | null): number {
  if (frequency === 'PAYROLL_PERIOD') {
    if (!payrollFrequency) throw new LeaveEngineError('LEAVE_PAYROLL_FREQUENCY_REQUIRED')
    return payrollFrequency === 'MONTHLY' ? 12 : 13
  }
  if (frequency === 'FOUR_WEEKLY') return 13
  if (frequency === 'MONTHLY') return 12
  return 1
}

export function getContractAccrualPeriodEntitlement(input: {
  annualEntitlement: number
  frequency: LeaveAccrualFrequency
  payrollFrequency?: LeavePayrollFrequency | null
}): number {
  if (!Number.isFinite(input.annualEntitlement)) return 0
  return input.annualEntitlement / periodsPerYear(input.frequency, input.payrollFrequency)
}

export function calculateContractAccrual(input: {
  fullPeriodStart: string
  fullPeriodEnd: string
  sliceStart: string
  sliceEnd: string
  annualEntitlement: number
  frequency: LeaveAccrualFrequency
  payrollFrequency?: LeavePayrollFrequency | null
  partTimeFactor: number
  employmentValid?: boolean
}): number {
  if (input.employmentValid === false) return 0
  const fullPeriodDays = countCalendarDays(input.fullPeriodStart, input.fullPeriodEnd)
  if (fullPeriodDays === 0) return 0
  const sliceStart = input.sliceStart < input.fullPeriodStart ? input.fullPeriodStart : input.sliceStart
  const sliceEnd = input.sliceEnd > input.fullPeriodEnd ? input.fullPeriodEnd : input.sliceEnd
  const sliceDays = countCalendarDays(sliceStart, sliceEnd)
  if (sliceDays === 0) return 0
  const periodDays = input.frequency === 'FOUR_WEEKLY'
    || (input.frequency === 'PAYROLL_PERIOD' && input.payrollFrequency === 'FOUR_WEEKLY')
    ? 28
    : fullPeriodDays
  return getContractAccrualPeriodEntitlement({
    annualEntitlement: input.annualEntitlement,
    frequency: input.frequency,
    payrollFrequency: input.payrollFrequency,
  }) * (sliceDays / periodDays) * capPartTimeFactor(input.partTimeFactor)
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
  payrollFrequency?: LeavePayrollFrequency | null
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
  const fullAward = input.bonusAmount * capPartTimeFactor(input.partTimeFactor)
  if (input.awardTiming === 'START_OF_YEAR' || input.triggerDate < yearStart || !input.proRateFirstYear) return fullAward
  const remainingDays = Math.round((utcDate(yearEnd).getTime() - utcDate(input.triggerDate).getTime()) / 86_400_000)
  return fullAward * (remainingDays / daysInYear(input.calendarYear))
}

function yearsAtDate(baseDate: string, asOfDate: string): number {
  const base = parseDate(baseDate)
  const asOf = parseDate(asOfDate)
  let years = asOf.year - base.year
  if (asOf.month < base.month || (asOf.month === base.month && asOf.day < base.day)) years -= 1
  return Math.max(0, years)
}

export function calculateBonusAccrualForYear(input: {
  calendarYear: number
  baseDate: string | null
  triggerType: BonusTriggerType
  tiers: readonly { thresholdYears: number; bonusAmount: number }[]
  awardTiming: BonusAwardTiming
  proRateFirstYear: boolean
  partTimeFactor: number
}): { amount: number; thresholdYears: number; achievedYears: number; triggerDate: string; reason: string } | null {
  if (!input.baseDate) return null
  const achievedYears = yearsAtDate(input.baseDate, String(input.calendarYear) + '-12-31')
  const tier = selectBonusTier(achievedYears, input.tiers)
  if (!tier) return null
  const baseYear = parseDate(input.baseDate).year
  const triggerDate = resolveAnnualTriggerDate(input.baseDate, baseYear + tier.thresholdYears)
  const amount = calculateBonusAward({ ...input, triggerDate, bonusAmount: tier.bonusAmount })
  if (amount <= 0) return null
  const label = input.triggerType === 'AGE' ? 'Leeftijdsbonus' : 'Anciënniteitsbonus'
  return { amount, thresholdYears: tier.thresholdYears, achievedYears, triggerDate, reason: `${label} (${achievedYears} jaar)` }
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
