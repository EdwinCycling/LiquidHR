import {
  FixedDecimal,
  sha256,
  stableSerialize,
  type PayrollPeriodReference,
} from '@liquid-hr/payroll-engine'
import type { EmploymentPayrollSourceProjection } from '@/lib/employment/employment-detail-service'
import {
  calculateNl2026PeriodSegments,
  prorateMonthlySalary,
} from '@liquid-hr/payroll-rules-nl-2026'

export type CaoPayrollFamily = 'KINDEROPVANG' | 'RETAIL_MODE'

export type CaoCalculationTraceStep = {
  readonly code: string
  readonly formula: string
  readonly values: Readonly<Record<string, string | number | boolean | null>>
  readonly sourceReference: string
}

export type CaoPayrollCalculation = {
  readonly status: 'NOT_APPLICABLE' | 'CALCULATED' | 'BLOCKED'
  readonly family?: CaoPayrollFamily
  readonly packageId?: string
  readonly packageVersion?: string
  readonly compositionId?: string
  readonly packageHash?: string
  readonly sourceHash?: string
  readonly inputHash?: string
  readonly resultHash?: string
  readonly effectiveFrom?: string
  readonly effectiveTo?: string | null
  readonly baseAmount?: string
  readonly premiumAmount?: string
  readonly grossAmount?: string
  readonly fullTimeMonthlyAmount?: string
  readonly hourlyBaseRate?: string
  readonly actualWorkConsumed?: boolean
  readonly reasonCode?: string
  readonly blockingStatus?: 'SOURCE_GAP' | 'UNSUPPORTED'
  readonly inputs?: Readonly<Record<string, string | number | boolean>>
  readonly trace?: readonly CaoCalculationTraceStep[]
  readonly sourceReferences?: readonly { readonly title: string; readonly url: string }[]
}

export type CaoPayrollSalaryInput = {
  readonly id: string
  readonly salaryBasis: string | null
  readonly caoScaleName: string | null
  readonly caoStepName: string | null
  readonly salaryStepCode: string | null
  readonly hourlyRate: number | null
  readonly validFrom: string
  readonly validUntil?: string | null
  readonly paymentType?: string | null
  readonly salaryStructureId?: string | null
  readonly salaryScaleId?: string | null
  readonly salaryScaleStepId?: string | null
}

export type CaoPayrollScheduleInput = {
  readonly contractHoursPerWeek: number
  readonly fullTimeHoursPerWeek: number
}

export type CaoPayrollActualWorkEntry = {
  readonly family: string
  readonly typeCode?: string | null
  readonly typeName?: string | null
  readonly workDate?: string | null
  readonly isPublicHoliday?: boolean | null
  readonly hours: string | number
  readonly status: string
}

export type CaoRetailBusinessScope = {
  readonly tenantId: string
  readonly administrationId: string
  readonly value: 'IN_STORE' | 'ECOMMERCE'
  readonly sourceClassification: 'OFFICIAL' | 'SYNTHETIC_FIXTURE'
  readonly sourceReference: string
  readonly sourceVersion: string
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
}

export type CaoPayrollIntegrationInput = {
  readonly tenantId: string
  readonly hrGroupId: string
  readonly administrationId: string
  readonly employeeId: string
  readonly employmentId: string
  readonly incomeRelationshipId: string | null
  readonly period: PayrollPeriodReference
  readonly activeStart: string
  readonly activeEndExclusive: string
  readonly laborConditionCode: string | null
  readonly laborConditionName: string | null
  readonly retailBusinessScope?: CaoRetailBusinessScope
  readonly salary: CaoPayrollSalaryInput | null
  readonly salaryTableSource?: EmploymentPayrollSourceProjection['salaryTableSource']
  readonly schedule: CaoPayrollScheduleInput | null
  readonly actualWorkEntries: readonly CaoPayrollActualWorkEntry[]
}

