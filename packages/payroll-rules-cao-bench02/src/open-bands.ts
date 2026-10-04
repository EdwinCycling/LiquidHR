import {
  sha256,
  stableSerialize,
} from '@liquid-hr/payroll-engine'
import type {
  PayrollComponentDefinition,
  PayrollComponentInputDefinition,
  PayrollComponentOutputDefinition,
  PayrollDependencyDefinition,
  PayrollRegisteredRule,
  PayrollRegisteredRuleTraceStep,
  PayrollResultMapping,
  PayrollRulePackage,
  PayrollRulePackageMetadata,
  PayrollSerializedValue,
  PayrollTypedParameter,
  PayrollValueType,
} from '@liquid-hr/payroll-engine'

const OPEN_BANDS_PACKAGE_ID = 'LHR_DEMO_OPEN_BANDS_2026'
const RULE_KEY = 'company.open-bands.gross-pay'
const RULE_IMPLEMENTATION_ID = 'cao-bench02-open-bands-gross-v1'
const OFFICIAL_OPEN_BANDS_SOURCE = 'https://zoek.officielebekendmakingen.nl/stcrt-2026-11183.html'
const SYNTHETIC_POLICY_REFERENCE = 'CAO-BENCH02 synthetic company policy, v1; not a collective agreement.'

type ArrangementVersion = '2026.01' | '2026.07'

interface RawBandBounds {
  readonly code: string
  readonly minimumCents: number
  readonly maximumCents: number
}

interface BandBounds {
  readonly code: string
  readonly minimumHourly: string
  readonly midpointHourly: string
  readonly maximumHourly: string
}

interface VersionedBandTable {
  readonly arrangementVersion: ArrangementVersion
  readonly effectiveFrom: string
  readonly effectiveTo: string
  readonly rawBands: readonly RawBandBounds[]
}

const VERSIONED_TABLES: Readonly<Record<ArrangementVersion, VersionedBandTable>> = Object.freeze({
  '2026.01': {
    arrangementVersion: '2026.01',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-06-30',
    rawBands: [
      { code: 'A', minimumCents: 1629, maximumCents: 1919 },
      { code: 'B', minimumCents: 1629, maximumCents: 1946 },
      { code: 'C', minimumCents: 1643, maximumCents: 2003 },
      { code: 'D', minimumCents: 1658, maximumCents: 2088 },
      { code: 'E', minimumCents: 1700, maximumCents: 2187 },
      { code: 'F', minimumCents: 1756, maximumCents: 2314 },
      { code: 'G', minimumCents: 1828, maximumCents: 2470 },
      { code: 'H', minimumCents: 1913, maximumCents: 2641 },
      { code: 'I', minimumCents: 2026, maximumCents: 2853 },
      { code: 'J', minimumCents: 2153, maximumCents: 3122 },
    ],
  },
  '2026.07': {
    arrangementVersion: '2026.07',
    effectiveFrom: '2026-07-01',
    effectiveTo: '2026-12-31',
    rawBands: [
      { code: 'A', minimumCents: 1662, maximumCents: 1957 },
      { code: 'B', minimumCents: 1662, maximumCents: 1985 },
      { code: 'C', minimumCents: 1676, maximumCents: 2043 },
      { code: 'D', minimumCents: 1691, maximumCents: 2130 },
      { code: 'E', minimumCents: 1734, maximumCents: 2231 },
      { code: 'F', minimumCents: 1792, maximumCents: 2361 },
      { code: 'G', minimumCents: 1864, maximumCents: 2520 },
      { code: 'H', minimumCents: 1951, maximumCents: 2694 },
      { code: 'I', minimumCents: 2066, maximumCents: 2910 },
      { code: 'J', minimumCents: 2196, maximumCents: 3185 },
    ],
  },
})

const RULE_INPUTS: readonly PayrollComponentInputDefinition[] = Object.freeze([
  { name: 'scenarioCode', valueType: 'STRING', required: true },
  { name: 'bandCode', valueType: 'STRING', required: true },
  { name: 'agreedHourlyRate', valueType: 'MONEY', required: true },
  { name: 'contractHoursPerWeek', valueType: 'DECIMAL', required: true },
  { name: 'fullTimeHoursPerWeek', valueType: 'DECIMAL', required: true },
  { name: 'monthlyGrossSalary', valueType: 'MONEY', required: true },
])

