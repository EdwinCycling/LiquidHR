import {
  FixedDecimal,
  PayrollEngineError,
  sha256,
  stableSerialize,
} from '@liquid-hr/payroll-engine'
import type {
  PayrollComponentDefinition,
  PayrollComponentInputDefinition,
  PayrollComponentOutputDefinition,
  PayrollControlDefinition,
  PayrollDependencyDefinition,
  PayrollExpression,
  PayrollRegisteredRule,
  PayrollResultMapping,
  PayrollRulePackage,
  PayrollSerializedValue,
  PayrollTypedParameter,
} from '@liquid-hr/payroll-engine'

const PACKAGE_ID = 'CAO-RETAIL-NON-FOOD-2026'
const RULE_KEY = 'retail-non-food.2026.gross-mode-r1-r2'
const RULE_CODE = 'RETAIL_MODE_GROSS'
const RULE_IMPLEMENTATION_HASH = '132e93165963ef3f29fbac7f746e8df2d4fab737e401cc17ec9823a307dd5a30'
const JANUARY_SOURCE_URL = 'https://www.inretail.nl/wp-content/uploads/2026/02/260121-Cao-Retail-Non-Food-januari-2026-def.pdf'
const JULY_SOURCE_URL = 'https://www.inretail.nl/wp-content/uploads/2026/05/260527-Cao-Retail-Non-Food-juli-2026-def.pdf'
const MONTHLY_CONVERSION_HOURS = '164.67'
const STANDARD_WEEK_HOURS = '38'

interface RetailModeTableSet {
  readonly arrangementVersion: string
  readonly packageVersion: string
  readonly effectiveFrom: string
  readonly effectiveTo: string
  readonly sourceUrl: string
  readonly tableCRow1: string
  readonly tableIRow15: string
}

const TABLE_VERSIONS: readonly RetailModeTableSet[] = Object.freeze([
  Object.freeze({
    arrangementVersion: 'retail-non-food/2026.01',
    packageVersion: '2026.1',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-06-30',
    sourceUrl: JANUARY_SOURCE_URL,
    tableCRow1: '15.15',
    tableIRow15: '28.41',
  }),
  Object.freeze({
    arrangementVersion: 'retail-non-food/2026.07',
    packageVersion: '2026.7',
    effectiveFrom: '2026-07-01',
    effectiveTo: '2026-12-31',
    sourceUrl: JULY_SOURCE_URL,
    tableCRow1: '15.44',
    tableIRow15: '28.95',
  }),
])

interface SourceField {
  readonly name: string
  readonly valueType: PayrollSerializedValue['valueType']
}

const SOURCE_FIELDS: readonly SourceField[] = Object.freeze([
  { name: 'scenarioCode', valueType: 'STRING' },
  { name: 'functionGroup', valueType: 'STRING' },
  { name: 'experienceRow', valueType: 'DECIMAL' },
  { name: 'contractHoursPerWeek', valueType: 'DECIMAL' },
  { name: 'fullTimeHoursPerWeek', valueType: 'DECIMAL' },
  { name: 'existingActualHourlyRate', valueType: 'MONEY' },
  { name: 'weekdayNightHours', valueType: 'DECIMAL' },
  { name: 'sundayHours', valueType: 'DECIMAL' },
  { name: 'dailyOvertimeHours', valueType: 'DECIMAL' },
  { name: 'isEcommerce', valueType: 'BOOLEAN' },
])

const RULE_INPUTS: readonly PayrollComponentInputDefinition[] = Object.freeze(
  SOURCE_FIELDS.map(({ name, valueType }) => ({ name, valueType, required: true })),
)

const RULE_OUTPUTS: readonly PayrollComponentOutputDefinition[] = Object.freeze([
  { name: 'hourlyBaseRate', valueType: 'MONEY' },
  { name: 'baseMonthlyGross', valueType: 'MONEY' },
  { name: 'selectedPremiumGross', valueType: 'MONEY' },
  { name: 'grossPay', valueType: 'MONEY' },
])

