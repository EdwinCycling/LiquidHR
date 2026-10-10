import { describe, expect, it } from 'vitest'
import { calculatePension, type PensionArrangementInput } from './pension-calculation'

const flatProvenance = {
  source: 'Belastingdienst CAP, 2026 WTP AOW franchise and pensionable-salary cap',
}
const flatArrangement: PensionArrangementInput = {
  arrangementId: 'flat-scheme',
  arrangementCode: 'COMPANY_WTP_FLAT_2026',
  arrangementVersion: '2026-01-01',
  arrangementType: 'FLAT_PREMIUM',
  effectiveFrom: '2026-01-01',
  arrangementEstablishedFrom: '2026-01-01',
  effectiveTo: null,
  transitionDate: '2026-01-01',
  grandfatheringMode: 'NONE',
  flatTotalRate: '15.0000',
  employerSharePercent: '66.6667',
  employeeSharePercent: '33.3333',
  annualFranchise: '19172.00',
  annualPensionableSalaryCap: '137800.00',
  pensionableSalaryDefinition: {
    annualization: '12_X_REGULAR_MONTHLY_PENSIONABLE_SALARY',
    basis: 'ANNUAL_PENSIONABLE_SALARY_MINUS_FRANCHISE',
    floorAtZero: true,
  },
  eligibilityRule: { participantGroup: 'NEW_ENTRANT', employmentOrParticipationStartOnOrAfter: '2026-01-01' },
  contractClassification: 'UNKNOWN',
  contractClassificationProvenance: { status: 'UNVERIFIED' },
  provenance: flatProvenance,
  tiers: [],
}

function input(overrides: Partial<Parameters<typeof calculatePension>[0]> = {}): Parameters<typeof calculatePension>[0] {
  return {
    arrangement: flatArrangement,
    period: { year: 2026, month: 10 },
    fullTimeMonthlyPensionableSalary: '5500.00',
    monthlyPayrollGross: '5500.00',
    partTimeFactor: '1.0000',
    ageForTier: null,
    participationStartDate: '2026-01-01',
    sourceSnapshotId: 'snapshot-id',
    sourceSnapshotHash: 'a'.repeat(64),
    inputSetId: 'input-id',
    inputHash: 'b'.repeat(64),
    ...overrides,
  }
}

