import {
  FixedDecimal,
  PayrollEngineError,
  applyPayrollRounding,
  applyPayrollRoundingToRatio,
} from '@liquid-hr/payroll-engine'
import type {
  PayrollRegisteredRule,
  PayrollRegisteredRuleTraceStep,
  PayrollRoundingDefinition,
  PayrollSerializedValue,
  PayrollTypedParameter,
} from '@liquid-hr/payroll-engine'
import { compositePaidWorkdays, parseNl2026CompositeTimePeriod, type Nl2026CompositePeriod } from './period'

const ZERO = FixedDecimal.fromInteger(BigInt(0))
const ONE_HUNDRED = FixedDecimal.fromInteger(BigInt(100))

type NumericParameterName =
  | 'monthFactor'
  | 'weekFactor'
  | 'dayFactor'
  | 'annualTableStep'
  | 'maximumAnnualTableWage'
  | 'bracket1Offset'
  | 'bracket2Offset'
  | 'bracket3Offset'
  | 'bracket1RatePercent'
  | 'bracket2RatePercent'
  | 'bracket3RatePercent'
  | 'bracket1CumulativeTax'
  | 'bracket2CumulativeTax'
  | 'bracket3CumulativeTax'
  | 'generalCreditMaximum'
  | 'generalCreditLowerBound'
  | 'generalCreditUpperBound'
  | 'generalCreditTaperRate'
  | 'labourCreditBuildRate1'
  | 'labourCreditBuildRate2'
  | 'labourCreditBuildRate3'
  | 'labourCreditBuildCap1'
  | 'labourCreditBuildCap2'
  | 'labourCreditBuildCap3'
  | 'labourCreditStart1'
  | 'labourCreditStart2'
  | 'labourCreditTaperStart'
  | 'labourCreditZeroBound'
  | 'labourCreditTaperRate'

interface RoundingSpec {
  readonly code: string
  readonly definition: PayrollRoundingDefinition
  readonly rounded: FixedDecimal
  readonly unrounded?: FixedDecimal
  readonly ratio?: { readonly numerator: FixedDecimal; readonly denominator: FixedDecimal }
}

function unsupported(reason: string): never {
  throw new PayrollEngineError(`NL2026_UNSUPPORTED_${reason}`, 'This payroll profile is outside the supported Dutch 2026 regular-wage scope.')
}

function inputValue(
  inputs: Readonly<Record<string, PayrollSerializedValue>>,
  name: string,
  valueType: PayrollSerializedValue['valueType'],
): PayrollSerializedValue {
  const input = inputs[name]
  if (!input) throw new PayrollEngineError('NL2026_INPUT_MISSING', 'A required Dutch 2026 payroll input is missing.')
  if (input.valueType !== valueType) throw new PayrollEngineError('NL2026_INPUT_TYPE_INVALID', 'A Dutch 2026 payroll input has an invalid type.')
  return input
}

function inputString(inputs: Readonly<Record<string, PayrollSerializedValue>>, name: string): string {
  const input = inputValue(inputs, name, 'STRING')
  if (typeof input.value !== 'string') throw new PayrollEngineError('NL2026_INPUT_TYPE_INVALID', 'A Dutch 2026 payroll input has an invalid type.')
  return input.value
}

function inputBoolean(inputs: Readonly<Record<string, PayrollSerializedValue>>, name: string): boolean {
  const input = inputValue(inputs, name, 'BOOLEAN')
  if (typeof input.value !== 'boolean') throw new PayrollEngineError('NL2026_INPUT_TYPE_INVALID', 'A Dutch 2026 payroll input has an invalid type.')
  return input.value
}

function inputDecimal(inputs: Readonly<Record<string, PayrollSerializedValue>>, name: string): FixedDecimal {
  const input = inputValue(inputs, name, 'DECIMAL')
  if (typeof input.value !== 'string') throw new PayrollEngineError('NL2026_INPUT_TYPE_INVALID', 'A Dutch 2026 payroll input has an invalid type.')
  try {
    return FixedDecimal.parse(input.value)
  } catch {
    throw new PayrollEngineError('NL2026_INPUT_DECIMAL_INVALID', 'A Dutch 2026 payroll input is not a valid exact decimal.')
  }
}

function inputMoney(inputs: Readonly<Record<string, PayrollSerializedValue>>, name: string): FixedDecimal {
  const input = inputValue(inputs, name, 'MONEY')
  if (typeof input.value !== 'string') throw new PayrollEngineError('NL2026_INPUT_TYPE_INVALID', 'A Dutch 2026 payroll input has an invalid type.')
  let value: FixedDecimal
  try {
    value = FixedDecimal.parse(input.value)
  } catch {
    throw new PayrollEngineError('NL2026_INPUT_MONEY_INVALID', 'A Dutch 2026 money input is not a valid exact decimal.')
  }
  if (value.scale > 2) unsupported('MONEY_PRECISION')
  if (value.compare(ZERO) < 0) unsupported('NEGATIVE_WAGE')
  return value
}

