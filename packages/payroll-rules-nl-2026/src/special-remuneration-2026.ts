import {
  FixedDecimal,
  PayrollEngineError,
  applyPayrollRounding,
  sha256,
  stableSerialize,
} from '@liquid-hr/payroll-engine'
import type {
  PayrollComponentDefinition,
  PayrollRegisteredRule,
  PayrollRegisteredRuleTraceStep,
  PayrollRoundingDefinition,
  PayrollSerializedValue,
  PayrollTypedParameter,
} from '@liquid-hr/payroll-engine'

export const NL_2026_SPECIAL_REWARD_TABLE_SOURCE = Object.freeze({
  publisher: 'Belastingdienst',
  title: 'Witte tabel bijzondere beloning Nederland, Standaard (uitgave januari 2026)',
  version: '2026-01-01',
  url: 'https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_bb_nl_std_20260101.pdf',
  sha256: '2f27798b332edc4d72dfbbe9bfe28fd144cbbefb756598cb31c72424ef59aab1',
  handbookReference: 'Handboek Loonheffingen 2026, §9.3.6, pp.193-196',
})

export interface Nl2026SpecialRewardTableRow {
  readonly annualWageFloor: string
  readonly standardRateWithoutCreditPercent: string
  readonly standardRateWithCreditPercent: string
  readonly creditReconciliationPercent: string
}

/** Official lower-bound rows for the white, NL, standard, under-AOW table. */
export const NL_2026_SPECIAL_REWARD_TABLE: readonly Nl2026SpecialRewardTableRow[] = Object.freeze([
  { annualWageFloor: '0.00', standardRateWithoutCreditPercent: '35.75', standardRateWithCreditPercent: '0.00', creditReconciliationPercent: '0.00' },
  { annualWageFloor: '11358.00', standardRateWithoutCreditPercent: '35.75', standardRateWithCreditPercent: '35.75', creditReconciliationPercent: '-8.32' },
  { annualWageFloor: '12923.00', standardRateWithoutCreditPercent: '35.75', standardRateWithCreditPercent: '35.75', creditReconciliationPercent: '-31.01' },
  { annualWageFloor: '23931.00', standardRateWithoutCreditPercent: '35.75', standardRateWithCreditPercent: '35.75', creditReconciliationPercent: '-1.95' },
  { annualWageFloor: '29737.00', standardRateWithoutCreditPercent: '35.75', standardRateWithCreditPercent: '35.75', creditReconciliationPercent: '4.45' },
  { annualWageFloor: '34719.00', standardRateWithoutCreditPercent: '35.75', standardRateWithCreditPercent: '35.75', creditReconciliationPercent: '4.45' },
  { annualWageFloor: '37409.00', standardRateWithoutCreditPercent: '35.75', standardRateWithCreditPercent: '35.75', creditReconciliationPercent: '4.45' },
  { annualWageFloor: '38884.00', standardRateWithoutCreditPercent: '37.56', standardRateWithCreditPercent: '37.56', creditReconciliationPercent: '4.45' },
  { annualWageFloor: '41124.00', standardRateWithoutCreditPercent: '37.56', standardRateWithCreditPercent: '37.56', creditReconciliationPercent: '4.45' },
  { annualWageFloor: '45593.00', standardRateWithoutCreditPercent: '37.56', standardRateWithCreditPercent: '37.56', creditReconciliationPercent: '12.91' },
  { annualWageFloor: '46003.00', standardRateWithoutCreditPercent: '37.56', standardRateWithCreditPercent: '37.56', creditReconciliationPercent: '12.91' },
  { annualWageFloor: '59783.00', standardRateWithoutCreditPercent: '37.56', standardRateWithCreditPercent: '37.56', creditReconciliationPercent: '12.91' },
  { annualWageFloor: '78427.00', standardRateWithoutCreditPercent: '49.50', standardRateWithCreditPercent: '49.50', creditReconciliationPercent: '6.51' },
  { annualWageFloor: '143555.00', standardRateWithoutCreditPercent: '49.50', standardRateWithCreditPercent: '49.50', creditReconciliationPercent: '0.00' },
])

