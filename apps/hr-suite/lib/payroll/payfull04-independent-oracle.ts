/**
 * Independent fixed reference for the October 2026 broken-period tax case.
 * This module deliberately imports no payroll engine, rule package, or source
 * provider code.
 */

export const PAYFULL04_NOAH_ORACLE_SOURCE = {
  whiteWeekTable: 'https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_wk_nl_std_20260101.pdf',
  whiteDayTable: 'https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_dag_nl_std_20260101.pdf',
  tableVersion: '2026-01-01',
} as const

export interface Payfull04NoahOracleResult {
  readonly source: typeof PAYFULL04_NOAH_ORACLE_SOURCE
  readonly grossAmount: string
  readonly taxableWage: string
  readonly fullWeeks: number
  readonly remainingDays: number
  readonly weeklyTableWage: string
  readonly weeklyWageTax: string
  readonly dailyTableWage: string
  readonly dailyWageTax: string
  readonly wageTax: string
  readonly netBeforePension: string
}

/**
 * The published table cells used by the composite 2-week/1-day calculation.
 * Values are kept as cents so this oracle has no floating-point arithmetic.
 */
export function derivePayfull04NoahOracle(): Payfull04NoahOracleResult {
  const grossCents = 175_850
  const weeklyTableWageCents = 79_858
  const weeklyWageTaxCents = 28_638
  const dailyTableWageCents = 15_972
  const dailyWageTaxCents = 5_728
  const wageTaxCents = weeklyWageTaxCents * 2 + dailyWageTaxCents
  const money = (cents: number) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
  return {
    source: PAYFULL04_NOAH_ORACLE_SOURCE,
    grossAmount: money(grossCents),
    taxableWage: money(grossCents),
    fullWeeks: 2,
    remainingDays: 1,
    weeklyTableWage: money(weeklyTableWageCents),
    weeklyWageTax: money(weeklyWageTaxCents),
    dailyTableWage: money(dailyTableWageCents),
    dailyWageTax: money(dailyWageTaxCents),
    wageTax: money(wageTaxCents),
    netBeforePension: money(grossCents - wageTaxCents),
  }
}