const RULE_OUTPUTS: readonly PayrollComponentOutputDefinition[] = Object.freeze([
  { name: 'grossSalary', valueType: 'MONEY' },
  { name: 'grossHourlyRate', valueType: 'MONEY' },
  { name: 'fullTimeEquivalentHourlyRate', valueType: 'MONEY' },
  { name: 'fullTimeEquivalentGrossMonthlySalary', valueType: 'MONEY' },
  { name: 'salaryBandMinimum', valueType: 'MONEY' },
  { name: 'salaryBandMidpoint', valueType: 'MONEY' },
  { name: 'salaryBandMaximum', valueType: 'MONEY' },
  { name: 'compaRatio', valueType: 'PERCENTAGE' },
  { name: 'compaRatioDisplay', valueType: 'PERCENTAGE' },
  { name: 'bandStatus', valueType: 'STRING' },
  { name: 'bandApplied', valueType: 'BOOLEAN' },
  { name: 'salaryStrategy', valueType: 'STRING' },
  { name: 'salaryBasis', valueType: 'STRING' },
  { name: 'arrangementVersion', valueType: 'STRING' },
])

const SOURCE_FIELDS = [
  { field: 'scenarioCode', code: 'BENCH02_SCENARIO_CODE', valueType: 'STRING' },
  { field: 'bandCode', code: 'BENCH02_BAND_CODE', valueType: 'STRING' },
  { field: 'agreedHourlyRate', code: 'BENCH02_AGREED_HOURLY_RATE', valueType: 'MONEY' },
  { field: 'contractHoursPerWeek', code: 'BENCH02_CONTRACT_HOURS_PER_WEEK', valueType: 'DECIMAL' },
  { field: 'fullTimeHoursPerWeek', code: 'BENCH02_FULL_TIME_HOURS_PER_WEEK', valueType: 'DECIMAL' },
  { field: 'monthlyGrossSalary', code: 'BENCH02_MONTHLY_GROSS_SALARY', valueType: 'MONEY' },
] as const satisfies readonly { readonly field: string; readonly code: string; readonly valueType: PayrollValueType }[]

const RESULT_MAPPINGS: readonly PayrollResultMapping[] = Object.freeze([
  { key: 'gross_salary', componentCode: 'BENCH02_OPEN_BAND_GROSS', outputName: 'grossSalary' },
  { key: 'gross_hourly_rate', componentCode: 'BENCH02_OPEN_BAND_GROSS', outputName: 'grossHourlyRate' },
  { key: 'full_time_equivalent_hourly_rate', componentCode: 'BENCH02_OPEN_BAND_GROSS', outputName: 'fullTimeEquivalentHourlyRate' },
  { key: 'full_time_equivalent_gross_monthly_salary', componentCode: 'BENCH02_OPEN_BAND_GROSS', outputName: 'fullTimeEquivalentGrossMonthlySalary' },
  { key: 'salary_band_minimum', componentCode: 'BENCH02_OPEN_BAND_GROSS', outputName: 'salaryBandMinimum' },
  { key: 'salary_band_midpoint', componentCode: 'BENCH02_OPEN_BAND_GROSS', outputName: 'salaryBandMidpoint' },
  { key: 'salary_band_maximum', componentCode: 'BENCH02_OPEN_BAND_GROSS', outputName: 'salaryBandMaximum' },
  { key: 'compa_ratio', componentCode: 'BENCH02_OPEN_BAND_GROSS', outputName: 'compaRatio' },
  { key: 'compa_ratio_display', componentCode: 'BENCH02_OPEN_BAND_GROSS', outputName: 'compaRatioDisplay' },
  { key: 'band_status', componentCode: 'BENCH02_OPEN_BAND_GROSS', outputName: 'bandStatus' },
  { key: 'band_applied', componentCode: 'BENCH02_OPEN_BAND_GROSS', outputName: 'bandApplied' },
  { key: 'salary_strategy', componentCode: 'BENCH02_OPEN_BAND_GROSS', outputName: 'salaryStrategy' },
  { key: 'salary_basis', componentCode: 'BENCH02_OPEN_BAND_GROSS', outputName: 'salaryBasis' },
  { key: 'arrangement_version', componentCode: 'BENCH02_OPEN_BAND_GROSS', outputName: 'arrangementVersion' },
])