interface RetailScenario {
  readonly scenarioCode: string
  readonly functionGroup: string
  readonly experienceRow: FixedDecimal
  readonly contractHoursPerWeek: FixedDecimal
  readonly fullTimeHoursPerWeek: FixedDecimal
  readonly existingActualHourlyRate: FixedDecimal
  readonly weekdayNightHours: FixedDecimal
  readonly sundayHours: FixedDecimal
  readonly dailyOvertimeHours: FixedDecimal
  readonly isEcommerce: boolean
}

interface RuleParameterValues {
  readonly effectiveFrom: string
  readonly effectiveTo: string
  readonly tableCRow1: FixedDecimal
  readonly tableIRow15: FixedDecimal
  readonly monthlyConversionHours: FixedDecimal
  readonly standardWeekHours: FixedDecimal
  readonly actualWageIndexation: FixedDecimal
  readonly stepFreeze2026: boolean
}

function invalidInput(message: string): never {
  throw new PayrollEngineError('RETAIL_MODE_INPUT_INVALID', message)
}

function parseIsoDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PayrollEngineError('RETAIL_MODE_DATE_INVALID', 'The effective date must use YYYY-MM-DD format.')
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new PayrollEngineError('RETAIL_MODE_DATE_INVALID', 'The effective date must be a real calendar date.')
  }
  return value
}

function tableSetForDate(asOfDate: string): RetailModeTableSet {
  const date = parseIsoDate(asOfDate)
  if (date < TABLE_VERSIONS[0]!.effectiveFrom || date > TABLE_VERSIONS[1]!.effectiveTo) {
    throw new PayrollEngineError('RETAIL_MODE_DATE_UNSUPPORTED', 'Retail Mode supports pinned January and July 2026 tables only.')
  }
  return date < TABLE_VERSIONS[1]!.effectiveFrom ? TABLE_VERSIONS[0]! : TABLE_VERSIONS[1]!
}

function sourceComponent(
  tableSet: RetailModeTableSet,
  field: SourceField,
): PayrollComponentDefinition {
  const suffix = field.name.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()
  return {
    id: `system:retail-mode-2026:${field.name}`,
    code: `RETAIL_MODE_SOURCE${suffix}`,
    version: tableSet.packageVersion,
    effectiveFrom: tableSet.effectiveFrom,
    effectiveTo: tableSet.effectiveTo,
    ownership: { kind: 'SYSTEM' },
    processingScope: 'EMPLOYMENT',
    inputs: [],
    outputs: [{ name: 'value', valueType: field.valueType }],
    dependencies: [],
    method: { kind: 'source', path: ['scenario', field.name] },
    tracePolicy: 'FULL',
  }
}

function ruleParameters(tableSet: RetailModeTableSet): Readonly<Record<string, PayrollTypedParameter>> {
  return Object.freeze({
    effectiveFrom: { valueType: 'STRING', value: tableSet.effectiveFrom },
    effectiveTo: { valueType: 'STRING', value: tableSet.effectiveTo },
    tableCRow1: { valueType: 'MONEY', value: tableSet.tableCRow1 },
    tableIRow15: { valueType: 'MONEY', value: tableSet.tableIRow15 },
    monthlyConversionHours: { valueType: 'DECIMAL', value: MONTHLY_CONVERSION_HOURS },
    standardWeekHours: { valueType: 'DECIMAL', value: STANDARD_WEEK_HOURS },
    actualWageIndexation: { valueType: 'PERCENTAGE', value: '0.019' },
    stepFreeze2026: { valueType: 'BOOLEAN', value: true },
  })
}

function parameterString(
  parameters: Readonly<Record<string, PayrollTypedParameter>>,
  name: string,
): string {
  const parameter = parameters[name]
  if (!parameter || parameter.valueType !== 'STRING' || typeof parameter.value !== 'string') {
    throw new PayrollEngineError('RETAIL_MODE_PARAMETERS_INVALID', `Registered rule parameter ${name} is missing or has the wrong type.`)
  }
  return parameter.value
}

function parameterDecimal(
  parameters: Readonly<Record<string, PayrollTypedParameter>>,
  name: string,
  valueType: 'DECIMAL' | 'MONEY' | 'PERCENTAGE',
): FixedDecimal {
  const parameter = parameters[name]
  if (!parameter || parameter.valueType !== valueType || typeof parameter.value !== 'string') {
    throw new PayrollEngineError('RETAIL_MODE_PARAMETERS_INVALID', `Registered rule parameter ${name} is missing or has the wrong type.`)
  }
  return FixedDecimal.parse(parameter.value)
}

