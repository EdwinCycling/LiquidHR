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
  PayrollRegisteredRule,
  PayrollRegisteredRuleTraceStep,
  PayrollResultMapping,
  PayrollRulePackage,
  PayrollSerializedValue,
  PayrollTypedParameter,
  PayrollValueType,
} from '@liquid-hr/payroll-engine'

export const KINDEROPVANG_PACKAGE_ID = 'CAO-KINDEROPVANG-2025-2026'
export const KINDEROPVANG_RULE_KEY = 'kinderopvang.2026.monthly-gross-k1-k2'
export const KINDEROPVANG_EFFECTIVE_FROM = '2026-01-01'
export const KINDEROPVANG_EFFECTIVE_TO = '2026-12-31'
export const KINDEROPVANG_SEPTEMBER_BOUNDARY = '2026-09-01'
export const KINDEROPVANG_CALCULATION_SCALE = 18

const PACKAGE_REFERENCE_DATE = '2026-10-03'
const SCALE = '6'
const SALARY_NUMBER = '12'
const FULL_TIME_HOURS = FixedDecimal.parse('36')
const ANNUAL_HOURS = FixedDecimal.parse('1879.2')
const SUNDAY_PREMIUM_PERCENT = FixedDecimal.parse('45')
const TWELVE = FixedDecimal.parse('12')
const ONE_HUNDRED = FixedDecimal.parse('100')
const ZERO = FixedDecimal.parse('0')
const MAX_SUNDAY_HOURS_PER_PERIOD = FixedDecimal.parse('24')

const SOURCE_URLS = Object.freeze({
  caoTextTitle: 'Cao Kinderopvang 2025-2026, integrale cao-tekst (juni 2025)',
  caoTextUrl: 'https://www.kinderopvang-werkt.nl/sites/fcb_kinderopvang/files/2025-06/Cao-Kinderopvang-2025-2026-integraal.pdf',
  salaryAppendixTitle: 'Bijlage 2 Cao Kinderopvang 2025-2026 - Salarisschalen',
  salaryAppendixUrl: 'https://www.kinderopvang-werkt.nl/sites/fcb_kinderopvang/files/2025-04/Bijlage-2-Salarisschalen-Cao-Kinderopvang-2025-2026.pdf',
  salaryDeterminationTitle: 'Het salaris bepalen - Cao Kinderopvang',
  salaryDeterminationUrl: 'https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/het-salaris-bepalen',
  workHourSupplementTitle: 'Werkurentoeslag - Cao Kinderopvang',
  workHourSupplementUrl: 'https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/werkurentoeslag',
  interimDecisionsTitle: 'Tussentijdse cao-besluiten Cao Kinderopvang',
  interimDecisionsUrl: 'https://www.kinderopvang-werkt.nl/alles-over-de-cao-kinderopvang/tussentijdse-cao-besluiten',
})

/** Synthetic inputs consumed by the benchmark source snapshot, not employee records. */
export const KINDEROPVANG_K1_SYNTHETIC_INPUT = Object.freeze({
  salaryScale: SCALE,
  salaryNumber: SALARY_NUMBER,
  contractHoursPerWeek: '36',
  fullTimeHoursPerWeek: '36',
  sundayHoursInPeriod: '0',
})

/** Synthetic inputs consumed by the benchmark source snapshot, not employee records. */
export const KINDEROPVANG_K2_SYNTHETIC_INPUT = Object.freeze({
  salaryScale: SCALE,
  salaryNumber: SALARY_NUMBER,
  contractHoursPerWeek: '24',
  fullTimeHoursPerWeek: '36',
  sundayHoursInPeriod: '4',
})

interface EffectiveTableVersion {
  readonly rulePackageVersion: '2026.01' | '2026.09'
  readonly effectiveFrom: string
  readonly effectiveTo: string
  readonly monthlySalary: string
  readonly salaryTableReference: string
}

const JANUARY_TABLE: EffectiveTableVersion = Object.freeze({
  rulePackageVersion: '2026.01',
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-08-31',
  monthlySalary: '2777',
  salaryTableReference: 'Bijlage 2 §§2.2-2.3, scale 6 / salary number 12: €2,777 in §2.2; §2.3 says numbers 1-7 changed and remaining values unchanged (PDF pp.6-7, printed pp.6-7).',
})

