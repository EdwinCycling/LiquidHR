import { sha256, stableSerialize, FixedDecimal } from '@liquid-hr/payroll-engine'
import { createPayfull02RulePackage } from '@liquid-hr/payroll-rules-nl-2026'

export const PAYROLL_EMPLOYER_CONFIGURATION_SCHEMA = 'payroll-employer-configuration-v1' as const
export const PAYROLL_CUSTOMER_COMPONENT_KIND = 'CUSTOMER_STANDARD' as const

export type PayrollEmployerConfigurationStatus = 'DRAFT' | 'ACTIVE'
export type PayrollPensionPartialMonthMethod =
  | 'UNCONFIGURED'
  | 'CALENDAR_DAYS_PRO_RATA'
  | 'FULL_MONTH'

export type PayrollEmployerConfiguration = {
  readonly schemaVersion: typeof PAYROLL_EMPLOYER_CONFIGURATION_SCHEMA
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
  readonly status: PayrollEmployerConfigurationStatus
  readonly sourceReference: string
  readonly employer: {
    readonly sectorCode: string | null
    readonly whkDecisionReference: string | null
    readonly awfClassification: string | null
    readonly aofClassification: string | null
    readonly wkoClassification: string | null
    readonly zvwClassification: string | null
  }
  readonly employerRates: {
    readonly awf: string | null
    readonly aof: string | null
    readonly wko: string | null
    readonly whk: string | null
    readonly zvw: string | null
  }
  readonly reserves: {
    readonly holidayAllowanceRate: string | null
    readonly yearEndApplies: boolean | null
    readonly yearEndRate: string | null
  }
  readonly componentSet: {
    readonly compositionId: string
    readonly packageVersion: string
    readonly packageHash: string
  }
  readonly pension: {
    readonly partialMonthMethod: PayrollPensionPartialMonthMethod
    readonly methodSourceReference: string | null
  }
}

export type PayrollEmployerConfigurationDraft = Omit<PayrollEmployerConfiguration, 'status' | 'componentSet'> & {
  readonly status?: PayrollEmployerConfigurationStatus
  readonly componentSet?: Partial<PayrollEmployerConfiguration['componentSet']>
}

export type PayrollEmployerConfigurationBlocker = {
  readonly code:
    | 'EFFECTIVE_FROM_REQUIRED'
    | 'EFFECTIVE_RANGE_INVALID'
    | 'SOURCE_REFERENCE_REQUIRED'
    | 'SECTOR_REQUIRED'
    | 'WHK_DECISION_REFERENCE_REQUIRED'
    | 'AWF_CLASSIFICATION_REQUIRED'
    | 'AOF_CLASSIFICATION_REQUIRED'
    | 'WKO_CLASSIFICATION_REQUIRED'
    | 'ZVW_CLASSIFICATION_REQUIRED'
    | 'AWF_RATE_REQUIRED'
    | 'AOF_RATE_REQUIRED'
    | 'WKO_RATE_REQUIRED'
    | 'WHK_RATE_REQUIRED'
    | 'ZVW_RATE_REQUIRED'
    | 'HOLIDAY_ALLOWANCE_RATE_REQUIRED'
    | 'YEAR_END_APPLICABILITY_REQUIRED'
    | 'YEAR_END_RATE_REQUIRED'
    | 'COMPONENT_SET_REQUIRED'
    | 'PENSION_PARTIAL_MONTH_METHOD_REQUIRED'
    | 'PENSION_METHOD_SOURCE_REQUIRED'
  readonly field: string
}

export type PayrollOpeningCumulativeBalance = {
  readonly schemaVersion: 'payroll-opening-cumulative-v1'
  readonly sourcePeriodFrom: string
  readonly sourcePeriodTo: string
  readonly asOfDate: string
  readonly meaning: {
    readonly grossWageBeforePeriod: string
    readonly taxableWageBeforePeriod: string
    readonly wageTaxBeforePeriod: string
    readonly employeeInsuranceWageBeforePeriod: string
    readonly zvwWageBeforePeriod: string
    readonly holidayReserveBeforePeriod: string
    readonly yearEndReserveBeforePeriod: string
  }
  readonly sourceReference: string
}

