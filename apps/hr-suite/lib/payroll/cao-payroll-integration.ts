import {
  buildCalculationInputs,
  calculatePayroll,
  FixedDecimal,
  sha256,
  stableSerialize,
  type PayrollCalculationResult,
  type PayrollCalculationTraceStep,
  type PayrollPeriodReference,
  type PayrollSourceSnapshot,
} from '@liquid-hr/payroll-engine'
import {
  getKinderopvangRuleBundle,
  getRetailModeRuleBundle,
} from '@liquid-hr/payroll-rules-cao-bench02'
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
  readonly componentTrace?: readonly PayrollCalculationTraceStep[]
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
}

export type CaoPayrollScheduleInput = {
  readonly contractHoursPerWeek: number
  readonly fullTimeHoursPerWeek: number
}

export type CaoPayrollActualWorkEntry = {
  readonly family: string
  readonly typeCode?: string | null
  readonly typeName?: string | null
  readonly hours: string | number
  readonly status: string
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
  readonly schedule: CaoPayrollScheduleInput | null
  readonly actualWorkEntries: readonly CaoPayrollActualWorkEntry[]
}

const KINDEROPVANG_SOURCES = Object.freeze([
  {
    title: 'Cao Kinderopvang 2025–2026 — integrale cao-tekst',
    url: 'https://www.kinderopvang-werkt.nl/sites/fcb_kinderopvang/files/2025-06/Cao-Kinderopvang-2025-2026-integraal.pdf',
  },
  {
    title: 'Cao Kinderopvang 2025–2026 — salarisschalen',
    url: 'https://www.kinderopvang-werkt.nl/sites/fcb_kinderopvang/files/2025-04/Bijlage-2-Salarisschalen-Cao-Kinderopvang-2025-2026.pdf',
  },
  {
    title: 'Cao Kinderopvang — werkurentoeslag',
    url: 'https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/werkurentoeslag',
  },
])

const RETAIL_MODE_SOURCES = Object.freeze([
  {
    title: 'Cao Retail Non-Food — januari 2026',
    url: 'https://www.inretail.nl/wp-content/uploads/2026/02/260121-Cao-Retail-Non-Food-januari-2026-def.pdf',
  },
  {
    title: 'Cao Retail Non-Food — juli 2026',
    url: 'https://www.inretail.nl/wp-content/uploads/2026/05/260527-Cao-Retail-Non-Food-juli-2026-def.pdf',
  },
])

