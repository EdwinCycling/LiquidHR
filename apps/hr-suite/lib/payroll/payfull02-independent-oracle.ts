/**
 * Independent fixed reference cases for the synthetic Mars PAYFULL-02
 * acceptance employees. This module intentionally imports no payroll engine,
 * rule package, or scenario setup code.
 */

export const PAYFULL02_MARS_ORACLE_SOURCE = {
  whiteMonthlyTable: 'https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_mnd_nl_std_20260101.pdf',
  printedPage: 20,
  tableVersion: '2026-01-01',
} as const

export type MarsCandidate = 'DEMO-001' | 'DEMO-002' | 'DEMO-003'

type MarsCase = {
  readonly grossCents: number
  readonly employeePensionCents: number
  readonly employerPensionCents: number
  readonly reimbursementCents: number
  readonly taxableWageCents: number
  readonly annualTableWageCents: number
  readonly tableWithholdingWithoutCreditCents: number
  readonly payrollTaxCreditApplies: boolean
  readonly tableWithholdingWithCreditCents?: number
  readonly employerPremiumRatesHundredths: readonly number[]
  readonly holidayReserveRateHundredths: number
  readonly openingGrossCents: number
  readonly openingMonthlyTaxableWageCents: number
  readonly openingMonthlyNoCreditWithholdingCents: number
  readonly openingTaxableWageCents: number
  readonly openingWageTaxCents: number
  readonly openingEmployeeInsuranceWageCents: number
  readonly openingZvwWageCents: number
  readonly openingHolidayReserveCents: number
  readonly openingEmployeePensionCents: number
  readonly openingEmployerPensionCents: number
}

// The amounts and rates below are the synthetic, versioned Mars TEST setup.
// Table withholding values are transcribed from the cited Belastingdienst
// white monthly table, NL standard, under AOW age, with the table selection
// explicitly set per case for loonheffingskorting.
const MARS_CASES: Readonly<Record<MarsCandidate, MarsCase>> = Object.freeze({
  'DEMO-001': {
    grossCents: 351_700,
    employeePensionCents: 19_193,
    employerPensionCents: 28_790,
    reimbursementCents: 4_500,
    taxableWageCents: 332_507,
    annualTableWageCents: 3_985_200,
    tableWithholdingWithoutCreditCents: 118_858,
    payrollTaxCreditApplies: false,
    employerPremiumRatesHundredths: [774, 627, 50, 181, 610],
    holidayReserveRateHundredths: 800,
    openingGrossCents: 9 * 351_700,
    openingMonthlyTaxableWageCents: 332_507,
    openingMonthlyNoCreditWithholdingCents: 118_858,
    openingTaxableWageCents: 9 * 332_507,
    openingWageTaxCents: 9 * 118_858,
    openingEmployeeInsuranceWageCents: 9 * 332_507,
    openingZvwWageCents: 9 * 332_507,
    openingHolidayReserveCents: 9 * 28_136,
    openingEmployeePensionCents: 9 * 19_193,
    openingEmployerPensionCents: 9 * 28_790,
  },
  'DEMO-002': {
    grossCents: 353_400,
    employeePensionCents: 25_172,
    employerPensionCents: 25_172,
    reimbursementCents: 3_250,
    taxableWageCents: 328_228,
    annualTableWageCents: 3_936_600,
    tableWithholdingWithoutCreditCents: 117_342,
    payrollTaxCreditApplies: false,
    employerPremiumRatesHundredths: [774, 627, 50, 181, 610],
    holidayReserveRateHundredths: 800,
    openingGrossCents: 9 * 353_400,
    openingMonthlyTaxableWageCents: 328_228,
    openingMonthlyNoCreditWithholdingCents: 117_342,
    openingTaxableWageCents: 9 * 328_228,
    openingWageTaxCents: 9 * 117_342,
    openingEmployeeInsuranceWageCents: 9 * 328_228,
    openingZvwWageCents: 9 * 328_228,
    openingHolidayReserveCents: 9 * 28_272,
    openingEmployeePensionCents: 9 * 25_172,
    openingEmployerPensionCents: 9 * 25_172,
  },
  'DEMO-003': {
    grossCents: 351_700,
    employeePensionCents: 19_193,
    employerPensionCents: 28_790,
    reimbursementCents: 4_500,
    taxableWageCents: 332_507,
    annualTableWageCents: 3_985_200,
    tableWithholdingWithoutCreditCents: 118_858,
    payrollTaxCreditApplies: true,
    tableWithholdingWithCreditCents: 51_842,
    employerPremiumRatesHundredths: [774, 627, 50, 181, 610],
    holidayReserveRateHundredths: 800,
    openingGrossCents: 9 * 355_100,
    openingMonthlyTaxableWageCents: 335_567,
    openingMonthlyNoCreditWithholdingCents: 120_042,
    openingTaxableWageCents: 9 * 335_567,
    openingWageTaxCents: 9 * 120_042,
    openingEmployeeInsuranceWageCents: 9 * 335_567,
    openingZvwWageCents: 9 * 335_567,
    openingHolidayReserveCents: 9 * 28_408,
    openingEmployeePensionCents: 9 * 19_533,
    openingEmployerPensionCents: 9 * 29_300,
  },
})