function parameterBoolean(
  parameters: Readonly<Record<string, PayrollTypedParameter>>,
  name: string,
): boolean {
  const parameter = parameters[name]
  if (!parameter || parameter.valueType !== 'BOOLEAN' || typeof parameter.value !== 'boolean') {
    throw new PayrollEngineError('RETAIL_MODE_PARAMETERS_INVALID', `Registered rule parameter ${name} is missing or has the wrong type.`)
  }
  return parameter.value
}

function serializedString(inputs: Readonly<Record<string, PayrollSerializedValue>>, name: string): string {
  const input = inputs[name]
  if (!input || input.valueType !== 'STRING' || typeof input.value !== 'string') invalidInput(`${name} must be a string.`)
  return input.value
}

function serializedBoolean(inputs: Readonly<Record<string, PayrollSerializedValue>>, name: string): boolean {
  const input = inputs[name]
  if (!input || input.valueType !== 'BOOLEAN' || typeof input.value !== 'boolean') invalidInput(`${name} must be a boolean.`)
  return input.value
}

function serializedDecimal(
  inputs: Readonly<Record<string, PayrollSerializedValue>>,
  name: string,
  valueType: 'DECIMAL' | 'MONEY',
): FixedDecimal {
  const input = inputs[name]
  if (!input || input.valueType !== valueType || typeof input.value !== 'string') invalidInput(`${name} must be a ${valueType.toLowerCase()}.`)
  return FixedDecimal.parse(input.value)
}

function readScenario(inputs: Readonly<Record<string, PayrollSerializedValue>>): RetailScenario {
  const scenario: RetailScenario = {
    scenarioCode: serializedString(inputs, 'scenarioCode'),
    functionGroup: serializedString(inputs, 'functionGroup'),
    experienceRow: serializedDecimal(inputs, 'experienceRow', 'DECIMAL'),
    contractHoursPerWeek: serializedDecimal(inputs, 'contractHoursPerWeek', 'DECIMAL'),
    fullTimeHoursPerWeek: serializedDecimal(inputs, 'fullTimeHoursPerWeek', 'DECIMAL'),
    existingActualHourlyRate: serializedDecimal(inputs, 'existingActualHourlyRate', 'MONEY'),
    weekdayNightHours: serializedDecimal(inputs, 'weekdayNightHours', 'DECIMAL'),
    sundayHours: serializedDecimal(inputs, 'sundayHours', 'DECIMAL'),
    dailyOvertimeHours: serializedDecimal(inputs, 'dailyOvertimeHours', 'DECIMAL'),
    isEcommerce: serializedBoolean(inputs, 'isEcommerce'),
  }

  const zero = FixedDecimal.parse('0')
  for (const [name, amount] of [
    ['contractHoursPerWeek', scenario.contractHoursPerWeek],
    ['existingActualHourlyRate', scenario.existingActualHourlyRate],
    ['weekdayNightHours', scenario.weekdayNightHours],
    ['sundayHours', scenario.sundayHours],
    ['dailyOvertimeHours', scenario.dailyOvertimeHours],
  ] as const) {
    if (amount.compare(zero) < 0) invalidInput(`${name} cannot be negative.`)
  }
  if (scenario.fullTimeHoursPerWeek.compare(FixedDecimal.parse(STANDARD_WEEK_HOURS)) !== 0) {
    throw new PayrollEngineError('RETAIL_MODE_FULL_TIME_UNSUPPORTED', 'This pinned non-Wonen table supports a 38-hour full-time week only.')
  }
  if (scenario.contractHoursPerWeek.compare(scenario.fullTimeHoursPerWeek) > 0) {
    invalidInput('Contract hours cannot exceed the stated full-time hours.')
  }
  if (scenario.experienceRow.toBigIntExact() < BigInt(0)) invalidInput('experienceRow cannot be negative.')
  return scenario
}

