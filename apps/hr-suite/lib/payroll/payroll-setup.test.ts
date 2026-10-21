import { describe, expect, it } from 'vitest'
import {
  assertActivePayrollEmployerConfiguration,
  hashPayrollEmployerConfiguration,
  hashPayrollOpeningCumulativeBalance,
  isNewIncomeRelationshipWithoutOpening,
  normalizePayrollOpeningCumulativeBalance,
  payrollOpeningCumulativeBlockers,
  payrollEmployerConfigurationBlockers,
  validatePayrollEmployerConfiguration,
  type PayrollOpeningCumulativeBalanceDraft,
  type PayrollEmployerConfigurationDraft,
} from './payroll-setup'

function draft(overrides: Partial<PayrollEmployerConfigurationDraft> = {}): PayrollEmployerConfigurationDraft {
  return {
    schemaVersion: 'payroll-employer-configuration-v1',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    sourceReference: 'Mars BV werkgeversbesluit 2026',
    employer: {
      sectorCode: '001',
      whkDecisionReference: 'WHK-2026-001',
      awfClassification: 'LOW',
      aofClassification: 'AOF-01',
      wkoClassification: 'WKO-01',
      zvwClassification: 'ZVW-EMPLOYER',
    },
    employerRates: {
      awf: '1.00',
      aof: '2.00',
      wko: '0.50',
      whk: '1.50',
      zvw: '6.10',
    },
    reserves: {
      holidayAllowanceRate: '8.00',
      yearEndApplies: false,
      yearEndRate: null,
    },
    pension: {
      partialMonthMethod: 'CALENDAR_DAYS_PRO_RATA',
      methodSourceReference: 'MARS-PENSION-2026 deelmaandregeling, versie 1',
    },
    ...overrides,
  }
}

function openingDraft(overrides: Partial<PayrollOpeningCumulativeBalanceDraft> = {}): PayrollOpeningCumulativeBalanceDraft {
  return {
    sourcePeriodFrom: '2026-01-01',
    sourcePeriodTo: '2026-09-30',
    asOfDate: '2026-10-01',
    meaning: {
      grossWageBeforePeriod: '18000.00',
      taxableWageBeforePeriod: '18000.00',
      wageTaxBeforePeriod: '5400.00',
      employeeInsuranceWageBeforePeriod: '18000.00',
      zvwWageBeforePeriod: '18000.00',
      holidayReserveBeforePeriod: '1440.00',
      yearEndReserveBeforePeriod: '0.00',
    },
    sourceReference: 'Gecontroleerde loonstaat januari-september 2026',
    ...overrides,
  }
}

describe('regular Payroll employer setup', () => {
  it('keeps an incomplete draft visible instead of turning missing rates into zero', () => {
    const result = validatePayrollEmployerConfiguration({
      ...draft(),
      employerRates: { ...draft().employerRates, awf: '' },
      reserves: { ...draft().reserves, holidayAllowanceRate: '' },
    })

    expect(result.configuration.employerRates.awf).toBeNull()
    expect(result.configuration.reserves.holidayAllowanceRate).toBeNull()
    expect(result.blockers.map((item) => item.code)).toEqual(expect.arrayContaining([
      'AWF_RATE_REQUIRED',
      'HOLIDAY_ALLOWANCE_RATE_REQUIRED',
    ]))
  })

  it('requires explicit source-backed settings before activation', () => {
    const configuration = validatePayrollEmployerConfiguration({
      ...draft(),
      status: 'ACTIVE',
      employer: { ...draft().employer, sectorCode: null },
      pension: { partialMonthMethod: 'UNCONFIGURED', methodSourceReference: null },
    }).configuration

    const blockers = payrollEmployerConfigurationBlockers(configuration)
    expect(blockers.map((item) => item.code)).toEqual(expect.arrayContaining([
      'SECTOR_REQUIRED',
      'PENSION_PARTIAL_MONTH_METHOD_REQUIRED',
      'PENSION_METHOD_SOURCE_REQUIRED',
    ]))
    expect(() => assertActivePayrollEmployerConfiguration({ ...draft(), employer: { ...draft().employer, sectorCode: null } }))
      .toThrow('not ready for activation')
  })

  it('hashes the normalized configuration and treats a new employee income relationship as no opening history', () => {
    const configuration = assertActivePayrollEmployerConfiguration(draft())
    expect(hashPayrollEmployerConfiguration(configuration)).toMatch(/^[0-9a-f]{64}$/)
    expect(isNewIncomeRelationshipWithoutOpening('2026-10-16', '2026-01-01')).toBe(true)
    expect(isNewIncomeRelationshipWithoutOpening('2026-01-01', '2026-01-01')).toBe(false)
  })

  it('keeps opening balances source-required, meaning-bound and hashable without inventing zeros', () => {
    const incomplete = openingDraft({ meaning: { ...openingDraft().meaning, wageTaxBeforePeriod: '' } })
    expect(payrollOpeningCumulativeBlockers(incomplete).map((item) => item.code)).toContain('OPENING_VALUE_REQUIRED')

    const balance = normalizePayrollOpeningCumulativeBalance(openingDraft())
    expect(balance.meaning.grossWageBeforePeriod).toBe('18000.00')
    expect(balance.meaning.yearEndReserveBeforePeriod).toBe('0.00')
    expect(hashPayrollOpeningCumulativeBalance(balance)).toMatch(/^[0-9a-f]{64}$/)
    expect(payrollOpeningCumulativeBlockers(openingDraft({ sourcePeriodTo: '2026-10-01' })))
      .toEqual(expect.arrayContaining([{ code: 'OPENING_PERIOD_AFTER_AS_OF_DATE', field: 'asOfDate' }]))
  })
})