const DEMO_001_VARIABLE_CASE: MarsCase = Object.freeze({
  ...MARS_CASES['DEMO-001'],
  grossCents: 401_700,
  employeePensionCents: 24_193,
  employerPensionCents: 36_290,
  taxableWageCents: 377_507,
  annualTableWageCents: 4_525_200,
  tableWithholdingWithoutCreditCents: 135_767,
  payrollTaxCreditApplies: false,
})

function roundPositiveRatio(numerator: number, denominator: number): number {
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator)
}

function tableWithholding(candidate: MarsCase): number {
  const tableWageCents = Math.floor(candidate.taxableWageCents * 12 / 5_400) * 5_400 / 12
  if (tableWageCents !== candidate.annualTableWageCents / 12) {
    throw new Error('The Mars taxable wage does not map to its independently pinned 2026 monthly table row.')
  }
  const publishedRowsWithoutCredit: Readonly<Record<number, number>> = {
    332_100: 118_858,
    328_050: 117_342,
    335_250: 120_042,
    377_100: 135_767,
  }
  const publishedRowsWithCredit: Readonly<Record<number, number>> = {
    332_100: 51_842,
  }
  const expected = candidate.payrollTaxCreditApplies
    ? candidate.tableWithholdingWithCreditCents
    : publishedRowsWithoutCredit[tableWageCents]
  const withholding = candidate.payrollTaxCreditApplies
    ? publishedRowsWithCredit[tableWageCents]
    : expected
  if (withholding === undefined || withholding !== expected
    || publishedRowsWithoutCredit[tableWageCents] !== candidate.tableWithholdingWithoutCreditCents) {
    throw new Error('The Mars withholding differs from its pinned Belastingdienst monthly table cell.')
  }
  return withholding
}

function openingTaxTableRow(candidate: MarsCase): void {
  const tableWageCents = Math.floor(candidate.openingMonthlyTaxableWageCents * 12 / 5_400) * 5_400 / 12
  const publishedRowsWithoutCredit: Readonly<Record<number, number>> = {
    332_100: 118_858,
    328_050: 117_342,
    335_250: 120_042,
  }
  if (tableWageCents !== candidate.openingMonthlyTaxableWageCents - candidate.openingMonthlyTaxableWageCents % 450
    || publishedRowsWithoutCredit[tableWageCents] !== candidate.openingMonthlyNoCreditWithholdingCents
    || candidate.openingWageTaxCents !== candidate.openingMonthlyNoCreditWithholdingCents * 9) {
    throw new Error('The Mars opening tax balance differs from its pinned no-credit 2026 monthly table row.')
  }
}

