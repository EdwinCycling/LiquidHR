import { describe, expect, it } from 'vitest'
import { FixedDecimal } from '@liquid-hr/payroll-engine'
import {
  calculatePfzw2026JanKinderopvangTest,
  PFZW_2026_JAN_KINDEROPVANG_TEST_SCOPE,
} from './index'

// Synthetic arithmetic vectors only; these are not Jan's salary or source data.
describe('PFZW 2026 annual contribution formula for the Jan Kinderopvang test scope', () => {
  it('uses the rounded 32/36 part-time factor and the 2026 annual rates', () => {
    const result = calculatePfzw2026JanKinderopvangTest({
      acceptedScope: PFZW_2026_JAN_KINDEROPVANG_TEST_SCOPE,
      pfzwParticipationConfirmed: true,
      fullTimeAnnualPensionableSalaryAtPfzwBasisDateBeforeUpaRounding: FixedDecimal.parse('95000'),
    })

    expect(result.annualized.pensionableSalary).toEqual(FixedDecimal.parse('95000'))
    expect(result.annualized.partTimeFactor.toString()).toBe('0.8889')
    expect(result.annualized.salaryBasisRule).toBe('PARTICIPATION_START_OR_JANUARY_1')
    expect(result.annualized.ordinaryInYearSalaryChangeRule).toBe('NEXT_CALENDAR_YEAR')
    expect(result.annualized.basicPremiumGround.toString()).toBe('69082.6413')
    expect(result.annualized.totalBasicPremium.toString()).toBe('17892.4040967')
    expect(result.annualized.employeeBasicPremium.toString()).toBe('8911.6607277')
    expect(result.annualized.employerBasicPremium.toString()).toBe('8980.743369')
    expect(result.annualized.wiaExcessGround.toString()).toBe('5036.5')
    expect(result.annualized.employeeWiaExcessPremium.toString()).toBe('0')
    expect(result.annualized.employerWiaExcessPremium.toString()).toBe('171.241')
    expect(result.annualized.amountStatus).toBe('EXACT_FORMULA_UNROUNDED')
  })

  it('rounds the supplied full-time annual basis up to whole euros before applying the annual formula', () => {
    const result = calculatePfzw2026JanKinderopvangTest({
      acceptedScope: PFZW_2026_JAN_KINDEROPVANG_TEST_SCOPE,
      pfzwParticipationConfirmed: true,
      fullTimeAnnualPensionableSalaryAtPfzwBasisDateBeforeUpaRounding: FixedDecimal.parse('95000.01'),
    })

    expect(result.annualized.pensionableSalary.toString()).toBe('95001')
  })

  it('caps the basic pensionable salary but keeps WIA-excess salary uncapped', () => {
    const result = calculatePfzw2026JanKinderopvangTest({
      acceptedScope: PFZW_2026_JAN_KINDEROPVANG_TEST_SCOPE,
      pfzwParticipationConfirmed: true,
      fullTimeAnnualPensionableSalaryAtPfzwBasisDateBeforeUpaRounding: FixedDecimal.parse('150000'),
    })

    expect(result.annualized.pensionableSalary.toString()).toBe('150000')
    expect(result.annualized.basicPremiumableSalary.toString()).toBe('137800')
    expect(result.annualized.basicPremiumGround.toString()).toBe('107127.5613')
    expect(result.annualized.wiaExcessGround.toString()).toBe('53926')
    expect(result.annualized.employerWiaExcessPremium.toString()).toBe('1833.484')
  })

  it('does not produce an October amount where current PFZW sources do not establish monthly proration and rounding', () => {
    const result = calculatePfzw2026JanKinderopvangTest({
      acceptedScope: PFZW_2026_JAN_KINDEROPVANG_TEST_SCOPE,
      pfzwParticipationConfirmed: true,
      fullTimeAnnualPensionableSalaryAtPfzwBasisDateBeforeUpaRounding: FixedDecimal.parse('95000'),
    })

    expect(result.octoberPeriod).toEqual({
      status: 'UNSUPPORTED',
      reasonCode: 'PFZW_2026_MONTHLY_PRORATION_AND_ROUNDING_UNVERIFIED',
    })
    expect(result.octoberPeriod).not.toHaveProperty('amount')
  })

  it('fails closed when PFZW participation or the accepted test scope is not confirmed', () => {
    expect(() => calculatePfzw2026JanKinderopvangTest({
      acceptedScope: PFZW_2026_JAN_KINDEROPVANG_TEST_SCOPE,
      pfzwParticipationConfirmed: false,
      fullTimeAnnualPensionableSalaryAtPfzwBasisDateBeforeUpaRounding: FixedDecimal.parse('95000'),
    })).toThrowError(expect.objectContaining({ code: 'PFZW_2026_PARTICIPATION_UNCONFIRMED' }))

    expect(() => calculatePfzw2026JanKinderopvangTest({
      acceptedScope: 'OTHER_SCENARIO',
      pfzwParticipationConfirmed: true,
      fullTimeAnnualPensionableSalaryAtPfzwBasisDateBeforeUpaRounding: FixedDecimal.parse('95000'),
    } as unknown as Parameters<typeof calculatePfzw2026JanKinderopvangTest>[0])).toThrowError(
      expect.objectContaining({ code: 'PFZW_2026_SCOPE_UNSUPPORTED' }),
    )
  })

  it('does not accept a negative pensionable salary input', () => {
    expect(() => calculatePfzw2026JanKinderopvangTest({
      acceptedScope: PFZW_2026_JAN_KINDEROPVANG_TEST_SCOPE,
      pfzwParticipationConfirmed: true,
      fullTimeAnnualPensionableSalaryAtPfzwBasisDateBeforeUpaRounding: FixedDecimal.parse('-1'),
    })).toThrowError(expect.objectContaining({ code: 'PFZW_2026_NEGATIVE_PENSIONABLE_SALARY' }))
  })
})