const C1_RESULT_MAPPINGS: readonly PayrollResultMapping[] = Object.freeze([
  { key: 'gross_salary', componentCode: 'BENCH02_OPEN_BAND_GROSS', outputName: 'grossSalary' },
  { key: 'band_status', componentCode: 'BENCH02_OPEN_BAND_GROSS', outputName: 'bandStatus' },
  { key: 'band_applied', componentCode: 'BENCH02_OPEN_BAND_GROSS', outputName: 'bandApplied' },
  { key: 'salary_strategy', componentCode: 'BENCH02_OPEN_BAND_GROSS', outputName: 'salaryStrategy' },
  { key: 'salary_basis', componentCode: 'BENCH02_OPEN_BAND_GROSS', outputName: 'salaryBasis' },
])

const C1_RULE_OUTPUTS: readonly PayrollComponentOutputDefinition[] = Object.freeze([
  { name: 'grossSalary', valueType: 'MONEY' },
  { name: 'bandStatus', valueType: 'STRING' },
  { name: 'bandApplied', valueType: 'BOOLEAN' },
  { name: 'salaryStrategy', valueType: 'STRING' },
  { name: 'salaryBasis', valueType: 'STRING' },
])
const NO_APPLICABLE_CAO_STATUS = 'NO_APPLICABLE_CAO_IDENTIFIED_IN_SYNTHETIC_DEMO'

function centsToMoney(cents: number | bigint): string {
  const amount = BigInt(cents)
  const whole = amount / BigInt(100)
  const fraction = (amount % BigInt(100)).toString().padStart(2, '0')
  return `${whole}.${fraction}`
}

function midpointCents(minimumCents: number, maximumCents: number): number {
  // The bounds are positive integer cents; ceil((min + max) / 2) is HALF_UP to one cent.
  return Math.floor((minimumCents + maximumCents + 1) / 2)
}

function resolveBandBounds(version: ArrangementVersion): readonly BandBounds[] {
  return VERSIONED_TABLES[version].rawBands.map((band) => ({
    code: band.code,
    minimumHourly: centsToMoney(band.minimumCents),
    midpointHourly: centsToMoney(midpointCents(band.minimumCents, band.maximumCents)),
    maximumHourly: centsToMoney(band.maximumCents),
  }))
}

function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function asString(inputs: Readonly<Record<string, PayrollSerializedValue>>, name: string): string {
  const value = inputs[name]
  if (!value || typeof value.value !== 'string') throw new RangeError(`Missing or invalid payroll input: ${name}.`)
  return value.value
}

function asParameterString(parameters: Readonly<Record<string, PayrollTypedParameter>>, name: string): string {
  const parameter = parameters[name]
  if (!parameter || typeof parameter.value !== 'string') throw new RangeError(`Missing or invalid rule parameter: ${name}.`)
  return parameter.value
}

function parseCents(value: string, name: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) throw new RangeError(`${name} must be a non-negative amount with at most two decimal places.`)
  return BigInt(match[1]!) * BigInt(100) + BigInt((match[2] ?? '').padEnd(2, '0') || '0')
}

function parseHundredths(value: string, name: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) throw new RangeError(`${name} must be a non-negative decimal with at most two decimal places.`)
  return BigInt(match[1]!) * BigInt(100) + BigInt((match[2] ?? '').padEnd(2, '0') || '0')
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < BigInt(0) || denominator <= BigInt(0)) throw new RangeError('HALF_UP rounding requires a non-negative ratio.')
  const quotient = numerator / denominator
  const remainder = numerator % denominator
  return quotient + (remainder * BigInt(2) >= denominator ? BigInt(1) : BigInt(0))
}

function scaledToDecimal(value: bigint, scale: bigint, decimalPlaces: number): string {
  const whole = value / scale
  const fraction = (value % scale).toString().padStart(decimalPlaces, '0')
  return `${whole}.${fraction}`
}

function value(valueType: PayrollValueType, item: string | boolean): PayrollSerializedValue {
  return { valueType, value: item }
}

function traceStep(
  code: string,
  values: Readonly<Record<string, PayrollSerializedValue>>,
  sourceReference: string,
): PayrollRegisteredRuleTraceStep {
  return { code, values, sourceReference }
}