function normalized(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function mentions(value: string | null | undefined, patterns: readonly string[]): boolean {
  const normalizedValue = normalized(value)
  return patterns.some((pattern) => normalizedValue === pattern || normalizedValue.includes(pattern))
}

function caoFamily(input: CaoPayrollIntegrationInput): CaoPayrollFamily | null {
  const values = [input.laborConditionCode, input.laborConditionName]
  if (values.some((value) => mentions(value, [
    'CAO_KINDEROPVANG_2025_2026',
    'CAO_KINDEROPVANG_2025',
    'KINDEROPVANG_2025_2026',
    'KINDEROPVANG',
  ]))) return 'KINDEROPVANG'
  if (values.some((value) => mentions(value, [
    'CAO_RETAIL_NON_FOOD_2026_2027',
    'RETAIL_NON_FOOD_MODE_2026_2027',
    'RETAIL_NON_FOOD',
    'RETAIL_MODE',
  ]))) return 'RETAIL_MODE'
  return null
}

function numericToken(value: string | null | undefined): string | null {
  const match = (value ?? '').trim().match(/(?:^|[^0-9])([0-9]+(?:[.,][0-9]+)?)(?:$|[^0-9])/)
  return match?.[1]?.replace(',', '.') ?? null
}

function scaleToken(salary: CaoPayrollSalaryInput): string | null {
  return numericToken(salary.caoScaleName)
}

function stepToken(salary: CaoPayrollSalaryInput): string | null {
  return numericToken(salary.caoStepName) ?? numericToken(salary.salaryStepCode)
}

function parseNonNegative(value: string | number, reasonCode: string): { readonly value: FixedDecimal } | { readonly reasonCode: string } {
  try {
    const parsed = FixedDecimal.parse(String(value))
    return parsed.compare(FixedDecimal.fromInteger(BigInt(0))) < 0
      ? { reasonCode }
      : { value: parsed }
  } catch {
    return { reasonCode }
  }
}

function sumActualWork(
  entries: readonly CaoPayrollActualWorkEntry[],
  family: CaoPayrollFamily,
): {
  readonly values: Readonly<Record<string, FixedDecimal>>
  readonly consumed: boolean
  readonly reasonCode?: string
} {
  const zero = FixedDecimal.fromInteger(BigInt(0))
  let sundayHours = zero
  let weekdayNightHours = zero
  let dailyOvertimeHours = zero
  let consumed = false
  for (const entry of entries) {
    if (entry.family === 'TRANSPARENT') continue
    const code = normalized(entry.typeCode)
    const name = normalized(entry.typeName)
    const searchable = `${code}_${name}`
    const sunday = /SUNDAY|ZONDAG/.test(searchable)
    const night = /NIGHT|NACHT/.test(searchable)
    const overtime = entry.family === 'OVERTIME' || /OVERTIME|OVERWERK|OVERUREN/.test(searchable)
    const matched = family === 'KINDEROPVANG' ? sunday : sunday || night || overtime
    if (!matched) return { values: {}, consumed: false, reasonCode: 'CAO_ACTUAL_WORK_TYPE_UNSUPPORTED' }
    const parsed = parseNonNegative(entry.hours, 'CAO_ACTUAL_WORK_HOURS_INVALID')
    if ('reasonCode' in parsed) return { values: {}, consumed: false, reasonCode: parsed.reasonCode }
    if (entry.status !== 'APPROVED') continue
    consumed = true
    if (sunday) sundayHours = sundayHours.add(parsed.value)
    if (night) weekdayNightHours = weekdayNightHours.add(parsed.value)
    if (overtime) dailyOvertimeHours = dailyOvertimeHours.add(parsed.value)
  }
  return {
    values: { sundayHours, weekdayNightHours, dailyOvertimeHours },
    consumed,
  }
}

function periodStart(period: PayrollPeriodReference): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}-01`
}

function periodEndExclusive(period: PayrollPeriodReference): string {
  return new Date(Date.UTC(period.year, period.month, 1)).toISOString().slice(0, 10)
}

function periodEndInclusive(period: PayrollPeriodReference): string {
  return new Date(Date.UTC(period.year, period.month, 0)).toISOString().slice(0, 10)
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}

function moneyResult(result: PayrollCalculationResult, key: string): string | null {
  const row = result.resultRows.find((candidate) => candidate.key === key)
  return row && row.valueType === 'MONEY' && typeof row.value === 'string' ? row.value : null
}

function sourceHashForScenario(input: CaoPayrollIntegrationInput, scenario: Readonly<Record<string, unknown>>): string {
  return sha256(stableSerialize({
    sourceTenantId: input.tenantId,
    sourceHrGroupId: input.hrGroupId,
    sourceAdministrationId: input.administrationId,
    sourceEmployeeId: input.employeeId,
    sourceEmploymentId: input.employmentId,
    sourceIncomeRelationshipId: input.incomeRelationshipId,
    periodReference: input.period,
    canonicalSource: { scenario },
    sourceVersionVector: {},
    sourceGaps: [],
  }))
}

function runRule(
  input: CaoPayrollIntegrationInput,
  scenario: Readonly<Record<string, string | boolean>>,
  bundle: ReturnType<typeof getKinderopvangRuleBundle> | ReturnType<typeof getRetailModeRuleBundle>,
): PayrollCalculationResult {
  const sourceHash = sourceHashForScenario(input, scenario)
  const snapshot: PayrollSourceSnapshot = {
    id: `CAO_SOURCE:${sourceHash}`,
    sourceTenantId: input.tenantId,
    sourceHrGroupId: input.hrGroupId,
    sourceAdministrationId: input.administrationId,
    sourceEmployeeId: input.employeeId,
    sourceEmploymentId: input.employmentId,
    sourceIncomeRelationshipId: input.incomeRelationshipId,
    periodReference: input.period,
    canonicalSource: { scenario },
    sourceVersionVector: {},
    sourceGaps: [],
    sourceHash,
    createdAt: new Date(0).toISOString(),
  }
  const inputs = buildCalculationInputs(snapshot, bundle.rulePackage, { effectiveDate: periodStart(input.period) })
  return calculatePayroll(inputs, bundle.registry)
}

function partialPeriodAmount(
  input: CaoPayrollIntegrationInput,
  amount: string,
): string {
  if (input.activeStart <= periodStart(input.period) && input.activeEndExclusive >= periodEndExclusive(input.period)) return amount
  try {
    const segments = calculateNl2026PeriodSegments({
      periodStart: periodStart(input.period),
      periodEndExclusive: periodEndExclusive(input.period),
      paidStart: input.activeStart,
      paidEndExclusive: input.activeEndExclusive,
    })
    return prorateMonthlySalary(FixedDecimal.parse(amount), segments.paidWorkdays, segments.periodWorkdays).toString(2)
  } catch {
    return amount
  }
}

function blocked(
  family: CaoPayrollFamily,
  reasonCode: string,
  blockingStatus: 'SOURCE_GAP' | 'UNSUPPORTED',
  sources: readonly { readonly title: string; readonly url: string }[],
): CaoPayrollCalculation {
  return { status: 'BLOCKED', family, reasonCode, blockingStatus, sourceReferences: sources }
}

function calculateKinderopvang(input: CaoPayrollIntegrationInput): CaoPayrollCalculation {
  const sources = KINDEROPVANG_SOURCES
  if (!input.salary) return blocked('KINDEROPVANG', 'CAO_SALARY_SOURCE_MISSING', 'SOURCE_GAP', sources)
  if (!input.schedule) return blocked('KINDEROPVANG', 'CAO_SCHEDULE_SOURCE_MISSING', 'SOURCE_GAP', sources)
  const scale = scaleToken(input.salary)
  const number = stepToken(input.salary)
  if (!scale) return blocked('KINDEROPVANG', 'CAO_SALARY_SCALE_MISSING', 'SOURCE_GAP', sources)
  if (!number) return blocked('KINDEROPVANG', 'CAO_SALARY_STEP_MISSING', 'SOURCE_GAP', sources)
  const hours = sumActualWork(input.actualWorkEntries, 'KINDEROPVANG')
  if (hours.reasonCode) return blocked('KINDEROPVANG', hours.reasonCode, 'UNSUPPORTED', sources)
  const contractHours = String(input.schedule.contractHoursPerWeek)
  const fullTimeHours = String(input.schedule.fullTimeHoursPerWeek)
  const scenario = {
    salaryScale: scale,
    salaryNumber: number,
    contractHoursPerWeek: contractHours,
    fullTimeHoursPerWeek: fullTimeHours,
    sundayHoursInPeriod: hours.values.sundayHours?.toString() ?? '0',
  }
  try {
    const bundle = getKinderopvangRuleBundle(periodStart(input.period))
    const result = runRule(input, scenario, bundle)
    const baseAmount = moneyResult(result, 'base_salary')
    const premiumAmount = moneyResult(result, 'work_hour_supplement')
    const grossAmount = moneyResult(result, 'gross_salary')
    const fullTimeMonthlyAmount = result.packageMetadata?.sourceMetadata.fullTimeMonthlySalary ?? null
    if (result.status !== 'CALCULATED' || !baseAmount || !premiumAmount || !grossAmount || !fullTimeMonthlyAmount) {
      return blocked('KINDEROPVANG', 'CAO_RULE_RESULT_INCOMPLETE', 'UNSUPPORTED', sources)
    }
    const periodBase = partialPeriodAmount(input, baseAmount)
    const periodPremium = partialPeriodAmount(input, premiumAmount)
    const periodGross = FixedDecimal.parse(periodBase).add(FixedDecimal.parse(periodPremium)).toString()
    const version = result.packageMetadata?.version ?? bundle.rulePackage.compositionId.split(':').at(-1) ?? 'UNKNOWN'
    return {
      status: 'CALCULATED',
      family: 'KINDEROPVANG',
      packageId: result.packageMetadata?.packageId,
      packageVersion: version,
      compositionId: result.rulePackageCompositionId,
      packageHash: result.packageMetadata?.packageHash,
      sourceHash: result.sourceHash,
      inputHash: result.inputHash,
      resultHash: result.resultHash,
      effectiveFrom: result.packageMetadata?.sourceMetadata.packageEffectiveFrom,
      effectiveTo: result.packageMetadata?.sourceMetadata.packageEffectiveTo,
      baseAmount: periodBase,
      premiumAmount: periodPremium,
      grossAmount: periodGross,
      fullTimeMonthlyAmount,
      actualWorkConsumed: hours.consumed,
      inputs: {
        salaryScale: scale,
        salaryNumber: number,
        contractHoursPerWeek: contractHours,
        fullTimeHoursPerWeek: fullTimeHours,
        sundayHoursInPeriod: hours.values.sundayHours?.toString() ?? '0',
      },
      trace: [
        {
          code: 'CAO_KINDEROPVANG_CLASSIFICATION',
          formula: 'Core labor-condition set + salary scale + salary number select the effective supported CAO row.',
          values: { family: 'KINDEROPVANG', salaryScale: scale, salaryNumber: number },
          sourceReference: sources[0]!.url,
        },
        {
          code: 'CAO_KINDEROPVANG_BASE_SALARY',
          formula: 'Full-time monthly table amount × contract hours ÷ full-time hours.',
          values: { fullTimeMonthlySalary: fullTimeMonthlyAmount, contractHoursPerWeek: contractHours, fullTimeHoursPerWeek: fullTimeHours, baseSalary: periodBase },
          sourceReference: sources[1]!.url,
        },
        {
          code: 'CAO_KINDEROPVANG_SUNDAY_SUPPLEMENT',
          formula: 'Full-time annual salary ÷ 1,879.2 annual hours × approved Sunday hours × 45%.',
          values: { sundayHoursInPeriod: hours.values.sundayHours?.toString() ?? '0', premium: periodPremium },
          sourceReference: sources[2]!.url,
        },
        {
          code: 'CAO_KINDEROPVANG_GROSS_RESULT',
          formula: 'Period base salary + period work-hour supplement.',
          values: { grossAmount: periodGross },
          sourceReference: sources[0]!.url,
        },
      ],
      sourceReferences: sources,
    }
  } catch (error) {
    const errorCode = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code : null
    const reasonCode = errorCode === 'KO_UNSUPPORTED_SCALE' || (error instanceof Error && error.message.includes('UNSUPPORTED_SCALE'))
      ? 'CAO_KINDEROPVANG_SCALE_UNSUPPORTED'
      : errorCode === 'KO_UNSUPPORTED_SALARY_NUMBER' || (error instanceof Error && error.message.includes('UNSUPPORTED_SALARY_NUMBER'))
        ? 'CAO_KINDEROPVANG_SALARY_STEP_UNSUPPORTED'
        : errorCode === 'KO_FULL_TIME_HOURS_UNSUPPORTED' || (error instanceof Error && error.message.includes('FULL_TIME_HOURS_UNSUPPORTED'))
          ? 'CAO_KINDEROPVANG_FULL_TIME_HOURS_UNSUPPORTED'
          : `CAO_KINDEROPVANG_RULE_EXECUTION_FAILED${errorCode ? `_${errorCode}` : ''}${error instanceof Error && errorCode === null ? `_${error.message.replace(/[^A-Z0-9_]+/gi, '_').slice(0, 80)}` : ''}`
    return blocked('KINDEROPVANG', reasonCode, 'UNSUPPORTED', sources)
  }
}

function calculateRetailMode(input: CaoPayrollIntegrationInput): CaoPayrollCalculation {
  const sources = RETAIL_MODE_SOURCES
  if (!input.salary) return blocked('RETAIL_MODE', 'CAO_SALARY_SOURCE_MISSING', 'SOURCE_GAP', sources)
  if (!input.schedule) return blocked('RETAIL_MODE', 'CAO_SCHEDULE_SOURCE_MISSING', 'SOURCE_GAP', sources)
  const functionGroup = (input.salary.caoScaleName ?? '').trim().toUpperCase()
  const experienceRow = stepToken(input.salary)
  if (!functionGroup) return blocked('RETAIL_MODE', 'CAO_FUNCTION_GROUP_MISSING', 'SOURCE_GAP', sources)
  if (!experienceRow) return blocked('RETAIL_MODE', 'CAO_EXPERIENCE_ROW_MISSING', 'SOURCE_GAP', sources)
  const scenarioCode = functionGroup === 'I' && experienceRow === '15'
    ? 'R1'
    : functionGroup === 'C' && experienceRow === '1'
      ? 'R2'
      : null
  if (!scenarioCode) return blocked('RETAIL_MODE', 'CAO_RETAIL_ROW_UNSUPPORTED', 'UNSUPPORTED', sources)
  const hours = sumActualWork(input.actualWorkEntries, 'RETAIL_MODE')
  if (hours.reasonCode) return blocked('RETAIL_MODE', hours.reasonCode, 'UNSUPPORTED', sources)
  const weekdayNightHours = hours.values.weekdayNightHours ?? FixedDecimal.fromInteger(BigInt(0))
  const retailBusinessScope = input.retailBusinessScope
  if (weekdayNightHours.compare(FixedDecimal.fromInteger(BigInt(0))) > 0 && !retailBusinessScope) {
    return blocked('RETAIL_MODE', 'CAO_RETAIL_BUSINESS_SCOPE_UNVERIFIED', 'SOURCE_GAP', sources)
  }
  if (retailBusinessScope && (
    !['IN_STORE', 'ECOMMERCE'].includes(retailBusinessScope.value)
    || !['OFFICIAL', 'SYNTHETIC_FIXTURE'].includes(retailBusinessScope.sourceClassification)
    || retailBusinessScope.tenantId !== input.tenantId
    || retailBusinessScope.administrationId !== input.administrationId
    || !retailBusinessScope.sourceReference.trim()
    || !retailBusinessScope.sourceVersion.trim()
    || !isValidIsoDate(retailBusinessScope.effectiveFrom)
    || (retailBusinessScope.effectiveTo !== null && (
      !isValidIsoDate(retailBusinessScope.effectiveTo)
      || retailBusinessScope.effectiveTo < retailBusinessScope.effectiveFrom
    ))
    || retailBusinessScope.effectiveFrom > periodStart(input.period)
    || (retailBusinessScope.effectiveTo !== null && retailBusinessScope.effectiveTo < periodEndInclusive(input.period))
  )) {
    return blocked('RETAIL_MODE', 'CAO_RETAIL_BUSINESS_SCOPE_INVALID', 'SOURCE_GAP', sources)
  }
  const actualHourlyRate = input.salary.hourlyRate === null ? '0' : String(input.salary.hourlyRate)
  if (scenarioCode === 'R1' && actualHourlyRate === '0') return blocked('RETAIL_MODE', 'CAO_RETAIL_ACTUAL_HOURLY_RATE_MISSING', 'SOURCE_GAP', sources)
  const scenario = {
    scenarioCode,
    functionGroup,
    experienceRow,
    contractHoursPerWeek: String(input.schedule.contractHoursPerWeek),
    fullTimeHoursPerWeek: String(input.schedule.fullTimeHoursPerWeek),
    existingActualHourlyRate: scenarioCode === 'R2' ? '0' : actualHourlyRate,
    weekdayNightHours: hours.values.weekdayNightHours?.toString() ?? '0',
    sundayHours: hours.values.sundayHours?.toString() ?? '0',
    dailyOvertimeHours: hours.values.dailyOvertimeHours?.toString() ?? '0',
    isEcommerce: retailBusinessScope?.value === 'ECOMMERCE',
  }
  try {
    const bundle = getRetailModeRuleBundle(periodStart(input.period))
    const result = runRule(input, scenario, bundle)
    const baseAmount = moneyResult(result, 'base_monthly_gross')
    const premiumAmount = moneyResult(result, 'selected_premium_gross')
    const grossAmount = moneyResult(result, 'gross_pay')
    const hourlyBaseRate = moneyResult(result, 'hourly_base_rate')
    if (result.status !== 'CALCULATED' || !baseAmount || !premiumAmount || !grossAmount || !hourlyBaseRate) {
      return blocked('RETAIL_MODE', 'CAO_RULE_RESULT_INCOMPLETE', 'UNSUPPORTED', sources)
    }
    const fullTimeMonthlyAmount = FixedDecimal.parse(hourlyBaseRate)
      .multiply(FixedDecimal.parse('164.67')).round(2, 'HALF_UP').toString(2)
    const periodBase = partialPeriodAmount(input, baseAmount)
    const periodPremium = partialPeriodAmount(input, premiumAmount)
    const periodGross = FixedDecimal.parse(periodBase).add(FixedDecimal.parse(periodPremium)).toString(2)
    const version = result.packageMetadata?.version ?? bundle.rulePackage.compositionId.split(':').at(-1) ?? 'UNKNOWN'
    return {
      status: 'CALCULATED',
      family: 'RETAIL_MODE',
      packageId: result.packageMetadata?.packageId,
      packageVersion: version,
      compositionId: result.rulePackageCompositionId,
      packageHash: result.packageMetadata?.packageHash,
      sourceHash: result.sourceHash,
      inputHash: result.inputHash,
      resultHash: result.resultHash,
      effectiveFrom: result.packageMetadata?.sourceMetadata.activeTableEffectiveFrom,
      effectiveTo: result.packageMetadata?.sourceMetadata.activeTableEffectiveTo,
      baseAmount: periodBase,
      premiumAmount: periodPremium,
      grossAmount: periodGross,
      fullTimeMonthlyAmount,
      hourlyBaseRate,
      actualWorkConsumed: hours.consumed,
      inputs: {
        scenarioCode,
        functionGroup,
        experienceRow,
        contractHoursPerWeek: String(input.schedule.contractHoursPerWeek),
        fullTimeHoursPerWeek: String(input.schedule.fullTimeHoursPerWeek),
        existingActualHourlyRate: scenario.existingActualHourlyRate,
        weekdayNightHours: scenario.weekdayNightHours,
        sundayHours: scenario.sundayHours,
        dailyOvertimeHours: scenario.dailyOvertimeHours,
        isEcommerce: scenario.isEcommerce,
      },
      trace: [
        {
          code: 'CAO_RETAIL_MODE_CLASSIFICATION',
          formula: 'Core function group + experience row select the supported Retail Non-Food Mode table row.',
          values: { family: 'RETAIL_MODE', scenarioCode, functionGroup, experienceRow },
          sourceReference: sources[0]!.url,
        },
        ...(retailBusinessScope ? [{
          code: 'CAO_RETAIL_BUSINESS_SCOPE',
          formula: 'Versioned employer activity scope determines whether the e-commerce night-hour restriction applies.',
          values: {
            businessModel: retailBusinessScope.value,
            sourceClassification: retailBusinessScope.sourceClassification,
            sourceVersion: retailBusinessScope.sourceVersion,
          },
          sourceReference: retailBusinessScope.sourceReference,
        }] : []),
        {
          code: 'CAO_RETAIL_MODE_BASE_SALARY',
          formula: 'Effective hourly CAO rate × 164.67 monthly conversion hours × contract hours ÷ 38 full-time hours.',
          values: { hourlyBaseRate, baseMonthlyGross: periodBase },
          sourceReference: sources[1]!.url,
        },
        {
          code: 'CAO_RETAIL_MODE_PREMIUM',
          formula: 'Most favorable applicable premium; overlapping hours are paid once.',
          values: { weekdayNightHours: scenario.weekdayNightHours, sundayHours: scenario.sundayHours, dailyOvertimeHours: scenario.dailyOvertimeHours, premium: periodPremium },
          sourceReference: sources[1]!.url,
        },
        {
          code: 'CAO_RETAIL_MODE_GROSS_RESULT',
          formula: 'Period base salary + selected premium; holiday allowance is not part of this supported rule slice.',
          values: { grossAmount: periodGross },
          sourceReference: sources[1]!.url,
        },
      ],
      componentTrace: result.trace.filter((step) => step.componentCode === 'RETAIL_MODE_GROSS'),
      sourceReferences: sources,
    }
  } catch (error) {
    const errorCode = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code : null
    const reasonCode = errorCode === 'RETAIL_MODE_FULL_TIME_UNSUPPORTED' || (error instanceof Error && error.message.includes('FULL_TIME_UNSUPPORTED'))
      ? 'CAO_RETAIL_FULL_TIME_HOURS_UNSUPPORTED'
      : errorCode === 'RETAIL_MODE_ECOMMERCE_NIGHT_BAND_UNSUPPORTED' || (error instanceof Error && error.message.includes('ECOMMERCE_NIGHT_BAND_UNSUPPORTED'))
        ? 'CAO_RETAIL_ECOMMERCE_NIGHT_BAND_UNSUPPORTED'
        : `CAO_RETAIL_RULE_EXECUTION_FAILED${errorCode ? `_${errorCode}` : ''}${error instanceof Error && errorCode === null ? `_${error.message.replace(/[^A-Z0-9_]+/gi, '_').slice(0, 80)}` : ''}`
    return blocked('RETAIL_MODE', reasonCode, 'UNSUPPORTED', sources)
  }
}

export function calculateCaoPayroll(input: CaoPayrollIntegrationInput): CaoPayrollCalculation {
  const family = caoFamily(input)
  if (!family) return { status: 'NOT_APPLICABLE' }
  return family === 'KINDEROPVANG' ? calculateKinderopvang(input) : calculateRetailMode(input)
}
