import { FixedDecimal } from '@liquid-hr/payroll-engine'

export type PayrollDecimalInput = number | string

const PART_TIME_FACTOR_SCALE = 4

export function partTimeFactorMatchesHours(
  averageHoursPerWeek: PayrollDecimalInput,
  fulltimeHoursPerWeek: PayrollDecimalInput,
  storedFactor: PayrollDecimalInput,
): boolean {
  const averageHours = FixedDecimal.parse(String(averageHoursPerWeek))
  const fulltimeHours = FixedDecimal.parse(String(fulltimeHoursPerWeek))
  const factor = FixedDecimal.parse(String(storedFactor))
  const zero = FixedDecimal.fromInteger(BigInt(0))
  const one = FixedDecimal.fromInteger(BigInt(1))

  if (averageHours.compare(zero) <= 0 || fulltimeHours.compare(zero) <= 0
    || factor.compare(zero) <= 0 || factor.compare(one) > 0) return false

  const hoursRatio = averageHours.divide(fulltimeHours, PART_TIME_FACTOR_SCALE, 'HALF_UP')
  return factor.round(PART_TIME_FACTOR_SCALE, 'HALF_UP').compare(hoursRatio) === 0
}

export function partTimeMonthlySalaryFromHours(
  fulltimeMonthlySalary: PayrollDecimalInput,
  averageHoursPerWeek: PayrollDecimalInput,
  fulltimeHoursPerWeek: PayrollDecimalInput,
): FixedDecimal {
  return FixedDecimal.parse(String(fulltimeMonthlySalary))
    .multiply(FixedDecimal.parse(String(averageHoursPerWeek)))
    .divide(FixedDecimal.parse(String(fulltimeHoursPerWeek)), 2, 'HALF_UP')
}