function calculateOpenBandRule(context: Parameters<PayrollRegisteredRule['execute']>[0]): ReturnType<PayrollRegisteredRule['execute']> {
  const scenarioCode = asString(context.inputs, 'scenarioCode')
  const bandCode = asString(context.inputs, 'bandCode')
  const arrangementVersion = asParameterString(context.parameters, 'arrangementVersion')
  const bandTableJson = asParameterString(context.parameters, 'bandTableJson')
  const bands = JSON.parse(bandTableJson) as readonly BandBounds[]
  const band = bands.find((candidate) => candidate.code === bandCode)
  const zeroMoney = '0.00'
  let grossSalary = zeroMoney
  let grossHourlyRate = zeroMoney
  let fullTimeEquivalentGrossMonthlySalary = zeroMoney
  let salaryBandMinimum = zeroMoney
  let salaryBandMidpoint = zeroMoney
  let salaryBandMaximum = zeroMoney
  let compaRatio = '0.000000'
  let compaRatioDisplay = '0.00'
  let bandStatus = 'NO_BAND'
  let bandApplied = false
  let salaryStrategy = 'FREELY_NEGOTIATED'
  let salaryBasis = 'MONTHLY'
  let hourlyRateCents = BigInt(0)

  if (scenarioCode === 'B1' || scenarioCode === 'B2') {
    if (!band) throw new RangeError(`Unknown open salary band: ${bandCode}.`)
    const minimumCents = parseCents(band.minimumHourly, 'salaryBandMinimum')
    const midpointCentsValue = parseCents(band.midpointHourly, 'salaryBandMidpoint')
    const maximumCents = parseCents(band.maximumHourly, 'salaryBandMaximum')
    const fullTimeHours = parseHundredths(asString(context.inputs, 'fullTimeHoursPerWeek'), 'fullTimeHoursPerWeek')
    const contractHours = parseHundredths(asString(context.inputs, 'contractHoursPerWeek'), 'contractHoursPerWeek')
    if (fullTimeHours <= BigInt(0) || contractHours <= BigInt(0) || contractHours > fullTimeHours) {
      throw new RangeError('Open-band weekly hours must be positive and contract hours cannot exceed full-time hours.')
    }

    salaryStrategy = 'OPEN_SALARY_BAND'
    salaryBasis = 'HOURLY'
    if (scenarioCode === 'B1') {
      if (contractHours !== fullTimeHours) throw new RangeError('B1 is the full-time exact-midpoint benchmark scenario.')
      hourlyRateCents = midpointCentsValue
    } else {
      hourlyRateCents = parseCents(asString(context.inputs, 'agreedHourlyRate'), 'agreedHourlyRate')
    }

    const actualMonthlyCents = roundHalfUp(hourlyRateCents * contractHours * BigInt(13), BigInt(300))
    const fullTimeMonthlyCents = roundHalfUp(hourlyRateCents * fullTimeHours * BigInt(13), BigInt(300))
    const exactRatioAtSixPlaces = roundHalfUp(hourlyRateCents * BigInt(100) * BigInt(1_000_000), midpointCentsValue)
    const ratioAtTwoPlaces = roundHalfUp(hourlyRateCents * BigInt(100) * BigInt(100), midpointCentsValue)
    grossSalary = centsToMoney(actualMonthlyCents)
    grossHourlyRate = centsToMoney(hourlyRateCents)
    fullTimeEquivalentGrossMonthlySalary = centsToMoney(fullTimeMonthlyCents)
    salaryBandMinimum = band.minimumHourly
    salaryBandMidpoint = band.midpointHourly
    salaryBandMaximum = band.maximumHourly
    compaRatio = scaledToDecimal(exactRatioAtSixPlaces, BigInt(1_000_000), 6)
    compaRatioDisplay = scaledToDecimal(ratioAtTwoPlaces, BigInt(100), 2)
    bandStatus = hourlyRateCents < minimumCents ? 'BELOW_MIN' : hourlyRateCents > maximumCents ? 'ABOVE_MAX' : 'WITHIN_BAND'
    bandApplied = true
  } else if (scenarioCode === 'C1') {
    grossSalary = centsToMoney(parseCents(asString(context.inputs, 'monthlyGrossSalary'), 'monthlyGrossSalary'))
    bandStatus = NO_APPLICABLE_CAO_STATUS
  } else {
    throw new RangeError(`Unsupported CAO-BENCH02 scenario code: ${scenarioCode}.`)
  }

  const allOutputs: Readonly<Record<string, PayrollSerializedValue>> = {
    grossSalary: value('MONEY', grossSalary),
    grossHourlyRate: value('MONEY', grossHourlyRate),
    fullTimeEquivalentHourlyRate: value('MONEY', scenarioCode === 'C1' ? zeroMoney : grossHourlyRate),
    fullTimeEquivalentGrossMonthlySalary: value('MONEY', fullTimeEquivalentGrossMonthlySalary),
    salaryBandMinimum: value('MONEY', salaryBandMinimum),
    salaryBandMidpoint: value('MONEY', salaryBandMidpoint),
    salaryBandMaximum: value('MONEY', salaryBandMaximum),
    compaRatio: value('PERCENTAGE', compaRatio),
    compaRatioDisplay: value('PERCENTAGE', compaRatioDisplay),
    bandStatus: value('STRING', bandStatus),
    bandApplied: value('BOOLEAN', bandApplied),
    salaryStrategy: value('STRING', salaryStrategy),
    salaryBasis: value('STRING', salaryBasis),
    arrangementVersion: value('STRING', arrangementVersion),
  }

  const outputs: Readonly<Record<string, PayrollSerializedValue>> = scenarioCode === 'C1'
    ? {
      grossSalary: allOutputs.grossSalary!,
      bandStatus: allOutputs.bandStatus!,
      bandApplied: allOutputs.bandApplied!,
      salaryStrategy: allOutputs.salaryStrategy!,
      salaryBasis: allOutputs.salaryBasis!,
    }
    : allOutputs

  if (scenarioCode === 'C1') {
    return {
      outputs,
      trace: [
        traceStep('scenario-policy', {
          scenarioCode: value('STRING', scenarioCode),
          salaryStrategy: value('STRING', salaryStrategy),
          salaryBasis: value('STRING', salaryBasis),
          arrangementVersion: value('STRING', arrangementVersion),
          bandApplied: value('BOOLEAN', bandApplied),
          applicability: value('STRING', NO_APPLICABLE_CAO_STATUS),
        }, SYNTHETIC_POLICY_REFERENCE),
        traceStep('negotiated-monthly-gross', {
          grossSalary: value('MONEY', grossSalary),
        }, SYNTHETIC_POLICY_REFERENCE),
      ],
    }
  }

  return {
    outputs,
    trace: [
      traceStep('scenario-policy', {
        scenarioCode: value('STRING', scenarioCode),
        salaryStrategy: value('STRING', salaryStrategy),
        salaryBasis: value('STRING', salaryBasis),
        arrangementVersion: value('STRING', arrangementVersion),
        bandApplied: value('BOOLEAN', bandApplied),
      }, SYNTHETIC_POLICY_REFERENCE),
      traceStep('published-open-band-reference', {
        bandCode: value('STRING', bandCode),
        minimumHourly: value('MONEY', salaryBandMinimum),
        midpointHourly: value('MONEY', salaryBandMidpoint),
        maximumHourly: value('MONEY', salaryBandMaximum),
      }, OFFICIAL_OPEN_BANDS_SOURCE),
      traceStep('gross-salary-and-band-position', {
        grossHourlyRate: value('MONEY', grossHourlyRate),
        grossSalary: value('MONEY', grossSalary),
        compaRatio: value('PERCENTAGE', compaRatio),
        compaRatioDisplay: value('PERCENTAGE', compaRatioDisplay),
        bandStatus: value('STRING', bandStatus),
      }, SYNTHETIC_POLICY_REFERENCE),
    ],
  }
}