function parameterDecimal(
  parameters: Readonly<Record<string, PayrollTypedParameter>>,
  name: NumericParameterName,
): FixedDecimal {
  const parameter = parameters[name]
  if (!parameter || !['MONEY', 'DECIMAL', 'PERCENTAGE'].includes(parameter.valueType) || typeof parameter.value !== 'string') {
    throw new PayrollEngineError('NL2026_RULE_PARAMETER_INVALID', 'A required pinned Dutch 2026 rule parameter is missing or invalid.')
  }
  try {
    return FixedDecimal.parse(parameter.value)
  } catch {
    throw new PayrollEngineError('NL2026_RULE_PARAMETER_INVALID', 'A required pinned Dutch 2026 rule parameter is missing or invalid.')
  }
}

function maximum(left: FixedDecimal, right: FixedDecimal): FixedDecimal {
  return left.compare(right) >= 0 ? left : right
}

function minimum(left: FixedDecimal, right: FixedDecimal): FixedDecimal {
  return left.compare(right) <= 0 ? left : right
}

function serialized(valueType: PayrollSerializedValue['valueType'], value: string | boolean): PayrollSerializedValue {
  return { valueType, value }
}

function decimalValue(value: FixedDecimal, scale?: number): PayrollSerializedValue {
  return serialized('DECIMAL', scale === undefined ? value.toString() : value.toString(scale))
}

function moneyValue(value: FixedDecimal): PayrollSerializedValue {
  return serialized('MONEY', value.toString(2))
}

function textValue(value: string): PayrollSerializedValue {
  return serialized('STRING', value)
}

function booleanValue(value: boolean): PayrollSerializedValue {
  return serialized('BOOLEAN', value)
}

function roundingTrace(spec: RoundingSpec): PayrollRegisteredRuleTraceStep {
  const values: Record<string, PayrollSerializedValue> = {
    roundedValue: decimalValue(spec.rounded, spec.definition.decimalPlaces),
    roundingMode: textValue(spec.definition.mode),
    roundingStage: textValue(spec.definition.stage),
    roundingRuleVersion: textValue(spec.definition.ruleVersion),
    statutorySource: textValue(spec.definition.provenance.sourceReference),
    statutorySourceHash: textValue(spec.definition.provenance.sourceHash),
  }
  if (spec.definition.decimalPlaces !== undefined) {
    values.decimalPlaces = decimalValue(FixedDecimal.fromInteger(BigInt(spec.definition.decimalPlaces)))
  }
  if (spec.definition.targetMultiple !== undefined) values.targetMultiple = decimalValue(FixedDecimal.parse(spec.definition.targetMultiple))
  if (spec.ratio) {
    const exactDifferenceNumerator = spec.rounded.multiply(spec.ratio.denominator).subtract(spec.ratio.numerator)
    values.unroundedValue = textValue(`${spec.ratio.numerator.toString()}/${spec.ratio.denominator.toString()}`)
    values.roundingDifference = textValue(`${exactDifferenceNumerator.toString()}/${spec.ratio.denominator.toString()}`)
    values.unroundedNumerator = decimalValue(spec.ratio.numerator)
    values.unroundedDenominator = decimalValue(spec.ratio.denominator)
  } else if (spec.unrounded) {
    values.unroundedValue = decimalValue(spec.unrounded)
    values.roundingDifference = decimalValue(spec.rounded.subtract(spec.unrounded))
  } else {
    throw new PayrollEngineError('NL2026_TRACE_ROUNDING_INVALID', 'A rounding trace needs an exact decimal or rational input.')
  }
  return {
    code: spec.code,
    values,
    sourceReference: spec.definition.provenance.sourceReference,
  }
}

function roundingDefinition(
  definitions: readonly PayrollRoundingDefinition[],
  stage: string,
): PayrollRoundingDefinition {
  const matching = definitions.filter((definition) => definition.stage === stage)
  if (matching.length !== 1) {
    throw new PayrollEngineError('NL2026_RULE_ROUNDING_REQUIRED', 'Exactly one pinned rounding rule is required for this statutory stage.')
  }
  return matching[0]!
}

