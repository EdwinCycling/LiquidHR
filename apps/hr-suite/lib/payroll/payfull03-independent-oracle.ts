/**
 * Independent fixed reference for the October 2026 full-month part-time case.
 * This module deliberately imports no payroll engine, rule package, or source
 * provider code.
 */

export const PAYFULL03_EMMA_ORACLE_SOURCE = {
  whiteMonthlyTable: 'https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_mnd_nl_std_20260101.pdf',
  printedPage: 13,
  tableVersion: '2026-01-01',
} as const

export interface Payfull03EmmaOracleResult {
  readonly source: typeof PAYFULL03_EMMA_ORACLE_SOURCE
  readonly grossAmount: string
  readonly tableWage: string
  readonly wageTax: string
  readonly netBeforePension: string
}

/**
 * The published monthly-table cell used by Emma's white-table calculation.
 * Values are kept as cents so this oracle has no floating-point arithmetic.
 */
export function derivePayfull03EmmaOracle(): Payfull03EmmaOracleResult {
  const grossCents = 211_020
  const tableWageCents = 210_600
  const wageTaxCents = 75_283
  const money = (cents: number) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
  return {
    source: PAYFULL03_EMMA_ORACLE_SOURCE,
    grossAmount: money(grossCents),
    tableWage: money(tableWageCents),
    wageTax: money(wageTaxCents),
    netBeforePension: money(grossCents - wageTaxCents),
  }
}