function sourceComponent(
  field: typeof SOURCE_FIELDS[number],
  version: ArrangementVersion,
  effectiveFrom: string,
  effectiveTo: string,
): PayrollComponentDefinition {
  return {
    id: `system:cao-bench02:${field.code.toLowerCase()}`,
    code: field.code,
    version,
    effectiveFrom,
    effectiveTo,
    ownership: { kind: 'SYSTEM' as const },
    processingScope: 'EMPLOYMENT',
    inputs: [],
    outputs: [{ name: field.field, valueType: field.valueType }],
    dependencies: [],
    method: { kind: 'source', path: ['scenario', field.field] },
    tracePolicy: 'FULL',
  }
}

function makeBundle(version: ArrangementVersion, freelyNegotiatedBenchmark = false): OpenBandsRuleBundle {
  const tableVersion = VERSIONED_TABLES[version]
  const bands = resolveBandBounds(version)
  const bandTableJson = stableSerialize(bands)
  const implementationHash = sha256(stableSerialize({ implementationId: RULE_IMPLEMENTATION_ID, ruleKey: RULE_KEY }))
  const ruleParameters: Readonly<Record<string, PayrollTypedParameter>> = Object.freeze({
    arrangementVersion: { valueType: 'STRING', value: version },
    bandTableJson: { valueType: 'STRING', value: bandTableJson },
    midpointRounding: { valueType: 'STRING', value: 'AVERAGE_BOUNDS_HALF_UP_TO_EUR_CENT' },
    monthlyGrossPolicy: { valueType: 'STRING', value: 'hourlyRate x contractedWeeklyHours x 52 / 12; 40-hour FTE reference x 40 x 52 / 12; HALF_UP to cents' },
  })
  const parameterSetHash = sha256(stableSerialize(ruleParameters))
  const registeredComponentId = 'system:cao-bench02:open-band-gross'
  const registeredComponentCode = 'BENCH02_OPEN_BAND_GROSS'
  const resultMappings = freelyNegotiatedBenchmark ? C1_RESULT_MAPPINGS : RESULT_MAPPINGS
  const registeredRuleOutputs = freelyNegotiatedBenchmark ? C1_RULE_OUTPUTS : RULE_OUTPUTS
  const sourceComponents = SOURCE_FIELDS.map((field) => sourceComponent(field, version, tableVersion.effectiveFrom, tableVersion.effectiveTo))
  const dependencies: readonly PayrollDependencyDefinition[] = Object.freeze(SOURCE_FIELDS.map((field) => ({
    componentCode: field.code,
    outputName: field.field,
    inputName: field.field,
  })))
  const registeredComponent: PayrollComponentDefinition = Object.freeze({
    id: registeredComponentId,
    code: registeredComponentCode,
    version,
    effectiveFrom: tableVersion.effectiveFrom,
    effectiveTo: tableVersion.effectiveTo,
    ownership: { kind: 'SYSTEM' as const },
    processingScope: 'EMPLOYMENT',
    inputs: RULE_INPUTS,
    outputs: registeredRuleOutputs,
    dependencies,
    parameters: ruleParameters,
    method: {
      kind: 'registeredRule' as const,
      ruleKey: RULE_KEY,
      ruleVersion: version,
      implementationHash,
      parameterSetHash,
    },
    tracePolicy: 'FULL',
  })
  const components: readonly PayrollComponentDefinition[] = Object.freeze([...sourceComponents, registeredComponent])
  const sourceMetadata: Readonly<Record<string, string>> = Object.freeze({
    officialSourceUrl: OFFICIAL_OPEN_BANDS_SOURCE,
    officialSourceIdentifier: 'Staatscourant 2026, nr. 11183',
    officialSourceTitle: 'Passagiers- en bagageafhandeling Luchtvaart 2026/2027, AVV',
    sourcePublishedOn: '2026-03-19',
    sourceDecisionEffectiveFrom: '2026-03-20',
    sourceDecisionExpiresOn: '2027-07-01',
    sourceDecisionNoRetroactivity: 'true',
    sourceRateBasis: 'EUR gross base hourly wage; source tables define minimum and maximum only',
    bandTableEffectiveFrom: tableVersion.effectiveFrom,
    bandTableEffectiveTo: tableVersion.effectiveTo,
    sourceTableJson: bandTableJson,
    midpointPolicy: 'Synthetic company policy: (published minimum + maximum) / 2, HALF_UP to EUR 0.01',
    monthlyGrossPolicy: 'Synthetic company policy: hourlyRate x contractedWeeklyHours x 52 / 12; 40-hour FTE reference x 40 x 52 / 12; HALF_UP to EUR 0.01; does not adopt source factor 164.667',
    compaRatioPolicy: 'Synthetic company policy: agreed hourly wage / reference midpoint x 100; exact integer arithmetic, 6 decimal result and separate 2 decimal display',
    arrangementIsCollectiveAgreement: 'false',
    salaryBandJobMapping: 'Synthetic test mapping only; no source function mapping or employer scope imported',
    ruleImplementationId: RULE_IMPLEMENTATION_ID,
    implementationHash,
    parameterSetHash,
  })
  const packageHash = sha256(stableSerialize({
    packageId: OPEN_BANDS_PACKAGE_ID,
    version,
    effectiveFrom: tableVersion.effectiveFrom,
    effectiveTo: tableVersion.effectiveTo,
    sourceMetadata,
    components,
    controls: [],
    resultMappings,
    parameterSetHash,
  }))
  const metadata: PayrollRulePackageMetadata = Object.freeze({
    packageId: OPEN_BANDS_PACKAGE_ID,
    version,
    packageHash,
    parameterSetHash,
    sourceMetadata,
  })
  const rulePackage: PayrollRulePackage = Object.freeze({
    compositionId: `${OPEN_BANDS_PACKAGE_ID}:${version}${freelyNegotiatedBenchmark ? ':C1-FREELY-NEGOTIATED' : ''}`,
    metadata,
    components,
    controls: [],
    resultMappings,
  })
  const registry: readonly PayrollRegisteredRule[] = Object.freeze([{
    ruleKey: RULE_KEY,
    ruleVersion: version,
    implementationHash,
    parameterSetHash,
    packageId: OPEN_BANDS_PACKAGE_ID,
    packageVersion: version,
    allowedComponents: [{ id: registeredComponentId, code: registeredComponentCode, version }],
    inputs: RULE_INPUTS,
    outputs: registeredRuleOutputs,
    execute: calculateOpenBandRule,
  }])
  return { rulePackage, registry, arrangementVersion: version }
}

