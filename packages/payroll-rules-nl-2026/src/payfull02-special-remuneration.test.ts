import { describe, expect, it } from 'vitest'
import {
  calculateNl2026SpecialRewardWithholding,
  NL_2026_SPECIAL_REWARD_PARAMETERS,
  NL_2026_SPECIAL_REWARD_PARAMETER_SET_SHA256,
  NL_2026_SPECIAL_REWARD_TABLE,
  NL_2026_SPECIAL_REWARD_TABLE_SOURCE,
} from './special-remuneration-2026'

function calculate(input: Partial<Parameters<typeof calculateNl2026SpecialRewardWithholding>[0]> = {}) {
  return calculateNl2026SpecialRewardWithholding({
    specialRewardWage: '500.00',
    annualWage: '66000.00',
    annualWageProfileResolved: true,
    fiscalYear: '2026',
    table: 'WHITE',
    residence: 'NL',
    ageCategory: 'UNDER_AOW',
    payrollTaxCredit: true,
    ...input,
  })
}

describe('PAYFULL02 Dutch 2026 special remuneration withholding', () => {
  it('pins the official 2026 table and its published rows', () => {
    expect(NL_2026_SPECIAL_REWARD_TABLE_SOURCE).toMatchObject({
      publisher: 'Belastingdienst',
      version: '2026-01-01',
      url: 'https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_bb_nl_std_20260101.pdf',
      sha256: '2f27798b332edc4d72dfbbe9bfe28fd144cbbefb756598cb31c72424ef59aab1',
    })
    expect(NL_2026_SPECIAL_REWARD_PARAMETER_SET_SHA256).toMatch(/^[0-9a-f]{64}$/)
    expect(NL_2026_SPECIAL_REWARD_TABLE.map((row) => row.annualWageFloor)).toEqual([
      '0.00', '11358.00', '12923.00', '23931.00', '29737.00', '34719.00', '37409.00',
      '38884.00', '41124.00', '45593.00', '46003.00', '59783.00', '78427.00', '143555.00',
    ])
  })

  it.each([
    { annualWage: '0.00', payrollTaxCredit: true, rate: '0.00', expected: '0.00' },
    { annualWage: '0.00', payrollTaxCredit: false, rate: '35.75', expected: '178.75' },
    { annualWage: '12922.99', payrollTaxCredit: true, rate: '27.43', expected: '137.15' },
    { annualWage: '12923.00', payrollTaxCredit: true, rate: '4.74', expected: '23.70' },
    { annualWage: '29737.00', payrollTaxCredit: true, rate: '40.20', expected: '201.00' },
    { annualWage: '40000.00', payrollTaxCredit: true, rate: '42.01', expected: '210.05' },
    { annualWage: '45593.00', payrollTaxCredit: true, rate: '50.47', expected: '252.35' },
    { annualWage: '78427.00', payrollTaxCredit: true, rate: '56.01', expected: '280.05' },
    { annualWage: '143555.00', payrollTaxCredit: true, rate: '49.50', expected: '247.50' },
    { annualWage: '50000.00', payrollTaxCredit: false, rate: '37.56', expected: '187.80' },
  ])('matches fixed published table case for annual wage $annualWage with LHK=$payrollTaxCredit', (reference) => {
    const result = calculate({ annualWage: reference.annualWage, payrollTaxCredit: reference.payrollTaxCredit })
    expect(result.profileSupported).toBe(true)
    expect(result.effectiveRatePercent).toBe(reference.rate)
    expect(result.withholding).toBe(reference.expected)
    expect(result.trace[0]?.sourceReference).toContain(NL_2026_SPECIAL_REWARD_TABLE_SOURCE.url)
  })

  it('selects the lower table threshold and rounds nonnegative withholding down to cents', () => {
    const justBelow = calculate({ annualWage: '45592.99', specialRewardWage: '0.03' })
    const atThreshold = calculate({ annualWage: '45593.00', specialRewardWage: '0.03' })

    expect(justBelow.annualWageThreshold).toBe('41124.00')
    expect(justBelow.effectiveRatePercent).toBe('42.01')
    expect(atThreshold.annualWageThreshold).toBe('45593.00')
    expect(atThreshold.effectiveRatePercent).toBe('50.47')
    expect(atThreshold.withholding).toBe('0.01')
    expect(atThreshold.trace[0]?.values.roundingMode).toEqual({ valueType: 'STRING', value: 'FLOOR' })
  })

  it('fails closed when annual wage or the supported profile is unresolved', () => {
    const unresolved = calculate({ annualWage: '66000.00', annualWageProfileResolved: false })
    const unsupportedTable = calculate({ table: 'GREEN' })

    expect(unresolved).toMatchObject({ withholding: '0.00', profileSupported: false, reasonCode: 'SPECIAL_REWARD_ANNUAL_WAGE_PROFILE_UNRESOLVED' })
    expect(unsupportedTable).toMatchObject({ withholding: '0.00', profileSupported: false, reasonCode: 'SPECIAL_REWARD_TAX_TABLE_UNSUPPORTED' })
  })
})