export interface Payfull02MarsOracleResult {
  readonly source: typeof PAYFULL02_MARS_ORACLE_SOURCE
  readonly printedPage: number
  readonly candidate: MarsCandidate
  readonly grossAmount: string
  readonly taxableWage: string
  readonly wageTax: string
  readonly employeePension: string
  readonly employerPension: string
  readonly netReimbursement: string
  readonly netDeduction: '0.00'
  readonly netCorrection: '0.00'
  readonly netPay: string
  readonly employerAwf: string
  readonly employerAof: string
  readonly employerWko: string
  readonly employerWhk: string
  readonly employerZvw: string
  readonly employerPremiums: string
  readonly holidayReserve: string
  readonly yearEndReserve: '0.00'
  readonly totalEmployerCost: string
  readonly cumulativeGross: string
  readonly cumulativeTaxableWage: string
  readonly cumulativeWageTax: string
  readonly cumulativeEmployeeInsuranceWage: string
  readonly cumulativeZvwWage: string
  readonly cumulativeHolidayReserve: string
  readonly cumulativeEmployeePension: string
  readonly cumulativeEmployerPension: string
}

export function derivePayfull02MarsOracle(candidate: MarsCandidate): Payfull02MarsOracleResult {
  return deriveOracle(candidate, MARS_CASES[candidate])
}

export function derivePayfull02MarsVariableOracle(): Payfull02MarsOracleResult {
  return deriveOracle('DEMO-001', DEMO_001_VARIABLE_CASE)
}

function deriveOracle(candidate: MarsCandidate, input: MarsCase): Payfull02MarsOracleResult {
  openingTaxTableRow(input)
  const wageTaxCents = tableWithholding(input)
  const socialWageCents = input.taxableWageCents
  const premiums = input.employerPremiumRatesHundredths.map((rate) =>
    roundPositiveRatio(socialWageCents * rate, 10_000))
  const employerPremiumCents = premiums.reduce((total, cents) => total + cents, 0)
  const holidayReserveCents = roundPositiveRatio(input.grossCents * input.holidayReserveRateHundredths, 10_000)
  const netPayCents = input.grossCents - input.employeePensionCents - wageTaxCents + input.reimbursementCents
  const employerCostCents = input.grossCents + input.employerPensionCents + employerPremiumCents
    + holidayReserveCents + input.reimbursementCents

  return {
    source: PAYFULL02_MARS_ORACLE_SOURCE,
    printedPage: input === DEMO_001_VARIABLE_CASE ? 23 : 20,
    candidate,
    grossAmount: euro(input.grossCents),
    taxableWage: euro(input.taxableWageCents),
    wageTax: euro(wageTaxCents),
    employeePension: euro(input.employeePensionCents),
    employerPension: euro(input.employerPensionCents),
    netReimbursement: euro(input.reimbursementCents),
    netDeduction: '0.00',
    netCorrection: '0.00',
    netPay: euro(netPayCents),
    employerAwf: euro(premiums[0]!),
    employerAof: euro(premiums[1]!),
    employerWko: euro(premiums[2]!),
    employerWhk: euro(premiums[3]!),
    employerZvw: euro(premiums[4]!),
    employerPremiums: euro(employerPremiumCents),
    holidayReserve: euro(holidayReserveCents),
    yearEndReserve: '0.00',
    totalEmployerCost: euro(employerCostCents),
    cumulativeGross: euro(input.openingGrossCents + input.grossCents),
    cumulativeTaxableWage: euro(input.openingTaxableWageCents + input.taxableWageCents),
    cumulativeWageTax: euro(input.openingWageTaxCents + wageTaxCents),
    cumulativeEmployeeInsuranceWage: euro(input.openingEmployeeInsuranceWageCents + socialWageCents),
    cumulativeZvwWage: euro(input.openingZvwWageCents + socialWageCents),
    cumulativeHolidayReserve: euro(input.openingHolidayReserveCents + holidayReserveCents),
    cumulativeEmployeePension: euro(input.openingEmployeePensionCents + input.employeePensionCents),
    cumulativeEmployerPension: euro(input.openingEmployerPensionCents + input.employerPensionCents),
  }
}

function euro(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error('The independent payroll oracle requires integer euro cents.')
  const absolute = Math.abs(cents)
  return `${cents < 0 ? '-' : ''}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`
}