const parameterMetadata = Object.freeze(Object.fromEntries(
  NL_2026_SPECIAL_REWARD_TABLE.flatMap((row, index) => {
    const rowNumber = String(index).padStart(2, '0')
    const annualWageFloorKey = `annualWageFloor${rowNumber}`
    const standardRateWithoutCreditKey = `standardRateWithoutCreditPercent${rowNumber}`
    const standardRateWithCreditKey = `standardRateWithCreditPercent${rowNumber}`
    const reconciliationRateKey = `creditReconciliationPercent${rowNumber}`
    const sourceReference = `${NL_2026_SPECIAL_REWARD_TABLE_SOURCE.title}, jaarloon vanaf €${row.annualWageFloor}`
    return [
      [annualWageFloorKey, { officialSymbol: `yearWageFloor${rowNumber}`, valueType: 'MONEY', value: row.annualWageFloor, unit: 'EUR per year', sourceReference }],
      [standardRateWithoutCreditKey, { officialSymbol: `standardRateWithoutCredit${rowNumber}`, valueType: 'PERCENTAGE', value: row.standardRateWithoutCreditPercent, unit: 'percent', sourceReference }],
      [standardRateWithCreditKey, { officialSymbol: `standardRateWithCredit${rowNumber}`, valueType: 'PERCENTAGE', value: row.standardRateWithCreditPercent, unit: 'percent', sourceReference }],
      [reconciliationRateKey, { officialSymbol: `creditReconciliation${rowNumber}`, valueType: 'PERCENTAGE', value: row.creditReconciliationPercent, unit: 'percent', sourceReference }],
    ]
  }),
)) as Readonly<Record<string, { readonly officialSymbol: string; readonly valueType: PayrollTypedParameter['valueType']; readonly value: string; readonly unit: string; readonly sourceReference: string }>>

export const NL_2026_SPECIAL_REWARD_PARAMETER_METADATA = parameterMetadata
export const NL_2026_SPECIAL_REWARD_PARAMETERS: Readonly<Record<string, PayrollTypedParameter>> = Object.freeze(
  Object.fromEntries(Object.entries(parameterMetadata).map(([key, parameter]) => [key, {
    valueType: parameter.valueType,
    value: parameter.value,
  }])) as Record<string, PayrollTypedParameter>,
)
export const NL_2026_SPECIAL_REWARD_PARAMETER_SET_SHA256 = sha256(stableSerialize(NL_2026_SPECIAL_REWARD_PARAMETERS))

export const NL_2026_SPECIAL_REWARD_RULE_KEY = 'nl.2026.special-remuneration-withholding'
export const NL_2026_SPECIAL_REWARD_RULE_VERSION = '2026.1'
// Hashes the normalized-LF file with this literal replaced by 64 zeroes.
export const NL_2026_SPECIAL_REWARD_IMPLEMENTATION_SHA256 = 'e0f72d8109b9c76ab0f0668dc0d14ea09ebbb642d755c9fd5a920e10bf79da61'

export const NL_2026_SPECIAL_REWARD_WITHHOLDING_ROUNDING: PayrollRoundingDefinition = Object.freeze({
  id: 'nl-2026-special-reward-period-withholding-floor-cent',
  componentCode: 'PAYFULL02_SPECIAL_REWARD_TAX',
  stage: 'SPECIAL_REWARD_PERIOD_WITHHOLDING',
  ruleVersion: '2026.1-payfull02',
  packageId: 'NL-PAYROLL-2026',
  packageVersion: '2026.1',
  // FLOOR is the rounding-definition mode. The component uses DOWN for the
  // matching decimal policy; for nonnegative tax both produce floor-to-cents.
  mode: 'FLOOR',
  decimalPlaces: 2,
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-12-31',
  provenance: {
    sourceReference: `${NL_2026_SPECIAL_REWARD_TABLE_SOURCE.title}; ${NL_2026_SPECIAL_REWARD_TABLE_SOURCE.url}; footnote: round in the employee's favor to cents`,
    sourceHash: NL_2026_SPECIAL_REWARD_TABLE_SOURCE.sha256,
  },
})

export interface Nl2026SpecialRewardInput {
  readonly specialRewardWage: string
  readonly annualWage: string
  readonly annualWageProfileResolved: boolean
  readonly fiscalYear: string
  readonly table: string
  readonly residence: string
  readonly ageCategory: string
  readonly payrollTaxCredit: boolean
}

export interface Nl2026SpecialRewardResult {
  readonly annualWageThreshold: string | null
  readonly standardRatePercent: string | null
  readonly creditReconciliationPercent: string | null
  readonly effectiveRatePercent: string | null
  readonly withholding: string
  readonly profileSupported: boolean
  readonly reasonCode: string | null
  readonly trace: readonly PayrollRegisteredRuleTraceStep[]
}