function readRuleParameters(parameters: Readonly<Record<string, PayrollTypedParameter>>): RuleParameterValues {
  const values = {
    effectiveFrom: parameterString(parameters, 'effectiveFrom'),
    effectiveTo: parameterString(parameters, 'effectiveTo'),
    tableCRow1: parameterDecimal(parameters, 'tableCRow1', 'MONEY'),
    tableIRow15: parameterDecimal(parameters, 'tableIRow15', 'MONEY'),
    monthlyConversionHours: parameterDecimal(parameters, 'monthlyConversionHours', 'DECIMAL'),
    standardWeekHours: parameterDecimal(parameters, 'standardWeekHours', 'DECIMAL'),
    actualWageIndexation: parameterDecimal(parameters, 'actualWageIndexation', 'PERCENTAGE'),
    stepFreeze2026: parameterBoolean(parameters, 'stepFreeze2026'),
  }
  if (values.standardWeekHours.compare(FixedDecimal.parse(STANDARD_WEEK_HOURS)) !== 0) {
    throw new PayrollEngineError('RETAIL_MODE_PARAMETERS_INVALID', 'The standard week must remain pinned at 38 hours in this table slice.')
  }
  return values
}

function isRow(scenario: RetailScenario, functionGroup: string, row: string): boolean {
  return scenario.functionGroup === functionGroup && scenario.experienceRow.compare(FixedDecimal.parse(row)) === 0
}

function chooseHourlyBase(
  scenario: RetailScenario,
  parameters: RuleParameterValues,
  trace: { code: string; values: Readonly<Record<string, PayrollSerializedValue>>; sourceReference: string }[],
): FixedDecimal {
  if (!parameters.stepFreeze2026) {
    throw new PayrollEngineError('RETAIL_MODE_PARAMETERS_INVALID', 'The 2026 step-freeze assumption must be pinned for this bundle.')
  }

  if (scenario.scenarioCode === 'R1') {
    if (!isRow(scenario, 'I', '15')) {
      throw new PayrollEngineError('RETAIL_MODE_ROW_UNSUPPORTED', 'R1 supports only function group I, experience row 15.')
    }
    if (scenario.existingActualHourlyRate.compare(FixedDecimal.parse('0')) <= 0) {
      invalidInput('R1 requires a positive existing actual hourly rate.')
    }
    if (
      scenario.weekdayNightHours.compare(FixedDecimal.parse('0')) !== 0 ||
      scenario.sundayHours.compare(FixedDecimal.parse('0')) !== 0 ||
      scenario.dailyOvertimeHours.compare(FixedDecimal.parse('0')) !== 0
    ) {
      invalidInput('R1 does not include premium hours.')
    }

    if (parameters.effectiveFrom === '2026-01-01') {
      trace.push({
        code: 'RETAIL_R1_JANUARY_ACTUAL_RATE',
        values: { hourlyRate: { valueType: 'MONEY', value: scenario.existingActualHourlyRate.toString(2) } },
        sourceReference: 'CAO Retail Non-Food 2026, Bijlage 1a (transition rules) and Bijlage 1b, January 2026 table, p. 30',
      })
      return scenario.existingActualHourlyRate.round(2, 'HALF_UP')
    }

    const indexedRateBeforeRounding = scenario.existingActualHourlyRate
      .multiply(FixedDecimal.parse('1').add(parameters.actualWageIndexation))
    const indexedRate = indexedRateBeforeRounding.round(2, 'HALF_UP')
    const cappedRate = indexedRate.compare(parameters.tableIRow15) > 0 ? parameters.tableIRow15 : indexedRate
    trace.push({
      code: 'RETAIL_R1_JULY_ACTUAL_RATE_INDEXATION_CAP',
      values: {
        previousHourlyRate: { valueType: 'MONEY', value: scenario.existingActualHourlyRate.toString(2) },
        indexationRate: { valueType: 'PERCENTAGE', value: parameters.actualWageIndexation.toString() },
        indexedHourlyRateBeforeRounding: { valueType: 'MONEY', value: indexedRateBeforeRounding.toString() },
        indexedHourlyRateBeforeCap: { valueType: 'MONEY', value: indexedRate.toString(2) },
        tableMaximumHourlyRate: { valueType: 'MONEY', value: parameters.tableIRow15.toString(2) },
        hourlyRateAfterCap: { valueType: 'MONEY', value: cappedRate.toString(2) },
      },
      sourceReference: 'CAO Retail Non-Food 2026, Bijlage 1a (transition rules) and Bijlage 1b, July 2026 table, p. 30',
    })
    return cappedRate
  }

  if (scenario.scenarioCode === 'R2') {
    if (!isRow(scenario, 'C', '1')) {
      throw new PayrollEngineError('RETAIL_MODE_ROW_UNSUPPORTED', 'R2 supports only function group C, experience row 1.')
    }
    if (scenario.existingActualHourlyRate.compare(FixedDecimal.parse('0')) !== 0) {
      invalidInput('R2 uses the pinned CAO table rate and requires a zero actual-rate placeholder.')
    }
    const selectedRate = parameters.tableCRow1
    trace.push({
      code: 'RETAIL_R2_PINNED_TABLE_RATE',
      values: {
        functionGroup: { valueType: 'STRING', value: scenario.functionGroup },
        experienceRow: { valueType: 'DECIMAL', value: scenario.experienceRow.toString() },
        hourlyRate: { valueType: 'MONEY', value: selectedRate.toString(2) },
      },
      sourceReference: `CAO Retail Non-Food 2026, Bijlage 1b, ${parameters.effectiveFrom === '2026-01-01' ? 'January' : 'July'} 2026 main loontabel, p. 30`,
    })
    return selectedRate
  }

  throw new PayrollEngineError('RETAIL_MODE_SCENARIO_UNSUPPORTED', 'Only the explicitly pinned R1 and R2 synthetic scenarios are supported.')
}