export type PayrollOpeningCumulativeBalanceDraft = {
  readonly sourcePeriodFrom: string
  readonly sourcePeriodTo: string
  readonly asOfDate: string
  readonly meaning: {
    readonly grossWageBeforePeriod: string | null
    readonly taxableWageBeforePeriod: string | null
    readonly wageTaxBeforePeriod: string | null
    readonly employeeInsuranceWageBeforePeriod: string | null
    readonly zvwWageBeforePeriod: string | null
    readonly holidayReserveBeforePeriod: string | null
    readonly yearEndReserveBeforePeriod: string | null
  }
  readonly sourceReference: string
}

export type PayrollOpeningCumulativeBlocker = {
  readonly code:
    | 'OPENING_SOURCE_PERIOD_INVALID'
    | 'OPENING_AS_OF_DATE_INVALID'
    | 'OPENING_PERIOD_AFTER_AS_OF_DATE'
    | 'OPENING_SOURCE_REFERENCE_REQUIRED'
    | 'OPENING_VALUE_REQUIRED'
    | 'OPENING_VALUE_INVALID'
  readonly field: string
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const HASH_PATTERN = /^[0-9a-f]{64}$/
const MONEY_PATTERN = /^\d{1,12}(?:\.\d{1,2})?$/
const ZERO = FixedDecimal.fromInteger(BigInt(0))
const ONE_HUNDRED = FixedDecimal.fromInteger(BigInt(100))

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? ''
  return normalized.length > 0 ? normalized : null
}

