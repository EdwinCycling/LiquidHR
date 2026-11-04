import { describe, expect, it } from 'vitest'
import {
  calculatePfzw2026Kinderopvang,
  PFZW_2026_KINDEROPVANG_RULE_VERSION,
  PFZW_2026_MONTHLY_ALLOCATION_TEST_APPROVED_VERSION,
  PFZW_2026_SYNTHETIC_TEST_EXTRA_HOURS_UPLIFT_VERSION,
  type Pfzw2026CalculationInput,
} from './pfzw-2026'
import { calculatePension, type PensionArrangementInput, type PensionCalculationInput } from './pension-calculation'

const syntheticTestMonthlyPolicy: Pfzw2026CalculationInput['calculationPolicy'] = {
  status: 'SYNTHETIC_TEST_APPROVED',
  version: PFZW_2026_MONTHLY_ALLOCATION_TEST_APPROVED_VERSION,
  sourceReference: 'SYNTHETIC_TEST_POLICY:PAY-RULE-002; annual share divided by 12; employee and employer shares rounded separately HALF_UP to cents; synthetic TEST acceptance only, not PFZW or employer production policy.',
  monthlyMethod: 'ANNUAL_RATE_DIVIDED_BY_12',
  shareRounding: 'HALF_UP_CENTS_PER_EMPLOYEE_AND_EMPLOYER_SHARE',
}

function pfzwInput(overrides: Partial<Pfzw2026CalculationInput> = {}): Pfzw2026CalculationInput {
  return {
    period: { year: 2026, month: 9 },
    participationStatus: 'CONFIRMED',
    participationStartDate: '2026-09-01',
    participationEvidenceReference: 'synthetic Core participant assignment and labor-condition mapping',
    arrangementVersion: PFZW_2026_KINDEROPVANG_RULE_VERSION,
    salaryBasisDate: '2026-09-01',
    salaryBasisSourceId: 'salary-row-test-2026-09-01',
    salaryBasisSourceVersion: '2026-09-01',
    fullTimeMonthlySalary: '3425.00',
    monthlyPaymentsPerYear: 12,
    holidayAllowancePercent: '8',
    structuralYearEndAllowancePercent: '5.5',
    structuralYearEndAllowanceReferenceDate: '2025-12-31',
    structuralYearEndAllowanceEligibleAnnualBase: '41100',
    structuralYearEndAllowanceSourceReference: 'https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/eindejaarsuitkering',
    structuralYearEndAllowanceSourceVersion: 'Cao Kinderopvang 2025-2026 article 5.7; PFZW article 5.2.4',
    additionalStructuralSalaryComponents: [],
    contractHoursPerWeek: '32',
    fullTimeHoursPerWeek: '36',
    additionalWorkedHours: '0',
    additionalHoursUpliftPercent: null,
    additionalHoursUpliftEvidence: 'NOT_APPLICABLE',
    additionalHoursUpliftSourceReference: null,
    additionalHoursUpliftSourceVersion: null,
    fullTimePeriodHours: '156.00',
    monthlyPayrollGross: '3044.44',
    calculationPolicy: syntheticTestMonthlyPolicy,
    sourceSnapshotId: 'snapshot-pfzw-test',
    sourceSnapshotHash: 'a'.repeat(64),
    inputSetId: 'input-pfzw-test',
    inputHash: 'b'.repeat(64),
    ...overrides,
  }
}

const pfzwArrangement: PensionArrangementInput = {
  arrangementId: 'pfzw-kinderopvang-2026',
  arrangementCode: 'PFZW_2026_KINDEROPVANG',
  arrangementVersion: PFZW_2026_KINDEROPVANG_RULE_VERSION,
  arrangementType: 'FLAT_PREMIUM',
  effectiveFrom: '2026-01-01',
  arrangementEstablishedFrom: null,
  effectiveTo: '2026-12-31',
  transitionDate: null,
  grandfatheringMode: 'NONE',
  flatTotalRate: '25.9',
  employerSharePercent: '13.0',
  employeeSharePercent: '12.9',
  annualFranchise: '17283',
  annualPensionableSalaryCap: '137800',
  pensionableSalaryDefinition: { method: 'PFZW_2026_KINDEROPVANG' },
  eligibilityRule: { participantGroup: 'NEW_ENTRANT' },
  contractClassification: 'UNKNOWN',
  contractClassificationProvenance: { status: 'OFFICIAL_RULE' },
  provenance: { source: PFZW_2026_KINDEROPVANG_RULE_VERSION },
  tiers: [],
}