function calculatePremiumGross(
  scenario: RetailScenario,
  hourlyBaseRate: FixedDecimal,
  trace: { code: string; values: Readonly<Record<string, PayrollSerializedValue>>; sourceReference: string }[],
): FixedDecimal {
  const zero = FixedDecimal.parse('0')
  if (scenario.isEcommerce && scenario.weekdayNightHours.compare(zero) > 0) {
    throw new PayrollEngineError('RETAIL_MODE_ECOMMERCE_NIGHT_BAND_UNSUPPORTED', 'E-commerce night hours need a separate 00:00–07:00 versus 22:00–24:00 breakdown.')
  }

  if (scenario.scenarioCode === 'R1') return zero

  // CAO Article 7.1 selects the most favorable concurrent rate. Daily overtime
  // hours overlap the night/Sunday hours first; each overlapping hour is paid
  // once at 50%, and any remaining daily overtime hour receives 25%.
  const nightAndSundayHours = scenario.weekdayNightHours.add(scenario.sundayHours)
  const overlapHours = scenario.dailyOvertimeHours.compare(nightAndSundayHours) < 0
    ? scenario.dailyOvertimeHours
    : nightAndSundayHours
  const dailyOvertimeOnlyHours = scenario.dailyOvertimeHours.subtract(overlapHours)
  const fiftyPercentPremiumEquivalentHours = nightAndSundayHours
    .multiply(FixedDecimal.parse('0.50'))
    .add(dailyOvertimeOnlyHours.multiply(FixedDecimal.parse('0.25')))
  const amount = hourlyBaseRate
    .multiply(fiftyPercentPremiumEquivalentHours)
    .round(2, 'HALF_UP')

  trace.push({
    code: 'RETAIL_R2_BEST_OF_PREMIUMS_NO_DOUBLE_PAY',
    values: {
      weekdayNightHours: { valueType: 'DECIMAL', value: scenario.weekdayNightHours.toString() },
      sundayHours: { valueType: 'DECIMAL', value: scenario.sundayHours.toString() },
      dailyOvertimeHours: { valueType: 'DECIMAL', value: scenario.dailyOvertimeHours.toString() },
      dailyOvertimeOverlapHours: { valueType: 'DECIMAL', value: overlapHours.toString() },
      dailyOvertimeOnlyHours: { valueType: 'DECIMAL', value: dailyOvertimeOnlyHours.toString() },
      selectedPremiumGross: { valueType: 'MONEY', value: amount.toString(2) },
    },
    sourceReference: 'CAO Retail Non-Food 2026, Article 7.1–7.4, pp. 13–14: the most favorable concurrent premium applies; weekday night and Sunday are 50%, daily overtime is 25%',
  })
  return amount
}

