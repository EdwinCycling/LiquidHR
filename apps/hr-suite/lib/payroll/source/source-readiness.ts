import { FixedDecimal } from '@liquid-hr/payroll-engine'
import { partTimeFactorMatchesHours, partTimeMonthlySalaryFromHours, type PayrollDecimalInput } from './part-time-reconciliation'

export type PayrollSourceReadinessStatus = 'READY' | 'MISSING' | 'CONFLICT' | 'UNVERIFIED'

export type EffectiveSourceVersion = {
  readonly id: string
  readonly version: string
  readonly validFrom: string
  readonly validUntilExclusive: string | null
}
export type EffectiveSourceCoverage = {
  readonly status: PayrollSourceReadinessStatus
  readonly rows: readonly EffectiveSourceVersion[]
}

export function canReviewPayrollSourceReadiness(context: {
  readonly activeRoles: readonly string[]
  readonly permissions: readonly string[]
}): boolean {
  return (context.activeRoles.includes('HR_ADMIN') || context.activeRoles.includes('TENANT_ADMIN'))
    && context.permissions.includes('salary:read')
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Checks source coverage and version presence only; it never derives a payroll amount. */
export function assessEffectiveSourceCoverage(
  inputRows: readonly EffectiveSourceVersion[],
  periodStart: string,
  periodEndExclusive: string,
): EffectiveSourceCoverage {
  if (!validDate(periodStart) || !validDate(periodEndExclusive) || periodEndExclusive <= periodStart) {
    return { status: 'CONFLICT', rows: [] }
  }

  const rows = inputRows.filter((row) => {
    if (!validDate(row.validFrom)
      || (row.validUntilExclusive !== null && !validDate(row.validUntilExclusive))
      || (row.validUntilExclusive !== null && row.validUntilExclusive <= row.validFrom)) return true
    return row.validFrom < periodEndExclusive
      && (row.validUntilExclusive === null || row.validUntilExclusive > periodStart)
  }).sort((left, right) => left.validFrom.localeCompare(right.validFrom) || left.id.localeCompare(right.id))

  if (rows.some((row) => !validDate(row.validFrom)
    || (row.validUntilExclusive !== null && (!validDate(row.validUntilExclusive) || row.validUntilExclusive <= row.validFrom)))) {
    return { status: 'CONFLICT', rows }
  }
  if (rows.length === 0) return { status: 'MISSING', rows }

  let cursor = periodStart
  let previousEnd: string | null = null
  let hasMissingVersion = false
  for (const row of rows) {
    if (previousEnd !== null && row.validFrom < previousEnd) return { status: 'CONFLICT', rows }
    if (row.validFrom > cursor) return { status: 'MISSING', rows }
    if (!row.id.trim() || !row.version.trim() || row.version === 'MISSING') hasMissingVersion = true
    const end = row.validUntilExclusive ?? '9999-12-31'
    if (end > cursor) cursor = end
    previousEnd = end
  }
  if (cursor < periodEndExclusive) return { status: 'MISSING', rows }
  return { status: hasMissingVersion ? 'UNVERIFIED' : 'READY', rows }
}

/**
 * Compares a persisted CAO monthly amount with the persisted roster factor as a source-consistency check.
 * This does not create or return a payroll amount.
 */
export function caoSalaryScheduleConflict(input: {
  readonly salaryBasis: string
  readonly paymentType: string
  readonly paymentFrequency: string
  readonly fulltimeAmount: PayrollDecimalInput | null
  readonly parttimeAmount: PayrollDecimalInput | null
  readonly partTimeFactor: PayrollDecimalInput | null
  readonly averageHoursPerWeek: PayrollDecimalInput | null
  readonly fulltimeHoursPerWeek: PayrollDecimalInput | null
}): boolean {
  if (input.salaryBasis !== 'CAO_SCALE' || input.paymentType !== 'PERIODIC_FIXED'
    || input.paymentFrequency !== 'MONTHLY' || input.fulltimeAmount === null
    || input.parttimeAmount === null || input.partTimeFactor === null
    || input.averageHoursPerWeek === null || input.fulltimeHoursPerWeek === null) return false
  try {
    if (!partTimeFactorMatchesHours(input.averageHoursPerWeek, input.fulltimeHoursPerWeek, input.partTimeFactor)) return true
    const expectedParttime = partTimeMonthlySalaryFromHours(
      input.fulltimeAmount, input.averageHoursPerWeek, input.fulltimeHoursPerWeek,
    )
    const storedParttime = FixedDecimal.parse(String(input.parttimeAmount)).round(2, 'HALF_UP')
    return expectedParttime.compare(storedParttime) !== 0
  } catch {
    return true
  }
}
