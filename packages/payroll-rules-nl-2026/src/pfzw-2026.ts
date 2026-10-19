import { FixedDecimal } from '@liquid-hr/payroll-engine'
import type { PensionTraceStep } from './pension-calculation'

const ZERO = FixedDecimal.parse('0')
const ONE = FixedDecimal.parse('1')
const TWELVE = FixedDecimal.parse('12')
const HUNDRED = FixedDecimal.parse('100')
const UPA_MONTHS_PER_YEAR = FixedDecimal.parse('12')

export interface Pfzw2026PremiumComponent {
  readonly code: 'PFZW_OP_NP' | 'PFZW_WIA_EXCESS'
  readonly name: string
  readonly componentType: 'BASE' | 'ADDITIONAL'
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
  readonly basisCode: string
  readonly basisDescription: string
  readonly totalRate: string
  readonly employeeRate: string
  readonly employerRate: string
  readonly annualFranchise: string
  readonly annualPensionableSalaryCap: string | null
  readonly eligibilityRule: string
  readonly calculationMethod: string
  readonly roundingRule: string
  readonly sourceVersion: string
  readonly sourceReference: string
  readonly sourceSha256: string
  readonly sourceValidationStatus: 'REFERENCE_ONLY' | 'EMPLOYER_RECORDED' | 'VERIFIED_SOURCE'
  readonly taxTreatment: 'PRE_TAX_EMPLOYEE_DEDUCTION' | 'EMPLOYER_COST_ONLY' | 'UNVERIFIED'
}

function componentText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function componentDecimal(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return componentText(value)
}

export function parsePfzw2026PremiumComponents(value: unknown): readonly Pfzw2026PremiumComponent[] | null {
  if (!Array.isArray(value) || value.length !== 2) return null
  const components: Pfzw2026PremiumComponent[] = []
  for (const candidate of value) {
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return null
    const row = candidate as Record<string, unknown>
    const code = row.code
    if (code !== 'PFZW_OP_NP' && code !== 'PFZW_WIA_EXCESS') return null
    const name = componentText(row.name)
    const componentType = row.componentType
    const basisCode = componentText(row.basisCode)
    const basisDescription = componentText(row.basisDescription)
    const effectiveFrom = componentText(row.effectiveFrom)
    const effectiveTo = row.effectiveTo === null ? null : componentText(row.effectiveTo)
    const totalRate = componentDecimal(row.totalRate)
    const employeeRate = componentDecimal(row.employeeRate)
    const employerRate = componentDecimal(row.employerRate)
    const annualFranchise = componentDecimal(row.annualFranchise)
    const annualPensionableSalaryCap = row.annualPensionableSalaryCap === null
      ? null
      : componentDecimal(row.annualPensionableSalaryCap)
    const eligibilityRule = componentText(row.eligibilityRule)
    const calculationMethod = componentText(row.calculationMethod)
    const roundingRule = componentText(row.roundingRule)
    const sourceVersion = componentText(row.sourceVersion)
    const sourceReference = componentText(row.sourceReference)
    const sourceSha256 = componentText(row.sourceSha256)
    const sourceValidationStatus = row.sourceValidationStatus
    const taxTreatment = row.taxTreatment
    if (!name || (componentType !== 'BASE' && componentType !== 'ADDITIONAL')
      || (code === 'PFZW_OP_NP' && componentType !== 'BASE')
      || (code === 'PFZW_WIA_EXCESS' && componentType !== 'ADDITIONAL')
      || !basisCode || !basisDescription
      || !effectiveFrom || (row.effectiveTo !== null && !effectiveTo)
      || !totalRate || !employeeRate || !employerRate || !annualFranchise
      || (row.annualPensionableSalaryCap !== null && !annualPensionableSalaryCap)
      || !eligibilityRule || !calculationMethod || !roundingRule
      || !sourceVersion || !sourceReference || !sourceSha256
      || (taxTreatment !== 'PRE_TAX_EMPLOYEE_DEDUCTION' && taxTreatment !== 'EMPLOYER_COST_ONLY' && taxTreatment !== 'UNVERIFIED')
      || (sourceValidationStatus !== 'REFERENCE_ONLY' && sourceValidationStatus !== 'EMPLOYER_RECORDED' && sourceValidationStatus !== 'VERIFIED_SOURCE')) {
      return null
    }
    components.push({
      code,
      name,
      componentType,
      effectiveFrom,
      effectiveTo,
      basisCode,
      basisDescription,
      totalRate,
      employeeRate,
      employerRate,
      annualFranchise,
      annualPensionableSalaryCap,
      eligibilityRule,
      calculationMethod,
      roundingRule,
      sourceVersion,
      sourceReference,
      sourceSha256,
      sourceValidationStatus,
      taxTreatment,
    })
  }
  return components.some((component, index) => components.findIndex((candidate) => candidate.code === component.code) !== index)
    ? null
    : components
}

