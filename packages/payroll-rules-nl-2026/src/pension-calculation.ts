import { FixedDecimal } from '@liquid-hr/payroll-engine'
import {
  calculatePfzw2026Kinderopvang,
  PFZW_2026_KINDEROPVANG_METHOD,
  type Pfzw2026CalculationInput,
} from './pfzw-2026'

export interface PensionRateTier {
  readonly minAge: number
  readonly maxAge: number
  readonly totalRate: string
}

export interface PensionArrangementInput {
  readonly arrangementId: string
  readonly arrangementCode: string
  readonly arrangementVersion: string
  readonly arrangementType: 'FLAT_PREMIUM' | 'PROGRESSIVE_PREMIUM'
  readonly effectiveFrom: string
  readonly arrangementEstablishedFrom: string | null
  readonly effectiveTo: string | null
  readonly transitionDate: string | null
  readonly grandfatheringMode: 'NONE' | 'EERBIEDIGENDE_WERKING'
  readonly flatTotalRate: string | null
  readonly employerSharePercent: string
  readonly employeeSharePercent: string
  readonly annualFranchise: string
  readonly annualPensionableSalaryCap: string | null
  readonly pensionableSalaryDefinition: Readonly<Record<string, unknown>>
  readonly eligibilityRule: Readonly<Record<string, unknown>>
  readonly contractClassification: 'SOLIDARITY' | 'NON_SOLIDARITY' | 'UNKNOWN'
  readonly contractClassificationProvenance: Readonly<Record<string, unknown>>
  readonly provenance: Readonly<Record<string, unknown>>
  readonly tiers: readonly PensionRateTier[]
}

export interface PensionCalculationInput {
  readonly arrangement: PensionArrangementInput
  readonly period: { readonly year: number; readonly month: number }
  /** Full-time monthly pensionable salary before the part-time factor. */
  readonly fullTimeMonthlyPensionableSalary: string
  /** Actual period gross used for the three payroll-tax assessment bases. */
  readonly monthlyPayrollGross: string
  readonly partTimeFactor: string
  /** Required only for progressive arrangements; supplied as an age, not a date of birth. */
  readonly ageForTier: number | null
  readonly participationStartDate: string
  readonly sourceSnapshotId: string
  readonly sourceSnapshotHash: string
  /** Bound after CalculationInputSet persistence; omitted during source projection. */
  readonly inputSetId?: string
  readonly inputHash?: string
  /** Present only for an effective PFZW 2026 arrangement with explicit UPA inputs. */
  readonly pfzw2026?: Pfzw2026CalculationInput
}

export interface PensionTraceStep {
  readonly source: string
  readonly componentCode: string
  readonly componentVersion: string
  readonly inputs: Readonly<Record<string, string | number | null>>
  readonly assessmentBase: string | null
  readonly rate: string | null
  readonly formula: string
  readonly unroundedValue: string | null
  readonly roundingRule: string
  readonly roundingStage: string
  readonly result: string | null
  readonly dependencies: readonly string[]
  readonly ruleProvenance: Readonly<Record<string, unknown>>
  readonly sourceSnapshotId: string
  readonly sourceSnapshotHash: string
  readonly inputSetId: string
  readonly inputHash: string
}

export interface PensionCalculationResult {
  readonly status: 'CALCULATED' | 'BLOCKED'
  readonly reasonCode: string | null
  readonly arrangementId: string
  readonly arrangementCode: string
  readonly arrangementNameSource: 'CORE'
  readonly rate: string | null
  readonly ageTier: { readonly minAge: number; readonly maxAge: number } | null
  readonly annualizedPensionableSalary: string | null
  readonly cappedPensionableSalary: string | null
  readonly adjustedFranchise: string | null
  readonly pensionableBase: string | null
  readonly totalPremiumAnnual: string | null
  readonly totalPremiumMonthly: string | null
  readonly employeePremiumMonthly: string | null
  readonly employerPremiumMonthly: string | null
  readonly allocationDifference: string | null
  readonly pfzw2026Details?: {
    readonly ruleVersion: string
    readonly contractualPartTimeFactor: string
    readonly pensionableHours: string
    readonly finalPartTimeFactor: string
    readonly employerBasicPremiumMonthly: string
    readonly employerWiaExcessPremiumMonthly: string
  }
  readonly fiscalBases: {
    readonly wageTax: string | null
    readonly employeeInsurance: string | null
    readonly zvw: string | null
  }
  readonly trace: readonly PensionTraceStep[]
}