function parameterDecimal(parameters: Readonly<Record<string, PayrollTypedParameter>>, name: string): FixedDecimal {
  const parameter = parameters[name]
  if (!parameter || parameter.valueType !== 'MONEY' && parameter.valueType !== 'PERCENTAGE' || typeof parameter.value !== 'string') {
    throw new PayrollEngineError('NL2026_SPECIAL_REWARD_PARAMETER_INVALID', 'A pinned special-remuneration table parameter is missing or invalid.')
  }
  try {
    return FixedDecimal.parse(parameter.value)
  } catch {
    throw new PayrollEngineError('NL2026_SPECIAL_REWARD_PARAMETER_INVALID', 'A pinned special-remuneration table parameter is invalid.')
  }
}

function serialize(valueType: PayrollSerializedValue['valueType'], value: string | boolean): PayrollSerializedValue {
  return { valueType, value }
}

function moneyValue(value: string): PayrollSerializedValue {
  return serialize('MONEY', value)
}

function percentValue(value: string | null): PayrollSerializedValue {
  return serialize('PERCENTAGE', value ?? '0.00')
}

function stringValue(value: string): PayrollSerializedValue {
  return serialize('STRING', value)
}

function tableRow(parameters: Readonly<Record<string, PayrollTypedParameter>>, annualWage: FixedDecimal): {
  readonly index: number
  readonly floor: FixedDecimal
  readonly standardRateWithoutCredit: FixedDecimal
  readonly standardRateWithCredit: FixedDecimal
  readonly reconciliationRate: FixedDecimal
} {
  let selectedIndex = 0
  for (let index = 1; index < NL_2026_SPECIAL_REWARD_TABLE.length; index += 1) {
    const floor = parameterDecimal(parameters, `annualWageFloor${String(index).padStart(2, '0')}`)
    if (annualWage.compare(floor) < 0) break
    selectedIndex = index
  }
  const row = String(selectedIndex).padStart(2, '0')
  return {
    index: selectedIndex,
    floor: parameterDecimal(parameters, `annualWageFloor${row}`),
    standardRateWithoutCredit: parameterDecimal(parameters, `standardRateWithoutCreditPercent${row}`),
    standardRateWithCredit: parameterDecimal(parameters, `standardRateWithCreditPercent${row}`),
    reconciliationRate: parameterDecimal(parameters, `creditReconciliationPercent${row}`),
  }
}

