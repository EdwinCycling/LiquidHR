import { FixedDecimal } from '@liquid-hr/payroll-engine'
import { BPF_DETAILHANDEL_2026_PARAMETERS } from './pension-parameters-2026'

export const BPF_DETAILHANDEL_2026_METHOD = 'BPF_DETAILHANDEL_2026_VCR' as const
export const BPF_DETAILHANDEL_2026_RULE_VERSION = 'BPF-DETAILHANDEL-2026-VCR-1' as const

const ZERO = FixedDecimal.parse('0')
const ONE = FixedDecimal.parse('1')
const TWELVE = FixedDecimal.parse('12')
const THIRTEEN = FixedDecimal.parse('13')
const FIFTY_TWO = FixedDecimal.parse('52')
const HUNDRED = FixedDecimal.parse('100')
const PERCENT_TEXT = /^-?(?:0|[1-9]\d*)(?:\.\d{1,8})?$/

export interface BpfDetailhandel2026CalculationInput {
  readonly period: { readonly year: number; readonly month: number }
  readonly payFrequency: 'MONTHLY' | 'FOUR_WEEKLY' | 'UNKNOWN'
  readonly cumulativePeriodCount: number
  readonly cumulativePeriodCountStatus: 'VERIFIED_SOURCE' | 'UNVERIFIED'
  readonly cumulativePeriodCountEvidence: string | null
  readonly normHoursPerWeek: string
  readonly cumulativePaidHours: string
  readonly cumulativeWfsvSalary: string
  readonly previousCumulativePensionableBase: string
  readonly currentPayrollGross: string
  readonly employerApplicabilityStatus: 'CONFIRMED' | 'UNCONFIRMED'
  readonly employerApplicabilityEvidence: string | null
  readonly employeeEligibilityStatus: 'CONFIRMED' | 'UNCONFIRMED'
  readonly employeeEligibilityEvidence: string | null
  readonly taxTreatmentStatus: 'VERIFIED_SOURCE' | 'UNVERIFIED'
}

export interface BpfDetailhandel2026TraceStep {
  readonly componentCode: string
  readonly inputs: Readonly<Record<string, string | number | null>>
  readonly assessmentBase: string | null
  readonly rate: string | null
  readonly formula: string
  readonly unroundedValue: string | null
  readonly roundingRule: string
  readonly roundingStage: string
  readonly result: string | null
  readonly dependencies: readonly string[]
}

export interface BpfDetailhandel2026CalculationResult {
  readonly status: 'CALCULATED' | 'BLOCKED'
  readonly reasonCode: string | null
  readonly ruleVersion: typeof BPF_DETAILHANDEL_2026_RULE_VERSION
  readonly cumulativePeriodCount: number | null
  readonly cumulativeNormHours: string | null
  readonly cumulativePartTimeFactor: string | null
  readonly cumulativeWfsvSalary: string | null
  readonly cumulativeFranchise: string | null
  readonly cumulativeMaximumSalary: string | null
  readonly cumulativePensionableBase: string | null
  readonly cumulativeTotalPremiumDue: string | null
  readonly periodTotalPremium: string | null
  readonly periodEmployeePremium: string | null
  readonly periodEmployerPremium: string | null
  readonly allocationDifference: string | null
  readonly fiscalBases: {
    readonly wageTax: string | null
    readonly employeeInsurance: string | null
    readonly zvw: string | null
  }
  readonly trace: readonly BpfDetailhandel2026TraceStep[]
}

function money(value: FixedDecimal): string {
  return value.round(2, 'HALF_UP').toString(2)
}

function decimal(value: string): FixedDecimal | null {
  if (!PERCENT_TEXT.test(value)) return null
  try {
    return FixedDecimal.parse(value)
  } catch {
    return null
  }
}

function maximum(left: FixedDecimal, right: FixedDecimal): FixedDecimal {
  return left.compare(right) >= 0 ? left : right
}