function requiredScope(inputs: Readonly<Record<string, PayrollSerializedValue>>): Nl2026CompositePeriod | null {
  const fiscalYear = inputDecimal(inputs, 'fiscalYear')
  if (fiscalYear.compare(FixedDecimal.fromInteger(BigInt(2026))) !== 0) unsupported('FISCAL_YEAR')
  if (inputString(inputs, 'table') !== 'WHITE') unsupported('TABLE')
  if (inputString(inputs, 'residence') !== 'NL') unsupported('RESIDENCE')
  if (inputString(inputs, 'ageCategory') !== 'UNDER_AOW') unsupported('AGE_CATEGORY')
  if (inputString(inputs, 'herleiding') !== 'STD') unsupported('HERLEIDING')
  const timePeriod = inputString(inputs, 'timePeriod')
  const compositePeriod = parseNl2026CompositeTimePeriod(timePeriod)
  if (!inputBoolean(inputs, 'regularWage')) unsupported('NON_REGULAR_WAGE')
  const fullPeriod = inputBoolean(inputs, 'fullPeriod')
  if (timePeriod !== 'MONTH' && compositePeriod === null) unsupported('TIME_PERIOD')
  if (timePeriod === 'MONTH' && !fullPeriod) unsupported('INCOMPLETE_PERIOD')
  if (compositePeriod !== null && fullPeriod) unsupported('COMPOSITE_PERIOD_FULL_PERIOD')
  if (compositePeriod !== null && inputBoolean(inputs, 'payrollTaxCredit')) {
    unsupported('COMPOSITE_PERIOD_WITH_TAX_CREDIT')
  }
  if (inputBoolean(inputs, 'hasSpecialSituation')) unsupported('SPECIAL_SITUATION')
  const incomeRelationshipCount = inputDecimal(inputs, 'incomeRelationshipCount')
  if (incomeRelationshipCount.compare(FixedDecimal.fromInteger(BigInt(1))) !== 0) unsupported('MULTIPLE_INCOME_RELATIONSHIPS')
  return compositePeriod
}

function bracketParameters(parameters: Readonly<Record<string, PayrollTypedParameter>>, annualWage: FixedDecimal): {
  readonly name: string
  readonly offset: FixedDecimal
  readonly ratePercent: FixedDecimal
  readonly cumulativeTax: FixedDecimal
} {
  const bracket2Offset = parameterDecimal(parameters, 'bracket2Offset')
  const bracket3Offset = parameterDecimal(parameters, 'bracket3Offset')
  if (annualWage.compare(bracket2Offset) <= 0) {
    return {
      name: '1',
      offset: parameterDecimal(parameters, 'bracket1Offset'),
      ratePercent: parameterDecimal(parameters, 'bracket1RatePercent'),
      cumulativeTax: parameterDecimal(parameters, 'bracket1CumulativeTax'),
    }
  }
  if (annualWage.compare(bracket3Offset) <= 0) {
    return {
      name: '2',
      offset: bracket2Offset,
      ratePercent: parameterDecimal(parameters, 'bracket2RatePercent'),
      cumulativeTax: parameterDecimal(parameters, 'bracket2CumulativeTax'),
    }
  }
  return {
    name: '3',
    offset: bracket3Offset,
    ratePercent: parameterDecimal(parameters, 'bracket3RatePercent'),
    cumulativeTax: parameterDecimal(parameters, 'bracket3CumulativeTax'),
  }
}

function calculateAnnualTaxBeforeCredits(
  parameters: Readonly<Record<string, PayrollTypedParameter>>,
  annualWage: FixedDecimal,
  roundingDefinitions: readonly PayrollRoundingDefinition[],
  trace: PayrollRegisteredRuleTraceStep[],
): FixedDecimal {
  const bracket = bracketParameters(parameters, annualWage)
  const unroundedTax = maximum(ZERO, annualWage.subtract(bracket.offset)
    .multiply(bracket.ratePercent)
    .divideExact(ONE_HUNDRED)
    .add(bracket.cumulativeTax))
  const taxRounding = roundingDefinition(roundingDefinitions, 'ANNUAL_TAX_BEFORE_CREDITS')
  const annualTax = maximum(ZERO, applyPayrollRounding(unroundedTax, taxRounding))
  trace.push({
    code: 'tax.bracket-selection',
    values: {
      bracket: textValue(bracket.name),
      annualTableWage: decimalValue(annualWage),
      bracketOffset: moneyValue(bracket.offset),
      bracketRatePercent: decimalValue(bracket.ratePercent),
      cumulativeTax: moneyValue(bracket.cumulativeTax),
    },
    sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.2 table 2, pp.8-9',
  })
  trace.push(roundingTrace({
    code: 'rounding.tax-before-credits',
    definition: taxRounding,
    unrounded: unroundedTax,
    rounded: annualTax,
  }))
  return annualTax
}