export function calculateNl2026SpecialRewardWithholding(
  input: Nl2026SpecialRewardInput,
  parameters: Readonly<Record<string, PayrollTypedParameter>> = NL_2026_SPECIAL_REWARD_PARAMETERS,
  rounding: PayrollRoundingDefinition = NL_2026_SPECIAL_REWARD_WITHHOLDING_ROUNDING,
): Nl2026SpecialRewardResult {
  let reward: FixedDecimal
  let annualWage: FixedDecimal
  try {
    reward = FixedDecimal.parse(input.specialRewardWage)
    annualWage = FixedDecimal.parse(input.annualWage)
  } catch {
    throw new PayrollEngineError('NL2026_SPECIAL_REWARD_INPUT_INVALID', 'The special reward and annual wage must be exact decimal values.')
  }
  if (reward.scale > 2 || annualWage.scale > 2) {
    throw new PayrollEngineError('NL2026_SPECIAL_REWARD_INPUT_PRECISION', 'Special reward and annual wage may have at most two decimal places.')
  }

  const profileSupported = reward.compare(FixedDecimal.fromInteger(BigInt(0))) === 0
    || (reward.compare(FixedDecimal.fromInteger(BigInt(0))) > 0
      && annualWage.compare(FixedDecimal.fromInteger(BigInt(0))) >= 0
      && input.annualWageProfileResolved
      && input.fiscalYear === '2026'
      && input.table === 'WHITE'
      && input.residence === 'NL'
      && input.ageCategory === 'UNDER_AOW')

  if (reward.compare(FixedDecimal.fromInteger(BigInt(0))) === 0) {
    return {
      annualWageThreshold: null,
      standardRatePercent: null,
      creditReconciliationPercent: null,
      effectiveRatePercent: null,
      withholding: '0.00',
      profileSupported: true,
      reasonCode: null,
      trace: [
        { code: 'special-reward-no-payment', values: { specialRewardWage: moneyValue('0.00'), withholding: moneyValue('0.00') }, sourceReference: NL_2026_SPECIAL_REWARD_TABLE_SOURCE.url },
      ],
    }
  }

  if (!profileSupported) {
    const reasonCode = reward.compare(FixedDecimal.fromInteger(BigInt(0))) < 0
      ? 'SPECIAL_REWARD_AMOUNT_INVALID'
      : !input.annualWageProfileResolved || annualWage.compare(FixedDecimal.fromInteger(BigInt(0))) < 0
        ? 'SPECIAL_REWARD_ANNUAL_WAGE_PROFILE_UNRESOLVED'
        : input.fiscalYear !== '2026' ? 'SPECIAL_REWARD_FISCAL_YEAR_UNSUPPORTED'
          : input.table !== 'WHITE' ? 'SPECIAL_REWARD_TAX_TABLE_UNSUPPORTED'
            : input.residence !== 'NL' ? 'SPECIAL_REWARD_RESIDENCE_UNSUPPORTED'
              : 'SPECIAL_REWARD_AGE_CATEGORY_UNSUPPORTED'
    return {
      annualWageThreshold: null,
      standardRatePercent: null,
      creditReconciliationPercent: null,
      effectiveRatePercent: null,
      withholding: '0.00',
      profileSupported: false,
      reasonCode,
      trace: [
        { code: 'special-reward-profile-blocked', values: {
          specialRewardWage: moneyValue(reward.toString(2)),
          annualWage: moneyValue(annualWage.toString(2)),
          reasonCode: stringValue(reasonCode),
          withholding: moneyValue('0.00'),
        }, sourceReference: NL_2026_SPECIAL_REWARD_TABLE_SOURCE.url },
      ],
    }
  }

  const selected = tableRow(parameters, annualWage)
  const selectedStandardRate = input.payrollTaxCredit ? selected.standardRateWithCredit : selected.standardRateWithoutCredit
  const appliedCreditReconciliation = input.payrollTaxCredit ? selected.reconciliationRate : FixedDecimal.fromInteger(BigInt(0))
  const effectiveRate = selectedStandardRate.add(appliedCreditReconciliation)
  if (effectiveRate.compare(FixedDecimal.fromInteger(BigInt(0))) < 0) {
    throw new PayrollEngineError('NL2026_SPECIAL_REWARD_RATE_INVALID', 'The selected published withholding rate cannot be negative.')
  }
  const unroundedWithholding = reward.multiply(effectiveRate).divideExact(FixedDecimal.fromInteger(BigInt(100)))
  const withholding = applyPayrollRounding(unroundedWithholding, rounding)
  return {
    annualWageThreshold: selected.floor.toString(2),
    standardRatePercent: selectedStandardRate.toString(2),
    creditReconciliationPercent: appliedCreditReconciliation.toString(2),
    effectiveRatePercent: effectiveRate.toString(2),
    withholding: withholding.toString(2),
    profileSupported: true,
    reasonCode: null,
    trace: [
      {
        code: 'special-reward-table-selection',
        values: {
          annualWage: moneyValue(annualWage.toString(2)),
          selectedAnnualWageThreshold: moneyValue(selected.floor.toString(2)),
          standardRatePercent: percentValue(selectedStandardRate.toString(2)),
          standardRateWithoutCreditPercent: percentValue(selected.standardRateWithoutCredit.toString(2)),
          standardRateWithCreditPercent: percentValue(selected.standardRateWithCredit.toString(2)),
          payrollTaxCreditApplied: serialize('BOOLEAN', input.payrollTaxCredit),
          creditReconciliationPercent: percentValue(appliedCreditReconciliation.toString(2)),
          effectiveRatePercent: percentValue(effectiveRate.toString(2)),
          rewardAmount: moneyValue(reward.toString(2)),
          unroundedWithholding: serialize('DECIMAL', unroundedWithholding.toString()),
          roundingMode: stringValue(rounding.mode),
          roundingScale: serialize('DECIMAL', String(rounding.decimalPlaces)),
          roundedWithholding: moneyValue(withholding.toString(2)),
          tableVersion: stringValue(NL_2026_SPECIAL_REWARD_TABLE_SOURCE.version),
          tableSha256: stringValue(NL_2026_SPECIAL_REWARD_TABLE_SOURCE.sha256),
        },
        sourceReference: `${NL_2026_SPECIAL_REWARD_TABLE_SOURCE.url}; ${NL_2026_SPECIAL_REWARD_TABLE_SOURCE.handbookReference}`,
      },
    ],
  }
}

function inputValue(
  inputs: Readonly<Record<string, PayrollSerializedValue>>,
  name: string,
  valueType: PayrollSerializedValue['valueType'],
): PayrollSerializedValue {
  const input = inputs[name]
  if (!input || input.valueType !== valueType) {
    throw new PayrollEngineError('NL2026_SPECIAL_REWARD_INPUT_INVALID', 'A required special-remuneration input is missing or has an invalid type.')
  }
  return input
}