export interface OpenBandsRuleBundle {
  readonly rulePackage: PayrollRulePackage
  readonly registry: readonly PayrollRegisteredRule[]
  readonly arrangementVersion: string
}

export function getOpenBandsRuleBundle(asOfDate: string, scenarioCode?: 'C1'): OpenBandsRuleBundle {
  if (!isIsoCalendarDate(asOfDate) || !asOfDate.startsWith('2026-')) {
    throw new RangeError('Open-band rules require a valid date within 2026.')
  }
  return makeBundle(asOfDate >= '2026-07-01' ? '2026.07' : '2026.01', scenarioCode === 'C1')
}

export type MetalektroApplicabilityStatus = 'SUPPORTED' | 'REQUIRES_REVIEW' | 'EXCLUDED'
export type MetalektroEvidenceValue = 'YES' | 'NO' | 'UNKNOWN'

export interface MetalektroEvidence<T> {
  readonly value: T
  readonly evidence: string
}

export interface MetalektroHpApplicabilityInput {
  readonly asOfDate: string
  readonly employerScope: MetalektroEvidence<'IN_SCOPE' | 'OUT_OF_SCOPE' | 'UNKNOWN'>
  readonly functionLevel: MetalektroEvidence<'ABOVE_BASIS_CAO' | 'AT_OR_BELOW_BASIS_CAO' | 'UNKNOWN'> & {
    readonly evaluationSystem?: string
    readonly isfPoints?: number
    readonly hpGroup?: 'L' | 'M' | 'N' | 'O' | 'P' | 'Q'
  }
  readonly enterpriseDirector: MetalektroEvidence<MetalektroEvidenceValue>
  readonly directlyDeterminesEnterprisePolicy: MetalektroEvidence<MetalektroEvidenceValue>
}