function calculateGeneralCredit(
  parameters: Readonly<Record<string, PayrollTypedParameter>>,
  annualWage: FixedDecimal,
  creditEnabled: boolean,
  roundingDefinitions: readonly PayrollRoundingDefinition[],
  trace: PayrollRegisteredRuleTraceStep[],
): FixedDecimal {
  if (!creditEnabled) {
    trace.push({
      code: 'credit.general-credit-skipped',
      values: { payrollTaxCredit: booleanValue(false), annualGeneralCredit: moneyValue(ZERO) },
      sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.4, p.13; loonheffingskorting not applied',
    })
    return ZERO
  }
  const maximumCredit = parameterDecimal(parameters, 'generalCreditMaximum')
  const lowerBound = parameterDecimal(parameters, 'generalCreditLowerBound')
  const upperBound = parameterDecimal(parameters, 'generalCreditUpperBound')
  let unrounded: FixedDecimal
  let rounded: FixedDecimal
  if (annualWage.compare(lowerBound) <= 0) {
    unrounded = maximumCredit
    rounded = maximumCredit
  } else if (annualWage.compare(upperBound) >= 0) {
    unrounded = ZERO
    rounded = ZERO
  } else {
    unrounded = maximumCredit.subtract(annualWage.subtract(lowerBound).multiply(parameterDecimal(parameters, 'generalCreditTaperRate')))
    const generalCreditRounding = roundingDefinition(roundingDefinitions, 'ANNUAL_GENERAL_CREDIT')
    rounded = maximum(ZERO, applyPayrollRounding(unrounded, generalCreditRounding))
    trace.push(roundingTrace({
      code: 'rounding.general-credit',
      definition: generalCreditRounding,
      unrounded,
      rounded,
    }))
  }
  trace.push({
    code: 'credit.general-credit',
    values: {
      annualWage: decimalValue(annualWage),
      unroundedGeneralCredit: decimalValue(unrounded),
      annualGeneralCredit: moneyValue(rounded),
    },
    sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.3.1, p.10',
  })
  return rounded
}

function calculateLabourCredit(
  parameters: Readonly<Record<string, PayrollTypedParameter>>,
  annualWage: FixedDecimal,
  creditEnabled: boolean,
  roundingDefinitions: readonly PayrollRoundingDefinition[],
  trace: PayrollRegisteredRuleTraceStep[],
): FixedDecimal {
  if (!creditEnabled) {
    trace.push({
      code: 'credit.labour-credit-skipped',
      values: { payrollTaxCredit: booleanValue(false), annualLabourCredit: moneyValue(ZERO) },
      sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.4, p.13; loonheffingskorting not applied',
    })
    return ZERO
  }
  const zeroBound = parameterDecimal(parameters, 'labourCreditZeroBound')
  if (annualWage.compare(zeroBound) >= 0) {
    trace.push({
      code: 'credit.labour-credit-zero-bound',
      values: { annualWage: decimalValue(annualWage), annualLabourCredit: moneyValue(ZERO) },
      sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.3.4 table 6, p.13; full phase-out at arkg4',
    })
    return ZERO
  }

  const build1Raw = parameterDecimal(parameters, 'labourCreditBuildRate1').multiply(annualWage)
  const build1Rounding = roundingDefinition(roundingDefinitions, 'ANNUAL_LABOUR_CREDIT_BUILD_1')
  const build1 = applyPayrollRounding(build1Raw, build1Rounding)
  trace.push(roundingTrace({
    code: 'rounding.labour-credit-build-1', definition: build1Rounding, unrounded: build1Raw, rounded: build1,
  }))
  const step1 = minimum(build1, parameterDecimal(parameters, 'labourCreditBuildCap1'))

  const build2Input = maximum(ZERO, annualWage.subtract(parameterDecimal(parameters, 'labourCreditStart1')))
  const build2Raw = parameterDecimal(parameters, 'labourCreditBuildRate2').multiply(build2Input)
  const build2Rounding = roundingDefinition(roundingDefinitions, 'ANNUAL_LABOUR_CREDIT_BUILD_2')
  const build2 = applyPayrollRounding(build2Raw, build2Rounding)
  trace.push(roundingTrace({
    code: 'rounding.labour-credit-build-2', definition: build2Rounding, unrounded: build2Raw, rounded: build2,
  }))
  const step2 = minimum(step1.add(build2), parameterDecimal(parameters, 'labourCreditBuildCap2'))

  const build3Input = maximum(ZERO, annualWage.subtract(parameterDecimal(parameters, 'labourCreditStart2')))
  const build3Raw = parameterDecimal(parameters, 'labourCreditBuildRate3').multiply(build3Input)
  const build3Rounding = roundingDefinition(roundingDefinitions, 'ANNUAL_LABOUR_CREDIT_BUILD_3')
  const build3 = applyPayrollRounding(build3Raw, build3Rounding)
  trace.push(roundingTrace({
    code: 'rounding.labour-credit-build-3', definition: build3Rounding, unrounded: build3Raw, rounded: build3,
  }))
  const step3 = minimum(step2.add(build3), parameterDecimal(parameters, 'labourCreditBuildCap3'))

  const taperInput = maximum(ZERO, annualWage.subtract(parameterDecimal(parameters, 'labourCreditTaperStart')))
  const taperRaw = parameterDecimal(parameters, 'labourCreditTaperRate').multiply(taperInput)
  const taperRounding = roundingDefinition(roundingDefinitions, 'ANNUAL_LABOUR_CREDIT_TAPER')
  const taper = applyPayrollRounding(taperRaw, taperRounding)
  trace.push(roundingTrace({
    code: 'rounding.labour-credit-taper', definition: taperRounding, unrounded: taperRaw, rounded: taper,
  }))

  const creditBeforeCeiling = step3.subtract(taper)
  const labourCreditRounding = roundingDefinition(roundingDefinitions, 'ANNUAL_LABOUR_CREDIT')
  const ceiledCredit = applyPayrollRounding(creditBeforeCeiling, labourCreditRounding)
  const credit = maximum(ZERO, ceiledCredit)
  trace.push(roundingTrace({
    code: 'rounding.labour-credit-annual', definition: labourCreditRounding,
    unrounded: creditBeforeCeiling, rounded: ceiledCredit,
  }))
  trace.push({
    code: 'credit.labour-credit-steps',
    values: {
      annualWage: decimalValue(annualWage),
      buildTerm1: decimalValue(build1, 5),
      cappedStep1: decimalValue(step1),
      buildTerm2: decimalValue(build2, 5),
      cappedStep2: decimalValue(step2),
      buildTerm3: decimalValue(build3, 5),
      cappedStep3: decimalValue(step3),
      taper: decimalValue(taper, 5),
      theoreticalLabourCredit: moneyValue(credit),
    },
    sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.3.4 table 6, pp.12-13; sequential caps and phase-out',
  })
  return credit
}

