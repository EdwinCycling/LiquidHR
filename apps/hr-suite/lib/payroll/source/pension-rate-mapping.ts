import { FixedDecimal } from '@liquid-hr/payroll-engine'
import type { PensionArrangementInput, PensionCalculationResult } from '@liquid-hr/payroll-rules-nl-2026'

type PensionRateArrangement = Pick<PensionArrangementInput,
  'arrangementType' | 'flatTotalRate' | 'employeeSharePercent' | 'employerSharePercent'>

type TypedPensionRates = {
  readonly totalRate: string
  readonly employeeRate: string
  readonly employerRate: string
}

export type PensionComponentRates = {
  readonly totalRate: string | null
  readonly employeeRate: string | null
  readonly employerRate: string | null
}

function deriveShareRate(totalRate: string | null, sharePercent: string | undefined): string | null {
  if (!totalRate || !sharePercent) return null
  try {
    return FixedDecimal.parse(totalRate)
      .multiply(FixedDecimal.parse(sharePercent))
      .divideToScale(FixedDecimal.parse('100'), 8, 'ARITHMETIC')
      .round(4, 'HALF_UP')
      .toString(4)
  } catch {
    return null
  }
}

/** Resolve employer and employee component rates from the effective total rate and source shares. */
export function resolvePensionComponentRates(
  arrangement: PensionRateArrangement | null,
  pensionResult: Pick<PensionCalculationResult, 'status' | 'rate'> | null,
  typedRates: TypedPensionRates | null = null,
): PensionComponentRates {
  const progressiveRate = arrangement?.arrangementType === 'PROGRESSIVE_PREMIUM'
    && pensionResult?.status === 'CALCULATED'
    ? pensionResult.rate
    : null
  const totalRate = typedRates?.totalRate
    ?? (arrangement?.arrangementType === 'PROGRESSIVE_PREMIUM'
      ? progressiveRate
      : arrangement?.flatTotalRate ?? null)
  return {
    totalRate,
    employeeRate: typedRates?.employeeRate
      ?? deriveShareRate(totalRate, arrangement?.employeeSharePercent),
    employerRate: typedRates?.employerRate
      ?? deriveShareRate(totalRate, arrangement?.employerSharePercent),
  }
}
