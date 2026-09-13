import type { LeaveAccrualTiming } from './leave-engine'
import { capPartTimeFactor } from '@/lib/employment/fulltime-reference'

export type LeaveEntitlementMode = 'ACCRUAL' | 'UNLIMITED' | 'ANNUAL_HOURS_CAP' | 'ANNUAL_HOURS_FTE_CAP' | 'OVERTIME_HOURS'
export type LeaveTransactionType = 'ACCRUAL' | 'OPENING_BALANCE' | 'MANUAL_ADJUSTMENT' | 'TAKEN' | 'EXPIRED_DEDUCTION'

export type ReportLeaveType = {
  id: string
  name: string
  colorCode: string
  entitlementMode: LeaveEntitlementMode
  annualHoursCap?: number | null
  annualHoursFteCap?: number | null
  partTimeFactor?: number | null
}

export type ReportBucket = {
  id: string
  leaveTypeId: string
  accrualYear: number
  expirationDate: string
  cohortKey?: string | null
  sourceAccrualYear?: number | null
}

export type ReportTransaction = {
  id?: string
  bucketId: string
  leaveTypeId: string
  transactionType: LeaveTransactionType
  amount: number
  transactionDate: string
  reason?: string | null
  actorUserId?: string | null
  actorDisplayName?: string | null
  createdAt?: string | null
  sourceType?: string | null
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
  status: LeaveEntitlementMode
  annualLimit: number | null
  usedAnnualLimit: number | null
  startOfYearBalance: number | null
  currentBalance: number | null
  projectedEndBalance: number | null
  projectedContractEndBalance: number | null
  openingBalance: number | null
  accrual: number | null
  planned: number | null
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
  if (leaveType.entitlementMode === 'ANNUAL_HOURS_FTE_CAP') {
    if (leaveType.annualHoursFteCap === null || leaveType.annualHoursFteCap === undefined || leaveType.partTimeFactor === null || leaveType.partTimeFactor === undefined) return null
    return leaveType.annualHoursFteCap * capPartTimeFactor(leaveType.partTimeFactor)
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
  projectedTaken?: readonly { leaveTypeId: string; amount: number; transactionDate?: string }[]
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
      const plannedTransactions = projectedTaken.filter((item) => item.leaveTypeId === leaveType.id && (!item.transactionDate || item.transactionDate <= (input.employmentEndDate && input.employmentEndDate < `${input.calendarYear}-12-31` ? input.employmentEndDate : `${input.calendarYear}-12-31`)))
      const manualAdjustments = typeTransactions.filter((transaction) => transaction.transactionType === 'MANUAL_ADJUSTMENT' && transaction.transactionDate <= input.asOfDate)
      const currentByBucket = new Map(typeBuckets.map((bucket) => [
        bucket.id,
        sumTransactions(typeTransactions, (transaction) => transaction.bucketId === bucket.id && transaction.transactionDate <= input.asOfDate),
      ]))
      const currentBalance = isUnlimited ? null : sumTransactions(typeTransactions, (transaction) => transaction.transactionDate <= input.asOfDate)
      const startOfYearBalance = isUnlimited ? null : sumTransactions(typeTransactions, (transaction) => transaction.transactionDate < yearStart)
      const expectedAccrual = projectedAccruals.filter((item) => item.leaveTypeId === leaveType.id).reduce((sum, item) => sum + item.amount, 0)
      const expectedTaken = plannedTransactions.reduce((sum, item) => sum + item.amount, 0)
      const projectedEndBalance = isUnlimited || currentBalance === null ? null : currentBalance + expectedAccrual - expectedTaken
      const projectedContractEndBalance = isUnlimited || currentBalance === null || !input.employmentEndDate ? null : currentBalance + expectedAccrual - expectedTaken
      const openingBalance = isUnlimited ? null : sumTransactions(typeTransactions, (transaction) => transaction.transactionType === 'OPENING_BALANCE' && transaction.transactionDate <= input.asOfDate)
      const accrual = isUnlimited ? null : sumTransactions(typeTransactions, (transaction) => transaction.transactionType === 'ACCRUAL' && transaction.transactionDate <= input.asOfDate)
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
        projectedContractEndBalance,
        openingBalance,
        accrual,
        planned: isUnlimited ? null : plannedTransactions.reduce((sum, item) => sum + item.amount, 0),
        carryForwards,
        monthlyAccrualMoments: moments.filter((moment) => moment.leaveTypeId === leaveType.id),
        expirationBuckets,
        manualAdjustments,
        taken,
      }
    }),
  }
}