export const PFZW_2026_KINDEROPVANG_RULE_VERSION = 'PFZW-PENSIONREGLEMENT-2026-07+UPA-2026-v5' as const
export const PFZW_2026_KINDEROPVANG_METHOD = 'PFZW_2026_KINDEROPVANG' as const
/** Candidate payroll allocation sequence; it remains preview-only until the employer approves it. */
export const PFZW_2026_MONTHLY_ALLOCATION_TEST_APPROVED_VERSION = 'PFZW-2026-MONTHLY-ALLOCATION-TEST-APPROVED-1' as const
export const PFZW_2026_SYNTHETIC_TEST_EXTRA_HOURS_UPLIFT_VERSION = 'SYNTHETIC_TEST_ONLY_EXTRA_HOURS_UPLIFT' as const

export interface Pfzw2026StructuralSalaryComponent {
  readonly code: string
  /** Full-time annual amount at the applicable PFZW salary-basis date. */
  readonly annualAmount: string
  readonly sourceVersion: string
  readonly sourceReference: string
}

export interface Pfzw2026CalculationPolicy {
  /** PFZW documents establish monthly UPA reporting but not this payroll cent-allocation sequence. */
  readonly status: 'VERIFIED_EMPLOYER_POLICY' | 'SYNTHETIC_TEST_APPROVED' | 'PROVISIONAL_PREVIEW'
  readonly version: string
  readonly sourceReference: string | null
  readonly monthlyMethod: 'ANNUAL_RATE_DIVIDED_BY_12'
  readonly shareRounding: 'HALF_UP_CENTS_PER_EMPLOYEE_AND_EMPLOYER_SHARE'
}

export interface Pfzw2026CalculationInput {
  readonly period: { readonly year: number; readonly month: number }
  readonly participationStatus: 'CONFIRMED' | 'SYNTHETIC_TEST_FIXTURE' | 'ASSUMED_FOR_PREVIEW' | 'UNCONFIRMED'
  readonly participationStartDate: string
  readonly participationEvidenceReference: string
  readonly arrangementVersion: string
  readonly premiumComponents: readonly Pfzw2026PremiumComponent[]
  /** PFZW salary basis is set at 1 January or at the participation/entry date. */
  readonly salaryBasisDate: string
  readonly salaryBasisSourceId: string
  readonly salaryBasisSourceVersion: string
  readonly fullTimeMonthlySalary: string
  readonly monthlyPaymentsPerYear: 12 | 13
  readonly holidayAllowancePercent: string
  readonly structuralYearEndAllowancePercent: string | null
  readonly structuralYearEndAllowanceReferenceDate: string | null
  readonly structuralYearEndAllowanceEligibleAnnualBase: string
  readonly structuralYearEndAllowanceSourceReference: string | null
  readonly structuralYearEndAllowanceSourceVersion: string | null
  readonly additionalStructuralSalaryComponents: readonly Pfzw2026StructuralSalaryComponent[]
  readonly contractHoursPerWeek: string
  readonly fullTimeHoursPerWeek: string
  readonly additionalWorkedHours: string
  readonly additionalHoursUpliftPercent: string | null
  readonly additionalHoursUpliftEvidence: 'VERIFIED_CAO_OR_EMPLOYER_RULE' | 'SYNTHETIC_TEST_ONLY_POLICY' | 'PROVISIONAL_CAO_ENTITLEMENT_DERIVATION' | 'NOT_APPLICABLE' | null
  readonly additionalHoursUpliftSourceReference: string | null
  readonly additionalHoursUpliftSourceVersion: string | null
  readonly fullTimePeriodHours: string
  readonly monthlyPayrollGross: string
  readonly calculationPolicy: Pfzw2026CalculationPolicy
  readonly sourceSnapshotId: string
  readonly sourceSnapshotHash: string
  readonly inputSetId?: string
  readonly inputHash?: string
}