export interface MetalektroHpApplicabilityResult {
  readonly status: MetalektroApplicabilityStatus
  readonly reasonCode: string
  readonly asOfDate: string
  readonly sourceIdentifier: string | null
  readonly sourceReference: string | null
  readonly sourceEffectiveFrom: string | null
  readonly missingEvidence: readonly string[]
  readonly explanation: string
}

const METAL_HP_BASELINE_SOURCE = 'https://zoek.officielebekendmakingen.nl/stcrt-2026-14650.html'
const METAL_HP_AMENDMENT_SOURCE = 'https://zoek.officielebekendmakingen.nl/stcrt-2026-22083.html'

const ISF_GROUP_RANGES: Readonly<Record<NonNullable<MetalektroHpApplicabilityInput['functionLevel']['hpGroup']>, readonly [number, number]>> = Object.freeze({
  L: [591, 645],
  M: [646, 700],
  N: [701, 760],
  O: [761, 820],
  P: [821, 880],
  Q: [881, 940],
})

function hasEvidence(evidence: string): boolean {
  return typeof evidence === 'string' && evidence.trim().length > 0
}

function isfEvidenceIsConsistent(functionLevel: MetalektroHpApplicabilityInput['functionLevel']): boolean {
  if (functionLevel.evaluationSystem?.toUpperCase() !== 'ISF') return true
  const group = functionLevel.hpGroup
  const points = functionLevel.isfPoints
  if (!group || !Number.isInteger(points)) return false
  const [minimum, maximum] = ISF_GROUP_RANGES[group]
  return points! >= minimum && points! <= maximum
}

function applicabilityResult(
  status: MetalektroApplicabilityStatus,
  reasonCode: string,
  input: MetalektroHpApplicabilityInput,
  source: { readonly identifier: string | null; readonly reference: string | null; readonly effectiveFrom: string | null },
  missingEvidence: readonly string[],
  explanation: string,
): MetalektroHpApplicabilityResult {
  return {
    status,
    reasonCode,
    asOfDate: input.asOfDate,
    sourceIdentifier: source.identifier,
    sourceReference: source.reference,
    sourceEffectiveFrom: source.effectiveFrom,
    missingEvidence: Object.freeze([...missingEvidence]),
    explanation,
  }
}

