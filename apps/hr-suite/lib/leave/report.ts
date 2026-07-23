import type { LeaveAccrualTiming } from './leave-engine'

export type LeaveEntitlementMode = 'ACCRUAL' | 'UNLIMITED' | 'ANNUAL_HOURS_CAP' | 'WEEKLY_HOURS_FACTOR_CAP'
export type LeaveTransactionType = 'ACCRUAL' | 'OPENING_BALANCE' | 'MANUAL_ADJUSTMENT' | 'TAKEN' | 'EXPIRED_DEDUCTION'

export type ReportLeaveType = {
  id: string
  name: string
  colorCode: string
  entitlementMode: LeaveEntitlementMode
  annualHoursCap?: number | null
  weeklyHoursCapFactor?: number | null
  averageHoursPerWeek?: number | null
}

export type ReportBucket = {
  id: string
  leaveTypeId: string
  accrualYear: number
  expirationDate: string
}

export type ReportTransaction = {
  bucketId: string
  leaveTypeId: string
  transactionType: LeaveTransactionType
  amount: number
  transactionDate: string
  reason?: string | null
  actorUserId?: string | null
}

export type ReportCarryForward = {
  sourceBucketId: string
  sourceAccrualYear: number
  carriedHours: number
  expirationDate: string
}

export type ReportAccrualMoment = {
  leaveTypeId: string
  month: number
  bookingDate: string
  expectedHours: number
  timing: LeaveAccrualTiming
  actualHours?: number
  ruleId?: string
}

export type LeaveBalanceReport = {
  employmentId: string
  calendarYear: number
  asOfDate: string
  leaveTypes: LeaveTypeBalanceReport[]
}

export type LeaveTypeBalanceReport = ReportLeaveType & {
  leaveTypeId: string
  status: 'ACCRUAL' | 'UNLIMITED' | 'ANNUAL_HOURS_CAP' | 'WEEKLY_HOURS_FACTOR_CAP'
  annualLimit: number | null
  usedAnnualLimit: number | null
  startOfYearBalance: number | null
  currentBalance: number | null
  projectedEndBalance: number | null
  carryForwards: Array<ReportCarryForward & { currentHours: number }>
  monthlyAccrualMoments: ReportAccrualMoment[]
  expirationBuckets: Array<ReportBucket & { remainingHours: number; daysUntilExpiration: number }>
  manualAdjustments: ReportTransaction[]
  taken: ReportTransaction[]
}

function utcDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new RangeError('Invalid date: ' + value)
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

function differenceInDays(later: string, earlier: string): number {
  return Math.round((utcDate(later).getTime() - utcDate(earlier).getTime()) / 86_400_000)
}

function sumTransactions(transactions: readonly ReportTransaction[], predicate: (transaction: ReportTransaction) => boolean): number {
  return transactions.filter(predicate).reduce((sum, transaction) => sum + transaction.amount, 0)
}

function annualLimitForType(leaveType: ReportLeaveType): number | null {
  if (leaveType.entitlementMode === 'ANNUAL_HOURS_CAP') return leaveType.annualHoursCap ?? null
  if (leaveType.entitlementMode === 'WEEKLY_HOURS_FACTOR_CAP') {
    if (leaveType.averageHoursPerWeek === null || leaveType.averageHoursPerWeek === undefined || leaveType.weeklyHoursCapFactor === null || leaveType.weeklyHoursCapFactor === undefined) return null
    return leaveType.averageHoursPerWeek * leaveType.weeklyHoursCapFactor
  }
  return null
}

export function calculateLeaveBalanceReport(input: {
  employmentId: string
  calendarYear: number
  asOfDate: string
  employmentEndDate?: string | null
  leaveTypes: readonly ReportLeaveType[]
  buckets: readonly ReportBucket[]
  transactions: readonly ReportTransaction[]
  carryForwards: readonly ReportCarryForward[]
  projectedAccruals?: readonly { leaveTypeId: string; amount: number }[]
  projectedTaken?: readonly { leaveTypeId: string; amount: number }[]
  monthlyAccrualMoments?: readonly ReportAccrualMoment[]
}): LeaveBalanceReport {
  const yearStart = String(input.calendarYear) + '-01-01'
  const projectedAccruals = input.projectedAccruals ?? []
  const projectedTaken = input.projectedTaken ?? []
  const moments = input.monthlyAccrualMoments ?? []

  return {
    employmentId: input.employmentId,
    calendarYear: input.calendarYear,
    asOfDate: input.asOfDate,
    leaveTypes: input.leaveTypes.map((leaveType) => {
      const typeTransactions = input.transactions.filter((transaction) => transaction.leaveTypeId === leaveType.id)
      const typeBuckets = input.buckets.filter((bucket) => bucket.leaveTypeId === leaveType.id)
      const isUnlimited = leaveType.entitlementMode === 'UNLIMITED'
      const isAccrual = leaveType.entitlementMode === 'ACCRUAL'
      const annualLimit = annualLimitForType(leaveType)
      const taken = typeTransactions.filter((transaction) => transaction.transactionType === 'TAKEN' && transaction.transactionDate <= input.asOfDate)
      const manualAdjustments = typeTransactions.filter((transaction) => transaction.transactionType === 'MANUAL_ADJUSTMENT' && transaction.transactionDate <= input.asOfDate)
      const currentByBucket = new Map(typeBuckets.map((bucket) => [
        bucket.id,
        sumTransactions(typeTransactions, (transaction) => transaction.bucketId === bucket.id && transaction.transactionDate <= input.asOfDate),
      ]))
      const currentBalance = isUnlimited ? null : sumTransactions(typeTransactions, (transaction) => transaction.transactionDate <= input.asOfDate)
      const startOfYearBalance = isUnlimited ? null : sumTransactions(typeTransactions, (transaction) => transaction.transactionDate < yearStart)
      const expectedAccrual = projectedAccruals.filter((item) => item.leaveTypeId === leaveType.id).reduce((sum, item) => sum + item.amount, 0)
      const expectedTaken = projectedTaken.filter((item) => item.leaveTypeId === leaveType.id).reduce((sum, item) => sum + item.amount, 0)
      const projectedEndBalance = isUnlimited || currentBalance === null ? null : currentBalance + expectedAccrual - expectedTaken
      const usedAnnualLimit = annualLimit === null ? null : Math.max(0, -sumTransactions(taken, (transaction) => transaction.amount < 0))
      const carryForwards = input.carryForwards
        .filter((carry) => typeBuckets.some((bucket) => bucket.id === carry.sourceBucketId) && carry.carriedHours > 0)
        .map((carry) => ({ ...carry, currentHours: currentByBucket.get(carry.sourceBucketId) ?? 0 }))
      const expirationBuckets = isAccrual
        ? typeBuckets
          .map((bucket) => ({ ...bucket, remainingHours: currentByBucket.get(bucket.id) ?? 0, daysUntilExpiration: differenceInDays(bucket.expirationDate, input.asOfDate) }))
          .filter((bucket) => bucket.remainingHours > 0)
        : []

      return {
        ...leaveType,
        leaveTypeId: leaveType.id,
        status: leaveType.entitlementMode,
        annualLimit,
        usedAnnualLimit,
        startOfYearBalance,
        currentBalance,
        projectedEndBalance,
        carryForwards,
        monthlyAccrualMoments: moments.filter((moment) => moment.leaveTypeId === leaveType.id),
        expirationBuckets,
        manualAdjustments,
        taken,
      }
    }),
  }
}