function validDate(value: string | null): boolean {
  if (!value || !DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}

function normalizeRate(value: string | null | undefined): string | null {
  const normalized = clean(value)
  if (normalized === null) return null
  try {
    const decimal = FixedDecimal.parse(normalized)
    if (decimal.scale > 4 || decimal.compare(ZERO) < 0 || decimal.compare(ONE_HUNDRED) > 0) return null
    return decimal.toString(4)
  } catch {
    return null
  }
}

const OPENING_VALUE_FIELDS = [
  'grossWageBeforePeriod', 'taxableWageBeforePeriod', 'wageTaxBeforePeriod',
  'employeeInsuranceWageBeforePeriod', 'zvwWageBeforePeriod', 'holidayReserveBeforePeriod',
  'yearEndReserveBeforePeriod',
] as const satisfies readonly (keyof PayrollOpeningCumulativeBalance['meaning'])[]

function normalizeOpeningMoney(value: string | null): string | null {
  const normalized = clean(value)
  if (normalized === null || !MONEY_PATTERN.test(normalized)) return null
  try {
    return FixedDecimal.parse(normalized).toString(2)
  } catch {
    return null
  }
}

function componentSetFromDraft(
  draft: PayrollEmployerConfigurationDraft,
): PayrollEmployerConfiguration['componentSet'] {
  const packageDefinition = createPayfull02RulePackage(PAYROLL_CUSTOMER_COMPONENT_KIND, {
    supportPartialPeriods: true,
  })
  const componentSet = draft.componentSet
  return {
    compositionId: componentSet?.compositionId?.trim() || packageDefinition.compositionId,
    packageVersion: componentSet?.packageVersion?.trim() || packageDefinition.metadata?.version || '2026.1',
    packageHash: componentSet?.packageHash?.trim() || packageDefinition.metadata?.packageHash || '',
  }
}

export function normalizePayrollEmployerConfiguration(
  draft: PayrollEmployerConfigurationDraft,
): PayrollEmployerConfiguration {
  const componentSet = componentSetFromDraft(draft)
  return {
    schemaVersion: PAYROLL_EMPLOYER_CONFIGURATION_SCHEMA,
    effectiveFrom: draft.effectiveFrom.trim(),
    effectiveTo: clean(draft.effectiveTo),
    status: draft.status ?? 'DRAFT',
    sourceReference: draft.sourceReference.trim(),
    employer: {
      sectorCode: clean(draft.employer.sectorCode),
      whkDecisionReference: clean(draft.employer.whkDecisionReference),
      awfClassification: clean(draft.employer.awfClassification),
      aofClassification: clean(draft.employer.aofClassification),
      wkoClassification: clean(draft.employer.wkoClassification),
      zvwClassification: clean(draft.employer.zvwClassification),
    },
    employerRates: {
      awf: normalizeRate(draft.employerRates.awf),
      aof: normalizeRate(draft.employerRates.aof),
      wko: normalizeRate(draft.employerRates.wko),
      whk: normalizeRate(draft.employerRates.whk),
      zvw: normalizeRate(draft.employerRates.zvw),
    },
    reserves: {
      holidayAllowanceRate: normalizeRate(draft.reserves.holidayAllowanceRate),
      yearEndApplies: draft.reserves.yearEndApplies ?? null,
      yearEndRate: normalizeRate(draft.reserves.yearEndRate),
    },
    componentSet,
    pension: {
      partialMonthMethod: draft.pension.partialMonthMethod,
      methodSourceReference: clean(draft.pension.methodSourceReference),
    },
  }
}

export function payrollEmployerConfigurationBlockers(
  configuration: PayrollEmployerConfiguration,
): readonly PayrollEmployerConfigurationBlocker[] {
  const blockers: PayrollEmployerConfigurationBlocker[] = []
  if (!validDate(configuration.effectiveFrom)) blockers.push({ code: 'EFFECTIVE_FROM_REQUIRED', field: 'effectiveFrom' })
  if (configuration.effectiveTo !== null
    && (!validDate(configuration.effectiveTo) || configuration.effectiveTo < configuration.effectiveFrom)) {
    blockers.push({ code: 'EFFECTIVE_RANGE_INVALID', field: 'effectiveTo' })
  }
  if (!configuration.sourceReference) blockers.push({ code: 'SOURCE_REFERENCE_REQUIRED', field: 'sourceReference' })

  const requiredText: readonly [keyof PayrollEmployerConfiguration['employer'], PayrollEmployerConfigurationBlocker['code']][] = [
    ['sectorCode', 'SECTOR_REQUIRED'],
    ['whkDecisionReference', 'WHK_DECISION_REFERENCE_REQUIRED'],
    ['awfClassification', 'AWF_CLASSIFICATION_REQUIRED'],
    ['aofClassification', 'AOF_CLASSIFICATION_REQUIRED'],
    ['wkoClassification', 'WKO_CLASSIFICATION_REQUIRED'],
    ['zvwClassification', 'ZVW_CLASSIFICATION_REQUIRED'],
  ]
  for (const [field, code] of requiredText) {
    if (!configuration.employer[field]) blockers.push({ code, field: `employer.${field}` })
  }

  const requiredRates: readonly [keyof PayrollEmployerConfiguration['employerRates'], PayrollEmployerConfigurationBlocker['code']][] = [
    ['awf', 'AWF_RATE_REQUIRED'],
    ['aof', 'AOF_RATE_REQUIRED'],
    ['wko', 'WKO_RATE_REQUIRED'],
    ['whk', 'WHK_RATE_REQUIRED'],
    ['zvw', 'ZVW_RATE_REQUIRED'],
  ]
  for (const [field, code] of requiredRates) {
    if (!configuration.employerRates[field]) blockers.push({ code, field: `employerRates.${field}` })
  }
  if (!configuration.reserves.holidayAllowanceRate) {
    blockers.push({ code: 'HOLIDAY_ALLOWANCE_RATE_REQUIRED', field: 'reserves.holidayAllowanceRate' })
  }
  if (configuration.reserves.yearEndApplies === null) {
    blockers.push({ code: 'YEAR_END_APPLICABILITY_REQUIRED', field: 'reserves.yearEndApplies' })
  } else if (configuration.reserves.yearEndApplies && !configuration.reserves.yearEndRate) {
    blockers.push({ code: 'YEAR_END_RATE_REQUIRED', field: 'reserves.yearEndRate' })
  }
  if (!configuration.componentSet.compositionId || !configuration.componentSet.packageVersion || !HASH_PATTERN.test(configuration.componentSet.packageHash)) {
    blockers.push({ code: 'COMPONENT_SET_REQUIRED', field: 'componentSet' })
  }
  if (configuration.pension.partialMonthMethod === 'UNCONFIGURED') {
    blockers.push({ code: 'PENSION_PARTIAL_MONTH_METHOD_REQUIRED', field: 'pension.partialMonthMethod' })
  }
  if (!configuration.pension.methodSourceReference) {
    blockers.push({ code: 'PENSION_METHOD_SOURCE_REQUIRED', field: 'pension.methodSourceReference' })
  }
  return blockers
}

export function validatePayrollEmployerConfiguration(
  draft: PayrollEmployerConfigurationDraft,
): { readonly configuration: PayrollEmployerConfiguration; readonly blockers: readonly PayrollEmployerConfigurationBlocker[] } {
  const configuration = normalizePayrollEmployerConfiguration(draft)
  const blockers = payrollEmployerConfigurationBlockers(configuration)
  return { configuration, blockers }
}

export function assertActivePayrollEmployerConfiguration(
  draft: PayrollEmployerConfigurationDraft,
): PayrollEmployerConfiguration {
  const { configuration, blockers } = validatePayrollEmployerConfiguration({ ...draft, status: 'ACTIVE' })
  if (blockers.length > 0) throw new PayrollEmployerConfigurationError(blockers)
  return configuration
}

export function hashPayrollEmployerConfiguration(configuration: PayrollEmployerConfiguration): string {
  return sha256(stableSerialize(configuration))
}

export function normalizePayrollOpeningCumulativeBalance(
  draft: PayrollOpeningCumulativeBalanceDraft,
): PayrollOpeningCumulativeBalance {
  return {
    schemaVersion: 'payroll-opening-cumulative-v1',
    sourcePeriodFrom: draft.sourcePeriodFrom.trim(),
    sourcePeriodTo: draft.sourcePeriodTo.trim(),
    asOfDate: draft.asOfDate.trim(),
    meaning: Object.fromEntries(OPENING_VALUE_FIELDS.map((field) => [
      field,
      normalizeOpeningMoney(draft.meaning[field]) ?? '',
    ])) as PayrollOpeningCumulativeBalance['meaning'],
    sourceReference: draft.sourceReference.trim(),
  }
}

export function payrollOpeningCumulativeBlockers(
  draft: PayrollOpeningCumulativeBalanceDraft,
): readonly PayrollOpeningCumulativeBlocker[] {
  const blockers: PayrollOpeningCumulativeBlocker[] = []
  if (!validDate(draft.sourcePeriodFrom) || !validDate(draft.sourcePeriodTo)
    || draft.sourcePeriodFrom > draft.sourcePeriodTo) {
    blockers.push({ code: 'OPENING_SOURCE_PERIOD_INVALID', field: 'sourcePeriod' })
  }
  if (!validDate(draft.asOfDate)) blockers.push({ code: 'OPENING_AS_OF_DATE_INVALID', field: 'asOfDate' })
  if (validDate(draft.sourcePeriodTo) && validDate(draft.asOfDate) && draft.sourcePeriodTo >= draft.asOfDate) {
    blockers.push({ code: 'OPENING_PERIOD_AFTER_AS_OF_DATE', field: 'asOfDate' })
  }
  if (!clean(draft.sourceReference)) blockers.push({ code: 'OPENING_SOURCE_REFERENCE_REQUIRED', field: 'sourceReference' })
  for (const field of OPENING_VALUE_FIELDS) {
    const value = clean(draft.meaning[field])
    if (value === null) blockers.push({ code: 'OPENING_VALUE_REQUIRED', field: `meaning.${field}` })
    else if (!normalizeOpeningMoney(value)) blockers.push({ code: 'OPENING_VALUE_INVALID', field: `meaning.${field}` })
  }
  return blockers
}

export function hashPayrollOpeningCumulativeBalance(balance: PayrollOpeningCumulativeBalance): string {
  return sha256(stableSerialize(balance))
}

export class PayrollEmployerConfigurationError extends Error {
  constructor(readonly blockers: readonly PayrollEmployerConfigurationBlocker[]) {
    super('Payroll employer configuration is not ready for activation.')
    this.name = 'PayrollEmployerConfigurationError'
  }
}

export function isNewIncomeRelationshipWithoutOpening(
  employmentStartsOn: string,
  periodStart: string,
): boolean {
  return validDate(employmentStartsOn) && validDate(periodStart) && employmentStartsOn > periodStart
}
