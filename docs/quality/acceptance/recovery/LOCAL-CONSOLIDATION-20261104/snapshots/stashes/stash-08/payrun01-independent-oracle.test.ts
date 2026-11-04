import { describe, expect, it } from 'vitest'
import {
  derivePayrun01LisaOracle,
  PAYRUN01_JAN_ORACLE,
  PAYRUN01_ORACLE_SOURCES,
} from './payrun01-independent-oracle'

describe('PAYRUN01 source-backed independent oracle', () => {
  it('matches Lisa to the exact 2026 white monthly-table row with payroll tax credit', () => {
    expect(derivePayrun01LisaOracle('PAYROLL_TAX_CREDIT_APPLIED')).toEqual({
      source: {
        table: 'WHITE_NL_STD_2026_MONTHLY',
        printedPage: 33,
        tableWage: '5499.00',
      },
      payrollTaxCredit: 'PAYROLL_TAX_CREDIT_APPLIED',
      monthlyGrossWage: '5500.00',
      monthlyTaxableWage: '5500.00',
      rawAnnualTaxableWage: '66000.00',
      annualTableWage: '65988.00',
      monthlyTableWage: '5499.00',
      monthlyWithholding: '1577.17',
      monthlyLabourCreditApplied: '363.17',
      monthlyNetAfterWithholding: '3922.83',
    })
  })

  it('keeps the published no-credit withholding as a separate option', () => {
    expect(derivePayrun01LisaOracle('PAYROLL_TAX_CREDIT_NOT_APPLIED')).toMatchObject({
      payrollTaxCredit: 'PAYROLL_TAX_CREDIT_NOT_APPLIED',
      monthlyWithholding: '2006.67',
      monthlyLabourCreditApplied: '0.00',
      monthlyNetAfterWithholding: '3493.33',
    })
  })

  it('retains Jan’s exact CAO ratio and leaves unsupported monthly tax and PFZW values absent', () => {
    const { fullTimeMonthlySalaryEuros, fullTimeHoursPerWeek, contractHoursPerWeek } = PAYRUN01_JAN_ORACLE.scenario

    const numerator = BigInt(fullTimeMonthlySalaryEuros) * BigInt(contractHoursPerWeek)
    const denominator = BigInt(fullTimeHoursPerWeek)
    const centsNumerator = numerator * BigInt(100)
    const roundedCents = (centsNumerator * BigInt(2) + denominator) / (denominator * BigInt(2))
    expect(PAYRUN01_JAN_ORACLE.exactProratedMonthlySalaryEuro).toMatchObject({
      numerator: '27400',
      denominator: '9',
      testConventionAmount: `${roundedCents / BigInt(100)}.${String(roundedCents % BigInt(100)).padStart(2, '0')}`,
      roundingConvention: 'ARITHMETIC_TO_CENTS_TEST_CONFIGURATION',
    })
    expect(roundedCents.toString()).toBe('304444')
    expect(PAYRUN01_JAN_ORACLE.pfzwPartTimeFactor).toMatchObject({
      exactRatio: '32/36',
      roundedToFourDecimals: '0.8889',
    })

    expect(PAYRUN01_JAN_ORACLE.monthlyPayrollTax).toEqual({
      status: 'UNRESOLVED',
      reasonCode: 'JAN_TAXABLE_WAGE_DEPENDS_ON_UNRESOLVED_PFZW_DEDUCTION',
    })
    expect(PAYRUN01_JAN_ORACLE.monthlyPfzwContribution).toEqual({
      status: 'UNRESOLVED',
      reasonCode: 'PFZW_MONTHLY_ALLOCATION_AND_AMOUNT_ROUNDING_NOT_ESTABLISHED',
    })
    expect(PAYRUN01_JAN_ORACLE.monthlyPayrollTax).not.toHaveProperty('amount')
    expect(PAYRUN01_JAN_ORACLE.monthlyPfzwContribution).not.toHaveProperty('amount')
  })

  it('pins only authoritative primary-source URLs', () => {
    expect(PAYRUN01_ORACLE_SOURCES.taxInstructions).toContain('belastingdienst.nl')
    expect(PAYRUN01_ORACLE_SOURCES.lisaWhiteMonthlyTable).toContain('belastingdienst.nl')
    expect(PAYRUN01_ORACLE_SOURCES.janCaoSalaryTable).toContain('kinderopvang-werkt.nl')
    expect(PAYRUN01_ORACLE_SOURCES.pfzwUpaManual).toContain('pfzw.nl')
    expect(PAYRUN01_ORACLE_SOURCES.pfzwPremiumCalculation).toContain('pfzw.nl')
  })
})
