import {
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
  PayrollRoundingDefinition,
  PayrollSerializedValue,
  PayrollTypedParameter,
} from '@liquid-hr/payroll-engine'
import { calculateNl2026RegularWageWithholding, createNl2026RegisteredRule } from './regular-wage/calculator'
import { NL_2026_PARAMETERS, NL_2026_PARAMETER_METADATA } from './parameters/nl-2026'
import { NL_2026_IMPLEMENTATION_SHA256, NL_2026_SOURCE_METADATA } from './source-metadata'

export const NL_2026_PACKAGE_ID = 'NL-PAYROLL-2026'
export const NL_2026_PACKAGE_VERSION = '2026.1'
export const NL_2026_EFFECTIVE_FROM = '2026-01-01'
export const NL_2026_EFFECTIVE_TO = '2026-12-31'

const ruleInputs: readonly PayrollComponentInputDefinition[] = [
  { name: 'fiscalYear', valueType: 'DECIMAL', required: true },
  { name: 'table', valueType: 'STRING', required: true },
  { name: 'residence', valueType: 'STRING', required: true },
  { name: 'ageCategory', valueType: 'STRING', required: true },
  { name: 'herleiding', valueType: 'STRING', required: true },
  { name: 'timePeriod', valueType: 'STRING', required: true },
  { name: 'payrollTaxCredit', valueType: 'BOOLEAN', required: true },
  { name: 'regularWage', valueType: 'BOOLEAN', required: true },
  { name: 'fullPeriod', valueType: 'BOOLEAN', required: true },
  { name: 'hasSpecialSituation', valueType: 'BOOLEAN', required: true },
  { name: 'incomeRelationshipCount', valueType: 'DECIMAL', required: true },
  { name: 'grossSalary', valueType: 'MONEY', required: true },
  { name: 'taxableWage', valueType: 'MONEY', required: true },
]

const wageTaxOutputs: readonly PayrollComponentOutputDefinition[] = [
  { name: 'wageTax', valueType: 'MONEY' },
]

const classifierSources = [
  { field: 'fiscalYear', code: 'NL_CLASS_FISCAL_YEAR', valueType: 'DECIMAL' },
  { field: 'table', code: 'NL_CLASS_TAX_TABLE', valueType: 'STRING' },
  { field: 'residence', code: 'NL_CLASS_RESIDENCE', valueType: 'STRING' },
  { field: 'ageCategory', code: 'NL_CLASS_AGE_CATEGORY', valueType: 'STRING' },
  { field: 'herleiding', code: 'NL_CLASS_HERLEIDING', valueType: 'STRING' },
  { field: 'timePeriod', code: 'NL_CLASS_TIME_PERIOD', valueType: 'STRING' },
  { field: 'payrollTaxCredit', code: 'NL_CLASS_PAYROLL_TAX_CREDIT', valueType: 'BOOLEAN' },
  { field: 'regularWage', code: 'NL_CLASS_REGULAR_WAGE', valueType: 'BOOLEAN' },
  { field: 'fullPeriod', code: 'NL_CLASS_FULL_PERIOD', valueType: 'BOOLEAN' },
  { field: 'hasSpecialSituation', code: 'NL_CLASS_SPECIAL_SITUATION', valueType: 'BOOLEAN' },
  { field: 'incomeRelationshipCount', code: 'NL_CLASS_IKV_COUNT', valueType: 'DECIMAL' },
] as const satisfies readonly { readonly field: string; readonly code: string; readonly valueType: PayrollSerializedValue['valueType'] }[]

const baseComponent = {
  version: NL_2026_PACKAGE_VERSION,
  effectiveFrom: NL_2026_EFFECTIVE_FROM,
  effectiveTo: NL_2026_EFFECTIVE_TO,
  ownership: { kind: 'SYSTEM' as const },
  processingScope: 'INCOME_RELATIONSHIP' as const,
  tracePolicy: 'FULL' as const,
}

function sourceComponent(
  code: string,
  outputName: string,
  valueType: PayrollSerializedValue['valueType'],
  path: readonly (string | number)[],
): PayrollComponentDefinition {
  return {
    ...baseComponent,
    id: `system:nl-2026:${code.toLowerCase()}`,
    code,
    inputs: [],
    outputs: [{ name: outputName, valueType }],
    dependencies: [],
    method: { kind: 'source', path },
  }
}