const SEPTEMBER_TABLE: EffectiveTableVersion = Object.freeze({
  rulePackageVersion: '2026.09',
  effectiveFrom: KINDEROPVANG_SEPTEMBER_BOUNDARY,
  effectiveTo: '2026-12-31',
  monthlySalary: '2819',
  salaryTableReference: 'Bijlage 2 §2.4, scale 6 / salary number 12: €2,819 (PDF p.8, printed p.8).',
})

const sourceFields = [
  { field: 'salaryScale', code: 'KO_SCENARIO_SALARY_SCALE', valueType: 'STRING' },
  { field: 'salaryNumber', code: 'KO_SCENARIO_SALARY_NUMBER', valueType: 'DECIMAL' },
  { field: 'contractHoursPerWeek', code: 'KO_SCENARIO_CONTRACT_HOURS', valueType: 'DECIMAL' },
  { field: 'fullTimeHoursPerWeek', code: 'KO_SCENARIO_FULL_TIME_HOURS', valueType: 'DECIMAL' },
  { field: 'sundayHoursInPeriod', code: 'KO_SCENARIO_SUNDAY_HOURS_IN_PERIOD', valueType: 'DECIMAL' },
] as const satisfies readonly {
  readonly field: string
  readonly code: string
  readonly valueType: PayrollValueType
}[]

const ruleInputs: readonly PayrollComponentInputDefinition[] = Object.freeze([
  { name: 'salaryScale', valueType: 'STRING', required: true },
  { name: 'salaryNumber', valueType: 'DECIMAL', required: true },
  { name: 'contractHoursPerWeek', valueType: 'DECIMAL', required: true },
  { name: 'fullTimeHoursPerWeek', valueType: 'DECIMAL', required: true },
  { name: 'sundayHoursInPeriod', valueType: 'DECIMAL', required: true },
])

const ruleOutputs: readonly PayrollComponentOutputDefinition[] = Object.freeze([
  { name: 'fullTimeMonthlySalary', valueType: 'MONEY' },
  { name: 'baseSalary', valueType: 'MONEY' },
  { name: 'hourlySalary', valueType: 'DECIMAL' },
  { name: 'workHourSupplement', valueType: 'MONEY' },
  { name: 'grossEarnings', valueType: 'MONEY' },
])

function sourceComponent(
  code: string,
  outputName: string,
  valueType: PayrollValueType,
  field: string,
  version: EffectiveTableVersion,
): PayrollComponentDefinition {
  return {
    id: `system:kinderopvang-2026:${code.toLowerCase()}`,
    code,
    version: version.rulePackageVersion,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    ownership: { kind: 'SYSTEM' as const },
    processingScope: 'PAYROLL_PERIOD',
    inputs: [],
    outputs: [{ name: outputName, valueType }],
    dependencies: [],
    method: { kind: 'source', path: ['scenario', field] },
    tracePolicy: 'FULL',
  }
}

function createParameters(version: EffectiveTableVersion): Readonly<Record<string, PayrollTypedParameter>> {
  return Object.freeze({
    salaryScale: { valueType: 'STRING', value: SCALE },
    salaryNumber: { valueType: 'DECIMAL', value: SALARY_NUMBER },
    fullTimeMonthlySalary: { valueType: 'MONEY', value: version.monthlySalary },
    fullTimeHoursPerWeek: { valueType: 'DECIMAL', value: FULL_TIME_HOURS.toString() },
    annualHours: { valueType: 'DECIMAL', value: ANNUAL_HOURS.toString() },
    sundayPremiumPercent: { valueType: 'PERCENTAGE', value: SUNDAY_PREMIUM_PERCENT.toString() },
    calculationScale: { valueType: 'DECIMAL', value: String(KINDEROPVANG_CALCULATION_SCALE) },
    rulePackageVersion: { valueType: 'STRING', value: version.rulePackageVersion },
    salaryTableReference: { valueType: 'STRING', value: version.salaryTableReference },
  })
}