function inputString(inputs: Readonly<Record<string, PayrollSerializedValue>>, name: string): string {
  const input = inputValue(inputs, name, 'STRING')
  if (typeof input.value !== 'string') throw new PayrollEngineError('NL2026_SPECIAL_REWARD_INPUT_INVALID', 'A special-remuneration string input is invalid.')
  return input.value
}

function inputBoolean(inputs: Readonly<Record<string, PayrollSerializedValue>>, name: string): boolean {
  const input = inputValue(inputs, name, 'BOOLEAN')
  if (typeof input.value !== 'boolean') throw new PayrollEngineError('NL2026_SPECIAL_REWARD_INPUT_INVALID', 'A special-remuneration boolean input is invalid.')
  return input.value
}

function inputYear(inputs: Readonly<Record<string, PayrollSerializedValue>>, name: string): string {
  const input = inputValue(inputs, name, 'DECIMAL')
  if (typeof input.value !== 'string') throw new PayrollEngineError('NL2026_SPECIAL_REWARD_INPUT_INVALID', 'The special-remuneration fiscal year is invalid.')
  try {
    return FixedDecimal.parse(input.value).toBigIntExact().toString()
  } catch {
    throw new PayrollEngineError('NL2026_SPECIAL_REWARD_INPUT_INVALID', 'The special-remuneration fiscal year must be a whole number.')
  }
}

function inputMoney(inputs: Readonly<Record<string, PayrollSerializedValue>>, name: string): string {
  const input = inputValue(inputs, name, 'MONEY')
  if (typeof input.value !== 'string') throw new PayrollEngineError('NL2026_SPECIAL_REWARD_INPUT_INVALID', 'A special-remuneration money input is invalid.')
  return input.value
}

export function createNl2026SpecialRewardRegisteredRule(identity: {
  readonly packageId: string
  readonly packageVersion: string
  readonly component: PayrollComponentDefinition
}): PayrollRegisteredRule {
  const implementationHash = identity.component.method.kind === 'registeredRule'
    ? identity.component.method.implementationHash
    : ''
  const parameterSetHash = identity.component.method.kind === 'registeredRule'
    ? identity.component.method.parameterSetHash
    : ''
  if (identity.component.method.kind !== 'registeredRule') {
    throw new PayrollEngineError('NL2026_SPECIAL_REWARD_COMPONENT_INVALID', 'The special-remuneration rule must be registered on a system component.')
  }
  return {
    ruleKey: identity.component.method.ruleKey,
    ruleVersion: identity.component.method.ruleVersion,
    implementationHash,
    parameterSetHash,
    packageId: identity.packageId,
    packageVersion: identity.packageVersion,
    allowedComponents: [{ id: identity.component.id, code: identity.component.code, version: identity.component.version }],
    inputs: identity.component.inputs,
    outputs: identity.component.outputs,
    execute: ({ inputs, parameters, roundingDefinitions }) => {
      if (!roundingDefinitions) throw new PayrollEngineError('NL2026_SPECIAL_REWARD_ROUNDING_REQUIRED', 'Pinned special-remuneration rounding is required.')
      const matchingRounding = roundingDefinitions.filter((definition) => definition.stage === 'SPECIAL_REWARD_PERIOD_WITHHOLDING')
      if (matchingRounding.length !== 1) throw new PayrollEngineError('NL2026_SPECIAL_REWARD_ROUNDING_REQUIRED', 'Exactly one pinned special-remuneration rounding rule is required.')
      const result = calculateNl2026SpecialRewardWithholding({
        specialRewardWage: inputMoney(inputs, 'specialRewardWage'),
        annualWage: inputMoney(inputs, 'annualWage'),
        annualWageProfileResolved: inputBoolean(inputs, 'annualWageProfileResolved'),
        fiscalYear: inputYear(inputs, 'fiscalYear'),
        table: inputString(inputs, 'table'),
        residence: inputString(inputs, 'residence'),
        ageCategory: inputString(inputs, 'ageCategory'),
        payrollTaxCredit: inputBoolean(inputs, 'payrollTaxCredit'),
      }, parameters, matchingRounding[0]!)
      return {
        outputs: {
          withholding: moneyValue(result.withholding),
          effectiveRatePercent: percentValue(result.effectiveRatePercent),
          profileSupported: serialize('BOOLEAN', result.profileSupported),
        },
        trace: result.trace,
      }
    },
  }
}