const KINDEROPVANG_RULE_SOURCE = 'https://www.kinderopvang-werkt.nl/sites/fcb_kinderopvang/files/2025-06/Cao-Kinderopvang-2025-2026-integraal.pdf'

function normalized(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function mentions(value: string | null | undefined, patterns: readonly string[]): boolean {
  const normalizedValue = normalized(value)
  return patterns.some((pattern) => normalizedValue === pattern || normalizedValue.includes(pattern))
}

function caoFamilyForValue(value: string | null | undefined): CaoPayrollFamily | null {
  if (mentions(value, [
    'CAO_KINDEROPVANG_2025_2026',
    'CAO_KINDEROPVANG_2025',
    'KINDEROPVANG_2025_2026',
    'KINDEROPVANG',
  ])) return 'KINDEROPVANG'
  if (mentions(value, [
    'CAO_RETAIL_NON_FOOD_2026_2027',
    'RETAIL_NON_FOOD_MODE_2026_2027',
    'RETAIL_NON_FOOD',
    'RETAIL_MODE',
  ])) return 'RETAIL_MODE'
  return null
}

function caoFamily(input: CaoPayrollIntegrationInput): CaoPayrollFamily | null {
  const codedFamily = caoFamilyForValue(input.laborConditionCode)
  if (codedFamily) return codedFamily
  if (input.laborConditionCode?.trim()) return null
  return caoFamilyForValue(input.laborConditionName)
}

function numericToken(value: string | null | undefined): string | null {
  return (value ?? '').trim().match(/(?:^|[^0-9])([0-9]+(?:[.,][0-9]+)?)(?:$|[^0-9])/)?.[1]?.replace(',', '.') ?? null
}

function salaryRowIdentityToken(value: string | null | undefined): string | null {
  const numeric = numericToken(value)
  if (numeric) return numeric.replace(/^0+(?=\d)/, '')
  const normalizedValue = normalized(value)
  if (!normalizedValue) return null
  const finalCode = normalizedValue.split('_').at(-1) ?? normalizedValue
  if (/^(?:[A-Z]|II|III|IV|V|VI|VII|VIII|IX|X)$/.test(finalCode)) return finalCode
  return normalizedValue
}

function parseNonNegative(value: string | number): FixedDecimal | null {
  try {
    const parsed = FixedDecimal.parse(String(value))
    return parsed.compare(FixedDecimal.fromInteger(BigInt(0))) < 0 ? null : parsed
  } catch {
    return null
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}

function periodEndInclusive(period: PayrollPeriodReference): string {
  return new Date(Date.UTC(period.year, period.month, 0)).toISOString().slice(0, 10)
}

function isValidRetailBusinessScope(input: CaoPayrollIntegrationInput, scope: CaoRetailBusinessScope): boolean {
  return (scope.value === 'IN_STORE' || scope.value === 'ECOMMERCE')
    && (scope.sourceClassification === 'OFFICIAL' || scope.sourceClassification === 'SYNTHETIC_FIXTURE')
    && scope.tenantId === input.tenantId
    && scope.administrationId === input.administrationId
    && scope.sourceReference.trim().length > 0
    && scope.sourceVersion.trim().length > 0
    && isIsoDate(scope.effectiveFrom)
    && (scope.effectiveTo === null || (isIsoDate(scope.effectiveTo) && scope.effectiveTo >= scope.effectiveFrom))
    && scope.effectiveFrom <= periodStart(input.period)
    && (scope.effectiveTo === null || scope.effectiveTo >= periodEndInclusive(input.period))
}

function sumApprovedWork(
  entries: readonly CaoPayrollActualWorkEntry[],
  family: CaoPayrollFamily,
): { readonly hours: FixedDecimal; readonly consumed: boolean; readonly reasonCode?: string } {
  const zero = FixedDecimal.fromInteger(BigInt(0))
  let qualifyingHours = zero
  let consumed = false
  for (const entry of entries) {
    if (entry.family === 'TRANSPARENT' || entry.status !== 'APPROVED') continue
    if (family === 'RETAIL_MODE') {
      return { hours: zero, consumed: false, reasonCode: 'CAO_RETAIL_VARIABLE_WAGE_RULE_NOT_CONFIGURED' }
    }
    const isSunday = typeof entry.workDate === 'string' && isIsoDate(entry.workDate)
      && new Date(`${entry.workDate}T00:00:00.000Z`).getUTCDay() === 0
    const isPublicHoliday = entry.isPublicHoliday === true
    if (!isSunday && !isPublicHoliday) {
      if (entry.family === 'ADDITIONAL' && entry.isPublicHoliday === null || entry.family === 'ADDITIONAL' && entry.isPublicHoliday === undefined) {
        return { hours: zero, consumed: false, reasonCode: 'CAO_PUBLIC_HOLIDAY_CLASSIFICATION_REQUIRED' }
      }
      if (entry.family === 'OVERTIME') return { hours: zero, consumed: false, reasonCode: 'CAO_ACTUAL_WORK_TYPE_UNSUPPORTED' }
      continue
    }
    const amount = parseNonNegative(entry.hours)
    if (!amount) return { hours: zero, consumed: false, reasonCode: 'CAO_ACTUAL_WORK_HOURS_INVALID' }
    qualifyingHours = qualifyingHours.add(amount)
    consumed = true
  }
  return { hours: qualifyingHours, consumed }
}

function periodStart(period: PayrollPeriodReference): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}-01`
}

function periodEndExclusive(period: PayrollPeriodReference): string {
  return new Date(Date.UTC(period.year, period.month, 1)).toISOString().slice(0, 10)
}

function partialPeriodAmount(input: CaoPayrollIntegrationInput, amount: FixedDecimal): FixedDecimal | null {
  const start = periodStart(input.period)
  const endExclusive = periodEndExclusive(input.period)
  if (input.activeStart <= start && input.activeEndExclusive >= endExclusive) return amount
  try {
    const segments = calculateNl2026PeriodSegments({
      periodStart: start,
      periodEndExclusive: endExclusive,
      paidStart: input.activeStart,
      paidEndExclusive: input.activeEndExclusive,
    })
    return prorateMonthlySalary(amount, segments.paidWorkdays, segments.periodWorkdays)
  } catch {
    return null
  }
}

function blocked(
  family: CaoPayrollFamily,
  reasonCode: string,
  blockingStatus: 'SOURCE_GAP' | 'UNSUPPORTED',
  references: readonly { readonly title: string; readonly url: string }[] = [],
): CaoPayrollCalculation {
  return { status: 'BLOCKED', family, reasonCode, blockingStatus, sourceReferences: references }
}

function referenceFor(source: NonNullable<NonNullable<CaoPayrollIntegrationInput['salaryTableSource']>['source']>) {
  return { title: `${source.sourceTitle} — ${source.sourceVersion}`, url: source.sourceUrl }
}

function calculateFamily(input: CaoPayrollIntegrationInput, family: CaoPayrollFamily): CaoPayrollCalculation {
  const sourceResolution = input.salaryTableSource
  const references = sourceResolution?.source ? [referenceFor(sourceResolution.source)] : []
  if (family === 'KINDEROPVANG') references.push({ title: 'Cao Kinderopvang 2025–2026 — regels voor werkurentoeslag', url: KINDEROPVANG_RULE_SOURCE })
  if (family === 'RETAIL_MODE' && input.retailBusinessScope
    && !isValidRetailBusinessScope(input, input.retailBusinessScope)) {
    return blocked(family, 'CAO_RETAIL_BUSINESS_SCOPE_INVALID', 'SOURCE_GAP', references)
  }
  if (!input.salary) return blocked(family, 'CAO_SALARY_SOURCE_MISSING', 'SOURCE_GAP', references)
  if (!input.schedule) return blocked(family, 'CAO_SCHEDULE_SOURCE_MISSING', 'SOURCE_GAP', references)
  if (!sourceResolution || sourceResolution.status !== 'RESOLVED' || !sourceResolution.source) {
    return blocked(family, sourceResolution?.reasonCode ?? 'CAO_SALARY_TABLE_SOURCE_MISSING', 'SOURCE_GAP', references)
  }
  const table = sourceResolution.source
  const start = periodStart(input.period)
  const endInclusive = new Date(Date.UTC(input.period.year, input.period.month, 0)).toISOString().slice(0, 10)
  if (table.salaryId !== input.salary.id
    || table.structureId !== input.salary.salaryStructureId
    || table.scaleId !== input.salary.salaryScaleId
    || table.stepId !== input.salary.salaryScaleStepId
    || table.effectiveFrom > start || table.effectiveTo < endInclusive
    || input.salary.validFrom > start || (input.salary.validUntil && input.salary.validUntil < endInclusive)) {
    return blocked(family, 'CAO_SALARY_TABLE_LINK_OR_PERIOD_MISMATCH', 'UNSUPPORTED', references)
  }
  if (input.salary.salaryBasis !== 'CAO_SCALE') {
    return blocked(family, 'CAO_SALARY_BASIS_MISMATCH', 'UNSUPPORTED', references)
  }
  const scaleToken = numericToken(table.scaleCode) ?? numericToken(table.scaleName)
  const scaleIdentity = salaryRowIdentityToken(table.scaleCode) ?? salaryRowIdentityToken(table.scaleName)
  const stepIdentity = salaryRowIdentityToken(table.stepCode) ?? salaryRowIdentityToken(table.stepName)
  const assignedScaleIdentity = salaryRowIdentityToken(input.salary.caoScaleName)
  const assignedStepIdentity = salaryRowIdentityToken(input.salary.caoStepName)
    ?? salaryRowIdentityToken(input.salary.salaryStepCode)
  if (!scaleIdentity || !stepIdentity || scaleIdentity !== assignedScaleIdentity || stepIdentity !== assignedStepIdentity) {
    return blocked(family, 'CAO_SALARY_TABLE_ROW_MISMATCH', 'UNSUPPORTED', references)
  }

  const contractHours = parseNonNegative(input.schedule.contractHoursPerWeek)
  const fullTimeHours = parseNonNegative(input.schedule.fullTimeHoursPerWeek)
  if (!contractHours || !fullTimeHours || contractHours.compare(FixedDecimal.fromInteger(BigInt(0))) <= 0
    || fullTimeHours.compare(FixedDecimal.fromInteger(BigInt(0))) <= 0
    || contractHours.compare(fullTimeHours) > 0) {
    return blocked(family, 'CAO_SCHEDULE_FACTOR_INVALID', 'UNSUPPORTED', references)
  }
  const work = sumApprovedWork(input.actualWorkEntries, family)
  if (work.reasonCode) return blocked(family, work.reasonCode, 'UNSUPPORTED', references)

  let fullTimeMonthly: FixedDecimal
  let baseAmount: FixedDecimal
  let hourlyBaseRate: FixedDecimal | null = null
  let premiumAmount = FixedDecimal.fromInteger(BigInt(0))
  let formula: string
  let premiumFormula: string | null = null

  if (family === 'KINDEROPVANG') {
    if (table.salaryBasis !== 'MONTHLY_BASE') {
      return blocked(family, 'CAO_MONTHLY_SALARY_TABLE_REQUIRED', 'UNSUPPORTED', references)
    }
    const fullTime = parseNonNegative(table.fulltimeAmount)
    if (!fullTime || fullTime.compare(FixedDecimal.fromInteger(BigInt(0))) <= 0) {
      return blocked(family, 'CAO_SALARY_TABLE_AMOUNT_INVALID', 'UNSUPPORTED', references)
    }
    fullTimeMonthly = fullTime
    const monthlyBase = fullTime.multiply(contractHours)
      .divideToScale(fullTimeHours, 18, 'ARITHMETIC')
    const proratedBase = partialPeriodAmount(input, monthlyBase)
    if (!proratedBase) return blocked(family, 'CAO_PERIOD_PRORATION_INVALID', 'UNSUPPORTED', references)
    baseAmount = proratedBase
    formula = 'Published full-time monthly salary table value × contract hours ÷ full-time hours, then period proration.'
    if (work.hours.compare(FixedDecimal.fromInteger(BigInt(0))) > 0) {
      const scaleNumber = Number(scaleToken)
      if (scaleNumber >= 11) return blocked(family, 'CAO_KINDEROPVANG_HIGH_SCALE_WORK_HOUR_EXCEPTION_REQUIRES_REVIEW', 'UNSUPPORTED', references)
      const maximumBasis = table.maximumStepFulltimeAmount ? parseNonNegative(table.maximumStepFulltimeAmount) : null
      if (!maximumBasis || maximumBasis.compare(FixedDecimal.fromInteger(BigInt(0))) <= 0) {
        return blocked(family, 'CAO_KINDEROPVANG_PREMIUM_CAP_STEP_MISSING', 'SOURCE_GAP', references)
      }
      const cappedMonthlyBasis = fullTime.compare(maximumBasis) > 0 ? maximumBasis : fullTime
      hourlyBaseRate = cappedMonthlyBasis.multiply(FixedDecimal.fromInteger(BigInt(12)))
        .divideToScale(FixedDecimal.parse('1879.2'), 18, 'ARITHMETIC')
      premiumAmount = hourlyBaseRate.multiply(FixedDecimal.parse('0.45')).multiply(work.hours)
      premiumFormula = 'Minimum of the employee full-time salary and salary number 18 × 12 ÷ 1,879.2 annual hours × 45% × approved Sunday or public-holiday hours.'
    }
  } else {
    if (table.salaryBasis !== 'HOURLY' || table.hourlyAmount === null) {
      return blocked(family, 'CAO_RETAIL_HOURLY_RATE_MISSING', 'SOURCE_GAP', references)
    }
    if (input.salary.paymentType === 'HOURLY_VARIABLE') {
      return blocked(family, 'CAO_RETAIL_VARIABLE_HOURS_SOURCE_REQUIRED', 'SOURCE_GAP', references)
    }
    const hourly = parseNonNegative(table.hourlyAmount)
    if (!hourly || hourly.compare(FixedDecimal.fromInteger(BigInt(0))) <= 0) {
      return blocked(family, 'CAO_RETAIL_HOURLY_RATE_INVALID', 'UNSUPPORTED', references)
    }
    const averageMonthlyHours = fullTimeHours.multiply(FixedDecimal.parse('52'))
      .divideToScale(FixedDecimal.parse('12'), 2, 'ARITHMETIC')
    fullTimeMonthly = hourly.multiply(averageMonthlyHours).round(2, 'HALF_UP')
    const monthlyBase = fullTimeMonthly.multiply(contractHours)
      .divideToScale(fullTimeHours, 18, 'ARITHMETIC').round(2, 'HALF_UP')
    const proratedBase = partialPeriodAmount(input, monthlyBase)
    if (!proratedBase) return blocked(family, 'CAO_PERIOD_PRORATION_INVALID', 'UNSUPPORTED', references)
    baseAmount = proratedBase.round(2, 'HALF_UP')
    hourlyBaseRate = hourly
    formula = 'Published hourly table value × rounded monthly full-time hours (full-time hours × 52 ÷ 12) × contract factor, then period proration.'
  }

  const grossAmount = family === 'RETAIL_MODE'
    ? baseAmount.add(premiumAmount).round(2, 'HALF_UP')
    : baseAmount.add(premiumAmount)
  const grossAmountText = family === 'RETAIL_MODE' ? grossAmount.toString(2) : grossAmount.toString()
  const sourceHash = sha256(stableSerialize({
    revisionId: table.revisionId,
    revisionNumber: table.revisionNumber,
    sourceHash: table.sourceHash,
    sourceRowCount: table.sourceRowCount,
    effectiveFrom: table.effectiveFrom,
    effectiveTo: table.effectiveTo,
  }))
  const inputHash = sha256(stableSerialize({
    salaryId: input.salary.id,
    scaleId: table.scaleId,
    stepId: table.stepId,
    fulltimeAmount: table.fulltimeAmount,
    hourlyAmount: table.hourlyAmount,
    contractHours: contractHours.toString(),
    fullTimeHours: fullTimeHours.toString(),
    period: input.period,
    activeStart: input.activeStart,
    activeEndExclusive: input.activeEndExclusive,
    approvedHours: work.hours.toString(),
  }))
  const resultHash = sha256(stableSerialize({
    baseAmount: baseAmount.toString(),
    premiumAmount: premiumAmount.toString(),
    grossAmount: grossAmountText,
    sourceHash,
    inputHash,
  }))
  const trace: CaoCalculationTraceStep[] = [{
    code: `${family}_BASE_SALARY`,
    formula,
    values: {
      sourceRevisionId: table.revisionId,
      salaryScale: table.scaleCode,
      salaryStep: table.stepCode,
      fullTimeSalary: fullTimeMonthly.toString(),
      contractHoursPerWeek: contractHours.toString(),
      fullTimeHoursPerWeek: fullTimeHours.toString(),
      baseSalary: baseAmount.toString(),
    },
    sourceReference: table.sourceUrl,
  }]
  if (premiumFormula) {
    trace.push({
      code: 'CAO_KINDEROPVANG_WORK_HOUR_PREMIUM',
      formula: premiumFormula,
      values: {
        approvedSundayOrHolidayHours: work.hours.toString(),
        maximumStepFulltimeAmount: table.maximumStepFulltimeAmount,
        hourlyBaseRate: hourlyBaseRate?.toString() ?? null,
        premium: premiumAmount.toString(),
      },
      sourceReference: KINDEROPVANG_RULE_SOURCE,
    })
  }
  trace.push({
    code: `${family}_GROSS_RESULT`,
    formula: 'Period base salary + applicable approved work-hour premium.',
    values: { grossAmount: grossAmountText },
    sourceReference: table.sourceUrl,
  })
  const sourceReferences = [referenceFor(table), ...(family === 'KINDEROPVANG'
    ? [{ title: 'Cao Kinderopvang 2025–2026 — regels voor werkurentoeslag', url: KINDEROPVANG_RULE_SOURCE }]
    : [])]
  return {
    status: 'CALCULATED',
    family,
    packageId: `CORE_SALARY_STRUCTURE:${table.structureId}`,
    packageVersion: table.sourceVersion,
    compositionId: `CORE_SALARY_REVISION:${table.revisionId}`,
    packageHash: table.sourceHash,
    sourceHash,
    inputHash,
    resultHash,
    effectiveFrom: table.effectiveFrom,
    effectiveTo: table.effectiveTo,
    baseAmount: baseAmount.toString(),
    premiumAmount: premiumAmount.toString(),
    grossAmount: grossAmountText,
    fullTimeMonthlyAmount: fullTimeMonthly.toString(),
    ...(hourlyBaseRate ? { hourlyBaseRate: hourlyBaseRate.toString() } : {}),
    actualWorkConsumed: work.consumed,
    inputs: {
      salaryScale: table.scaleCode,
      salaryStep: table.stepCode,
      contractHoursPerWeek: contractHours.toString(),
      fullTimeHoursPerWeek: fullTimeHours.toString(),
      approvedSundayOrHolidayHours: work.hours.toString(),
      sourceRevisionId: table.revisionId,
    },
    trace,
    sourceReferences,
  }
}

export function calculateCaoPayroll(input: CaoPayrollIntegrationInput): CaoPayrollCalculation {
  const family = caoFamily(input)
  if (!family) return { status: 'NOT_APPLICABLE' }
  return calculateFamily(input, family)
}