function monthlyRounded(
  annualAmount: FixedDecimal,
  monthFactor: FixedDecimal,
  roundingDefinitions: readonly PayrollRoundingDefinition[],
  stage: string,
  code: string,
  trace: PayrollRegisteredRuleTraceStep[],
): FixedDecimal {
  const definition = roundingDefinition(roundingDefinitions, stage)
  const rounded = applyPayrollRoundingToRatio(annualAmount, monthFactor, definition)
  trace.push(roundingTrace({
    code,
    definition,
    ratio: { numerator: annualAmount, denominator: monthFactor },
    rounded,
  }))
  return rounded
}

function calculateCompositePeriodWithholding(context: {
  readonly period: Nl2026CompositePeriod
  readonly taxableWage: FixedDecimal
  readonly parameters: Readonly<Record<string, PayrollTypedParameter>>
  readonly roundingDefinitions: readonly PayrollRoundingDefinition[]
  readonly trace: PayrollRegisteredRuleTraceStep[]
}): { readonly outputs: Readonly<Record<string, PayrollSerializedValue>>; readonly trace: readonly PayrollRegisteredRuleTraceStep[] } {
  const { period, taxableWage, parameters, roundingDefinitions, trace } = context
  const paidWorkdays = compositePaidWorkdays(period)
  const weekFactor = parameterDecimal(parameters, 'weekFactor')
  const dayFactor = parameterDecimal(parameters, 'dayFactor')
  const annualTableStep = parameterDecimal(parameters, 'annualTableStep')
  const maximumAnnualTableWage = parameterDecimal(parameters, 'maximumAnnualTableWage')
  const dailyWage = taxableWage.divideToScale(
    FixedDecimal.fromInteger(BigInt(paidWorkdays)),
    12,
    'ARITHMETIC',
  )
  const segments = [
    ...(period.fullWeeks > 0 ? [{ kind: 'WEEK' as const, count: period.fullWeeks, factor: weekFactor, wage: dailyWage.multiply(FixedDecimal.fromInteger(BigInt(5))) }] : []),
    ...(period.remainingDays > 0 ? [{ kind: 'DAY' as const, count: period.remainingDays, factor: dayFactor, wage: dailyWage }] : []),
  ]
  const annualTableRounding = roundingDefinition(roundingDefinitions, 'ANNUAL_TABLE_WAGE')
  if (!annualTableRounding.targetMultiple
    || FixedDecimal.parse(annualTableRounding.targetMultiple).compare(annualTableStep) !== 0) {
    throw new PayrollEngineError('NL2026_ROUNDING_PARAMETER_MISMATCH', 'The annual table-step parameter does not match its pinned rounding definition.')
  }
  const taxAfterCreditsRounding = roundingDefinition(roundingDefinitions, 'ANNUAL_TAX_AFTER_CREDITS')
  const tablePeriodRounding = roundingDefinition(roundingDefinitions, 'PERIOD_TABLE_WAGE')
  const periodTaxRounding = roundingDefinition(roundingDefinitions, 'PERIOD_WAGE_TAX')
  let totalWageTax = ZERO

  trace.push({
    code: 'period.composite-segment-plan',
    values: {
      fullWeeks: decimalValue(FixedDecimal.fromInteger(BigInt(period.fullWeeks))),
      remainingDays: decimalValue(FixedDecimal.fromInteger(BigInt(period.remainingDays))),
      paidWorkdays: decimalValue(FixedDecimal.fromInteger(BigInt(paidWorkdays))),
      dailyWage: decimalValue(dailyWage, 12),
      payrollTaxCredit: booleanValue(false),
    },
    sourceReference: 'Handboek Loonheffingen 2026, §9.3.4; Rekenvoorschriften 2026 v2, §2.2.1 table 1b, p.8',
  })

  for (const segment of segments) {
    const segmentName = segment.kind.toLowerCase()
    const annualizedWageRaw = segment.wage.multiply(segment.factor)
    if (annualizedWageRaw.compare(maximumAnnualTableWage) > 0) unsupported('ABOVE_LMAX')
    const annualTableWage = applyPayrollRounding(annualizedWageRaw, annualTableRounding)
    trace.push(roundingTrace({
      code: `rounding.annual-table-wage.${segmentName}`,
      definition: annualTableRounding,
      unrounded: annualizedWageRaw,
      rounded: annualTableWage,
    }))

    const annualTaxBeforeCredits = calculateAnnualTaxBeforeCredits(parameters, annualTableWage, roundingDefinitions, trace)
    const annualTaxAfterCredits = maximum(ZERO, applyPayrollRounding(annualTaxBeforeCredits, taxAfterCreditsRounding))
    trace.push({
      code: `credit.application-and-cap.${segmentName}`,
      values: {
        annualTaxBeforeCredits: moneyValue(annualTaxBeforeCredits),
        theoreticalGeneralCredit: moneyValue(ZERO),
        theoreticalLabourCredit: moneyValue(ZERO),
        appliedLabourCredit: moneyValue(ZERO),
        appliedGeneralCredit: moneyValue(ZERO),
        annualTaxAfterCredits: moneyValue(annualTaxAfterCredits),
      },
      sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.4, p.13; loonheffingskorting not applied',
    })
    trace.push(roundingTrace({
      code: `rounding.tax-after-credits.${segmentName}`,
      definition: taxAfterCreditsRounding,
      unrounded: annualTaxBeforeCredits,
      rounded: annualTaxAfterCredits,
    }))

    const tablePeriodWage = applyPayrollRoundingToRatio(annualTableWage, segment.factor, tablePeriodRounding)
    trace.push(roundingTrace({
      code: `rounding.period-table-wage.${segmentName}`,
      definition: tablePeriodRounding,
      ratio: { numerator: annualTableWage, denominator: segment.factor },
      rounded: tablePeriodWage,
    }))
    const segmentWageTax = applyPayrollRoundingToRatio(annualTaxAfterCredits, segment.factor, periodTaxRounding)
    trace.push(roundingTrace({
      code: `rounding.period-wage-tax.${segmentName}`,
      definition: periodTaxRounding,
      ratio: { numerator: annualTaxAfterCredits, denominator: segment.factor },
      rounded: segmentWageTax,
    }))
    trace.push({
      code: `result.period-values.${segmentName}`,
      values: {
        segmentCount: decimalValue(FixedDecimal.fromInteger(BigInt(segment.count))),
        annualTableWage: decimalValue(annualTableWage),
        tablePeriodWage: moneyValue(tablePeriodWage),
        annualTaxBeforeCredits: moneyValue(annualTaxBeforeCredits),
        annualTaxAfterCredits: moneyValue(annualTaxAfterCredits),
        wageTax: moneyValue(segmentWageTax),
      },
      sourceReference: 'Rekenvoorschriften 2026 v2, §§2.2.4-2.2.5, pp.13-16; composite week/day time-period selection',
    })
    totalWageTax = totalWageTax.add(segmentWageTax.multiply(FixedDecimal.fromInteger(BigInt(segment.count))))
  }

  trace.push({
    code: 'result.composite-period-values',
    values: {
      paidWorkdays: decimalValue(FixedDecimal.fromInteger(BigInt(paidWorkdays))),
      wageTax: moneyValue(totalWageTax),
    },
    sourceReference: 'Handboek Loonheffingen 2026, §9.3.4; composite week/day table aggregation',
  })
  return { outputs: { wageTax: moneyValue(totalWageTax) }, trace }
}