export const NL_2026_WAGE_TAX_COMPONENT_ID = 'system:nl-2026:nl-wage-tax'
export const NL_2026_WAGE_TAX_COMPONENT_CODE = 'NL_WAGE_TAX'

const sourceComponents: readonly PayrollComponentDefinition[] = [
  sourceComponent('NL_REGULAR_WAGE', 'grossSalary', 'MONEY', ['regularWage', 'grossAmount']),
  ...classifierSources.map(({ field, code, valueType }) => sourceComponent(code, field, valueType, ['regularWage', field])),
]

const regularWageComponent: PayrollComponentDefinition = {
  ...baseComponent,
  id: 'system:nl-2026:nl-taxable-wage',
  code: 'NL_TAXABLE_WAGE',
  inputs: [{ name: 'grossSalary', valueType: 'MONEY', required: true }],
  outputs: [{ name: 'taxableWage', valueType: 'MONEY' }],
  dependencies: [{ componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary', inputName: 'grossSalary' }],
  method: { kind: 'passThrough', outputs: { taxableWage: 'grossSalary' } },
}

const classifierCodeByField = new Map(classifierSources.map(({ field, code }) => [field, code]))
const wageTaxDependencies: readonly PayrollDependencyDefinition[] = [
  { componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary', inputName: 'grossSalary' },
  { componentCode: 'NL_TAXABLE_WAGE', outputName: 'taxableWage', inputName: 'taxableWage' },
  ...classifierSources.map(({ field }) => ({
    componentCode: classifierCodeByField.get(field)!,
    outputName: field,
    inputName: field,
  })),
]

const wageTaxComponent: PayrollComponentDefinition = {
  ...baseComponent,
  id: NL_2026_WAGE_TAX_COMPONENT_ID,
  code: NL_2026_WAGE_TAX_COMPONENT_CODE,
  inputs: ruleInputs,
  outputs: wageTaxOutputs,
  dependencies: wageTaxDependencies,
  parameters: NL_2026_PARAMETERS,
  method: {
    kind: 'registeredRule',
    ruleKey: 'nl.2026.regular-wage-withholding',
    ruleVersion: NL_2026_PACKAGE_VERSION,
    implementationHash: NL_2026_IMPLEMENTATION_SHA256,
    parameterSetHash: sha256(stableSerialize(NL_2026_PARAMETERS)),
  },
}

const netSalaryExpression: PayrollExpression = {
  kind: 'binary',
  operator: '-',
  left: { kind: 'output', componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary' },
  right: { kind: 'output', componentCode: 'NL_WAGE_TAX', outputName: 'wageTax' },
}

const netPayComponent: PayrollComponentDefinition = {
  ...baseComponent,
  id: 'system:nl-2026:nl-net-pay',
  code: 'NL_NET_PAY',
  inputs: [
    { name: 'grossSalary', valueType: 'MONEY', required: true },
    { name: 'wageTax', valueType: 'MONEY', required: true },
  ],
  outputs: [{ name: 'netSalary', valueType: 'MONEY' }],
  dependencies: [
    { componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary', inputName: 'grossSalary' },
    { componentCode: 'NL_WAGE_TAX', outputName: 'wageTax', inputName: 'wageTax' },
  ],
  method: { kind: 'expression', outputs: { netSalary: netSalaryExpression } },
}

export const NL_2026_SYSTEM_COMPONENTS: readonly PayrollComponentDefinition[] = Object.freeze([
  ...sourceComponents,
  regularWageComponent,
  wageTaxComponent,
  netPayComponent,
])

export const NL_2026_RESULT_COMPONENTS: readonly PayrollResultMapping[] = Object.freeze([
  { key: 'gross_salary', componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary' },
  { key: 'taxable_wage', componentCode: 'NL_TAXABLE_WAGE', outputName: 'taxableWage' },
  { key: 'wage_tax', componentCode: 'NL_WAGE_TAX', outputName: 'wageTax' },
  { key: 'net_salary', componentCode: 'NL_NET_PAY', outputName: 'netSalary' },
])

const grossSalaryOutput: PayrollExpression = { kind: 'output', componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary' }
const taxableWageOutput: PayrollExpression = { kind: 'output', componentCode: 'NL_TAXABLE_WAGE', outputName: 'taxableWage' }
const wageTaxOutput: PayrollExpression = { kind: 'output', componentCode: 'NL_WAGE_TAX', outputName: 'wageTax' }
const netSalaryOutput: PayrollExpression = { kind: 'output', componentCode: 'NL_NET_PAY', outputName: 'netSalary' }
const zeroMoney: PayrollExpression = { kind: 'literal', valueType: 'MONEY', value: '0.00' }

/** These controls check this package's selected no-deduction mapping and arithmetic reconciliation. */
export const NL_2026_CONTROLS: readonly PayrollControlDefinition[] = Object.freeze([
  {
    code: 'NL2026-CTRL-001-TAXABLE-WAGE-RECONCILIATION',
    severity: 'BLOCKING',
    expression: { kind: 'binary', operator: '=', left: taxableWageOutput, right: grossSalaryOutput },
  },
  {
    code: 'NL2026-CTRL-002-NET-PAY-RECONCILIATION',
    severity: 'BLOCKING',
    expression: {
      kind: 'binary',
      operator: '=',
      left: netSalaryOutput,
      right: { kind: 'binary', operator: '-', left: grossSalaryOutput, right: wageTaxOutput },
    },
  },
  {
    code: 'NL2026-CTRL-003-NONNEGATIVE-WAGE-TAX',
    severity: 'BLOCKING',
    expression: { kind: 'binary', operator: '>=', left: wageTaxOutput, right: zeroMoney },
  },
  {
    code: 'NL2026-CTRL-004-NONNEGATIVE-NET-PAY',
    severity: 'BLOCKING',
    expression: { kind: 'binary', operator: '>=', left: netSalaryOutput, right: zeroMoney },
  },
])

const roundingSourceReference = 'Rekenvoorschriften voor de geautomatiseerde loonadministratie 2026, januari 2026, versie 2'
const ruleSourceHash = NL_2026_SOURCE_METADATA.calculationRulesSha256

function roundingDefinition(
  stage: string,
  mode: PayrollRoundingDefinition['mode'],
  sourcePage: string,
  options: { readonly decimalPlaces?: number; readonly targetMultiple?: string } = {},
): PayrollRoundingDefinition {
  return {
    id: `nl-2026-${stage.toLowerCase().replaceAll('_', '-')}`,
    componentCode: NL_2026_WAGE_TAX_COMPONENT_CODE,
    stage,
    ruleVersion: NL_2026_PACKAGE_VERSION,
    packageId: NL_2026_PACKAGE_ID,
    packageVersion: NL_2026_PACKAGE_VERSION,
    mode,
    ...options,
    effectiveFrom: NL_2026_EFFECTIVE_FROM,
    effectiveTo: NL_2026_EFFECTIVE_TO,
    provenance: {
      sourceReference: `${roundingSourceReference}, ${sourcePage}`,
      sourceHash: ruleSourceHash,
    },
  }
}

export const NL_2026_ROUNDING_DEFINITIONS: readonly PayrollRoundingDefinition[] = Object.freeze([
  roundingDefinition('ANNUAL_TABLE_WAGE', 'ROUND_DOWN_TO_MULTIPLE', '§2.2.1 table 1a, pp.6-8', { targetMultiple: '54' }),
  roundingDefinition('ANNUAL_TAX_BEFORE_CREDITS', 'FLOOR', '§2.2.4, p.14; floor0', { decimalPlaces: 0 }),
  roundingDefinition('ANNUAL_GENERAL_CREDIT', 'CEILING', '§2.2.3.1 table 3, p.10; ceil0', { decimalPlaces: 0 }),
  roundingDefinition('ANNUAL_LABOUR_CREDIT_BUILD_1', 'ARITHMETIC', '§2.2.3.4 table 6, p.13; arithmetic rounding to 5 decimals', { decimalPlaces: 5 }),
  roundingDefinition('ANNUAL_LABOUR_CREDIT_BUILD_2', 'ARITHMETIC', '§2.2.3.4 table 6, p.13; arithmetic rounding to 5 decimals', { decimalPlaces: 5 }),
  roundingDefinition('ANNUAL_LABOUR_CREDIT_BUILD_3', 'ARITHMETIC', '§2.2.3.4 table 6, p.13; arithmetic rounding to 5 decimals', { decimalPlaces: 5 }),
  roundingDefinition('ANNUAL_LABOUR_CREDIT_TAPER', 'ARITHMETIC', '§2.2.3.4 table 6, p.13; arithmetic rounding to 5 decimals', { decimalPlaces: 5 }),
  roundingDefinition('ANNUAL_LABOUR_CREDIT', 'CEILING', '§2.2.3.4 table 6, p.13; ceil0', { decimalPlaces: 0 }),
  roundingDefinition('ANNUAL_TAX_AFTER_CREDITS', 'FLOOR', '§2.2.4, p.13; floor0', { decimalPlaces: 0 }),
  roundingDefinition('PERIOD_TABLE_WAGE', 'CEILING', '§2.2.5, p.16; ceil2', { decimalPlaces: 2 }),
  roundingDefinition('PERIOD_WAGE_TAX', 'ARITHMETIC', '§2.2.5 table 8, p.15; arithmetic rounding to 2 decimals', { decimalPlaces: 2 }),
  roundingDefinition('PERIOD_GENERAL_CREDIT', 'ARITHMETIC', '§2.2.5 table 8, p.15; arithmetic rounding to 2 decimals', { decimalPlaces: 2 }),
  roundingDefinition('PERIOD_LABOUR_CREDIT', 'ARITHMETIC', '§2.2.5 table 8, p.15; arithmetic rounding to 2 decimals', { decimalPlaces: 2 }),
])

const parameterSetHash = sha256(stableSerialize(NL_2026_PARAMETERS))
const parameterMappingHash = sha256(stableSerialize(NL_2026_PARAMETER_METADATA))
const sourceMetadata: Readonly<Record<string, string>> = Object.freeze({
  ...NL_2026_SOURCE_METADATA,
  packageEffectiveFrom: NL_2026_EFFECTIVE_FROM,
  packageEffectiveTo: NL_2026_EFFECTIVE_TO,
  parameterSetSha256: parameterSetHash,
  parameterMappingSha256: parameterMappingHash,
  implementationSha256: NL_2026_IMPLEMENTATION_SHA256,
})

const packageHashPayload = {
  packageId: NL_2026_PACKAGE_ID,
  version: NL_2026_PACKAGE_VERSION,
  effectiveFrom: NL_2026_EFFECTIVE_FROM,
  effectiveTo: NL_2026_EFFECTIVE_TO,
  implementationHash: NL_2026_IMPLEMENTATION_SHA256,
  parameters: NL_2026_PARAMETERS,
  parameterMetadata: NL_2026_PARAMETER_METADATA,
  sourceMetadata,
  components: NL_2026_SYSTEM_COMPONENTS,
  controls: NL_2026_CONTROLS,
  resultMappings: NL_2026_RESULT_COMPONENTS,
  roundingDefinitions: NL_2026_ROUNDING_DEFINITIONS,
}

export const NL_2026_PACKAGE_HASH = sha256(stableSerialize(packageHashPayload))

const ruleIdentity = {
  implementationHash: NL_2026_IMPLEMENTATION_SHA256,
  parameterSetHash,
  packageId: NL_2026_PACKAGE_ID,
  packageVersion: NL_2026_PACKAGE_VERSION,
  component: { id: wageTaxComponent.id, code: wageTaxComponent.code, version: wageTaxComponent.version },
  inputs: wageTaxComponent.inputs,
  outputs: wageTaxComponent.outputs,
}

export const NL_2026_RULE_REGISTRY: readonly PayrollRegisteredRule[] = Object.freeze([
  createNl2026RegisteredRule(ruleIdentity),
])

export const NL_2026_RULE_PACKAGE: PayrollRulePackage = Object.freeze({
  compositionId: `${NL_2026_PACKAGE_ID}:${NL_2026_PACKAGE_VERSION}`,
  metadata: {
    packageId: NL_2026_PACKAGE_ID,
    version: NL_2026_PACKAGE_VERSION,
    packageHash: NL_2026_PACKAGE_HASH,
    parameterSetHash,
    sourceMetadata,
  },
  components: NL_2026_SYSTEM_COMPONENTS,
  roundingDefinitions: NL_2026_ROUNDING_DEFINITIONS,
  controls: NL_2026_CONTROLS,
  resultMappings: NL_2026_RESULT_COMPONENTS,
})

export const NL_2026_REGISTERED_RULE_INPUTS: readonly PayrollComponentInputDefinition[] = ruleInputs
export const NL_2026_REGISTERED_RULE_OUTPUTS: readonly PayrollComponentOutputDefinition[] = wageTaxOutputs
export const NL_2026_REGISTERED_RULE_PARAMETERS: Readonly<Record<string, PayrollTypedParameter>> = NL_2026_PARAMETERS
export { calculateNl2026RegularWageWithholding }