function executeRetailModeRule(
  context: Parameters<PayrollRegisteredRule['execute']>[0],
): ReturnType<PayrollRegisteredRule['execute']> {
  const scenario = readScenario(context.inputs)
  const parameters = readRuleParameters(context.parameters)
  const trace: { code: string; values: Readonly<Record<string, PayrollSerializedValue>>; sourceReference: string }[] = []
  const hourlyBaseRate = chooseHourlyBase(scenario, parameters, trace)
  const baseMonthlyGross = hourlyBaseRate
    .multiply(parameters.monthlyConversionHours)
    .multiply(scenario.contractHoursPerWeek)
    .divideToScale(scenario.fullTimeHoursPerWeek, 2, 'ARITHMETIC')
  const selectedPremiumGross = calculatePremiumGross(scenario, hourlyBaseRate, trace)
  const grossPay = baseMonthlyGross.add(selectedPremiumGross).round(2, 'HALF_UP')

  trace.push({
    code: 'RETAIL_MONTHLY_GROSS_CONVERSION',
    values: {
      monthlyConversionHours: { valueType: 'DECIMAL', value: parameters.monthlyConversionHours.toString() },
      contractHoursPerWeek: { valueType: 'DECIMAL', value: scenario.contractHoursPerWeek.toString() },
      fullTimeHoursPerWeek: { valueType: 'DECIMAL', value: scenario.fullTimeHoursPerWeek.toString() },
      baseMonthlyGross: { valueType: 'MONEY', value: baseMonthlyGross.toString(2) },
      selectedPremiumGross: { valueType: 'MONEY', value: selectedPremiumGross.toString(2) },
      grossPay: { valueType: 'MONEY', value: grossPay.toString(2) },
    },
    sourceReference: 'CAO Retail Non-Food 2026, Article 6.2; monthly conversion is pinned at 164.67 hours for the 38-hour standard week',
  })

  return {
    outputs: {
      hourlyBaseRate: { valueType: 'MONEY', value: hourlyBaseRate.toString(2) },
      baseMonthlyGross: { valueType: 'MONEY', value: baseMonthlyGross.toString(2) },
      selectedPremiumGross: { valueType: 'MONEY', value: selectedPremiumGross.toString(2) },
      grossPay: { valueType: 'MONEY', value: grossPay.toString(2) },
    },
    trace,
  }
}

function resultMappings(): readonly PayrollResultMapping[] {
  return Object.freeze([
    { key: 'hourly_base_rate', componentCode: RULE_CODE, outputName: 'hourlyBaseRate' },
    { key: 'base_monthly_gross', componentCode: RULE_CODE, outputName: 'baseMonthlyGross' },
    { key: 'selected_premium_gross', componentCode: RULE_CODE, outputName: 'selectedPremiumGross' },
    { key: 'gross_pay', componentCode: RULE_CODE, outputName: 'grossPay' },
  ])
}

function ruleControls(): readonly PayrollControlDefinition[] {
  const grossOutput: PayrollExpression = { kind: 'output', componentCode: RULE_CODE, outputName: 'grossPay' }
  return Object.freeze([{
    code: 'RETAIL-MODE-CTRL-NONNEGATIVE-GROSS',
    severity: 'BLOCKING',
    expression: {
      kind: 'binary',
      operator: '>=',
      left: grossOutput,
      right: { kind: 'literal', valueType: 'MONEY', value: '0.00' },
    },
  }])
}

function ruleDependencies(): readonly PayrollDependencyDefinition[] {
  return Object.freeze(SOURCE_FIELDS.map(({ name }) => ({
    componentCode: `RETAIL_MODE_SOURCE${name.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`,
    outputName: 'value',
    inputName: name,
  })))
}

