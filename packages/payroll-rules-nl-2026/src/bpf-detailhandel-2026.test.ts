import { describe, expect, it } from 'vitest'
import {
  BPF_DETAILHANDEL_2026_METHOD,
  calculateBpfDetailhandel2026,
  type BpfDetailhandel2026CalculationInput,
} from './bpf-detailhandel-2026'
import { BPF_DETAILHANDEL_2026_PARAMETERS } from './pension-parameters-2026'
import { calculatePension, type PensionArrangementInput, type PensionCalculationInput } from './pension-calculation'

function bpfInput(overrides: Partial<BpfDetailhandel2026CalculationInput> = {}): BpfDetailhandel2026CalculationInput {
  return {
    period: { year: 2026, month: 1 },
    payFrequency: 'MONTHLY',
    cumulativePeriodCount: 1,
    cumulativePeriodCountStatus: 'VERIFIED_SOURCE',
    cumulativePeriodCountEvidence: 'Employer payroll period calendar 2026',
    normHoursPerWeek: '38',
    cumulativePaidHours: '164.67',
    cumulativeWfsvSalary: '3500.00',
    previousCumulativePensionableBase: '0.00',
    currentPayrollGross: '3500.00',
    employerApplicabilityStatus: 'CONFIRMED',
    employerApplicabilityEvidence: 'Employer sector registration confirmed for this calculation fixture',
    employeeEligibilityStatus: 'CONFIRMED',
    employeeEligibilityEvidence: 'Employee participation confirmed for this calculation fixture',
    taxTreatmentStatus: 'VERIFIED_SOURCE',
    ...overrides,
  }
}

function bpfArrangement(): PensionArrangementInput {
  return {
    arrangementId: 'bpf-detailhandel-2026',
    arrangementCode: 'BPF_DETAILHANDEL_2026',
    arrangementVersion: 'BPF-DETAILHANDEL-2026-VCR-1',
    arrangementType: 'FLAT_PREMIUM',
    effectiveFrom: '2026-01-01',
    arrangementEstablishedFrom: null,
    effectiveTo: '2026-12-31',
    transitionDate: null,
    grandfatheringMode: 'NONE',
    flatTotalRate: '24.75',
    employerSharePercent: '75',
    employeeSharePercent: '25',
    annualFranchise: '18680',
    annualPensionableSalaryCap: '79409',
    pensionableSalaryDefinition: { method: BPF_DETAILHANDEL_2026_METHOD },
    eligibilityRule: { description: 'Mandatory BPF Detailhandel scope, employer registration and participant confirmed.' },
    contractClassification: 'UNKNOWN',
    contractClassificationProvenance: { status: 'OFFICIAL_RULE' },
    provenance: { source: 'BPF_DETAILHANDEL_2026' },
    tiers: [],
  }
}

const expectedMonthlyTotals = [
  '480.97', '480.98', '480.97', '480.97', '1312.58', '480.97',
  '480.97', '480.98', '480.97', '480.97', '480.98', '480.97',
]

function officialFullTimeExample() {
  const monthlyWages = [3500, 3500, 3500, 3500, 6860, 3500, 3500, 3500, 3500, 3500, 3500, 3500]
  let cumulativeWage = 0
  let previousCumulativePensionableBase = '0.00'
  const results = monthlyWages.map((wage, index) => {
    const month = index + 1
    cumulativeWage += wage
    const cumulativeNormHours = (38 * 52 * month / 12).toFixed(2)
    const result = calculateBpfDetailhandel2026(bpfInput({
      period: { year: 2026, month },
      cumulativePeriodCount: month,
      cumulativePaidHours: cumulativeNormHours,
      cumulativeWfsvSalary: cumulativeWage.toFixed(2),
      previousCumulativePensionableBase,
      currentPayrollGross: wage.toFixed(2),
    }))
    if (result.cumulativePensionableBase !== null) previousCumulativePensionableBase = result.cumulativePensionableBase
    return result
  })
  return results
}

