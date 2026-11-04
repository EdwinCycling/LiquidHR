/**
 * Independent, source-backed check vectors for the bounded PAYRUN01 synthetic
 * cases. This module deliberately imports no payroll engine or rule package.
 *
 * Lisa's white-table amount is read from the published Belastingdienst table
 * after independently applying its annual €54 table-wage step. Jan's salary
 * uses the official full-time CAO row and a versioned test convention that a
 * monthly euro amount is rounded arithmetically to cents; that convention is
 * not presented as an official CAO rounding instruction.
 */

export const PAYRUN01_ORACLE_SOURCES = {
  taxInstructions: 'https://download.belastingdienst.nl/belastingdienst/docs/rekenvoorschriften_voor_geautomatiseerde_loonadministratie_lh991z62fd.pdf',
  lisaWhiteMonthlyTable: 'https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_mnd_nl_std_20260101.pdf',
  janCaoSalaryTable: 'https://www.kinderopvang-werkt.nl/sites/fcb_kinderopvang/files/2025-04/Bijlage-2-Salarisschalen-Cao-Kinderopvang-2025-2026.pdf',
  pfzwUpaManual: 'https://www.pfzw.nl/content/dam/pfzw/web/werkgevers/pensioenaangifte/2026_Handleiding-aanlevering-UPA-gegevens.pdf',
  pfzwPremiumCalculation: 'https://www.pfzw.nl/werkgevers/premie-en-factuur/premie-berekenen/hoe-bereken-ik.html',
} as const

type LisaWithholdingOption = 'PAYROLL_TAX_CREDIT_APPLIED' | 'PAYROLL_TAX_CREDIT_NOT_APPLIED'

interface LisaPublishedMonthlyTableRow {
  readonly monthlyTableWageCents: number
  readonly withholdingWithCreditCents: number
  readonly withholdingWithoutCreditCents: number
  readonly labourCreditCents: number
  readonly printedPage: number
}

// Belastingdienst witte maandtabel 2026, p. 33, age below AOW, Netherlands Std.
const lisaPublishedTableRow: LisaPublishedMonthlyTableRow = {
  monthlyTableWageCents: 549_900,
  withholdingWithCreditCents: 157_717,
  withholdingWithoutCreditCents: 200_667,
  labourCreditCents: 36_317,
  printedPage: 33,
}

export interface Payrun01LisaOracleResult {
  readonly source: {
    readonly table: 'WHITE_NL_STD_2026_MONTHLY'
    readonly printedPage: number
    readonly tableWage: string
  }
  readonly payrollTaxCredit: LisaWithholdingOption
  readonly monthlyGrossWage: string
  readonly monthlyTaxableWage: string
  readonly rawAnnualTaxableWage: string
  readonly annualTableWage: string
  readonly monthlyTableWage: string
  readonly monthlyWithholding: string
  readonly monthlyLabourCreditApplied: string
  readonly monthlyNetAfterWithholding: string
}

/**
 * Select Lisa's published statutory table cell using integer cents only.
 * Caller supplies the tax-credit choice because it is not implicit in "white
 * wage". For this no-pension/no-other-adjustment case, taxable wage equals
 * gross wage. Only the Lisa wage that maps to the independently transcribed
 * published table anchor is supported by this oracle.
 */
export function derivePayrun01LisaOracle(
  payrollTaxCredit: LisaWithholdingOption,
): Payrun01LisaOracleResult {
  const monthlyGrossCents = 550_000
  const monthlyTaxableCents = monthlyGrossCents
  const rawAnnualTaxableCents = monthlyTaxableCents * 12
  const annualTableStepCents = 5_400
  const annualTableWageCents = Math.floor(rawAnnualTaxableCents / annualTableStepCents) * annualTableStepCents
  const monthlyTableWageCents = annualTableWageCents / 12

  if (monthlyTableWageCents !== lisaPublishedTableRow.monthlyTableWageCents) {
    throw new Error('The synthetic Lisa wage does not map to the independently transcribed official table row.')
  }

  const withholdingCents = payrollTaxCredit === 'PAYROLL_TAX_CREDIT_APPLIED'
    ? lisaPublishedTableRow.withholdingWithCreditCents
    : lisaPublishedTableRow.withholdingWithoutCreditCents
  const labourCreditCents = payrollTaxCredit === 'PAYROLL_TAX_CREDIT_APPLIED'
    ? lisaPublishedTableRow.labourCreditCents
    : 0

  return {
    source: {
      table: 'WHITE_NL_STD_2026_MONTHLY',
      printedPage: lisaPublishedTableRow.printedPage,
      tableWage: formatEuroCents(lisaPublishedTableRow.monthlyTableWageCents),
    },
    payrollTaxCredit,
    monthlyGrossWage: formatEuroCents(monthlyGrossCents),
    monthlyTaxableWage: formatEuroCents(monthlyTaxableCents),
    rawAnnualTaxableWage: formatEuroCents(rawAnnualTaxableCents),
    annualTableWage: formatEuroCents(annualTableWageCents),
    monthlyTableWage: formatEuroCents(monthlyTableWageCents),
    monthlyWithholding: formatEuroCents(withholdingCents),
    monthlyLabourCreditApplied: formatEuroCents(labourCreditCents),
    monthlyNetAfterWithholding: formatEuroCents(monthlyGrossCents - withholdingCents),
  }
}

export const PAYRUN01_JAN_ORACLE = {
  source: {
    table: 'CAO_KINDEROPVANG_2025_2026_SALARY_TABLE',
    effectiveDate: '2026-09-01',
    printedPage: 9,
  },
  scenario: {
    personaLabel: 'Jan (synthetic)',
    scale: 6,
    salaryNumber: 20,
    fullTimeMonthlySalaryEuros: 3_425,
    fullTimeHoursPerWeek: 36,
    contractHoursPerWeek: 32,
  },
  exactProratedMonthlySalaryEuro: {
    numerator: '27400',
    denominator: '9',
    testConventionAmount: '3044.44',
    roundingConvention: 'ARITHMETIC_TO_CENTS_TEST_CONFIGURATION',
  },
  pfzwPartTimeFactor: {
    exactRatio: '32/36',
    roundedToFourDecimals: '0.8889',
    roundingSource: 'PFZW rounds the participation part-time factor to four decimal places.',
  },
  monthlyPayrollTax: {
    status: 'UNRESOLVED',
    reasonCode: 'JAN_TAXABLE_WAGE_DEPENDS_ON_UNRESOLVED_PFZW_DEDUCTION',
  },
  monthlyPfzwContribution: {
    status: 'UNRESOLVED',
    reasonCode: 'PFZW_MONTHLY_ALLOCATION_AND_AMOUNT_ROUNDING_NOT_ESTABLISHED',
  },
} as const

function formatEuroCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error('Oracle money values must be safe integer cents.')
  const euros = Math.floor(Math.abs(cents) / 100)
  const remainder = Math.abs(cents) % 100
  const sign = cents < 0 ? '-' : ''
  return `${sign}${euros}.${remainder.toString().padStart(2, '0')}`
}