function createBundle(tableSet: RetailModeTableSet) {
  const parameters = ruleParameters(tableSet)
  const parameterSetHash = sha256(stableSerialize(parameters))
  const ruleImplementationHash = RULE_IMPLEMENTATION_HASH
  const sourceComponents = SOURCE_FIELDS.map((field) => sourceComponent(tableSet, field))
  const ruleComponent: PayrollComponentDefinition = {
    id: 'system:retail-mode-2026:gross',
    code: RULE_CODE,
    version: tableSet.packageVersion,
    effectiveFrom: tableSet.effectiveFrom,
    effectiveTo: tableSet.effectiveTo,
    ownership: { kind: 'SYSTEM' },
    processingScope: 'EMPLOYMENT',
    inputs: RULE_INPUTS,
    outputs: RULE_OUTPUTS,
    dependencies: ruleDependencies(),
    parameters,
    method: {
      kind: 'registeredRule',
      ruleKey: RULE_KEY,
      ruleVersion: tableSet.packageVersion,
      implementationHash: ruleImplementationHash,
      parameterSetHash,
    },
    tracePolicy: 'FULL',
  }
  const components = Object.freeze([...sourceComponents, ruleComponent])
  const controls = ruleControls()
  const mappings = resultMappings()
  const sourceMetadata = Object.freeze({
    january2026OfficialCaoPdf: JANUARY_SOURCE_URL,
    july2026OfficialCaoPdf: JULY_SOURCE_URL,
    activeTableSource: tableSet.sourceUrl,
    activeTableEffectiveFrom: tableSet.effectiveFrom,
    activeTableEffectiveTo: tableSet.effectiveTo,
    activeTableScope: 'Appendix 1b main table: function groups A/B through I, adult scale; only group C row 1 and group I row 15 are enabled in this slice',
    pinnedHourlyRows: `C/1=${tableSet.tableCRow1}; I/15=${tableSet.tableIRow15}`,
    transitionRule: 'R1 actual hourly rate receives 1.9% from 2026-07-01, capped at pinned group I row 15; no projection after 2026-12-31',
    monthlyConversionHours: MONTHLY_CONVERSION_HOURS,
    stepProgression: '2026 step freeze assumed; no historical wage or review reconstruction',
    grossScopeNotice: 'Only adult Mode table rows C/1 (R2) and I/15 (R1) are implemented. Gross pay excludes the 8% vacation allowance (vakantietoeslag) and public-holiday premiums. Other table rows, WML/under-21 paths, general wage history and review, payroll tax, net pay, pension, and other deductions, e-commerce night hours without a band split, and non-38-hour full-time arrangements are unsupported.',
    unsupported: '8% vacation allowance (vakantietoeslag) excluded from gross pay; WML/under-21 paths; general wage history and review; public-holiday premiums; payroll tax, net pay, pension, and other deductions; e-commerce night hours without a band split; non-38-hour full-time arrangements; all table rows except adult Mode C/1 and I/15',
  })
  const packageHashPayload = {
    packageId: PACKAGE_ID,
    packageVersion: tableSet.packageVersion,
    arrangementVersion: tableSet.arrangementVersion,
    effectiveFrom: tableSet.effectiveFrom,
    effectiveTo: tableSet.effectiveTo,
    implementationHash: ruleImplementationHash,
    parameters,
    sourceMetadata,
    components,
    controls,
    resultMappings: mappings,
  }
  const packageHash = sha256(stableSerialize(packageHashPayload))
  const rulePackage: PayrollRulePackage = Object.freeze({
    compositionId: `${PACKAGE_ID}:${tableSet.packageVersion}`,
    metadata: Object.freeze({
      packageId: PACKAGE_ID,
      version: tableSet.packageVersion,
      packageHash,
      parameterSetHash,
      sourceMetadata,
    }),
    components,
    controls,
    resultMappings: mappings,
  })
  const registry: readonly PayrollRegisteredRule[] = Object.freeze([Object.freeze({
    ruleKey: RULE_KEY,
    ruleVersion: tableSet.packageVersion,
    implementationHash: ruleImplementationHash,
    parameterSetHash,
    packageId: PACKAGE_ID,
    packageVersion: tableSet.packageVersion,
    allowedComponents: Object.freeze([Object.freeze({
      id: ruleComponent.id,
      code: ruleComponent.code,
      version: ruleComponent.version,
    })]),
    inputs: RULE_INPUTS,
    outputs: RULE_OUTPUTS,
    execute: executeRetailModeRule,
  })])
  return Object.freeze({ rulePackage, registry, arrangementVersion: tableSet.arrangementVersion })
}

/** Returns a trusted, effective-dated gross-only bundle for the pinned 2026 CAO tables. */
export function getRetailModeRuleBundle(asOfDate: string): {
  readonly rulePackage: PayrollRulePackage
  readonly registry: readonly PayrollRegisteredRule[]
  readonly arrangementVersion: string
} {
  return createBundle(tableSetForDate(asOfDate))
}