const ZERO = FixedDecimal.parse('0')
const TWELVE = FixedDecimal.parse('12')
const ONE_HUNDRED = FixedDecimal.parse('100')

function money(value: FixedDecimal): string {
  return value.toString(2)
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function recordText(value: Readonly<Record<string, unknown>>, key: string): string | null {
  return typeof value[key] === 'string' ? value[key] as string : null
}

function blocked(input: PensionCalculationInput, reasonCode: string): PensionCalculationResult {
  return {
    status: 'BLOCKED',
    reasonCode,
    arrangementId: input.arrangement.arrangementId,
    arrangementCode: input.arrangement.arrangementCode,
    arrangementNameSource: 'CORE',
    rate: null,
    ageTier: null,
    annualizedPensionableSalary: null,
    cappedPensionableSalary: null,
    adjustedFranchise: null,
    pensionableBase: null,
    totalPremiumAnnual: null,
    totalPremiumMonthly: null,
    employeePremiumMonthly: null,
    employerPremiumMonthly: null,
    allocationDifference: null,
    fiscalBases: { wageTax: null, employeeInsurance: null, zvw: null },
    trace: [],
  }
}

/**
 * Resolves a scoped, versioned Core arrangement into monthly Payroll amounts.
 * All inputs and intermediate amounts use exact base-10 decimal arithmetic.
 * The scheme-specific period allocation and two-decimal HALF_UP policy are
 * explicit here, in the calculation package, rather than in persona or UI code.
 */
export function calculatePension(input: PensionCalculationInput): PensionCalculationResult {
  const { arrangement } = input
  if (!validDate(arrangement.effectiveFrom)
    || (arrangement.effectiveTo !== null && !validDate(arrangement.effectiveTo))
    || (arrangement.arrangementEstablishedFrom !== null && !validDate(arrangement.arrangementEstablishedFrom))
    || !validDate(input.participationStartDate)
    || input.period.month < 1 || input.period.month > 12
    || !/^[0-9a-f]{64}$/i.test(input.sourceSnapshotHash)
    || (input.inputHash !== undefined && !/^[0-9a-f]{64}$/i.test(input.inputHash))
    || input.sourceSnapshotId.length === 0 || (input.inputSetId !== undefined && input.inputSetId.length === 0)) {
    return blocked(input, 'PENSION_INPUT_INVALID')
  }
  const periodStart = `${input.period.year}-${String(input.period.month).padStart(2, '0')}-01`
  const periodEnd = new Date(Date.UTC(input.period.year, input.period.month, 0)).toISOString().slice(0, 10)
  if (arrangement.effectiveFrom > periodEnd
    || (arrangement.effectiveTo !== null && arrangement.effectiveTo < periodStart)
    || input.participationStartDate > periodEnd) {
    return blocked(input, 'PENSION_ARRANGEMENT_NOT_EFFECTIVE_FOR_PERIOD')
  }
  if (recordText(arrangement.pensionableSalaryDefinition, 'method') === PFZW_2026_KINDEROPVANG_METHOD) {
    if (input.pfzw2026 === undefined) return blocked(input, 'PFZW_2026_INPUT_MISSING')
    const pfzw = calculatePfzw2026Kinderopvang(input.pfzw2026)
    if (pfzw.status !== 'CALCULATED') {
      return blocked(input, pfzw.reasonCodes[0] ?? 'PFZW_2026_EVIDENCE_GATE_BLOCKED')
    }
    return {
      status: 'CALCULATED',
      reasonCode: null,
      arrangementId: arrangement.arrangementId,
      arrangementCode: arrangement.arrangementCode,
      arrangementNameSource: 'CORE',
      rate: '25.9',
      ageTier: null,
      annualizedPensionableSalary: pfzw.pensionableAnnualSalary,
      cappedPensionableSalary: pfzw.cappedPensionableSalary,
      adjustedFranchise: FixedDecimal.parse('17283')
        .multiply(FixedDecimal.parse(pfzw.finalPartTimeFactor!)).round(2, 'HALF_UP').toString(2),
      pensionableBase: pfzw.pensionableBase,
      totalPremiumAnnual: pfzw.totalPremiumAnnual,
      totalPremiumMonthly: pfzw.totalPremiumMonthly,
      employeePremiumMonthly: pfzw.employeePremiumMonthly,
      employerPremiumMonthly: pfzw.employerPremiumMonthly,
      allocationDifference: pfzw.allocationDifference,
      fiscalBases: pfzw.fiscalBases,
      trace: pfzw.trace,
      pfzw2026Details: {
        ruleVersion: pfzw.ruleVersion,
        contractualPartTimeFactor: pfzw.contractualPartTimeFactor!,
        pensionableHours: pfzw.pensionableHours!,
        finalPartTimeFactor: pfzw.finalPartTimeFactor!,
        employerBasicPremiumMonthly: pfzw.employerBasicPremiumMonthly!,
        employerWiaExcessPremiumMonthly: pfzw.employerWiaExcessPremiumMonthly!,
      },
    }
  }
  if (arrangement.grandfatheringMode === 'EERBIEDIGENDE_WERKING') {
    if (arrangement.transitionDate === null || !validDate(arrangement.transitionDate)) {
      return blocked(input, 'PENSION_GRANDFATHERING_TRANSITION_DATE_UNVERIFIED')
    }
    if (arrangement.arrangementEstablishedFrom === null || arrangement.arrangementEstablishedFrom > '2023-06-30') {
      return blocked(input, 'PENSION_GRANDFATHERING_ARRANGEMENT_START_DATE_UNSUPPORTED')
    }
    if (input.participationStartDate >= arrangement.transitionDate) {
      return blocked(input, 'PENSION_GRANDFATHERING_PARTICIPATION_START_NOT_BEFORE_TRANSITION')
    }
    if (arrangement.contractClassification !== 'NON_SOLIDARITY') {
      return blocked(input, 'PENSION_GRANDFATHERING_CONTRACT_CLASSIFICATION_UNPROVEN')
    }
  }
  if (arrangement.grandfatheringMode === 'NONE' && arrangement.arrangementType === 'PROGRESSIVE_PREMIUM') {
    return blocked(input, 'PENSION_PROGRESSIVE_PREMIUM_REQUIRES_VERIFIED_TRANSITION')
  }
  const annualization = recordText(arrangement.pensionableSalaryDefinition, 'annualization')
  const basis = recordText(arrangement.pensionableSalaryDefinition, 'basis')
  if (annualization !== '12_X_REGULAR_MONTHLY_PENSIONABLE_SALARY'
    || basis !== 'ANNUAL_PENSIONABLE_SALARY_MINUS_FRANCHISE'
    || arrangement.pensionableSalaryDefinition.floorAtZero !== true) {
    return blocked(input, 'PENSIONABLE_SALARY_DEFINITION_UNSUPPORTED')
  }
  const participantGroup = recordText(arrangement.eligibilityRule, 'participantGroup')
  if (arrangement.arrangementType === 'FLAT_PREMIUM') {
    const effectiveStart = recordText(arrangement.eligibilityRule, 'employmentOrParticipationStartOnOrAfter')
    if (participantGroup !== 'NEW_ENTRANT' || !effectiveStart || !validDate(effectiveStart)
      || input.participationStartDate < effectiveStart) {
      return blocked(input, 'PENSION_FLAT_PREMIUM_ELIGIBILITY_UNPROVEN')
    }
  }
  if (arrangement.arrangementType === 'PROGRESSIVE_PREMIUM') {
    const transitionMethod = recordText(arrangement.eligibilityRule, 'transitionMethod')
    const participationStartBefore = recordText(arrangement.eligibilityRule, 'participationStartBefore')
    if (participantGroup !== 'GRANDFATHERED') {
      return blocked(input, 'PENSION_GRANDFATHERING_PARTICIPANT_GROUP_UNPROVEN')
    }
    if (transitionMethod !== 'EERBIEDIGENDE_WERKING') {
      return blocked(input, 'PENSION_GRANDFATHERING_METHOD_UNVERIFIED')
    }
    if (participationStartBefore === null || !validDate(participationStartBefore)) {
      return blocked(input, 'PENSION_GRANDFATHERING_PARTICIPATION_CUTOFF_UNVERIFIED')
    }
    if (arrangement.transitionDate !== participationStartBefore) {
      return blocked(input, 'PENSION_GRANDFATHERING_TRANSITION_CUTOFF_MISMATCH')
    }
    if (input.participationStartDate >= participationStartBefore) {
      return blocked(input, 'PENSION_GRANDFATHERING_PARTICIPATION_NOT_BEFORE_CUTOFF')
    }
  }

  let invalidDecimalInput: string | null = null
  const parseInput = (value: string, reasonCode: string): FixedDecimal => {
    try {
      return FixedDecimal.parse(value)
    } catch {
      invalidDecimalInput ??= reasonCode
      return ZERO
    }
  }
  const fullTimeMonthlySalary = parseInput(input.fullTimeMonthlyPensionableSalary, 'PENSION_FULL_TIME_PENSIONABLE_SALARY_INPUT_INVALID')
  const monthlyGrossInput = parseInput(input.monthlyPayrollGross, 'PENSION_MONTHLY_PAYROLL_GROSS_INPUT_INVALID')
  const partTimeFactor = parseInput(input.partTimeFactor, 'PENSION_PART_TIME_FACTOR_INPUT_INVALID')
  const franchise = parseInput(arrangement.annualFranchise, 'PENSION_ANNUAL_FRANCHISE_INPUT_INVALID')
  const employerShare = parseInput(arrangement.employerSharePercent, 'PENSION_EMPLOYER_SHARE_INPUT_INVALID')
  const employeeShare = parseInput(arrangement.employeeSharePercent, 'PENSION_EMPLOYEE_SHARE_INPUT_INVALID')
  const cap = arrangement.annualPensionableSalaryCap === null
    ? null
    : parseInput(arrangement.annualPensionableSalaryCap, 'PENSION_ANNUAL_SALARY_CAP_INPUT_INVALID')
  if (invalidDecimalInput !== null) return blocked(input, invalidDecimalInput)

  const annualSalary = fullTimeMonthlySalary.multiply(TWELVE)
  const monthlyGross = monthlyGrossInput
  if (partTimeFactor.compare(ZERO) <= 0 || partTimeFactor.compare(FixedDecimal.parse('1')) > 0) {
    return blocked(input, 'PENSION_PART_TIME_FACTOR_OUT_OF_RANGE')
  }
  if (franchise.compare(ZERO) < 0) return blocked(input, 'PENSION_ANNUAL_FRANCHISE_NEGATIVE')
  if (employeeShare.add(employerShare).compare(ONE_HUNDRED) !== 0) {
    return blocked(input, 'PENSION_PREMIUM_SHARES_NOT_100_PERCENT')
  }
  if (annualSalary.compare(ZERO) < 0) return blocked(input, 'PENSION_ANNUALIZED_SALARY_NEGATIVE')
  if (monthlyGross.compare(ZERO) < 0) return blocked(input, 'PENSION_MONTHLY_PAYROLL_GROSS_NEGATIVE')
  if (cap !== null && cap.compare(ZERO) <= 0) return blocked(input, 'PENSION_ANNUAL_SALARY_CAP_NOT_POSITIVE')

  let rateText = arrangement.flatTotalRate
  let selectedTier: PensionRateTier | null = null
  if (arrangement.arrangementType === 'PROGRESSIVE_PREMIUM') {
    if (input.ageForTier === null || !Number.isInteger(input.ageForTier)) return blocked(input, 'PENSION_AGE_TIER_UNRESOLVED')
    const matches = arrangement.tiers.filter((tier) => tier.minAge <= input.ageForTier! && input.ageForTier! <= tier.maxAge)
    if (matches.length !== 1) return blocked(input, 'PENSION_AGE_TIER_AMBIGUOUS')
    selectedTier = matches[0] ?? null
    rateText = selectedTier?.totalRate ?? null
  }
  if (rateText === null || !/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(rateText)) {
    return blocked(input, 'PENSION_RATE_UNRESOLVED')
  }

  const cappedSalary = cap !== null && annualSalary.compare(cap) > 0 ? cap : annualSalary
  const adjustedFranchise = franchise.multiply(partTimeFactor)
  const annualBaseBeforePartTime = cappedSalary.subtract(franchise)
  const pensionableBase = (annualBaseBeforePartTime.compare(ZERO) > 0 ? annualBaseBeforePartTime : ZERO)
    .multiply(partTimeFactor)
  const rate = FixedDecimal.parse(rateText)
  const annualPremium = pensionableBase.multiply(rate).divideToScale(ONE_HUNDRED, 8, 'ARITHMETIC')
  const monthlyPremiumUnrounded = annualPremium.divideToScale(TWELVE, 8, 'ARITHMETIC')
  const monthlyPremium = monthlyPremiumUnrounded.round(2, 'ARITHMETIC')
  const employeeMonthlyUnrounded = monthlyPremium.multiply(employeeShare).divideToScale(ONE_HUNDRED, 8, 'ARITHMETIC')
  const employerMonthlyUnrounded = monthlyPremium.multiply(employerShare).divideToScale(ONE_HUNDRED, 8, 'ARITHMETIC')
  const employeeMonthly = employeeMonthlyUnrounded.round(2, 'ARITHMETIC')
  const employerMonthly = employerMonthlyUnrounded.round(2, 'ARITHMETIC')
  const allocationDifference = monthlyPremium.subtract(employeeMonthly).subtract(employerMonthly)
  const allocatedGross = monthlyGross.subtract(employeeMonthly)
  const fiscalBase = allocatedGross.compare(ZERO) > 0 ? allocatedGross : ZERO
  const canonicalInputs = {
    arrangementId: arrangement.arrangementId,
    arrangementCode: arrangement.arrangementCode,
    arrangementVersion: arrangement.arrangementVersion,
    period: `${input.period.year}-${String(input.period.month).padStart(2, '0')}`,
    arrangementEstablishedFrom: arrangement.arrangementEstablishedFrom,
    versionEffectiveFrom: arrangement.effectiveFrom,
    fullTimeMonthlyPensionableSalary: input.fullTimeMonthlyPensionableSalary,
    annualizationMonths: '12',
    partTimeFactor: input.partTimeFactor,
    annualFranchise: arrangement.annualFranchise,
    annualPensionableSalaryCap: arrangement.annualPensionableSalaryCap,
    ageForTier: input.ageForTier,
    participationStartDate: input.participationStartDate,
    contractClassification: arrangement.contractClassification,
  }
  const traceBase = {
    source: 'Core pension arrangement and employment assignment',
    componentVersion: arrangement.arrangementVersion,
    ruleProvenance: {
      ...arrangement.provenance,
      arrangementEstablishedFrom: arrangement.arrangementEstablishedFrom,
      versionEffectiveFrom: arrangement.effectiveFrom,
      eligibilityRule: arrangement.eligibilityRule,
      pensionableSalaryDefinition: arrangement.pensionableSalaryDefinition,
      contractClassification: arrangement.contractClassification,
      contractClassificationProvenance: arrangement.contractClassificationProvenance,
    },
    sourceSnapshotId: input.sourceSnapshotId,
    sourceSnapshotHash: input.sourceSnapshotHash,
    inputSetId: input.inputSetId ?? '',
    inputHash: input.inputHash ?? '',
  }
  const trace: PensionTraceStep[] = [
    {
      ...traceBase,
      componentCode: 'PENSION_ANNUALIZED_PENSIONABLE_SALARY',
      inputs: { fullTimeMonthlyPensionableSalary: input.fullTimeMonthlyPensionableSalary, annualizationMonths: 12 },
      assessmentBase: input.fullTimeMonthlyPensionableSalary,
      rate: null,
      formula: 'fullTimeMonthlyPensionableSalary × 12',
      unroundedValue: annualSalary.toString(),
      roundingRule: 'No rounding before pension base evaluation',
      roundingStage: 'ANNUALIZATION',
      result: annualSalary.toString(),
      dependencies: [],
    },
    {
      ...traceBase,
      componentCode: 'PENSION_PENSIONABLE_BASE',
      inputs: { ...canonicalInputs, cappedPensionableSalary: cappedSalary.toString(), adjustedFranchise: adjustedFranchise.toString() },
      assessmentBase: cappedSalary.toString(),
      rate: null,
      formula: 'max(min(annualizedSalary, salaryCap) − annualFranchise, 0) × partTimeFactor',
      unroundedValue: pensionableBase.toString(),
      roundingRule: 'No rounding before premium calculation',
      roundingStage: 'PENSIONABLE_BASE',
      result: money(pensionableBase),
      dependencies: ['PENSION_ANNUALIZED_PENSIONABLE_SALARY'],
    },
    {
      ...traceBase,
      componentCode: arrangement.arrangementType === 'FLAT_PREMIUM' ? 'PENSION_FLAT_RATE' : 'PENSION_AGE_TIER_RATE',
      inputs: { ...canonicalInputs, selectedTierMinAge: selectedTier?.minAge ?? null, selectedTierMaxAge: selectedTier?.maxAge ?? null },
      assessmentBase: money(pensionableBase),
      rate: rateText,
      formula: arrangement.arrangementType === 'FLAT_PREMIUM' ? 'Core flat total premium rate' : 'Core progressive rate for the supplied age band',
      unroundedValue: rate.toString(4),
      roundingRule: 'Core source rate; no calculation rounding',
      roundingStage: 'RATE_RESOLUTION',
      result: rate.toString(4),
      dependencies: ['PENSION_PENSIONABLE_BASE'],
    },
    {
      ...traceBase,
      componentCode: 'PENSION_MONTHLY_TOTAL',
      inputs: { annualPensionableBase: pensionableBase.toString(), annualRatePercent: rateText, annualizationMonths: 12 },
      assessmentBase: money(pensionableBase),
      rate: rateText,
      formula: 'pensionableBase × totalRate ÷ 100 ÷ 12',
      unroundedValue: monthlyPremiumUnrounded.toString(),
      roundingRule: 'HALF_UP to 2 decimal places after annual total is allocated to the month',
      roundingStage: 'MONTHLY_TOTAL',
      result: money(monthlyPremium),
      dependencies: [
        'PENSION_PENSIONABLE_BASE',
        arrangement.arrangementType === 'FLAT_PREMIUM' ? 'PENSION_FLAT_RATE' : 'PENSION_AGE_TIER_RATE',
      ],
    },
    {
      ...traceBase,
      componentCode: 'PENSION_EMPLOYEE_SHARE',
      inputs: { monthlyTotal: money(monthlyPremium), employeeSharePercent: arrangement.employeeSharePercent },
      assessmentBase: money(monthlyPremium),
      rate: arrangement.employeeSharePercent,
      formula: 'monthlyTotal × employeeSharePercent ÷ 100',
      unroundedValue: employeeMonthlyUnrounded.toString(),
      roundingRule: 'HALF_UP to 2 decimal places; allocation must reconcile to monthly total',
      roundingStage: 'EMPLOYEE_SHARE',
      result: money(employeeMonthly),
      dependencies: ['PENSION_MONTHLY_TOTAL'],
    },
    {
      ...traceBase,
      componentCode: 'PENSION_EMPLOYER_SHARE',
      inputs: { monthlyTotal: money(monthlyPremium), employerSharePercent: arrangement.employerSharePercent },
      assessmentBase: money(monthlyPremium),
      rate: arrangement.employerSharePercent,
      formula: 'monthlyTotal × employerSharePercent ÷ 100',
      unroundedValue: employerMonthlyUnrounded.toString(),
      roundingRule: 'HALF_UP to 2 decimal places; allocation must reconcile to monthly total',
      roundingStage: 'EMPLOYER_SHARE',
      result: money(employerMonthly),
      dependencies: ['PENSION_MONTHLY_TOTAL'],
    },
    {
      ...traceBase,
      componentCode: 'PENSION_EMPLOYEE_TAX_ASSESSMENT_BASES',
      inputs: { monthlyPayrollGross: input.monthlyPayrollGross, employeePension: money(employeeMonthly) },
      assessmentBase: input.monthlyPayrollGross,
      rate: null,
      formula: 'gross − employee pension contribution (applied separately to wage-tax, employee-insurance and Zvw bases)',
      unroundedValue: allocatedGross.toString(),
      roundingRule: 'No additional rounding; both source amounts are in cents',
      roundingStage: 'EMPLOYEE_PENSION_DEDUCTION',
      result: money(fiscalBase),
      dependencies: ['PENSION_EMPLOYEE_SHARE'],
    },
  ]

  const balanced = allocationDifference.compare(ZERO) === 0
  return {
    status: balanced ? 'CALCULATED' : 'BLOCKED',
    reasonCode: balanced ? null : 'PENSION_PREMIUM_SPLIT_ROUNDING_UNRESOLVED',
    arrangementId: arrangement.arrangementId,
    arrangementCode: arrangement.arrangementCode,
    arrangementNameSource: 'CORE',
    rate: rateText,
    ageTier: selectedTier ? { minAge: selectedTier.minAge, maxAge: selectedTier.maxAge } : null,
    annualizedPensionableSalary: money(annualSalary),
    cappedPensionableSalary: money(cappedSalary),
    adjustedFranchise: money(adjustedFranchise),
    pensionableBase: money(pensionableBase),
    totalPremiumAnnual: money(annualPremium),
    totalPremiumMonthly: money(monthlyPremium),
    employeePremiumMonthly: money(employeeMonthly),
    employerPremiumMonthly: money(employerMonthly),
    allocationDifference: money(allocationDifference),
    fiscalBases: balanced ? {
      wageTax: money(fiscalBase),
      employeeInsurance: money(fiscalBase),
      zvw: money(fiscalBase),
    } : { wageTax: null, employeeInsurance: null, zvw: null },
    trace,
  }
}