/**
 * Evaluates only evidenced employer/function/role facts against the effective HP scope text.
 * It accepts neither salary nor title as a classification input.
 */
export function evaluateMetalektroHpApplicability(input: MetalektroHpApplicabilityInput): MetalektroHpApplicabilityResult {
  if (!isIsoCalendarDate(input.asOfDate) || input.asOfDate < '2026-05-21' || input.asOfDate > '2028-05-20') {
    return applicabilityResult('REQUIRES_REVIEW', 'REQUIRES_EFFECTIVE_SOURCE', input,
      { identifier: null, reference: null, effectiveFrom: null }, ['asOfDate'],
      'The supported official HP scope sources do not cover this date; select the applicable version before classifying scope.')
  }

  const amended = input.asOfDate >= '2026-07-17'
  const source = amended
    ? { identifier: 'Staatscourant 2026, nr. 22083', reference: METAL_HP_AMENDMENT_SOURCE, effectiveFrom: '2026-07-17' }
    : { identifier: 'Staatscourant 2026, nr. 14650', reference: METAL_HP_BASELINE_SOURCE, effectiveFrom: '2026-05-21' }

  if (input.enterpriseDirector.value === 'YES' && hasEvidence(input.enterpriseDirector.evidence)
    || input.directlyDeterminesEnterprisePolicy.value === 'YES' && hasEvidence(input.directlyDeterminesEnterprisePolicy.evidence)) {
    return applicabilityResult('EXCLUDED', 'EXCLUDED_ROLE_CATEGORY', input, source, [],
      'The effective HP scope clause excludes an evidenced enterprise director or functionary directly involved in determining enterprise policy.')
  }
  if (input.employerScope.value === 'OUT_OF_SCOPE' && hasEvidence(input.employerScope.evidence)) {
    return applicabilityResult('EXCLUDED', 'EXCLUDED_EMPLOYER_SCOPE', input, source, [],
      'The employer is evidenced as outside Metalektro scope, so this HP route is not supported.')
  }
  if (input.functionLevel.value === 'AT_OR_BELOW_BASIS_CAO' && hasEvidence(input.functionLevel.evidence)) {
    return applicabilityResult('EXCLUDED', 'EXCLUDED_FUNCTION_LEVEL', input, source, [],
      'The function is evidenced at or below the Basis-cao salary-group level required by the HP scope clause.')
  }

  const missingEvidence = [
    ...(!hasEvidence(input.employerScope.evidence) || input.employerScope.value === 'UNKNOWN' ? ['employerScope'] : []),
    ...(!hasEvidence(input.functionLevel.evidence) || input.functionLevel.value === 'UNKNOWN' ? ['functionLevel'] : []),
    ...(!hasEvidence(input.enterpriseDirector.evidence) || input.enterpriseDirector.value === 'UNKNOWN' ? ['enterpriseDirector'] : []),
    ...(!hasEvidence(input.directlyDeterminesEnterprisePolicy.evidence) || input.directlyDeterminesEnterprisePolicy.value === 'UNKNOWN' ? ['directlyDeterminesEnterprisePolicy'] : []),
    ...(input.functionLevel.value === 'ABOVE_BASIS_CAO' && !isfEvidenceIsConsistent(input.functionLevel) ? ['functionLevel.isfEvidence'] : []),
  ]
  if (missingEvidence.length > 0) {
    return applicabilityResult('REQUIRES_REVIEW', 'REQUIRES_SCOPE_EVIDENCE', input, source, missingEvidence,
      'Employer scope, function level and the two excluded role categories need dated evidence; title and salary are not classification criteria.')
  }

  if (input.employerScope.value !== 'IN_SCOPE'
    || input.functionLevel.value !== 'ABOVE_BASIS_CAO'
    || input.enterpriseDirector.value !== 'NO'
    || input.directlyDeterminesEnterprisePolicy.value !== 'NO') {
    return applicabilityResult('REQUIRES_REVIEW', 'REQUIRES_SCOPE_EVIDENCE', input, source,
      ['employerScope', 'functionLevel', 'enterpriseDirector', 'directlyDeterminesEnterprisePolicy'],
      'The supplied facts do not establish every required HP-scope condition.')
  }

  return applicabilityResult('SUPPORTED', 'SUPPORTED_HIGHER_SPECIALIST', input, source, [],
    'The synthetic employer is evidenced in Metalektro, the function is evidenced above the Basis-cao groups, and neither express excluded role category applies.')
}