describe('BPF Detailhandel 2026 VCR', () => {
  it('records the official mandatory scheme and keeps the supplemental scheme separate', () => {
    expect(BPF_DETAILHANDEL_2026_PARAMETERS.mandatory).toMatchObject({
      totalRate: '24.75',
      employeeRate: '6.1875',
      employerRate: '18.5625',
      annualFranchise: '18680',
      annualPensionableSalaryCap: '79409',
      annualMaximumPremiumBase: '60729',
      entryAge: 18,
    })
    expect(BPF_DETAILHANDEL_2026_PARAMETERS.additional).toMatchObject({
      totalRate: '26.4',
      employeeRate: null,
      employerRate: null,
      applicabilityStatus: 'OPTIONAL_AND_NOT_AUTOMATIC',
    })
  })

  it('matches all twelve total premiums in the official full-time VCR example', () => {
    const results = officialFullTimeExample()
    expect(results.every((result) => result.periodTotalPremium !== null)).toBe(true)
    expect(results.map((result) => result.periodTotalPremium)).toEqual(expectedMonthlyTotals)
    expect(results[11]).toMatchObject({
      cumulativeWfsvSalary: '45360.00',
      cumulativeFranchise: '18680.00',
      cumulativeMaximumSalary: '79409.00',
      cumulativePensionableBase: '26680.00',
      cumulativeTotalPremiumDue: '6603.30',
    })
    const totalOfRoundedPeriodsCents = expectedMonthlyTotals
      .map((item) => BigInt(item.replace('.', '')))
      .reduce((sum, item) => sum + item, 0n)
    expect(totalOfRoundedPeriodsCents).toBe(660328n)
    expect(660330n - totalOfRoundedPeriodsCents).toBe(2n)
  })

  it('blocks unknown payroll frequency and unconfirmed employer or employee applicability', () => {
    expect(calculateBpfDetailhandel2026(bpfInput({ payFrequency: 'UNKNOWN' }))).toMatchObject({
      status: 'BLOCKED', reasonCode: 'BPF_DETAILHANDEL_2026_PAY_FREQUENCY_UNSUPPORTED',
    })
    expect(calculateBpfDetailhandel2026(bpfInput({ employerApplicabilityStatus: 'UNCONFIRMED' }))).toMatchObject({
      status: 'BLOCKED', reasonCode: 'BPF_DETAILHANDEL_2026_EMPLOYER_APPLICABILITY_UNVERIFIED',
    })
    expect(calculateBpfDetailhandel2026(bpfInput({ employeeEligibilityStatus: 'UNCONFIRMED' }))).toMatchObject({
      status: 'BLOCKED', reasonCode: 'BPF_DETAILHANDEL_2026_EMPLOYEE_ELIGIBILITY_UNVERIFIED',
    })
    expect(calculateBpfDetailhandel2026(bpfInput({ cumulativePeriodCountStatus: 'UNVERIFIED' }))).toMatchObject({
      status: 'BLOCKED', reasonCode: 'BPF_DETAILHANDEL_2026_PERIOD_COUNT_UNVERIFIED',
    })
  })

  it('calculates the official 13-period four-weekly year using period-based VCR prorating', () => {
    const period12 = calculateBpfDetailhandel2026(bpfInput({
      period: { year: 2026, month: 12 },
      payFrequency: 'FOUR_WEEKLY',
      cumulativePeriodCount: 12,
      normHoursPerWeek: '38',
      cumulativePaidHours: '1824.00',
      cumulativeWfsvSalary: '42000.00',
      currentPayrollGross: '3500.00',
    }))
    expect(period12.cumulativePensionableBase).toBe('24756.92')

    const period13 = calculateBpfDetailhandel2026(bpfInput({
      period: { year: 2026, month: 12 },
      payFrequency: 'FOUR_WEEKLY',
      cumulativePeriodCount: 13,
      normHoursPerWeek: '38',
      cumulativePaidHours: '1976.00',
      cumulativeWfsvSalary: '45500.00',
      previousCumulativePensionableBase: period12.cumulativePensionableBase ?? '0.00',
      currentPayrollGross: '3500.00',
    }))
    expect(period13).toMatchObject({
      status: 'CALCULATED',
      cumulativePeriodCount: 13,
      cumulativeNormHours: '1976.00',
      cumulativeFranchise: '18680.00',
      cumulativeMaximumSalary: '79409.00',
      cumulativePensionableBase: '26820.00',
      periodTotalPremium: '510.61',
      periodEmployeePremium: '127.65',
      periodEmployerPremium: '382.96',
    })
  })

  it('blocks a rounding difference instead of changing either official component rate', () => {
    const result = calculateBpfDetailhandel2026(bpfInput({
      cumulativeWfsvSalary: '1556.74',
      previousCumulativePensionableBase: '0.00',
    }))
    expect(result).toMatchObject({
      status: 'BLOCKED',
      reasonCode: 'BPF_DETAILHANDEL_2026_PREMIUM_SPLIT_ROUNDING_UNRESOLVED',
    })
    expect(result.trace).toHaveLength(5)
  })

  it('routes an eligible BPF arrangement through VCR and includes the employee contribution in fiscal bases', () => {
    const input = bpfInput({
      period: { year: 2026, month: 1 },
      cumulativePeriodCount: 1,
      cumulativePaidHours: '164.67',
      cumulativeWfsvSalary: '3500.00',
      currentPayrollGross: '3500.00',
    })
    const resultInput: PensionCalculationInput = {
      arrangement: bpfArrangement(),
      period: { year: 2026, month: 1 },
      fullTimeMonthlyPensionableSalary: '3500.00',
      monthlyPayrollGross: '3500.00',
      partTimeFactor: '1',
      ageForTier: null,
      participationStartDate: '2026-01-01',
      sourceSnapshotId: 'bpf-source-snapshot',
      sourceSnapshotHash: 'a'.repeat(64),
      bpfDetailhandel2026: input,
    }
    const result = calculatePension(resultInput)
    expect(result).toMatchObject({
      status: 'CALCULATED',
      arrangementCode: 'BPF_DETAILHANDEL_2026',
      totalPremiumMonthly: '480.97',
      bpfDetailhandel2026Details: { cumulativePensionableBase: '1943.33', cumulativeTotalPremiumDue: '480.97' },
    })
    expect(result.fiscalBases.wageTax).toBe((3500 - Number(result.employeePremiumMonthly)).toFixed(2))
    expect(result.trace.map((step) => step.componentCode)).toContain('BPF_DETAILHANDEL_EMPLOYEE_TAX_BASES')
  })
})