function typedInput(
  inputs: Readonly<Record<string, PayrollSerializedValue>>,
  name: string,
  valueType: 'STRING' | 'DECIMAL',
): string {
  const input = inputs[name]
  if (!input || input.valueType !== valueType || typeof input.value !== 'string') {
    throw new PayrollEngineError('KO_INPUT_INVALID', `Input ${name} must be a ${valueType} value.`)
  }
  return input.value
}

function decimalInput(inputs: Readonly<Record<string, PayrollSerializedValue>>, name: string): FixedDecimal {
  return FixedDecimal.parse(typedInput(inputs, name, 'DECIMAL'))
}

function decimalParameter(
  parameters: Readonly<Record<string, PayrollTypedParameter>>,
  name: string,
): FixedDecimal {
  const parameter = parameters[name]
  if (!parameter || !['MONEY', 'DECIMAL', 'PERCENTAGE'].includes(parameter.valueType) || typeof parameter.value !== 'string') {
    throw new PayrollEngineError('KO_PARAMETER_INVALID', `Parameter ${name} must be numeric.`)
  }
  return FixedDecimal.parse(parameter.value)
}

function stringParameter(
  parameters: Readonly<Record<string, PayrollTypedParameter>>,
  name: string,
): string {
  const parameter = parameters[name]
  if (!parameter || parameter.valueType !== 'STRING' || typeof parameter.value !== 'string') {
    throw new PayrollEngineError('KO_PARAMETER_INVALID', `Parameter ${name} must be a string.`)
  }
  return parameter.value
}

function moneyValue(value: FixedDecimal): PayrollSerializedValue {
  return { valueType: 'MONEY', value: value.toString(KINDEROPVANG_CALCULATION_SCALE) }
}

function decimalValue(value: FixedDecimal): PayrollSerializedValue {
  return { valueType: 'DECIMAL', value: value.toString(KINDEROPVANG_CALCULATION_SCALE) }
}

function percentageValue(value: FixedDecimal): PayrollSerializedValue {
  return { valueType: 'PERCENTAGE', value: value.toString() }
}

function textValue(value: string): PayrollSerializedValue {
  return { valueType: 'STRING', value }
}

function fail(code: string, message: string): never {
  throw new PayrollEngineError(code, message)
}