export function calculateNl2026RegularWageWithholding(context: {
  readonly inputs: Readonly<Record<string, PayrollSerializedValue>>
  readonly parameters: Readonly<Record<string, PayrollTypedParameter>>
  readonly roundingDefinitions?: readonly PayrollRoundingDefinition[]
}): {
  readonly outputs: Readonly<Record<string, PayrollSerializedValue>>
  readonly trace: readonly PayrollRegisteredRuleTraceStep[]
} {
  const { inputs, parameters } = context
  const roundingDefinitions = context.roundingDefinitions
  if (!roundingDefinitions) {
    throw new PayrollEngineError('NL2026_RULE_ROUNDING_REQUIRED', 'Pinned rounding definitions are required for Dutch 2026 payroll calculation.')
  }
  const compositePeriod = requiredScope(inputs)
  const grossSalary = inputMoney(inputs, 'grossSalary')
  const taxableWage = inputMoney(inputs, 'taxableWage')
  if (grossSalary.compare(taxableWage) !== 0) unsupported('TAXABLE_WAGE_ADJUSTMENT')
  const payrollTaxCredit = inputBoolean(inputs, 'payrollTaxCredit')
  const trace: PayrollRegisteredRuleTraceStep[] = []
  trace.push({
    code: 'classification.accepted',
    values: {
      fiscalYear: decimalValue(inputDecimal(inputs, 'fiscalYear')),
      table: textValue(inputString(inputs, 'table')),
      residence: textValue(inputString(inputs, 'residence')),
      ageCategory: textValue(inputString(inputs, 'ageCategory')),
      herleiding: textValue(inputString(inputs, 'herleiding')),
      timePeriod: textValue(inputString(inputs, 'timePeriod')),
      payrollTaxCredit: booleanValue(payrollTaxCredit),
      regularWage: booleanValue(inputBoolean(inputs, 'regularWage')),
      fullPeriod: booleanValue(inputBoolean(inputs, 'fullPeriod')),
      hasSpecialSituation: booleanValue(inputBoolean(inputs, 'hasSpecialSituation')),
      incomeRelationshipCount: decimalValue(inputDecimal(inputs, 'incomeRelationshipCount')),
      grossSalary: moneyValue(grossSalary),
      taxableWage: moneyValue(taxableWage),
    },
    sourceReference: 'PAYLAB03 first compliance scope; Belastingdienst parameter appendix 2026 p.4 and Handboek 2026 §§9.3.1-9.3.4',
  })
  if (compositePeriod) {
    return calculateCompositePeriodWithholding({
      period: compositePeriod,
      taxableWage,
      parameters,
      roundingDefinitions,
      trace,
    })
  }
  const monthFactor = parameterDecimal(parameters, 'monthFactor')
  const annualTableStep = parameterDecimal(parameters, 'annualTableStep')
  const maximumAnnualTableWage = parameterDecimal(parameters, 'maximumAnnualTableWage')
  const annualizedWageRaw = taxableWage.multiply(monthFactor)
  if (annualizedWageRaw.compare(maximumAnnualTableWage) > 0) unsupported('ABOVE_LMAX')

  const annualTableRounding = roundingDefinition(roundingDefinitions, 'ANNUAL_TABLE_WAGE')
  if (!annualTableRounding.targetMultiple
    || FixedDecimal.parse(annualTableRounding.targetMultiple).compare(annualTableStep) !== 0) {
    throw new PayrollEngineError('NL2026_ROUNDING_PARAMETER_MISMATCH', 'The annual table-step parameter does not match its pinned rounding definition.')
  }
  const annualTableWage = applyPayrollRounding(annualizedWageRaw, annualTableRounding)
  trace.push(roundingTrace({
    code: 'rounding.annual-table-wage',
    definition: annualTableRounding,
    unrounded: annualizedWageRaw,
    rounded: annualTableWage,
  }))

  const x1 = calculateAnnualTaxBeforeCredits(parameters, annualTableWage, roundingDefinitions, trace)
  const generalCredit = calculateGeneralCredit(parameters, annualTableWage, payrollTaxCredit, roundingDefinitions, trace)
  const labourCredit = calculateLabourCredit(parameters, annualTableWage, payrollTaxCredit, roundingDefinitions, trace)
  const excessCredits = maximum(ZERO, generalCredit.add(labourCredit).subtract(x1))
  const appliedLabourCredit = maximum(ZERO, labourCredit.subtract(excessCredits))
  const taxRemainingAfterLabourCredit = maximum(ZERO, x1.subtract(appliedLabourCredit))
  const appliedGeneralCredit = minimum(generalCredit, taxRemainingAfterLabourCredit)
  const annualTaxAfterCreditsRaw = maximum(ZERO, x1.subtract(appliedLabourCredit).subtract(appliedGeneralCredit))
  const taxAfterCreditsRounding = roundingDefinition(roundingDefinitions, 'ANNUAL_TAX_AFTER_CREDITS')
  const annualTaxAfterCredits = maximum(ZERO, applyPayrollRounding(annualTaxAfterCreditsRaw, taxAfterCreditsRounding))
  trace.push({
    code: 'credit.application-and-cap',
    values: {
      annualTaxBeforeCredits: moneyValue(x1),
      theoreticalGeneralCredit: moneyValue(generalCredit),
      theoreticalLabourCredit: moneyValue(labourCredit),
      appliedLabourCredit: moneyValue(appliedLabourCredit),
      appliedGeneralCredit: moneyValue(appliedGeneralCredit),
      annualTaxAfterCredits: moneyValue(annualTaxAfterCredits),
    },
    sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.4, p.13; reduce ARK before AHK; X is never negative',
  })
  trace.push(roundingTrace({
    code: 'rounding.tax-after-credits',
    definition: taxAfterCreditsRounding,
    unrounded: annualTaxAfterCreditsRaw,
    rounded: annualTaxAfterCredits,
  }))

  const tablePeriodRounding = roundingDefinition(roundingDefinitions, 'PERIOD_TABLE_WAGE')
  const tablePeriodWage = applyPayrollRoundingToRatio(annualTableWage, monthFactor, tablePeriodRounding)
  trace.push(roundingTrace({
    code: 'rounding.period-table-wage',
    definition: tablePeriodRounding,
    ratio: { numerator: annualTableWage, denominator: monthFactor },
    rounded: tablePeriodWage,
  }))
  const wageTax = monthlyRounded(
    annualTaxAfterCredits,
    monthFactor,
    roundingDefinitions,
    'PERIOD_WAGE_TAX',
    'rounding.period-wage-tax',
    trace,
  )
  const monthlyGeneralCredit = monthlyRounded(
    appliedGeneralCredit,
    monthFactor,
    roundingDefinitions,
    'PERIOD_GENERAL_CREDIT',
    'rounding.period-general-credit',
    trace,
  )
  const monthlyLabourCredit = monthlyRounded(
    appliedLabourCredit,
    monthFactor,
    roundingDefinitions,
    'PERIOD_LABOUR_CREDIT',
    'rounding.period-labour-credit',
    trace,
  )
  trace.push({
    code: 'result.period-values',
    values: {
      annualTableWage: decimalValue(annualTableWage),
      tablePeriodWage: moneyValue(tablePeriodWage),
      annualTaxBeforeCredits: moneyValue(x1),
      annualTaxAfterCredits: moneyValue(annualTaxAfterCredits),
      appliedGeneralCreditMonthly: moneyValue(monthlyGeneralCredit),
      appliedLabourCreditMonthly: moneyValue(monthlyLabourCredit),
      wageTax: moneyValue(wageTax),
    },
    sourceReference: 'Rekenvoorschriften 2026 v2, §§2.2.4-2.2.5, pp.13-16; table wage is a trace value',
  })

  return {
    outputs: { wageTax: moneyValue(wageTax) },
    trace,
  }
}

export function createNl2026RegisteredRule(identity: {
  readonly implementationHash: string
  readonly parameterSetHash: string
  readonly packageId: string
  readonly packageVersion: string
  readonly component: { readonly id: string; readonly code: string; readonly version: string }
  readonly inputs: PayrollRegisteredRule['inputs']
  readonly outputs: PayrollRegisteredRule['outputs']
}): PayrollRegisteredRule {
  return {
    ruleKey: 'nl.2026.regular-wage-withholding',
    ruleVersion: '2026.1',
    implementationHash: identity.implementationHash,
    parameterSetHash: identity.parameterSetHash,
    packageId: identity.packageId,
    packageVersion: identity.packageVersion,
    allowedComponents: [identity.component],
    inputs: identity.inputs,
    outputs: identity.outputs,
    execute: calculateNl2026RegularWageWithholding,
  }
}