function minimum(left: FixedDecimal, right: FixedDecimal): FixedDecimal {
  return left.compare(right) <= 0 ? left : right
}

function blocked(reasonCode: string): BpfDetailhandel2026CalculationResult {
  return {
    status: 'BLOCKED',
    reasonCode,
    ruleVersion: BPF_DETAILHANDEL_2026_RULE_VERSION,
    cumulativePeriodCount: null,
    cumulativeNormHours: null,
    cumulativePartTimeFactor: null,
    cumulativeWfsvSalary: null,
    cumulativeFranchise: null,
    cumulativeMaximumSalary: null,
    cumulativePensionableBase: null,
    cumulativeTotalPremiumDue: null,
    periodTotalPremium: null,
    periodEmployeePremium: null,
    periodEmployerPremium: null,
    allocationDifference: null,
    fiscalBases: { wageTax: null, employeeInsurance: null, zvw: null },
    trace: [],
  }
}

/**
 * Calculates the monthly BPF Detailhandel VCR premium from employer-projected
 * year-to-date payroll facts. Missing scope, period-count, or tax evidence
 * fails closed; no employment or sector applicability is inferred here.
 */
export function calculateBpfDetailhandel2026(
  input: BpfDetailhandel2026CalculationInput,
): BpfDetailhandel2026CalculationResult {
  if (input.period.year !== 2026 || !Number.isInteger(input.period.month) || input.period.month < 1 || input.period.month > 12) {
    return blocked('BPF_DETAILHANDEL_2026_PERIOD_UNSUPPORTED')
  }
  if (input.payFrequency !== 'MONTHLY' && input.payFrequency !== 'FOUR_WEEKLY') {
    return blocked('BPF_DETAILHANDEL_2026_PAY_FREQUENCY_UNSUPPORTED')
  }
  const periodsPerYear = input.payFrequency === 'MONTHLY' ? TWELVE : THIRTEEN
  const periodCountLimit = input.payFrequency === 'MONTHLY' ? input.period.month : 13
  if (!Number.isInteger(input.cumulativePeriodCount) || input.cumulativePeriodCount < 1 || input.cumulativePeriodCount > periodCountLimit) {
    return blocked('BPF_DETAILHANDEL_2026_PERIOD_COUNT_INVALID')
  }
  if (input.cumulativePeriodCountStatus !== 'VERIFIED_SOURCE' || !input.cumulativePeriodCountEvidence?.trim()) {
    return blocked('BPF_DETAILHANDEL_2026_PERIOD_COUNT_UNVERIFIED')
  }
  if (input.employerApplicabilityStatus !== 'CONFIRMED' || !input.employerApplicabilityEvidence?.trim()) {
    return blocked('BPF_DETAILHANDEL_2026_EMPLOYER_APPLICABILITY_UNVERIFIED')
  }
  if (input.employeeEligibilityStatus !== 'CONFIRMED' || !input.employeeEligibilityEvidence?.trim()) {
    return blocked('BPF_DETAILHANDEL_2026_EMPLOYEE_ELIGIBILITY_UNVERIFIED')
  }
  if (input.taxTreatmentStatus !== 'VERIFIED_SOURCE') {
    return blocked('BPF_DETAILHANDEL_2026_TAX_TREATMENT_UNVERIFIED')
  }

  const normHoursPerWeek = decimal(input.normHoursPerWeek)
  const cumulativePaidHours = decimal(input.cumulativePaidHours)
  const cumulativeWfsvSalary = decimal(input.cumulativeWfsvSalary)
  const previousCumulativePensionableBase = decimal(input.previousCumulativePensionableBase)
  const currentPayrollGross = decimal(input.currentPayrollGross)
  if (!normHoursPerWeek || !cumulativePaidHours || !cumulativeWfsvSalary || !previousCumulativePensionableBase || !currentPayrollGross) {
    return blocked('BPF_DETAILHANDEL_2026_DECIMAL_INPUT_INVALID')
  }
  if (normHoursPerWeek.compare(FixedDecimal.parse('35')) < 0 || normHoursPerWeek.compare(FixedDecimal.parse('40')) > 0
    || cumulativePaidHours.compare(ZERO) < 0 || cumulativeWfsvSalary.compare(ZERO) < 0
    || currentPayrollGross.compare(ZERO) < 0) {
    return blocked('BPF_DETAILHANDEL_2026_INPUT_OUT_OF_RANGE')
  }

  const cumulativeNormHours = normHoursPerWeek.multiply(FIFTY_TWO)
    .multiply(FixedDecimal.parse(String(input.cumulativePeriodCount)))
    .divideToScale(periodsPerYear, 8, 'ARITHMETIC')
    .round(2, 'HALF_UP')
  if (cumulativeNormHours.compare(ZERO) <= 0) return blocked('BPF_DETAILHANDEL_2026_NORM_HOURS_INVALID')

  const uncappedPartTimeFactor = cumulativePaidHours
    .divideToScale(cumulativeNormHours, 8, 'ARITHMETIC')
    .multiply(HUNDRED)
    .round(2, 'HALF_UP')
    .divideToScale(HUNDRED, 4, 'ARITHMETIC')
  const cumulativePartTimeFactor = minimum(uncappedPartTimeFactor, ONE)
  const cumulativePeriodFraction = FixedDecimal.parse(String(input.cumulativePeriodCount))
    .divideToScale(periodsPerYear, 8, 'ARITHMETIC')
  const annualFranchise = FixedDecimal.parse(BPF_DETAILHANDEL_2026_PARAMETERS.mandatory.annualFranchise)
  const annualMaximumSalary = FixedDecimal.parse(BPF_DETAILHANDEL_2026_PARAMETERS.mandatory.annualPensionableSalaryCap)
  const cumulativeFranchise = annualFranchise.multiply(cumulativePeriodFraction)
    .multiply(cumulativePartTimeFactor).round(2, 'HALF_UP')
  const cumulativeMaximumSalary = annualMaximumSalary.multiply(cumulativePeriodFraction)
    .multiply(cumulativePartTimeFactor).round(2, 'HALF_UP')
  const cappedSalary = minimum(cumulativeWfsvSalary, cumulativeMaximumSalary)
  const cumulativePensionableBase = maximum(cappedSalary.subtract(cumulativeFranchise), ZERO).round(2, 'HALF_UP')
  if (previousCumulativePensionableBase.compare(ZERO) < 0) return blocked('BPF_DETAILHANDEL_2026_PREVIOUS_BASE_INVALID')
  const periodPensionableBaseIncrease = cumulativePensionableBase.subtract(previousCumulativePensionableBase)

  const totalRate = FixedDecimal.parse(BPF_DETAILHANDEL_2026_PARAMETERS.mandatory.totalRate)
  const employeeRate = FixedDecimal.parse(BPF_DETAILHANDEL_2026_PARAMETERS.mandatory.employeeRate)
  const employerRate = FixedDecimal.parse(BPF_DETAILHANDEL_2026_PARAMETERS.mandatory.employerRate)
  const cumulativeTotalPremiumDue = cumulativePensionableBase.multiply(totalRate).divideToScale(HUNDRED, 8, 'ARITHMETIC').round(2, 'HALF_UP')
  const periodTotalPremium = periodPensionableBaseIncrease.multiply(totalRate).divideToScale(HUNDRED, 8, 'ARITHMETIC').round(2, 'HALF_UP')
  const periodEmployeePremium = periodPensionableBaseIncrease.multiply(employeeRate).divideToScale(HUNDRED, 8, 'ARITHMETIC').round(2, 'HALF_UP')
  const periodEmployerPremium = periodPensionableBaseIncrease.multiply(employerRate).divideToScale(HUNDRED, 8, 'ARITHMETIC').round(2, 'HALF_UP')
  const allocationDifference = periodTotalPremium.subtract(periodEmployeePremium).subtract(periodEmployerPremium)
  const fiscalBase = maximum(currentPayrollGross.subtract(periodEmployeePremium), ZERO)
  const commonInputs = {
    period: `${input.period.year}-${String(input.period.month).padStart(2, '0')}`,
    cumulativePeriodCount: input.cumulativePeriodCount,
    periodsPerYear: periodsPerYear.toString(),
    cumulativeNormHours: money(cumulativeNormHours),
    cumulativePaidHours: input.cumulativePaidHours,
    cumulativeWfsvSalary: money(cumulativeWfsvSalary),
    cumulativePartTimeFactor: cumulativePartTimeFactor.toString(4),
    annualFranchise: BPF_DETAILHANDEL_2026_PARAMETERS.mandatory.annualFranchise,
    annualMaximumSalary: BPF_DETAILHANDEL_2026_PARAMETERS.mandatory.annualPensionableSalaryCap,
    previousCumulativePensionableBase: money(previousCumulativePensionableBase),
    periodPensionableBaseIncrease: money(periodPensionableBaseIncrease),
  }
  const trace: BpfDetailhandel2026TraceStep[] = [
    {
      componentCode: 'BPF_DETAILHANDEL_CUMULATIVE_PENSIONABLE_BASE',
      inputs: commonInputs,
      assessmentBase: money(cappedSalary),
      rate: null,
      formula: 'max(min(cumulative Wfsv wage, prorated maximum salary) − prorated franchise, 0)',
      unroundedValue: cappedSalary.subtract(cumulativeFranchise).toString(),
      roundingRule: 'HALF_UP cents for cumulative franchise, maximum salary, and pensionable base',
      roundingStage: 'CUMULATIVE_VCR_BASE',
      result: money(cumulativePensionableBase),
      dependencies: [],
    },
    {
      componentCode: 'BPF_DETAILHANDEL_CUMULATIVE_TOTAL_PREMIUM',
      inputs: { ...commonInputs, cumulativePensionableBase: money(cumulativePensionableBase) },
      assessmentBase: money(cumulativePensionableBase),
      rate: BPF_DETAILHANDEL_2026_PARAMETERS.mandatory.totalRate,
      formula: 'round((cumulative pensionable base − prior cumulative pensionable base) × total rate, cents)',
      unroundedValue: periodPensionableBaseIncrease.multiply(totalRate).divideToScale(HUNDRED, 8, 'ARITHMETIC').toString(),
      roundingRule: 'HALF_UP to cents on the VCR pensionable-base increase',
      roundingStage: 'VCR_TOTAL_PREMIUM',
      result: money(periodTotalPremium),
      dependencies: ['BPF_DETAILHANDEL_CUMULATIVE_PENSIONABLE_BASE'],
    },
    {
      componentCode: 'BPF_DETAILHANDEL_EMPLOYEE_PREMIUM',
      inputs: { ...commonInputs, employeeRate: BPF_DETAILHANDEL_2026_PARAMETERS.mandatory.employeeRate },
      assessmentBase: money(cumulativePensionableBase),
      rate: BPF_DETAILHANDEL_2026_PARAMETERS.mandatory.employeeRate,
      formula: 'round((cumulative pensionable base − prior cumulative pensionable base) × employee rate, cents)',
      unroundedValue: periodPensionableBaseIncrease.multiply(employeeRate).divideToScale(HUNDRED, 8, 'ARITHMETIC').toString(),
      roundingRule: 'HALF_UP to cents on the VCR pensionable-base increase; component rounding must reconcile to total',
      roundingStage: 'VCR_EMPLOYEE_PREMIUM',
      result: money(periodEmployeePremium),
      dependencies: ['BPF_DETAILHANDEL_CUMULATIVE_PENSIONABLE_BASE'],
    },
    {
      componentCode: 'BPF_DETAILHANDEL_EMPLOYER_PREMIUM',
      inputs: { ...commonInputs, employerRate: BPF_DETAILHANDEL_2026_PARAMETERS.mandatory.employerRate },
      assessmentBase: money(cumulativePensionableBase),
      rate: BPF_DETAILHANDEL_2026_PARAMETERS.mandatory.employerRate,
      formula: 'round((cumulative pensionable base − prior cumulative pensionable base) × employer rate, cents)',
      unroundedValue: periodPensionableBaseIncrease.multiply(employerRate).divideToScale(HUNDRED, 8, 'ARITHMETIC').toString(),
      roundingRule: 'HALF_UP to cents on the VCR pensionable-base increase; component rounding must reconcile to total',
      roundingStage: 'VCR_EMPLOYER_PREMIUM',
      result: money(periodEmployerPremium),
      dependencies: ['BPF_DETAILHANDEL_CUMULATIVE_PENSIONABLE_BASE'],
    },
    {
      componentCode: 'BPF_DETAILHANDEL_EMPLOYEE_TAX_BASES',
      inputs: { currentPayrollGross: input.currentPayrollGross, employeePremium: money(periodEmployeePremium) },
      assessmentBase: input.currentPayrollGross,
      rate: null,
      formula: 'current payroll gross − payroll-withheld employee pension contribution',
      unroundedValue: currentPayrollGross.subtract(periodEmployeePremium).toString(),
      roundingRule: 'No additional rounding; source values are in cents',
      roundingStage: 'EMPLOYEE_PENSION_DEDUCTION',
      result: money(fiscalBase),
      dependencies: ['BPF_DETAILHANDEL_EMPLOYEE_PREMIUM'],
    },
  ]

  if (allocationDifference.compare(ZERO) !== 0) {
    return {
      status: 'BLOCKED',
      reasonCode: 'BPF_DETAILHANDEL_2026_PREMIUM_SPLIT_ROUNDING_UNRESOLVED',
      ruleVersion: BPF_DETAILHANDEL_2026_RULE_VERSION,
      cumulativePeriodCount: input.cumulativePeriodCount,
      cumulativeNormHours: money(cumulativeNormHours),
      cumulativePartTimeFactor: cumulativePartTimeFactor.toString(4),
      cumulativeWfsvSalary: money(cumulativeWfsvSalary),
      cumulativeFranchise: money(cumulativeFranchise),
      cumulativeMaximumSalary: money(cumulativeMaximumSalary),
      cumulativePensionableBase: money(cumulativePensionableBase),
      cumulativeTotalPremiumDue: money(cumulativeTotalPremiumDue),
      periodTotalPremium: money(periodTotalPremium),
      periodEmployeePremium: money(periodEmployeePremium),
      periodEmployerPremium: money(periodEmployerPremium),
      allocationDifference: money(allocationDifference),
      fiscalBases: { wageTax: null, employeeInsurance: null, zvw: null },
      trace,
    }
  }

  return {
    status: 'CALCULATED',
    reasonCode: null,
    ruleVersion: BPF_DETAILHANDEL_2026_RULE_VERSION,
    cumulativePeriodCount: input.cumulativePeriodCount,
    cumulativeNormHours: money(cumulativeNormHours),
    cumulativePartTimeFactor: cumulativePartTimeFactor.toString(4),
    cumulativeWfsvSalary: money(cumulativeWfsvSalary),
    cumulativeFranchise: money(cumulativeFranchise),
    cumulativeMaximumSalary: money(cumulativeMaximumSalary),
    cumulativePensionableBase: money(cumulativePensionableBase),
    cumulativeTotalPremiumDue: money(cumulativeTotalPremiumDue),
    periodTotalPremium: money(periodTotalPremium),
    periodEmployeePremium: money(periodEmployeePremium),
    periodEmployerPremium: money(periodEmployerPremium),
    allocationDifference: money(allocationDifference),
    fiscalBases: { wageTax: money(fiscalBase), employeeInsurance: money(fiscalBase), zvw: money(fiscalBase) },
    trace,
  }
}