export interface Pfzw2026CalculationResult {
  readonly status: 'CALCULATED' | 'PREVIEW_ONLY' | 'BLOCKED'
  readonly reasonCodes: readonly string[]
  readonly ruleVersion: typeof PFZW_2026_KINDEROPVANG_RULE_VERSION
  readonly salaryBasisDate: string | null
  readonly fullTimeAnnualSalaryBeforeUpaRounding: string | null
  readonly pensionableAnnualSalary: string | null
  readonly cappedPensionableSalary: string | null
  readonly contractualPartTimeFactor: string | null
  readonly contractHoursInPeriod: string | null
  readonly additionalHoursForArrangement: string | null
  readonly pensionableHours: string | null
  readonly finalPartTimeFactor: string | null
  readonly pensionableBase: string | null
  readonly wiaExcessBase: string | null
  readonly totalPremiumAnnual: string | null
  readonly totalPremiumMonthly: string | null
  readonly employeePremiumMonthly: string | null
  readonly employerBasicPremiumMonthly: string | null
  readonly employerWiaExcessPremiumMonthly: string | null
  readonly employerPremiumMonthly: string | null
  readonly allocationDifference: string | null
  readonly fiscalBases: { readonly wageTax: string | null; readonly employeeInsurance: string | null; readonly zvw: string | null }
  readonly trace: readonly PensionTraceStep[]
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function parse(value: string, code: string, reasons: string[]): FixedDecimal | null {
  try {
    return FixedDecimal.parse(value)
  } catch {
    reasons.push(code)
    return null
  }
}

function money(value: FixedDecimal): string {
  return value.round(2, 'HALF_UP').toString(2)
}

function blocked(input: Pfzw2026CalculationInput, reasons: readonly string[]): Pfzw2026CalculationResult {
  return {
    status: 'BLOCKED',
    reasonCodes: reasons,
    ruleVersion: PFZW_2026_KINDEROPVANG_RULE_VERSION,
    salaryBasisDate: null,
    fullTimeAnnualSalaryBeforeUpaRounding: null,
    pensionableAnnualSalary: null,
    cappedPensionableSalary: null,
    contractualPartTimeFactor: null,
    contractHoursInPeriod: null,
    additionalHoursForArrangement: null,
    pensionableHours: null,
    finalPartTimeFactor: null,
    pensionableBase: null,
    wiaExcessBase: null,
    totalPremiumAnnual: null,
    totalPremiumMonthly: null,
    employeePremiumMonthly: null,
    employerBasicPremiumMonthly: null,
    employerWiaExcessPremiumMonthly: null,
    employerPremiumMonthly: null,
    allocationDifference: null,
    fiscalBases: { wageTax: null, employeeInsurance: null, zvw: null },
    trace: [],
  }
}

/**
 * Generic 2026 PFZW basis and monthly-share calculator. It never establishes
 * coverage. Participation, the EJU basis, the hours uplift and the employer's
 * monthly cent-allocation policy are explicit inputs. Preview-only assumptions
 * can produce reproducible arithmetic but cannot become a PAYRUN01 result.
 */
export function calculatePfzw2026Kinderopvang(input: Pfzw2026CalculationInput): Pfzw2026CalculationResult {
  const reasons: string[] = []
  const periodStart = `${input.period.year}-${String(input.period.month).padStart(2, '0')}-01`
  const periodEnd = new Date(Date.UTC(input.period.year, input.period.month, 0)).toISOString().slice(0, 10)
  if (input.period.year !== 2026 || input.period.month < 1 || input.period.month > 12
    || !validDate(input.participationStartDate) || !validDate(input.salaryBasisDate)
    || !/^[0-9a-f]{64}$/i.test(input.sourceSnapshotHash) || input.sourceSnapshotId.length === 0
    || (input.inputHash !== undefined && !/^[0-9a-f]{64}$/i.test(input.inputHash))
    || (input.inputSetId !== undefined && input.inputSetId.length === 0)) {
    return blocked(input, ['PFZW_2026_INPUT_INVALID'])
  }
  if (input.monthlyPaymentsPerYear === 13) {
    return blocked(input, ['PFZW_FOUR_WEEKLY_PERIOD_UNSUPPORTED'])
  }
  if (input.participationStatus === 'UNCONFIRMED') return blocked(input, ['PFZW_PARTICIPATION_UNCONFIRMED'])
  if (input.participationStatus === 'SYNTHETIC_TEST_FIXTURE'
    && !input.participationEvidenceReference.startsWith('SYNTHETIC_TEST_FIXTURE:')) {
    return blocked(input, ['PFZW_SYNTHETIC_PARTICIPATION_PROVENANCE_INVALID'])
  }
  const opnpComponent = input.premiumComponents.find((component) => component.code === 'PFZW_OP_NP')
  const wiaComponent = input.premiumComponents.find((component) => component.code === 'PFZW_WIA_EXCESS')
  if (input.premiumComponents.length !== 2 || !opnpComponent || !wiaComponent) {
    return blocked(input, ['PFZW_PREMIUM_COMPONENTS_MISSING_OR_UNSUPPORTED'])
  }
  const componentPeriodCovered = [opnpComponent, wiaComponent].every((component) =>
    validDate(component.effectiveFrom)
    && (component.effectiveTo === null || validDate(component.effectiveTo))
    && component.effectiveFrom <= periodStart
    && (component.effectiveTo === null || component.effectiveTo >= periodEnd),
  )
  if (!componentPeriodCovered) return blocked(input, ['PFZW_PREMIUM_COMPONENT_PERIOD_INVALID'])
  if ([opnpComponent, wiaComponent].some((component) => component.sourceValidationStatus !== 'VERIFIED_SOURCE'
    || component.sourceVersion.trim() === ''
    || component.sourceReference.trim() === ''
    || !/^[0-9a-f]{64}$/i.test(component.sourceSha256))) {
    return blocked(input, ['PFZW_PREMIUM_COMPONENT_SOURCE_UNVERIFIED'])
  }
  const basicTotalRate = parse(opnpComponent.totalRate, 'PFZW_OPNP_TOTAL_RATE_INVALID', reasons)
  const basicEmployeeRate = parse(opnpComponent.employeeRate, 'PFZW_OPNP_EMPLOYEE_RATE_INVALID', reasons)
  const basicEmployerRate = parse(opnpComponent.employerRate, 'PFZW_OPNP_EMPLOYER_RATE_INVALID', reasons)
  const basicFranchise = parse(opnpComponent.annualFranchise, 'PFZW_OPNP_FRANCHISE_INVALID', reasons)
  const basicSalaryCap = opnpComponent.annualPensionableSalaryCap === null
    ? null
    : parse(opnpComponent.annualPensionableSalaryCap, 'PFZW_OPNP_SALARY_CAP_INVALID', reasons)
  const wiaTotalRate = parse(wiaComponent.totalRate, 'PFZW_WIA_TOTAL_RATE_INVALID', reasons)
  const wiaEmployeeRate = parse(wiaComponent.employeeRate, 'PFZW_WIA_EMPLOYEE_RATE_INVALID', reasons)
  const wiaEmployerRate = parse(wiaComponent.employerRate, 'PFZW_WIA_EMPLOYER_RATE_INVALID', reasons)
  const wiaFranchise = parse(wiaComponent.annualFranchise, 'PFZW_WIA_FRANCHISE_INVALID', reasons)
  if (reasons.some((reason) => reason.endsWith('_INVALID'))) return blocked(input, reasons)
  if (!basicTotalRate || !basicEmployeeRate || !basicEmployerRate || !basicFranchise || !basicSalaryCap
    || !wiaTotalRate || !wiaEmployeeRate || !wiaEmployerRate || !wiaFranchise
    || basicFranchise.compare(ZERO) < 0 || basicSalaryCap.compare(basicFranchise) < 0
    || wiaFranchise.compare(ZERO) < 0
    || basicEmployeeRate.add(basicEmployerRate).compare(basicTotalRate) !== 0
    || wiaEmployeeRate.compare(ZERO) !== 0
    || wiaEmployerRate.compare(wiaTotalRate) !== 0) {
    return blocked(input, ['PFZW_PREMIUM_COMPONENT_PARAMETERS_INVALID'])
  }
  if (input.participationStartDate > periodEnd) return blocked(input, ['PFZW_PARTICIPATION_NOT_EFFECTIVE_FOR_PERIOD'])
  if (input.participationStartDate > periodStart) return blocked(input, ['PFZW_PARTIAL_MONTH_PRORATION_UNVERIFIED'])
  const expectedEjuReferenceDate = `${input.period.year - 1}-12-31`
  if (input.structuralYearEndAllowanceReferenceDate !== expectedEjuReferenceDate
    || input.structuralYearEndAllowancePercent === null) {
    reasons.push('PFZW_PRIOR_YEAR_EJU_REFERENCE_UNVERIFIED')
  }
  if (!input.participationEvidenceReference || !input.arrangementVersion || !input.salaryBasisSourceId || !input.salaryBasisSourceVersion) {
    reasons.push('PFZW_SOURCE_PROVENANCE_INCOMPLETE')
  }
  if (!input.structuralYearEndAllowanceSourceReference || !input.structuralYearEndAllowanceSourceVersion) {
    reasons.push('PFZW_PRIOR_YEAR_EJU_SOURCE_UNVERIFIED')
  }
  if (input.calculationPolicy.status === 'PROVISIONAL_PREVIEW'
    || !input.calculationPolicy.sourceReference
    || (input.calculationPolicy.status === 'SYNTHETIC_TEST_APPROVED'
      && (input.calculationPolicy.version !== PFZW_2026_MONTHLY_ALLOCATION_TEST_APPROVED_VERSION
        || !input.calculationPolicy.sourceReference.startsWith('SYNTHETIC_TEST_POLICY:PAY-RULE-002;')))) {
    reasons.push('PFZW_MONTHLY_CENT_ALLOCATION_POLICY_UNVERIFIED')
  }

  const fullTimeMonthlySalary = parse(input.fullTimeMonthlySalary, 'PFZW_FULLTIME_MONTHLY_SALARY_INVALID', reasons)
  const holidayAllowancePercent = parse(input.holidayAllowancePercent, 'PFZW_HOLIDAY_ALLOWANCE_PERCENT_INVALID', reasons)
  const yearEndAllowancePercent = input.structuralYearEndAllowancePercent === null
    ? null
    : parse(input.structuralYearEndAllowancePercent, 'PFZW_EJU_PERCENT_INVALID', reasons)
  const ejuEligibleAnnualBase = parse(input.structuralYearEndAllowanceEligibleAnnualBase, 'PFZW_EJU_BASE_INVALID', reasons)
  const contractHoursPerWeek = parse(input.contractHoursPerWeek, 'PFZW_CONTRACT_HOURS_INVALID', reasons)
  const fullTimeHoursPerWeek = parse(input.fullTimeHoursPerWeek, 'PFZW_FULLTIME_HOURS_INVALID', reasons)
  const additionalWorkedHours = parse(input.additionalWorkedHours, 'PFZW_ADDITIONAL_HOURS_INVALID', reasons)
  const fullTimePeriodHours = parse(input.fullTimePeriodHours, 'PFZW_FULLTIME_PERIOD_HOURS_INVALID', reasons)
  const monthlyGross = parse(input.monthlyPayrollGross, 'PFZW_MONTHLY_GROSS_INVALID', reasons)
  const additionalHoursUpliftPercent = input.additionalHoursUpliftPercent === null
    ? null
    : parse(input.additionalHoursUpliftPercent, 'PFZW_ADDITIONAL_HOURS_UPLIFT_INVALID', reasons)
  const structuralAmounts: FixedDecimal[] = []
  for (const component of input.additionalStructuralSalaryComponents) {
    const amount = parse(component.annualAmount, `PFZW_STRUCTURAL_COMPONENT_${component.code}_INVALID`, reasons)
    if (amount !== null) structuralAmounts.push(amount)
  }
  if (reasons.some((reason) => reason.endsWith('_INVALID'))) return blocked(input, reasons)
  if (!fullTimeMonthlySalary || !holidayAllowancePercent || !ejuEligibleAnnualBase
    || !contractHoursPerWeek || !fullTimeHoursPerWeek || !additionalWorkedHours
    || !fullTimePeriodHours || !monthlyGross || yearEndAllowancePercent === null
    || additionalWorkedHours.compare(ZERO) < 0 || fullTimeHoursPerWeek.compare(ZERO) <= 0
    || fullTimePeriodHours.compare(ZERO) <= 0 || contractHoursPerWeek.compare(ZERO) <= 0
    || contractHoursPerWeek.compare(fullTimeHoursPerWeek) > 0 || monthlyGross.compare(ZERO) < 0) {
    return blocked(input, [...reasons, 'PFZW_REQUIRED_INPUT_MISSING_OR_OUT_OF_RANGE'])
  }
  if (additionalWorkedHours.compare(ZERO) > 0
    && (additionalHoursUpliftPercent === null || input.additionalHoursUpliftEvidence === null
      || input.additionalHoursUpliftEvidence === 'NOT_APPLICABLE')) {
    return blocked(input, [...reasons, 'PFZW_ADDITIONAL_HOURS_UPLIFT_UNVERIFIED'])
  }
  if (additionalWorkedHours.compare(ZERO) > 0
    && (input.additionalHoursUpliftSourceReference === null || input.additionalHoursUpliftSourceVersion === null)) {
    reasons.push('PFZW_ADDITIONAL_HOURS_UPLIFT_SOURCE_UNVERIFIED')
  }
  if (input.additionalHoursUpliftEvidence === 'PROVISIONAL_CAO_ENTITLEMENT_DERIVATION') {
    reasons.push('PFZW_ADDITIONAL_HOURS_UPLIFT_PROVISIONAL')
  }
  if (input.participationStatus === 'ASSUMED_FOR_PREVIEW') reasons.push('PFZW_PARTICIPATION_ASSUMED_FOR_PREVIEW')
  if (input.salaryBasisDate !== '2026-01-01' && input.salaryBasisDate !== input.participationStartDate) {
    return blocked(input, [...reasons, 'PFZW_SALARY_BASIS_DATE_INVALID'])
  }

  const paymentPeriods = FixedDecimal.fromInteger(BigInt(input.monthlyPaymentsPerYear))
  const fullTimeAnnualBaseSalary = fullTimeMonthlySalary.multiply(paymentPeriods)
  const holidayAllowanceAnnual = fullTimeAnnualBaseSalary.multiply(holidayAllowancePercent).divideToScale(HUNDRED, 8, 'ARITHMETIC')
  const ejuAnnual = ejuEligibleAnnualBase.multiply(yearEndAllowancePercent).divideToScale(HUNDRED, 8, 'ARITHMETIC')
  const otherStructuralAnnual = structuralAmounts.reduce((sum, amount) => sum.add(amount), ZERO)
  const annualSalaryBeforeUpaRounding = fullTimeAnnualBaseSalary.add(holidayAllowanceAnnual).add(ejuAnnual).add(otherStructuralAnnual)
  const pensionableAnnualSalary = annualSalaryBeforeUpaRounding.round(0, 'CEILING')
  const cappedPensionableSalary = pensionableAnnualSalary.compare(basicSalaryCap) > 0
    ? basicSalaryCap
    : pensionableAnnualSalary

  const contractualPartTimeFactor = contractHoursPerWeek.divideToScale(fullTimeHoursPerWeek, 4, 'ARITHMETIC')
  const contractHoursInPeriod = fullTimePeriodHours.multiply(contractualPartTimeFactor).round(2, 'HALF_UP')
  const upliftFactor = additionalHoursUpliftPercent === null
    ? ONE
    : ONE.add(additionalHoursUpliftPercent.divideToScale(HUNDRED, 12, 'ARITHMETIC'))
  const additionalHoursForArrangement = additionalWorkedHours.multiply(upliftFactor)
  const pensionableHours = contractHoursInPeriod.add(additionalHoursForArrangement).round(2, 'HALF_UP')
  const finalPartTimeFactor = pensionableHours.divideToScale(fullTimePeriodHours, 4, 'ARITHMETIC')

  const pensionableBase = maximum(ZERO, cappedPensionableSalary.subtract(basicFranchise)).multiply(finalPartTimeFactor)
  const wiaExcessBase = maximum(ZERO, pensionableAnnualSalary.multiply(finalPartTimeFactor).subtract(wiaFranchise))
  const employeeBasicAnnual = pensionableBase.multiply(basicEmployeeRate).divideToScale(HUNDRED, 8, 'ARITHMETIC')
  const employerBasicAnnual = pensionableBase.multiply(basicEmployerRate).divideToScale(HUNDRED, 8, 'ARITHMETIC')
  const employerWiaAnnual = wiaExcessBase.multiply(wiaEmployerRate).divideToScale(HUNDRED, 8, 'ARITHMETIC')
  const employeeMonthly = employeeBasicAnnual.divideToScale(UPA_MONTHS_PER_YEAR, 2, 'ARITHMETIC')
  const employerBasicMonthly = employerBasicAnnual.divideToScale(UPA_MONTHS_PER_YEAR, 2, 'ARITHMETIC')
  const employerWiaMonthly = employerWiaAnnual.divideToScale(UPA_MONTHS_PER_YEAR, 2, 'ARITHMETIC')
  const employerMonthly = employerBasicMonthly.add(employerWiaMonthly)
  const totalMonthly = employeeMonthly.add(employerMonthly)
  const totalAnnual = employeeBasicAnnual.add(employerBasicAnnual).add(employerWiaAnnual)
  const allocationDifference = totalMonthly.subtract(employeeMonthly).subtract(employerMonthly)
  const fiscalBase = maximum(ZERO, monthlyGross.subtract(employeeMonthly))

  if (allocationDifference.compare(ZERO) !== 0) return blocked(input, [...reasons, 'PFZW_PREMIUM_SPLIT_ROUNDING_INVALID'])

  const traceBase = {
    source: 'PFZW 2026 Pensionreglement and UPA 2026 input rules',
    componentVersion: PFZW_2026_KINDEROPVANG_RULE_VERSION,
    ruleProvenance: {
      rules: PFZW_2026_KINDEROPVANG_RULE_VERSION,
      pensionReglementArticles: ['5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.8'],
      upaManual: 'January 2026 version 5.0',
      premiumAllocationPolicy: input.calculationPolicy,
      additionalHoursUpliftEvidence: input.additionalHoursUpliftEvidence,
      additionalHoursUpliftSourceReference: input.additionalHoursUpliftSourceReference,
      additionalHoursUpliftSourceVersion: input.additionalHoursUpliftSourceVersion,
      participationStatus: input.participationStatus,
      participationEvidenceReference: input.participationEvidenceReference,
      arrangementVersion: input.arrangementVersion,
      salaryBasisSourceId: input.salaryBasisSourceId,
      salaryBasisSourceVersion: input.salaryBasisSourceVersion,
      yearEndAllowanceReferenceDate: input.structuralYearEndAllowanceReferenceDate,
      yearEndAllowanceSourceReference: input.structuralYearEndAllowanceSourceReference,
      yearEndAllowanceSourceVersion: input.structuralYearEndAllowanceSourceVersion,
      premiumComponents: input.premiumComponents.map((component) => ({
        code: component.code,
        name: component.name,
        componentType: component.componentType,
        effectiveFrom: component.effectiveFrom,
        effectiveTo: component.effectiveTo,
        basisCode: component.basisCode,
        basisDescription: component.basisDescription,
        totalRate: component.totalRate,
        employeeRate: component.employeeRate,
        employerRate: component.employerRate,
        annualFranchise: component.annualFranchise,
        annualPensionableSalaryCap: component.annualPensionableSalaryCap,
        eligibilityRule: component.eligibilityRule,
        calculationMethod: component.calculationMethod,
        roundingRule: component.roundingRule,
        sourceVersion: component.sourceVersion,
        sourceReference: component.sourceReference,
        sourceSha256: component.sourceSha256,
        sourceValidationStatus: component.sourceValidationStatus,
        taxTreatment: component.taxTreatment,
      })),
    },
    sourceSnapshotId: input.sourceSnapshotId,
    sourceSnapshotHash: input.sourceSnapshotHash,
    inputSetId: input.inputSetId ?? '',
    inputHash: input.inputHash ?? '',
  }
  const trace: PensionTraceStep[] = [
    traceStep(traceBase, 'PFZW_REGELINGLOON_CONSTRUCTION', 'full-time monthly salary × payment periods + holiday allowance + structural EJU at prior-year 31 December + other structural components; UPA rounds the full-time annual amount UP to euros', annualSalaryBeforeUpaRounding, pensionableAnnualSalary, 'CEILING to whole euros', 'UPA_REGELINGLOON', null, {
      fullTimeMonthlySalary: money(fullTimeMonthlySalary), paymentPeriodsPerYear: input.monthlyPaymentsPerYear,
      holidayAllowancePercent: holidayAllowancePercent.toString(), holidayAllowanceAnnual: money(holidayAllowanceAnnual),
      structuralYearEndAllowancePercent: yearEndAllowancePercent.toString(),
      structuralYearEndAllowanceEligibleAnnualBase: money(ejuEligibleAnnualBase), structuralYearEndAllowanceAnnual: money(ejuAnnual),
      otherStructuralAnnual: money(otherStructuralAnnual), salaryBasisDate: input.salaryBasisDate,
    }, annualSalaryBeforeUpaRounding.toString()),
    traceStep(traceBase, 'PFZW_CONTRACTUAL_PARTTIME_FACTOR', 'contract hours per week ÷ full-time hours per week', contractHoursPerWeek.divideToScale(fullTimeHoursPerWeek, 12, 'ARITHMETIC'), contractualPartTimeFactor, 'HALF_UP to 4 decimals', 'CONTRACT_DTF', null, {
      contractHoursPerWeek: contractHoursPerWeek.toString(), fullTimeHoursPerWeek: fullTimeHoursPerWeek.toString(),
    }),
    traceStep(traceBase, 'PFZW_UPA_PENSIONABLE_HOURS', 'contractual period hours + additional worked hours × (1 + evidenced ADV/holiday-hours uplift); round total hours to UPA precision', contractHoursInPeriod.add(additionalHoursForArrangement), pensionableHours, 'HALF_UP to 2 decimals', 'UPA_HOURS_FOR_ARRANGEMENT', null, {
      fullTimePeriodHours: fullTimePeriodHours.toString(), contractHoursInPeriod: contractHoursInPeriod.toString(),
      additionalWorkedHours: additionalWorkedHours.toString(), additionalHoursUpliftPercent: additionalHoursUpliftPercent?.toString() ?? null,
      additionalHoursForArrangement: additionalHoursForArrangement.toString(),
    }),
    traceStep(traceBase, 'PFZW_FINAL_PERIOD_DTF', 'UPA pensionable hours ÷ full-time hours for the period', pensionableHours.divideToScale(fullTimePeriodHours, 12, 'ARITHMETIC'), finalPartTimeFactor, 'HALF_UP to 4 decimals', 'PERIOD_DTF', null, {
      pensionableHours: pensionableHours.toString(), fullTimePeriodHours: fullTimePeriodHours.toString(),
    }),
    traceStep(traceBase, 'PFZW_OPNP_PREMIUM_BASE', `max(min(RegLn, €${opnpComponent.annualPensionableSalaryCap}) − €${basicFranchise.toString(2)}, 0) × final period DTF`, maximum(ZERO, cappedPensionableSalary.subtract(basicFranchise)).multiply(finalPartTimeFactor), pensionableBase, 'No intermediate monetary rounding', 'OPNP_BASE', null, {
      pensionableAnnualSalary: pensionableAnnualSalary.toString(2), salaryCap: basicSalaryCap.toString(2),
      franchise: basicFranchise.toString(2), finalPartTimeFactor: finalPartTimeFactor.toString(4),
    }),
    traceStep(traceBase, 'PFZW_OPNP_EMPLOYEE_PREMIUM', `OP/NP base × ${basicEmployeeRate.toString()}% ÷ 12; monthly employee share`, employeeBasicAnnual.divideToScale(TWELVE, 8, 'ARITHMETIC'), employeeMonthly, 'Versioned-policy HALF_UP to cents after annual share allocation', 'EMPLOYEE_SHARE', basicEmployeeRate.toString(), {
      pensionableBase: money(pensionableBase), annualEmployeeShare: employeeBasicAnnual.toString(),
    }, money(pensionableBase)),
    traceStep(traceBase, 'PFZW_OPNP_EMPLOYER_PREMIUM', `OP/NP base × ${basicEmployerRate.toString()}% ÷ 12; monthly employer share`, employerBasicAnnual.divideToScale(TWELVE, 8, 'ARITHMETIC'), employerBasicMonthly, 'Versioned-policy HALF_UP to cents after annual share allocation', 'EMPLOYER_SHARE', basicEmployerRate.toString(), {
      pensionableBase: money(pensionableBase), annualEmployerShare: employerBasicAnnual.toString(),
    }, money(pensionableBase)),
    traceStep(traceBase, 'PFZW_WIA_EXCESS_PREMIUM_BASE', `max(RegLn × final period DTF − €${wiaFranchise.toString(2)}, 0); WIA base is not subject to the OP/NP salary cap`, pensionableAnnualSalary.multiply(finalPartTimeFactor).subtract(wiaFranchise), wiaExcessBase, 'No intermediate monetary rounding', 'WIA_EXCESS_BASE', null, {
      pensionableAnnualSalary: pensionableAnnualSalary.toString(2), finalPartTimeFactor: finalPartTimeFactor.toString(4),
      wiaExcessFranchise: wiaFranchise.toString(2),
    }),
    traceStep(traceBase, 'PFZW_WIA_EXCESS_EMPLOYER_PREMIUM', `WIA-excess base × ${wiaEmployerRate.toString()}% ÷ 12; employer-only premium`, employerWiaAnnual.divideToScale(TWELVE, 8, 'ARITHMETIC'), employerWiaMonthly, 'Versioned-policy HALF_UP to cents after annual share allocation', 'WIA_EMPLOYER_SHARE', wiaEmployerRate.toString(), {
      wiaExcessBase: money(wiaExcessBase), annualEmployerWiaShare: employerWiaAnnual.toString(),
    }, money(wiaExcessBase)),
    traceStep(traceBase, 'PFZW_EMPLOYEE_PENSION_FISCAL_BASES', 'monthly gross − employee pension contribution, applied separately to wage-tax, employee-insurance and Zvw bases', monthlyGross.subtract(employeeMonthly), fiscalBase, 'No additional rounding; source values are cents', 'FISCAL_BASE_DEDUCTION', null, {
      monthlyPayrollGross: monthlyGross.toString(2), employeePensionContribution: employeeMonthly.toString(2),
      wageTaxBase: money(fiscalBase), employeeInsuranceBase: money(fiscalBase), zvwBase: money(fiscalBase),
    }, monthlyGross.toString(2)),
  ]

  return {
    status: reasons.length === 0 ? 'CALCULATED' : 'PREVIEW_ONLY',
    reasonCodes: reasons,
    ruleVersion: PFZW_2026_KINDEROPVANG_RULE_VERSION,
    salaryBasisDate: input.salaryBasisDate,
    fullTimeAnnualSalaryBeforeUpaRounding: annualSalaryBeforeUpaRounding.toString(),
    pensionableAnnualSalary: pensionableAnnualSalary.toString(2),
    cappedPensionableSalary: cappedPensionableSalary.toString(2),
    contractualPartTimeFactor: contractualPartTimeFactor.toString(4),
    contractHoursInPeriod: contractHoursInPeriod.toString(2),
    additionalHoursForArrangement: additionalHoursForArrangement.toString(),
    pensionableHours: pensionableHours.toString(2),
    finalPartTimeFactor: finalPartTimeFactor.toString(4),
    pensionableBase: money(pensionableBase),
    wiaExcessBase: money(wiaExcessBase),
    totalPremiumAnnual: money(totalAnnual),
    totalPremiumMonthly: money(totalMonthly),
    employeePremiumMonthly: money(employeeMonthly),
    employerBasicPremiumMonthly: money(employerBasicMonthly),
    employerWiaExcessPremiumMonthly: money(employerWiaMonthly),
    employerPremiumMonthly: money(employerMonthly),
    allocationDifference: money(allocationDifference),
    fiscalBases: { wageTax: money(fiscalBase), employeeInsurance: money(fiscalBase), zvw: money(fiscalBase) },
    trace,
  }
}

function maximum(left: FixedDecimal, right: FixedDecimal): FixedDecimal {
  return left.compare(right) >= 0 ? left : right
}

function traceStep(
  base: Omit<PensionTraceStep, 'componentCode' | 'inputs' | 'assessmentBase' | 'rate' | 'formula' | 'unroundedValue' | 'roundingRule' | 'roundingStage' | 'result' | 'dependencies'>,
  componentCode: string,
  formula: string,
  unrounded: FixedDecimal,
  result: FixedDecimal,
  roundingRule: string,
  roundingStage: string,
  rate: string | null = null,
  inputs: Readonly<Record<string, string | number | null>> = {},
  assessmentBase: string | null = null,
): PensionTraceStep {
  return {
    ...base,
    componentCode,
    inputs,
    assessmentBase,
    rate,
    formula,
    unroundedValue: unrounded.toString(),
    roundingRule,
    roundingStage,
    result: result.toString(),
    dependencies: [],
  }
}