function calculateKinderopvangGross(context: {
  readonly inputs: Readonly<Record<string, PayrollSerializedValue>>
  readonly parameters: Readonly<Record<string, PayrollTypedParameter>>
}): {
  readonly outputs: Readonly<Record<string, PayrollSerializedValue>>
  readonly trace: readonly PayrollRegisteredRuleTraceStep[]
} {
  const { inputs, parameters } = context
  const salaryScale = typedInput(inputs, 'salaryScale', 'STRING')
  const salaryNumber = decimalInput(inputs, 'salaryNumber')
  const contractHours = decimalInput(inputs, 'contractHoursPerWeek')
  const suppliedFullTimeHours = decimalInput(inputs, 'fullTimeHoursPerWeek')
  const sundayHoursInPeriod = decimalInput(inputs, 'sundayHoursInPeriod')
  const expectedScale = stringParameter(parameters, 'salaryScale')
  const expectedNumber = decimalParameter(parameters, 'salaryNumber')
  const fullTimeMonthlySalary = decimalParameter(parameters, 'fullTimeMonthlySalary')
  const fullTimeHours = decimalParameter(parameters, 'fullTimeHoursPerWeek')
  const annualHours = decimalParameter(parameters, 'annualHours')
  const sundayPremiumPercent = decimalParameter(parameters, 'sundayPremiumPercent')
  const scale = decimalParameter(parameters, 'calculationScale')

  if (salaryScale !== expectedScale) {
    fail('KO_UNSUPPORTED_SCALE', `Only salary scale ${expectedScale} is included in this benchmark slice.`)
  }
  if (salaryNumber.compare(expectedNumber) !== 0) {
    fail('KO_UNSUPPORTED_SALARY_NUMBER', `Only salary number ${expectedNumber.toString()} is included in this benchmark slice.`)
  }
  if (scale.compare(FixedDecimal.parse(String(KINDEROPVANG_CALCULATION_SCALE))) !== 0) {
    fail('KO_CALCULATION_PRECISION_MISMATCH', 'The parameter set does not match the pinned calculation precision.')
  }
  if (fullTimeHours.compare(FULL_TIME_HOURS) !== 0 || suppliedFullTimeHours.compare(fullTimeHours) !== 0) {
    fail('KO_FULL_TIME_HOURS_UNSUPPORTED', 'The official salary table is based on 36 full-time hours per week.')
  }
  if (contractHours.compare(ZERO) <= 0 || contractHours.compare(fullTimeHours) > 0) {
    fail('KO_CONTRACT_HOURS_INVALID', 'Contract hours must be greater than zero and no more than 36 per week in this slice.')
  }
  if (sundayHoursInPeriod.compare(ZERO) < 0
    || sundayHoursInPeriod.compare(MAX_SUNDAY_HOURS_PER_PERIOD) > 0) {
    fail('KO_SUNDAY_HOURS_INVALID', 'Sunday premium hours must be between zero and 24 in the monthly payroll period for this synthetic slice.')
  }

  const version = stringParameter(parameters, 'rulePackageVersion')
  const salaryTableReference = stringParameter(parameters, 'salaryTableReference')
  const tableSource = `${SOURCE_URLS.salaryAppendixUrl} — ${salaryTableReference}`
  const partTimeSalaryNumerator = fullTimeMonthlySalary.multiply(contractHours)
  const baseSalary = partTimeSalaryNumerator.divideToScale(
    fullTimeHours,
    KINDEROPVANG_CALCULATION_SCALE,
    'TRUNCATE',
  )
  const fullTimeAnnualSalary = fullTimeMonthlySalary.multiply(TWELVE)
  const hourlySalary = fullTimeAnnualSalary.divideToScale(annualHours, KINDEROPVANG_CALCULATION_SCALE, 'TRUNCATE')
  const supplementDenominator = annualHours.multiply(ONE_HUNDRED)
  const supplementNumerator = fullTimeAnnualSalary.multiply(sundayHoursInPeriod).multiply(sundayPremiumPercent)
  const workHourSupplement = supplementNumerator.divideToScale(
    supplementDenominator,
    KINDEROPVANG_CALCULATION_SCALE,
    'TRUNCATE',
  )
  const grossEarnings = baseSalary.add(workHourSupplement)

  const trace: PayrollRegisteredRuleTraceStep[] = [
    {
      code: 'classification.accepted',
      values: {
        rulePackageVersion: textValue(version),
        salaryScale: textValue(salaryScale),
        salaryNumber: decimalValue(salaryNumber),
        contractHoursPerWeek: decimalValue(contractHours),
        fullTimeHoursPerWeek: decimalValue(suppliedFullTimeHours),
        sundayHoursInPeriod: decimalValue(sundayHoursInPeriod),
      },
      sourceReference: `${SOURCE_URLS.caoTextUrl} — art. 4.2(2), (7) and art. 5.1(1); benchmark inputs remain synthetic.`,
    },
    {
      code: 'salary.table-and-proration',
      values: {
        fullTimeMonthlySalary: moneyValue(fullTimeMonthlySalary),
        partTimeSalaryNumerator: moneyValue(partTimeSalaryNumerator),
        contractHoursPerWeek: decimalValue(contractHours),
        fullTimeHoursPerWeek: decimalValue(fullTimeHours),
        baseSalary: moneyValue(baseSalary),
      },
      sourceReference: `${tableSource}; CAO art. 4.2(7) states hour-dependent terms apply proportionally.`,
    },
    {
      code: 'supplement.sunday-work-hours',
      values: {
        fullTimeAnnualSalary: moneyValue(fullTimeAnnualSalary),
        annualHours: decimalValue(annualHours),
        hourlySalary: decimalValue(hourlySalary),
        sundayHoursInPeriod: decimalValue(sundayHoursInPeriod),
        sundayPremiumPercent: percentageValue(sundayPremiumPercent),
        workHourSupplement: moneyValue(workHourSupplement),
      },
      sourceReference: `${SOURCE_URLS.caoTextUrl} — art. 1.1(bb), art. 4.2(2), (4) (2026: 1,879.2 year-hours), and art. 6.2(1)-(3), Sunday rate table, hourly basis, salary-number-18 cap and exceptions. The fixture assumes art. 6.2(3) does not exclude this synthetic case; role eligibility and the exclusion conditions are not evaluated.`,
    },
    {
      code: 'result.gross-earnings',
      values: {
        baseSalary: moneyValue(baseSalary),
        workHourSupplement: moneyValue(workHourSupplement),
        grossEarnings: moneyValue(grossEarnings),
      },
      sourceReference: `Synthetic monthly gross earnings before tax/deductions; supplement is earned for the represented period. FixedDecimal divisions use TRUNCATE at ${KINDEROPVANG_CALCULATION_SCALE} places as engine precision only. The scoped CAO source does not prescribe monetary rounding, and no cent rounding, tax or net-pay calculation is applied.`,
    },
  ]

  return {
    outputs: {
      fullTimeMonthlySalary: moneyValue(fullTimeMonthlySalary),
      baseSalary: moneyValue(baseSalary),
      hourlySalary: decimalValue(hourlySalary),
      workHourSupplement: moneyValue(workHourSupplement),
      grossEarnings: moneyValue(grossEarnings),
    },
    trace,
  }
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function sourceMetadata(version: EffectiveTableVersion): Readonly<Record<string, string>> {
  return Object.freeze({
    publisher: 'Kinderopvang werkt! / Cao-partijen Kinderopvang',
    checkedAt: PACKAGE_REFERENCE_DATE,
    ...SOURCE_URLS,
    rulePackageVersion: version.rulePackageVersion,
    packageEffectiveFrom: version.effectiveFrom,
    packageEffectiveTo: version.effectiveTo,
    salaryScale: SCALE,
    salaryNumber: SALARY_NUMBER,
    fullTimeHoursPerWeek: FULL_TIME_HOURS.toString(),
    fullTimeAnnualHours2026: ANNUAL_HOURS.toString(),
    fullTimeMonthlySalary: version.monthlySalary,
    salaryTableReference: version.salaryTableReference,
    salaryIncreaseBoundary: KINDEROPVANG_SEPTEMBER_BOUNDARY,
    sundayPremiumReference: 'Cao art. 6.2 table, Sunday and public holiday 45% in both listed time windows',
    precisionPolicy: `FixedDecimal division truncated to ${KINDEROPVANG_CALCULATION_SCALE} decimal places for engine serialization only; CAO monetary rounding is unspecified and cent rounding is not applied.`,
    scope: 'Synthetic K1/K2 benchmark only: scale 6, salary number 12, one monthly base salary, and total Sunday premium hours in that monthly pay period.',
    unsupportedConditions: 'Other scales/numbers; function-to-scale assignment; CAO applicability; salary-number-18 cap for other salary numbers; art. 6.2(3) role/exclusion eligibility; more than 24 Sunday premium hours in one monthly payroll period; other shifts, allowances, holiday pay, year-end award, deductions, tax and net pay.',
    implementationSha256: KINDEROPVANG_IMPLEMENTATION_SHA256,
  })
}

function resultMappings(): readonly PayrollResultMapping[] {
  return Object.freeze([
    { key: 'base_salary', componentCode: 'KO_GROSS_PAY', outputName: 'baseSalary' },
    { key: 'work_hour_supplement', componentCode: 'KO_GROSS_PAY', outputName: 'workHourSupplement' },
    { key: 'gross_salary', componentCode: 'KO_GROSS_PAY', outputName: 'grossEarnings' },
  ])
}

function createRuleBundle(version: EffectiveTableVersion): {
  readonly rulePackage: PayrollRulePackage
  readonly registry: readonly PayrollRegisteredRule[]
  readonly rulePackageVersion: string
} {
  const parameters = createParameters(version)
  const parameterSetHash = sha256(stableSerialize(parameters))
  const commonSources = sourceFields.map(({ field, code, valueType }) => sourceComponent(
    code,
    field,
    valueType,
    field,
    version,
  ))
  const dependencies = sourceFields.map(({ field, code }) => ({
    componentCode: code,
    outputName: field,
    inputName: field,
  }))
  const component: PayrollComponentDefinition = Object.freeze({
    id: `system:kinderopvang-2026:ko-gross-pay-${version.rulePackageVersion}`,
    code: 'KO_GROSS_PAY',
    version: version.rulePackageVersion,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    ownership: { kind: 'SYSTEM' as const },
    processingScope: 'PAYROLL_PERIOD',
    inputs: ruleInputs,
    outputs: ruleOutputs,
    dependencies: Object.freeze(dependencies),
    parameters,
    method: {
      kind: 'registeredRule' as const,
      ruleKey: KINDEROPVANG_RULE_KEY,
      ruleVersion: version.rulePackageVersion,
      implementationHash: KINDEROPVANG_IMPLEMENTATION_SHA256,
      parameterSetHash,
    },
    tracePolicy: 'FULL',
  })
  const components = Object.freeze([...commonSources, component])
  const mappings = resultMappings()
  const provenance = sourceMetadata(version)
  const packageHash = sha256(stableSerialize({
    packageId: KINDEROPVANG_PACKAGE_ID,
    version: version.rulePackageVersion,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    implementationHash: KINDEROPVANG_IMPLEMENTATION_SHA256,
    parameters,
    sourceMetadata: provenance,
    components,
    controls: [],
    resultMappings: mappings,
  }))
  const metadata = Object.freeze({
    packageId: KINDEROPVANG_PACKAGE_ID,
    version: version.rulePackageVersion,
    packageHash,
    parameterSetHash,
    sourceMetadata: provenance,
  })
  const rulePackage: PayrollRulePackage = Object.freeze({
    compositionId: `${KINDEROPVANG_PACKAGE_ID}:${version.rulePackageVersion}`,
    metadata,
    components,
    controls: Object.freeze([]),
    resultMappings: mappings,
  })
  const registry: readonly PayrollRegisteredRule[] = Object.freeze([{
    ruleKey: KINDEROPVANG_RULE_KEY,
    ruleVersion: version.rulePackageVersion,
    implementationHash: KINDEROPVANG_IMPLEMENTATION_SHA256,
    parameterSetHash,
    packageId: KINDEROPVANG_PACKAGE_ID,
    packageVersion: version.rulePackageVersion,
    allowedComponents: Object.freeze([{ id: component.id, code: component.code, version: component.version }]),
    inputs: ruleInputs,
    outputs: ruleOutputs,
    execute: calculateKinderopvangGross,
  }])
  return Object.freeze({ rulePackage, registry, rulePackageVersion: version.rulePackageVersion })
}

/**
 * Builds the synthetic Kinderopvang K1/K2 rule slice for one effective date.
 * Supported dates are within 2026; 2026-09-01 selects the revised salary table.
 */
export function getKinderopvangRuleBundle(asOfDate: string): {
  readonly rulePackage: PayrollRulePackage
  readonly registry: readonly PayrollRegisteredRule[]
  readonly rulePackageVersion: string
} {
  if (!validIsoDate(asOfDate)) {
    throw new PayrollEngineError('KO_DATE_INVALID', 'asOfDate must be a valid ISO calendar date in YYYY-MM-DD form.')
  }
  if (asOfDate < KINDEROPVANG_EFFECTIVE_FROM || asOfDate > KINDEROPVANG_EFFECTIVE_TO) {
    throw new PayrollEngineError('KO_DATE_OUT_OF_SCOPE', 'This Kinderopvang salary-table slice supports dates from 2026-01-01 through 2026-12-31.')
  }
  return createRuleBundle(asOfDate < KINDEROPVANG_SEPTEMBER_BOUNDARY ? JANUARY_TABLE : SEPTEMBER_TABLE)
}

/** SHA-256 of this file as UTF-8/LF, with this value normalized in the test. */
export const KINDEROPVANG_IMPLEMENTATION_SHA256 = 'e1f78ad0f5f0f60e986584fa4d4d49ee26648d15539b235507355d31aa918767'