function pensionInput(pfzw: Pfzw2026CalculationInput): PensionCalculationInput {
  return {
    arrangement: pfzwArrangement,
    period: pfzw.period,
    fullTimeMonthlyPensionableSalary: pfzw.fullTimeMonthlySalary,
    monthlyPayrollGross: pfzw.monthlyPayrollGross,
    partTimeFactor: '0.8889',
    ageForTier: null,
    participationStartDate: pfzw.participationStartDate,
    sourceSnapshotId: pfzw.sourceSnapshotId,
    sourceSnapshotHash: pfzw.sourceSnapshotHash,
    ...(pfzw.inputSetId !== undefined ? { inputSetId: pfzw.inputSetId } : {}),
    ...(pfzw.inputHash !== undefined ? { inputHash: pfzw.inputHash } : {}),
    pfzw2026: pfzw,
  }
}

describe('PFZW 2026 Kinderopvang annual basis and period premium', () => {
  it('calculates full-time salary construction and annual shares from official 2026 rates', () => {
    const result = calculatePfzw2026Kinderopvang(pfzwInput({ contractHoursPerWeek: '36' }))

    expect(result).toMatchObject({
      status: 'CALCULATED',
      fullTimeAnnualSalaryBeforeUpaRounding: '46648.5',
      pensionableAnnualSalary: '46649.00',
      cappedPensionableSalary: '46649.00',
      contractualPartTimeFactor: '1.0000',
      pensionableHours: '156.00',
      finalPartTimeFactor: '1.0000',
      pensionableBase: '29366.00',
      employeePremiumMonthly: '315.68',
      employerBasicPremiumMonthly: '318.13',
      employerWiaExcessPremiumMonthly: '0.00',
      employerPremiumMonthly: '318.13',
      totalPremiumMonthly: '633.81',
    })
  })

  it('uses the independently derived 32/36 contractual factor and per-period UPA hours', () => {
    expect(calculatePfzw2026Kinderopvang(pfzwInput())).toMatchObject({
      contractualPartTimeFactor: '0.8889',
      contractHoursInPeriod: '138.67',
      pensionableHours: '138.67',
      finalPartTimeFactor: '0.8889',
      pensionableBase: '26103.44',
      employeePremiumMonthly: '280.61',
      employerBasicPremiumMonthly: '282.79',
    })
  })

  it('treats a 1 September entrant as a full monthly UPA period without day proration', () => {
    const result = calculatePfzw2026Kinderopvang(pfzwInput())
    expect(result.status).toBe('CALCULATED')
    expect(result.reasonCodes).not.toContain('PFZW_MONTHLY_CENT_ALLOCATION_POLICY_UNVERIFIED')
    expect(result.pensionableHours).toBe('138.67')
    expect(result.totalPremiumMonthly).toBe('563.40')
  })

  it('keeps an explicit synthetic TEST assignment distinct from external enrollment evidence', () => {
    const sourceClassification = 'SYNTHETIC_TEST_FIXTURE — PAY-RULE-002 — FRITS_PFZW_2026'
    const result = calculatePfzw2026Kinderopvang(pfzwInput({
      participationStatus: 'SYNTHETIC_TEST_FIXTURE',
      participationEvidenceReference: `SYNTHETIC_TEST_FIXTURE:${sourceClassification}`,
    }))

    expect(result.status).toBe('CALCULATED')
    expect(result.reasonCodes).not.toContain('PFZW_PARTICIPATION_ASSUMED_FOR_PREVIEW')
    expect(result.trace[0]?.ruleProvenance).toMatchObject({
      participationStatus: 'SYNTHETIC_TEST_FIXTURE',
      participationEvidenceReference: `SYNTHETIC_TEST_FIXTURE:${sourceClassification}`,
    })
    expect(calculatePfzw2026Kinderopvang(pfzwInput({
      participationStatus: 'SYNTHETIC_TEST_FIXTURE',
      participationEvidenceReference: 'Core user-recorded assignment',
    }))).toMatchObject({ status: 'BLOCKED', reasonCodes: ['PFZW_SYNTHETIC_PARTICIPATION_PROVENANCE_INVALID'] })
  })

  it('blocks four-week payroll because PAYRUN01 has monthly periods and cannot allocate 13 UPA installments', () => {
    expect(calculatePfzw2026Kinderopvang(pfzwInput({ monthlyPaymentsPerYear: 13 }))).toMatchObject({
      status: 'BLOCKED', reasonCodes: ['PFZW_FOUR_WEEKLY_PERIOD_UNSUPPORTED'], employeePremiumMonthly: null,
    })
  })

  it('continues the unchanged basis into October without annualizing contractual gross again', () => {
    const result = calculatePfzw2026Kinderopvang(pfzwInput({
      period: { year: 2026, month: 10 },
      participationStartDate: '2026-09-01',
      salaryBasisDate: '2026-09-01',
      monthlyPayrollGross: '3219.41',
    }))
    expect(result.salaryBasisDate).toBe('2026-09-01')
    expect(result.pensionableAnnualSalary).toBe('46649.00')
    expect(result.employeePremiumMonthly).toBe('280.61')
  })

  it('raises October pensionable hours for eight additional hours with an explicit uplift', () => {
    const result = calculatePfzw2026Kinderopvang(pfzwInput({
      period: { year: 2026, month: 10 },
      participationStartDate: '2026-09-01',
      salaryBasisDate: '2026-09-01',
      additionalWorkedHours: '8.0000',
      additionalHoursUpliftPercent: '11.2179487179',
      additionalHoursUpliftEvidence: 'SYNTHETIC_TEST_ONLY_POLICY',
      additionalHoursUpliftSourceReference: 'https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/vakantie; https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/verlofbudget; https://www.pfzw.nl/content/dam/pfzw/web/werkgevers/pensioenaangifte/2026_Handleiding-aanlevering-UPA-gegevens.pdf',
      additionalHoursUpliftSourceVersion: `${PFZW_2026_SYNTHETIC_TEST_EXTRA_HOURS_UPLIFT_VERSION}; 210 annual full-time CAO leave hours / (36 full-time weekly hours × 52 weeks); synthetic TEST acceptance only`,
      monthlyPayrollGross: '3219.41',
    }))
    expect(result).toMatchObject({
      status: 'CALCULATED',
      additionalHoursForArrangement: '8.897435897432',
      pensionableHours: '147.57',
      finalPartTimeFactor: '0.9460',
      pensionableBase: '27780.24',
      employeePremiumMonthly: '298.64',
      employerBasicPremiumMonthly: '300.95',
      employerWiaExcessPremiumMonthly: '0.00',
    })
    expect(result.reasonCodes).not.toContain('PFZW_ADDITIONAL_HOURS_UPLIFT_PROVISIONAL')
  })

  it('keeps contractual factor, base contracted hours, uplifted hours and final factor separate', () => {
    const noUplift = calculatePfzw2026Kinderopvang(pfzwInput({
      additionalWorkedHours: '8',
      additionalHoursUpliftPercent: '0',
      additionalHoursUpliftEvidence: 'VERIFIED_CAO_OR_EMPLOYER_RULE',
    }))
    const withUplift = calculatePfzw2026Kinderopvang(pfzwInput({
      additionalWorkedHours: '8',
      additionalHoursUpliftPercent: '11.2179487179',
      additionalHoursUpliftEvidence: 'SYNTHETIC_TEST_ONLY_POLICY',
      additionalHoursUpliftSourceReference: 'CAO Kinderopvang 2025-2026 arts. 7.1 and 7.3; PFZW UPA 2026 v5 p. 19; synthetic TEST-only uplift authorization',
      additionalHoursUpliftSourceVersion: PFZW_2026_SYNTHETIC_TEST_EXTRA_HOURS_UPLIFT_VERSION,
    }))
    expect(noUplift).toMatchObject({ contractualPartTimeFactor: '0.8889', contractHoursInPeriod: '138.67', pensionableHours: '146.67', finalPartTimeFactor: '0.9402' })
    expect(withUplift.pensionableHours).toBe('147.57')
  })

  it('uses the preceding 31 December EJU rate for the 2026 annual salary basis', () => {
    const result = calculatePfzw2026Kinderopvang(pfzwInput())
    expect(result.fullTimeAnnualSalaryBeforeUpaRounding).toBe('46648.5')
    const wrongReference = calculatePfzw2026Kinderopvang(pfzwInput({
      structuralYearEndAllowancePercent: '8',
      structuralYearEndAllowanceReferenceDate: '2026-12-31',
    }))
    expect(wrongReference.status).toBe('PREVIEW_ONLY')
    expect(wrongReference.reasonCodes).toContain('PFZW_PRIOR_YEAR_EJU_REFERENCE_UNVERIFIED')
    expect(wrongReference.pensionableAnnualSalary).toBe('47676.00')
  })

  it('applies the franchise floor and the separate OP/NP salary cap', () => {
    const belowFranchise = calculatePfzw2026Kinderopvang(pfzwInput({
      fullTimeMonthlySalary: '1000',
      structuralYearEndAllowanceEligibleAnnualBase: '12000',
      additionalStructuralSalaryComponents: [{
        code: 'THRESHOLD_ADJUSTMENT', annualAmount: '3663', sourceVersion: 'test', sourceReference: 'synthetic boundary vector',
      }],
      contractHoursPerWeek: '36',
    }))
    expect(belowFranchise.pensionableAnnualSalary).toBe('17283.00')
    expect(belowFranchise.pensionableBase).toBe('0.00')
    expect(belowFranchise.employeePremiumMonthly).toBe('0.00')

    const overCap = calculatePfzw2026Kinderopvang(pfzwInput({
      fullTimeMonthlySalary: '10000',
      structuralYearEndAllowanceEligibleAnnualBase: '120000',
      additionalStructuralSalaryComponents: [{
        code: 'CAP_ADJUSTMENT', annualAmount: '2000', sourceVersion: 'test', sourceReference: 'synthetic boundary vector',
      }],
      contractHoursPerWeek: '36',
    }))
    expect(overCap.pensionableAnnualSalary).toBe('138200.00')
    expect(overCap.cappedPensionableSalary).toBe('137800.00')
    expect(overCap.pensionableBase).toBe('120517.00')
  })

  it('rounds RegLn upward to whole euros before applying the cap and franchise', () => {
    const result = calculatePfzw2026Kinderopvang(pfzwInput({
      fullTimeMonthlySalary: '3425.0001',
      structuralYearEndAllowanceEligibleAnnualBase: '41100.0012',
    }))
    expect(result.fullTimeAnnualSalaryBeforeUpaRounding).toBe('46648.501362')
    expect(result.pensionableAnnualSalary).toBe('46649.00')
  })

  it('rounds monthly employee and employer shares half-up at a half-cent boundary', () => {
    const result = calculatePfzw2026Kinderopvang(pfzwInput({
      fullTimeMonthlySalary: '1000.00',
      structuralYearEndAllowanceEligibleAnnualBase: '12000.00',
      additionalStructuralSalaryComponents: [{
        code: 'ROUNDING_TEST', annualAmount: '3750.00', sourceVersion: 'test', sourceReference: 'independent exact-decimal boundary vector',
      }],
      contractHoursPerWeek: '36',
      fullTimeHoursPerWeek: '36',
      fullTimePeriodHours: '100.00',
      additionalWorkedHours: '7.458',
      additionalHoursUpliftPercent: '0',
      additionalHoursUpliftEvidence: 'VERIFIED_CAO_OR_EMPLOYER_RULE',
      additionalHoursUpliftSourceReference: 'test vector',
      additionalHoursUpliftSourceVersion: 'rounding-boundary-1',
      calculationPolicy: {
        status: 'VERIFIED_EMPLOYER_POLICY',
        version: PFZW_2026_MONTHLY_ALLOCATION_TEST_APPROVED_VERSION,
        sourceReference: syntheticTestMonthlyPolicy.sourceReference,
        monthlyMethod: 'ANNUAL_RATE_DIVIDED_BY_12',
        shareRounding: 'HALF_UP_CENTS_PER_EMPLOYEE_AND_EMPLOYER_SHARE',
      },
    }))

    // Independent oracle: RegLn=12,000+960+660+3,750=17,370; base=87;
    // period DTF=107.46/100=1.0746; pension base=87*1.0746=93.4902.
    // Employee: 93.4902*12.9%/12=1.00501965 -> 1.01 (HALF_UP).
    // Employer: 93.4902*13%/12=1.0128105 -> 1.01 (HALF_UP).
    expect(result).toMatchObject({
      pensionableAnnualSalary: '17370.00',
      pensionableHours: '107.46',
      finalPartTimeFactor: '1.0746',
      pensionableBase: '93.49',
      employeePremiumMonthly: '1.01',
      employerBasicPremiumMonthly: '1.01',
      allocationDifference: '0.00',
    })
  })

  it('reconciles separately rounded employee and employer shares and reduces all fiscal bases only by employee share', () => {
    const result = calculatePfzw2026Kinderopvang(pfzwInput({ monthlyPayrollGross: '3044.44' }))
    expect(result.employeePremiumMonthly).toBe('280.61')
    expect(result.employerPremiumMonthly).toBe('282.79')
    expect(result.totalPremiumMonthly).toBe('563.40')
    expect(result.allocationDifference).toBe('0.00')
    expect(result.fiscalBases).toEqual({ wageTax: '2763.83', employeeInsurance: '2763.83', zvw: '2763.83' })
  })

  it('does not apply WIA-excedent unless the independent salary base exceeds its franchise', () => {
    const ordinary = calculatePfzw2026Kinderopvang(pfzwInput())
    const belowWiaFranchise = calculatePfzw2026Kinderopvang(pfzwInput({
      fullTimeMonthlySalary: '5500',
      structuralYearEndAllowanceEligibleAnnualBase: '66000',
      contractHoursPerWeek: '36',
    }))
    expect(ordinary.wiaExcessBase).toBe('0.00')
    expect(ordinary.employerWiaExcessPremiumMonthly).toBe('0.00')
    expect(belowWiaFranchise.wiaExcessBase).toBe('0.00')
    const wiaWithAdditionalStructuralPay = calculatePfzw2026Kinderopvang(pfzwInput({
      fullTimeMonthlySalary: '6000',
      structuralYearEndAllowanceEligibleAnnualBase: '72000',
      additionalStructuralSalaryComponents: [{
        code: 'WIA_BOUNDARY_COMPONENT', annualAmount: '3623', sourceVersion: 'test', sourceReference: 'synthetic boundary vector',
      }],
      contractHoursPerWeek: '36',
    }))
    expect(wiaWithAdditionalStructuralPay.wiaExcessBase).toBe('5934.00')
    expect(wiaWithAdditionalStructuralPay.employerWiaExcessPremiumMonthly).toBe('16.81')
  })

  it('blocks missing participation and invalid effective dates without a numeric zero fallback', () => {
    expect(calculatePfzw2026Kinderopvang(pfzwInput({ participationStatus: 'UNCONFIRMED' }))).toMatchObject({
      status: 'BLOCKED', reasonCodes: ['PFZW_PARTICIPATION_UNCONFIRMED'], employeePremiumMonthly: null,
    })
    expect(calculatePfzw2026Kinderopvang(pfzwInput({ participationStartDate: '2026-09-31' }))).toMatchObject({
      status: 'BLOCKED', reasonCodes: ['PFZW_2026_INPUT_INVALID'], employerPremiumMonthly: null,
    })
    expect(calculatePfzw2026Kinderopvang(pfzwInput({ participationStartDate: '2026-09-15' }))).toMatchObject({
      status: 'BLOCKED', reasonCodes: ['PFZW_PARTIAL_MONTH_PRORATION_UNVERIFIED'], totalPremiumMonthly: null,
    })
  })

  it('blocks missing uplift, EJU, and calculation-rule evidence rather than silently treating them as zero', () => {
    expect(calculatePfzw2026Kinderopvang(pfzwInput({
      additionalWorkedHours: '8',
      additionalHoursUpliftPercent: null,
      additionalHoursUpliftEvidence: null,
    })).reasonCodes).toContain('PFZW_ADDITIONAL_HOURS_UPLIFT_UNVERIFIED')
    expect(calculatePfzw2026Kinderopvang(pfzwInput({
      structuralYearEndAllowancePercent: null,
      structuralYearEndAllowanceReferenceDate: null,
    })).status).toBe('BLOCKED')
    expect(calculatePfzw2026Kinderopvang(pfzwInput({
      structuralYearEndAllowanceSourceReference: null,
      structuralYearEndAllowanceSourceVersion: null,
    })).reasonCodes).toContain('PFZW_PRIOR_YEAR_EJU_SOURCE_UNVERIFIED')
    expect(calculatePfzw2026Kinderopvang(pfzwInput({
      additionalWorkedHours: '8',
      additionalHoursUpliftPercent: '0',
      additionalHoursUpliftEvidence: 'VERIFIED_CAO_OR_EMPLOYER_RULE',
      additionalHoursUpliftSourceReference: null,
      additionalHoursUpliftSourceVersion: null,
    })).reasonCodes).toContain('PFZW_ADDITIONAL_HOURS_UPLIFT_SOURCE_UNVERIFIED')
    expect(calculatePfzw2026Kinderopvang(pfzwInput({
      calculationPolicy: { ...syntheticTestMonthlyPolicy, version: 'PFZW-2026-MONTHLY-ALLOCATION-CANDIDATE-1' },
    })).reasonCodes).toContain('PFZW_MONTHLY_CENT_ALLOCATION_POLICY_UNVERIFIED')
    expect(calculatePfzw2026Kinderopvang(pfzwInput({
      calculationPolicy: { ...syntheticTestMonthlyPolicy, sourceReference: null },
    })).reasonCodes).toContain('PFZW_MONTHLY_CENT_ALLOCATION_POLICY_UNVERIFIED')
    expect(calculatePfzw2026Kinderopvang(pfzwInput({
      calculationPolicy: { ...syntheticTestMonthlyPolicy, status: 'PROVISIONAL_PREVIEW' },
    })).reasonCodes).toContain('PFZW_MONTHLY_CENT_ALLOCATION_POLICY_UNVERIFIED')
  })

  it('integrates only a fully evidenced calculation into the existing PAYRUN01 pension contract', () => {
    const inputs = pfzwInput({
      calculationPolicy: {
        status: 'SYNTHETIC_TEST_APPROVED',
        version: PFZW_2026_MONTHLY_ALLOCATION_TEST_APPROVED_VERSION,
        sourceReference: syntheticTestMonthlyPolicy.sourceReference,
        monthlyMethod: 'ANNUAL_RATE_DIVIDED_BY_12',
        shareRounding: 'HALF_UP_CENTS_PER_EMPLOYEE_AND_EMPLOYER_SHARE',
      },
    })
    const result = calculatePension(pensionInput(inputs))
    expect(result).toMatchObject({
      status: 'CALCULATED',
      employeePremiumMonthly: '280.61',
      employerPremiumMonthly: '282.79',
      fiscalBases: { wageTax: '2763.83', employeeInsurance: '2763.83', zvw: '2763.83' },
      pfzw2026Details: {
        ruleVersion: PFZW_2026_KINDEROPVANG_RULE_VERSION,
        contractualPartTimeFactor: '0.8889',
        pensionableHours: '138.67',
        finalPartTimeFactor: '0.8889',
      },
    })
    expect(result.trace.map((step) => step.componentCode)).toEqual(expect.arrayContaining([
      'PFZW_REGELINGLOON_CONSTRUCTION', 'PFZW_UPA_PENSIONABLE_HOURS',
      'PFZW_OPNP_EMPLOYEE_PREMIUM', 'PFZW_OPNP_EMPLOYER_PREMIUM',
      'PFZW_WIA_EXCESS_EMPLOYER_PREMIUM', 'PFZW_EMPLOYEE_PENSION_FISCAL_BASES',
    ]))
    expect(calculatePension(pensionInput(pfzwInput({
      calculationPolicy: { ...syntheticTestMonthlyPolicy, status: 'PROVISIONAL_PREVIEW' },
    }))).status).toBe('BLOCKED')
  })

  it('keeps the full annual basics separate from period work and never accumulates extra hours across months', () => {
    const september = calculatePfzw2026Kinderopvang(pfzwInput())
    const october = calculatePfzw2026Kinderopvang(pfzwInput({
      period: { year: 2026, month: 10 }, participationStartDate: '2026-09-01', salaryBasisDate: '2026-09-01',
      additionalWorkedHours: '8', additionalHoursUpliftPercent: '11.2179487179',
      additionalHoursUpliftEvidence: 'SYNTHETIC_TEST_ONLY_POLICY', monthlyPayrollGross: '3219.41',
      additionalHoursUpliftSourceReference: 'https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/vakantie; https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/verlofbudget; https://www.pfzw.nl/content/dam/pfzw/web/werkgevers/pensioenaangifte/2026_Handleiding-aanlevering-UPA-gegevens.pdf',
      additionalHoursUpliftSourceVersion: PFZW_2026_SYNTHETIC_TEST_EXTRA_HOURS_UPLIFT_VERSION,
    }))
    expect(september.pensionableAnnualSalary).toBe(october.pensionableAnnualSalary)
    expect(september.additionalHoursForArrangement).toBe('0')
    expect(october.additionalHoursForArrangement).toBe('8.897435897432')
    expect(october.pensionableHours).toBe('147.57')
    expect(october.trace.find((row) => row.componentCode === 'PFZW_UPA_PENSIONABLE_HOURS')?.ruleProvenance.upaManual)
      .toBe('January 2026 version 5.0')
  })
})