describe('calculatePension', () => {
  it('calculates flat monthly premium, split, and three distinct fiscal bases', () => {
    const result = calculatePension(input())
    expect(result).toMatchObject({
      status: 'CALCULATED',
      annualizedPensionableSalary: '66000.00',
      cappedPensionableSalary: '66000.00',
      adjustedFranchise: '19172.00',
      pensionableBase: '46828.00',
      rate: '15.0000',
      totalPremiumAnnual: '7024.20',
      totalPremiumMonthly: '585.35',
      employeePremiumMonthly: '195.12',
      employerPremiumMonthly: '390.23',
      allocationDifference: '0.00',
      fiscalBases: { wageTax: '5304.88', employeeInsurance: '5304.88', zvw: '5304.88' },
    })
    expect(result.trace).toEqual(expect.arrayContaining([
      expect.objectContaining({ componentCode: 'PENSION_PENSIONABLE_BASE', formula: expect.stringContaining('partTimeFactor') }),
      expect.objectContaining({ componentCode: 'PENSION_EMPLOYEE_TAX_ASSESSMENT_BASES', inputHash: 'b'.repeat(64) }),
    ]))
  })

  it('applies an explicit part-time factor to the pension base', () => {
    const result = calculatePension(input({ partTimeFactor: '0.5000', monthlyPayrollGross: '2750.00' }))
    expect(result).toMatchObject({
      pensionableBase: '23414.00',
      totalPremiumMonthly: '292.68',
      employeePremiumMonthly: '97.56',
      employerPremiumMonthly: '195.12',
      fiscalBases: { wageTax: '2652.44', employeeInsurance: '2652.44', zvw: '2652.44' },
    })
  })

  it('calculates the Jaap TEST legacy pension from explicit Annex IV Table 2 OP-only terms', () => {
    const arrangement: PensionArrangementInput = {
      ...flatArrangement,
      arrangementId: 'legacy-scheme',
      arrangementCode: 'COMPANY_LEGACY_PROGRESSIVE_EERBIEDIGD',
      arrangementVersion: '2026-10-correction-v2',
      arrangementType: 'PROGRESSIVE_PREMIUM',
      effectiveFrom: '2026-01-01',
      arrangementEstablishedFrom: '2023-01-01',
      transitionDate: '2026-01-01',
      grandfatheringMode: 'EERBIEDIGENDE_WERKING',
      flatTotalRate: null,
      annualFranchise: '15308.00',
      annualPensionableSalaryCap: '137800.00',
      pensionableSalaryDefinition: {
        ...flatArrangement.pensionableSalaryDefinition,
        ageDetermination: 'AGE_AT_PERIOD_END',
      },
      eligibilityRule: {
        participantGroup: 'GRANDFATHERED',
        transitionMethod: 'EERBIEDIGENDE_WERKING',
        participationStartBefore: '2026-01-01',
        ageDetermination: 'AGE_AT_PERIOD_END',
      },
      contractClassification: 'NON_SOLIDARITY',
      contractClassificationProvenance: {
        status: 'SYNTHETIC_TEST_ASSUMPTION',
        source: 'PAYRUN01 synthetic company arrangement configuration',
      },
      provenance: {
        source: 'Belastingdienst CAP, Staffelbesluit pensioenen, Annex IV Table 2, OP-only column',
        referenceAccrualBasis: '1.701% middelloon',
        taxFranchiseSource: '2026 UBLB article 10aa amount for 1.701% basis',
        ageDetermination: 'AGE_AT_PERIOD_END',
        companyPolicy: 'Synthetic TEST policy: 20% total rate; employer 2/3 and employee 1/3',
        fixtureAssumptions: 'Synthetic regression only: the arrangement was established 2023-01-01 and version 2 became effective 2026-01-01; non-solidarity classification is a synthetic TEST assumption. The Core version dates are read back; legal classification remains unverified.',
      },
      tiers: [{ minAge: 60, maxAge: 64, totalRate: '20.0000' }],
    }
    const result = calculatePension(input({
      arrangement,
      fullTimeMonthlyPensionableSalary: '6750.00',
      monthlyPayrollGross: '6750.00',
      ageForTier: 62,
      participationStartDate: '2018-01-01',
    }))
    expect(result).toMatchObject({
      status: 'CALCULATED',
      ageTier: { minAge: 60, maxAge: 64 },
      annualizedPensionableSalary: '81000.00',
      cappedPensionableSalary: '81000.00',
      adjustedFranchise: '15308.00',
      pensionableBase: '65692.00',
      rate: '20.0000',
      totalPremiumAnnual: '13138.40',
      totalPremiumMonthly: '1094.87',
      employeePremiumMonthly: '364.96',
      employerPremiumMonthly: '729.91',
      fiscalBases: { wageTax: '6385.04', employeeInsurance: '6385.04', zvw: '6385.04' },
    })
    expect(result.trace.find((step) => step.componentCode === 'PENSION_AGE_TIER_RATE')?.ruleProvenance)
      .toMatchObject({
        source: 'Belastingdienst CAP, Staffelbesluit pensioenen, Annex IV Table 2, OP-only column',
        referenceAccrualBasis: '1.701% middelloon',
        taxFranchiseSource: '2026 UBLB article 10aa amount for 1.701% basis',
        ageDetermination: 'AGE_AT_PERIOD_END',
        fixtureAssumptions: 'Synthetic regression only: the arrangement was established 2023-01-01 and version 2 became effective 2026-01-01; non-solidarity classification is a synthetic TEST assumption. The Core version dates are read back; legal classification remains unverified.',
      })
    expect(result.trace.find((step) => step.componentCode === 'PENSION_AGE_TIER_RATE')?.ruleProvenance)
      .toMatchObject({ contractClassification: 'NON_SOLIDARITY', contractClassificationProvenance: { status: 'SYNTHETIC_TEST_ASSUMPTION' } })
  })

  it('blocks progressive grandfathering when contract classification is unknown', () => {
    const arrangement: PensionArrangementInput = {
      ...flatArrangement,
      arrangementType: 'PROGRESSIVE_PREMIUM',
      effectiveFrom: '2023-01-01',
      arrangementEstablishedFrom: '2023-01-01',
      grandfatheringMode: 'EERBIEDIGENDE_WERKING',
      transitionDate: '2026-01-01',
      flatTotalRate: null,
      eligibilityRule: { participantGroup: 'GRANDFATHERED', transitionMethod: 'EERBIEDIGENDE_WERKING', participationStartBefore: '2026-01-01' },
      tiers: [{ minAge: 60, maxAge: 64, totalRate: '20.0000' }],
    }
    expect(calculatePension(input({ arrangement, ageForTier: 62, participationStartDate: '2018-01-01' })))
      .toMatchObject({ status: 'BLOCKED', reasonCode: 'PENSION_GRANDFATHERING_CONTRACT_CLASSIFICATION_UNPROVEN' })
  })

  it('blocks unresolved, overlapping, or ineligible age tiers and unbalanced monthly splits', () => {
    const progressive: PensionArrangementInput = {
      ...flatArrangement,
      arrangementType: 'PROGRESSIVE_PREMIUM',
      effectiveFrom: '2023-01-01',
      arrangementEstablishedFrom: '2023-01-01',
      grandfatheringMode: 'EERBIEDIGENDE_WERKING',
      transitionDate: '2026-01-01',
      flatTotalRate: null,
      eligibilityRule: { participantGroup: 'GRANDFATHERED', transitionMethod: 'EERBIEDIGENDE_WERKING', participationStartBefore: '2026-01-01' },
      contractClassification: 'NON_SOLIDARITY',
      contractClassificationProvenance: { status: 'SYNTHETIC_TEST_ASSUMPTION' },
      tiers: [
        { minAge: 60, maxAge: 64, totalRate: '20.0000' },
        { minAge: 62, maxAge: 66, totalRate: '21.0000' },
      ],
    }
    expect(calculatePension(input({ arrangement: progressive, ageForTier: 62, participationStartDate: '2018-01-01' })).reasonCode)
      .toBe('PENSION_AGE_TIER_AMBIGUOUS')
    expect(calculatePension(input({ arrangement: progressive, ageForTier: null, participationStartDate: '2018-01-01' })).reasonCode)
      .toBe('PENSION_AGE_TIER_UNRESOLVED')
    expect(calculatePension(input({ arrangement: progressive, ageForTier: 62, participationStartDate: '2026-01-01' })).reasonCode)
      .toBe('PENSION_GRANDFATHERING_PARTICIPATION_START_NOT_BEFORE_TRANSITION')
    expect(calculatePension(input({
      arrangement: { ...flatArrangement, employerSharePercent: '65.0000' },
    })).reasonCode).toBe('PENSION_PREMIUM_SHARES_NOT_100_PERCENT')
  })

  it('reports which pension input is malformed without returning the value', () => {
    expect(calculatePension(input({ arrangement: { ...flatArrangement, annualFranchise: '' } })).reasonCode)
      .toBe('PENSION_ANNUAL_FRANCHISE_INPUT_INVALID')
  })

  it('does not serialize invented zero pension bases when a rule blocks the calculation', () => {
    const result = calculatePension(input({
      arrangement: {
        ...flatArrangement,
        arrangementType: 'PROGRESSIVE_PREMIUM',
        effectiveFrom: '2023-01-01',
        arrangementEstablishedFrom: '2023-01-01',
        transitionDate: '2026-01-01',
        grandfatheringMode: 'EERBIEDIGENDE_WERKING',
        flatTotalRate: null,
        eligibilityRule: { participantGroup: 'GRANDFATHERED', transitionMethod: 'EERBIEDIGENDE_WERKING', participationStartBefore: '2026-01-01' },
        contractClassification: 'NON_SOLIDARITY',
        contractClassificationProvenance: { status: 'SYNTHETIC_TEST_ASSUMPTION' },
        tiers: [{ minAge: 60, maxAge: 64, totalRate: '20.0000' }],
      },
      ageForTier: 62,
      participationStartDate: '2026-01-01',
    }))

    expect(result).toMatchObject({
      status: 'BLOCKED',
      reasonCode: 'PENSION_GRANDFATHERING_PARTICIPATION_START_NOT_BEFORE_TRANSITION',
      annualizedPensionableSalary: null,
      cappedPensionableSalary: null,
      adjustedFranchise: null,
      pensionableBase: null,
      totalPremiumAnnual: null,
      totalPremiumMonthly: null,
      employeePremiumMonthly: null,
      employerPremiumMonthly: null,
      fiscalBases: { wageTax: null, employeeInsurance: null, zvw: null },
    })
  })
})
