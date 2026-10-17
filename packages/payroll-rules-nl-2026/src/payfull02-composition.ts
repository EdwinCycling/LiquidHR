import {
  sha256,
  stableSerialize,
  type PayrollComponentDefinition,
  type PayrollExpression,
  type PayrollRulePackage,
  type PayrollResultMapping,
  type PayrollRegisteredRule,
  type PayrollRoundingDefinition,
} from '@liquid-hr/payroll-engine'
import {
  PAYRUN01_RULE_REGISTRY,
  createPayrun01RulePackage,
  type Payrun01CompositionKind,
  type Payrun01RulePackageOptions,
} from './payrun01-composition'
import { NL_2026_PACKAGE_ID, NL_2026_PACKAGE_VERSION } from './package-definition'
import { NL_2026_PARAMETERS } from './parameters/nl-2026'
import {
  createNl2026SpecialRewardRegisteredRule,
  NL_2026_SPECIAL_REWARD_IMPLEMENTATION_SHA256,
  NL_2026_SPECIAL_REWARD_PARAMETER_SET_SHA256,
  NL_2026_SPECIAL_REWARD_PARAMETERS,
  NL_2026_SPECIAL_REWARD_TABLE_SOURCE,
  NL_2026_SPECIAL_REWARD_WITHHOLDING_ROUNDING,
} from './special-remuneration-2026'

// The engine pins one parameter-set hash per registered-rule package. PAYFULL02
// therefore gives both registered rules the same immutable merged parameter
// set; each calculation still reads only its own namespaced parameters.
const PAYFULL02_PARAMETERS = Object.freeze({ ...NL_2026_PARAMETERS, ...NL_2026_SPECIAL_REWARD_PARAMETERS })
const PAYFULL02_PARAMETER_SET_SHA256 = sha256(stableSerialize(PAYFULL02_PARAMETERS))

function output(componentCode: string, outputName: string): PayrollExpression {
  return { kind: 'output', componentCode, outputName }
}

function source(
  code: string,
  outputName: string,
  valueType: PayrollComponentDefinition['outputs'][number]['valueType'],
  path: readonly (string | number)[],
): PayrollComponentDefinition {
  return {
    id: `system:payfull02:${code.toLowerCase()}`,
    code,
    version: '2026.1',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    ownership: { kind: 'SYSTEM' },
    processingScope: 'INCOME_RELATIONSHIP',
    inputs: [],
    outputs: [{ name: outputName, valueType }],
    dependencies: [],
    method: { kind: 'source', path },
    tracePolicy: 'FULL',
  }
}

function moneyComponent(
  code: string,
  dependencies: PayrollComponentDefinition['dependencies'],
  expression: PayrollExpression,
  version = '2026.1-payfull02',
): PayrollComponentDefinition {
  return {
    id: `system:payfull02:${code.toLowerCase()}`,
    code,
    version,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    ownership: { kind: 'SYSTEM' },
    processingScope: 'INCOME_RELATIONSHIP',
    inputs: dependencies.map((dependency) => ({ name: dependency.inputName, valueType: 'MONEY' as const, required: true })),
    outputs: [{ name: 'amount', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
    dependencies,
    method: { kind: 'expression', outputs: { amount: expression } },
    tracePolicy: 'FULL',
  }
}

const add = (left: PayrollExpression, right: PayrollExpression): PayrollExpression => ({
  kind: 'binary', operator: '+', left, right,
})
const subtract = (left: PayrollExpression, right: PayrollExpression): PayrollExpression => ({
  kind: 'binary', operator: '-', left, right,
})
const zero: PayrollExpression = { kind: 'literal', valueType: 'MONEY', value: '0.00' }

const inputSources = [
  source('PAYFULL02_VARIABLE_REGULAR_WAGE', 'amount', 'MONEY', ['payrollOwned', 'amounts', 'variableRegularWage']),
  source('PAYFULL02_SPECIAL_REWARD_WAGE', 'amount', 'MONEY', ['payrollOwned', 'amounts', 'specialRewardWage']),
  source('PAYFULL02_SPECIAL_REWARD_ANNUAL_WAGE', 'amount', 'MONEY', ['payrollOwned', 'taxProfile', 'specialRewardAnnualWage']),
  source('PAYFULL02_SPECIAL_REWARD_ANNUAL_WAGE_RESOLVED', 'value', 'BOOLEAN', ['payrollOwned', 'taxProfile', 'specialRewardAnnualWageResolved']),
  source('PAYFULL02_SPECIAL_REWARD_PENSIONABLE', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'specialRewardPensionable']),
  source('PAYFULL02_SPECIAL_REWARD_HOLIDAY_RESERVEABLE', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'specialRewardIncludedInHolidayReserve']),
  source('PAYFULL02_SPECIAL_REWARD_YEAR_END_RESERVEABLE', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'specialRewardIncludedInYearEndReserve']),
  source('PAYFULL02_NET_REIMBURSEMENT', 'amount', 'MONEY', ['payrollOwned', 'amounts', 'netReimbursement']),
  source('PAYFULL02_NET_DEDUCTION', 'amount', 'MONEY', ['payrollOwned', 'amounts', 'netDeduction']),
  source('PAYFULL02_NET_CORRECTION', 'amount', 'MONEY', ['payrollOwned', 'amounts', 'netCorrection']),
  source('PAYFULL02_RECURRING_WAGE_CLASSIFIED', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'variableWageIsRegular']),
  source('PAYFULL02_REIMBURSEMENT_TAX_FREE', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'netReimbursementsTaxFree']),
  source('PAYFULL02_DEDUCTION_AUTHORIZED', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'netDeductionsAuthorized']),
  source('PAYFULL02_OPENING_TAXABLE_WAGE', 'amount', 'MONEY', ['payrollOwned', 'cumulatives', 'taxableWageBeforePeriod']),
  source('PAYFULL02_OPENING_WAGE_TAX', 'amount', 'MONEY', ['payrollOwned', 'cumulatives', 'wageTaxBeforePeriod']),
  source('PAYFULL02_OPENING_EMPLOYEE_INSURANCE_WAGE', 'amount', 'MONEY', ['payrollOwned', 'cumulatives', 'employeeInsuranceWageBeforePeriod']),
  source('PAYFULL02_OPENING_ZVW_WAGE', 'amount', 'MONEY', ['payrollOwned', 'cumulatives', 'zvwWageBeforePeriod']),
  source('PAYFULL02_ANNUAL_SOCIAL_WAGE_MAX', 'amount', 'MONEY', ['payrollOwned', 'parameters', 'annualSocialWageMaximum']),
  source('PAYFULL02_PENSION_FRANCHISE_MONTHLY', 'amount', 'MONEY', ['payrollOwned', 'pension', 'monthlyFranchise']),
  source('PAYFULL02_PENSION_MAXIMUM_MONTHLY', 'amount', 'MONEY', ['payrollOwned', 'pension', 'monthlyMaximum']),
  source('PAYFULL02_PENSION_PART_TIME_FACTOR', 'factor', 'DECIMAL', ['payrollOwned', 'pension', 'partTimeFactor']),
  source('PAYFULL02_EMPLOYEE_PENSION_RATE', 'rate', 'PERCENTAGE', ['payrollOwned', 'pension', 'employeeRate']),
  source('PAYFULL02_EMPLOYER_PENSION_RATE', 'rate', 'PERCENTAGE', ['payrollOwned', 'pension', 'employerRate']),
  source('PAYFULL02_PENSION_PLAN_ACTIVE', 'value', 'BOOLEAN', ['payrollOwned', 'pension', 'active']),
] as const

const classifiedRegularVariableWage: PayrollComponentDefinition = {
  id: 'system:payfull02:classified-regular-variable-wage',
  code: 'PAYFULL02_CLASSIFIED_REGULAR_VARIABLE_WAGE',
  version: '2026.1-payfull02',
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-12-31',
  ownership: { kind: 'SYSTEM' },
  processingScope: 'INCOME_RELATIONSHIP',
  inputs: [
    { name: 'amount', valueType: 'MONEY', required: true },
    { name: 'classifiedAsRegular', valueType: 'BOOLEAN', required: true },
  ],
  outputs: [{ name: 'amount', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
  dependencies: [
    { componentCode: 'PAYFULL02_VARIABLE_REGULAR_WAGE', outputName: 'amount', inputName: 'amount' },
    { componentCode: 'PAYFULL02_RECURRING_WAGE_CLASSIFIED', outputName: 'value', inputName: 'classifiedAsRegular' },
  ],
  method: {
    kind: 'expression',
    outputs: {
      amount: {
        kind: 'if',
        condition: output('PAYFULL02_RECURRING_WAGE_CLASSIFIED', 'value'),
        then: output('PAYFULL02_VARIABLE_REGULAR_WAGE', 'amount'),
        else: zero,
      },
    },
  },
  tracePolicy: 'FULL',
}

const grossWithRegularVariableWage: PayrollComponentDefinition = {
  id: 'system:payfull02:nl-regular-wage',
  code: 'NL_REGULAR_WAGE',
  version: '2026.1-payfull02',
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-12-31',
  ownership: { kind: 'SYSTEM' },
  processingScope: 'INCOME_RELATIONSHIP',
  inputs: [
    { name: 'contractualSalary', valueType: 'MONEY', required: true },
    { name: 'additionalCashAmount', valueType: 'MONEY', required: true },
    { name: 'variableRegularWage', valueType: 'MONEY', required: true },
  ],
  outputs: [{ name: 'grossSalary', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
  dependencies: [
    { componentCode: 'PAYRUN01_CONTRACTUAL_SALARY', outputName: 'amount', inputName: 'contractualSalary' },
    { componentCode: 'PAYRUN01_ADDITIONAL_CASH_AMOUNT', outputName: 'amount', inputName: 'additionalCashAmount' },
    { componentCode: 'PAYFULL02_CLASSIFIED_REGULAR_VARIABLE_WAGE', outputName: 'amount', inputName: 'variableRegularWage' },
  ],
  method: { kind: 'expression', outputs: { grossSalary: add(
    add(output('PAYRUN01_CONTRACTUAL_SALARY', 'amount'), output('PAYRUN01_ADDITIONAL_CASH_AMOUNT', 'amount')),
    output('PAYFULL02_CLASSIFIED_REGULAR_VARIABLE_WAGE', 'amount'),
  ) } },
  tracePolicy: 'FULL',
}

const caoExactGrossAppliedSource = source(
  'PAYFULL02_CAO_EXACT_GROSS_APPLIED',
  'value',
  'BOOLEAN',
  ['regularWage', 'caoApplied'],
)

const caoExactGrossAmountSource = source(
  'PAYFULL02_CAO_EXACT_GROSS_AMOUNT',
  'amount',
  'MONEY',
  ['regularWage', 'caoGrossAmount'],
)

function createCaoAwareRegularWageComponent(): PayrollComponentDefinition {
  const baseExpression = add(
    add(output('PAYRUN01_CONTRACTUAL_SALARY', 'amount'), output('PAYRUN01_ADDITIONAL_CASH_AMOUNT', 'amount')),
    output('PAYFULL02_CLASSIFIED_REGULAR_VARIABLE_WAGE', 'amount'),
  )
  return {
    ...grossWithRegularVariableWage,
    inputs: [
      ...grossWithRegularVariableWage.inputs,
      { name: 'caoApplied', valueType: 'BOOLEAN', required: true },
      { name: 'caoGrossAmount', valueType: 'MONEY', required: true },
    ],
    dependencies: [
      ...grossWithRegularVariableWage.dependencies,
      { componentCode: caoExactGrossAppliedSource.code, outputName: 'value', inputName: 'caoApplied' },
      { componentCode: caoExactGrossAmountSource.code, outputName: 'amount', inputName: 'caoGrossAmount' },
    ],
    method: {
      kind: 'expression',
      outputs: {
        grossSalary: {
          kind: 'if',
          condition: output(caoExactGrossAppliedSource.code, 'value'),
          then: output(caoExactGrossAmountSource.code, 'amount'),
          else: baseExpression,
        },
      },
    },
  }
}

const specialRewardTax: PayrollComponentDefinition = {
  id: 'system:payfull02:special-reward-tax',
  code: 'PAYFULL02_SPECIAL_REWARD_TAX',
  version: '2026.1-payfull02',
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-12-31',
  ownership: { kind: 'SYSTEM' },
  processingScope: 'INCOME_RELATIONSHIP',
  inputs: [
    { name: 'specialRewardWage', valueType: 'MONEY', required: true },
    { name: 'annualWage', valueType: 'MONEY', required: true },
    { name: 'annualWageProfileResolved', valueType: 'BOOLEAN', required: true },
    { name: 'fiscalYear', valueType: 'DECIMAL', required: true },
    { name: 'table', valueType: 'STRING', required: true },
    { name: 'residence', valueType: 'STRING', required: true },
    { name: 'ageCategory', valueType: 'STRING', required: true },
    { name: 'payrollTaxCredit', valueType: 'BOOLEAN', required: true },
  ],
  outputs: [
    { name: 'withholding', valueType: 'MONEY', rounding: { scale: 2, mode: 'DOWN' } },
    { name: 'effectiveRatePercent', valueType: 'PERCENTAGE' },
    { name: 'profileSupported', valueType: 'BOOLEAN' },
  ],
  dependencies: [
    { componentCode: 'PAYFULL02_SPECIAL_REWARD_WAGE', outputName: 'amount', inputName: 'specialRewardWage' },
    { componentCode: 'PAYFULL02_SPECIAL_REWARD_ANNUAL_WAGE', outputName: 'amount', inputName: 'annualWage' },
    { componentCode: 'PAYFULL02_SPECIAL_REWARD_ANNUAL_WAGE_RESOLVED', outputName: 'value', inputName: 'annualWageProfileResolved' },
    { componentCode: 'NL_CLASS_FISCAL_YEAR', outputName: 'fiscalYear', inputName: 'fiscalYear' },
    { componentCode: 'NL_CLASS_TAX_TABLE', outputName: 'table', inputName: 'table' },
    { componentCode: 'NL_CLASS_RESIDENCE', outputName: 'residence', inputName: 'residence' },
    { componentCode: 'NL_CLASS_AGE_CATEGORY', outputName: 'ageCategory', inputName: 'ageCategory' },
    { componentCode: 'NL_CLASS_PAYROLL_TAX_CREDIT', outputName: 'payrollTaxCredit', inputName: 'payrollTaxCredit' },
  ],
  parameters: PAYFULL02_PARAMETERS,
  method: {
    kind: 'registeredRule',
    ruleKey: 'nl.2026.special-remuneration-withholding',
    ruleVersion: '2026.1',
    implementationHash: NL_2026_SPECIAL_REWARD_IMPLEMENTATION_SHA256,
    parameterSetHash: PAYFULL02_PARAMETER_SET_SHA256,
  },
  tracePolicy: 'FULL',
}

const grossIncludingSpecialReward = moneyComponent('PAYFULL02_GROSS_WAGE', [
  { componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary', inputName: 'regularGross' },
  { componentCode: 'PAYFULL02_SPECIAL_REWARD_WAGE', outputName: 'amount', inputName: 'specialReward' },
], add(output('NL_REGULAR_WAGE', 'grossSalary'), output('PAYFULL02_SPECIAL_REWARD_WAGE', 'amount')))

const taxableWageIncludingSpecialReward = moneyComponent('PAYFULL02_TAXABLE_WAGE', [
  { componentCode: 'NL_TAXABLE_WAGE', outputName: 'taxableWage', inputName: 'regularTaxableWage' },
  { componentCode: 'PAYFULL02_SPECIAL_REWARD_WAGE', outputName: 'amount', inputName: 'specialReward' },
], add(output('NL_TAXABLE_WAGE', 'taxableWage'), output('PAYFULL02_SPECIAL_REWARD_WAGE', 'amount')))

const wageTaxIncludingSpecialReward = moneyComponent('PAYFULL02_TOTAL_WAGE_TAX', [
  { componentCode: 'NL_WAGE_TAX', outputName: 'wageTax', inputName: 'regularWageTax' },
  { componentCode: 'PAYFULL02_SPECIAL_REWARD_TAX', outputName: 'withholding', inputName: 'specialRewardTax' },
], add(output('NL_WAGE_TAX', 'wageTax'), output('PAYFULL02_SPECIAL_REWARD_TAX', 'withholding')))

const netPayAfterOtherItems = moneyComponent('PAYFULL02_NET_PAY', [
  { componentCode: 'PAYRUN01_NET_PAY', outputName: 'amount', inputName: 'netBeforeOtherItems' },
  { componentCode: 'PAYFULL02_SPECIAL_REWARD_WAGE', outputName: 'amount', inputName: 'specialReward' },
  { componentCode: 'PAYFULL02_SPECIAL_REWARD_TAX', outputName: 'withholding', inputName: 'specialRewardTax' },
  { componentCode: 'PAYFULL02_NET_REIMBURSEMENT', outputName: 'amount', inputName: 'reimbursement' },
  { componentCode: 'PAYFULL02_NET_DEDUCTION', outputName: 'amount', inputName: 'deduction' },
  { componentCode: 'PAYFULL02_NET_CORRECTION', outputName: 'amount', inputName: 'correction' },
], add(subtract(
  add(subtract(
    add(output('PAYRUN01_NET_PAY', 'amount'), output('PAYFULL02_SPECIAL_REWARD_WAGE', 'amount')),
    output('PAYFULL02_SPECIAL_REWARD_TAX', 'withholding'),
  ), output('PAYFULL02_NET_REIMBURSEMENT', 'amount')),
  output('PAYFULL02_NET_DEDUCTION', 'amount'),
), output('PAYFULL02_NET_CORRECTION', 'amount')))

const employerCostWithReimbursements = moneyComponent('PAYFULL02_TOTAL_EMPLOYER_COST', [
  { componentCode: 'PAYRUN01_TOTAL_EMPLOYER_COST', outputName: 'amount', inputName: 'existingEmployerCost' },
  { componentCode: 'PAYFULL02_SPECIAL_REWARD_WAGE', outputName: 'amount', inputName: 'specialReward' },
  { componentCode: 'PAYFULL02_NET_REIMBURSEMENT', outputName: 'amount', inputName: 'netReimbursement' },
  { componentCode: 'PAYFULL02_NET_CORRECTION', outputName: 'amount', inputName: 'netCorrection' },
], add(add(add(output('PAYRUN01_TOTAL_EMPLOYER_COST', 'amount'), output('PAYFULL02_SPECIAL_REWARD_WAGE', 'amount')),
  output('PAYFULL02_NET_REIMBURSEMENT', 'amount')), output('PAYFULL02_NET_CORRECTION', 'amount')))

function specialRewardReserveComponent(
  code: 'PAYRUN01_HOLIDAY_RESERVE' | 'PAYRUN01_YEAR_END_RESERVE',
  reserveableSource: 'PAYFULL02_SPECIAL_REWARD_HOLIDAY_RESERVEABLE' | 'PAYFULL02_SPECIAL_REWARD_YEAR_END_RESERVEABLE',
  rateSource: 'PAYRUN01_HOLIDAY_RATE' | 'PAYRUN01_YEAR_END_RATE',
): PayrollComponentDefinition {
  const reserveableOutput = output(reserveableSource, 'value')
  const specialRewardOutput = output('PAYFULL02_SPECIAL_REWARD_WAGE', 'amount')
  const regularGrossOutput = output('NL_REGULAR_WAGE', 'grossSalary')
  const rateOutput = output(rateSource, 'rate')
  return {
    id: `system:payfull02:${code.toLowerCase()}`,
    code,
    version: '2026.1-payfull02',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    ownership: { kind: 'SYSTEM' },
    processingScope: 'INCOME_RELATIONSHIP',
    inputs: [
      { name: 'regularGross', valueType: 'MONEY', required: true },
      { name: 'specialReward', valueType: 'MONEY', required: true },
      { name: 'specialRewardReserveable', valueType: 'BOOLEAN', required: true },
      { name: 'rate', valueType: 'PERCENTAGE', required: true },
    ],
    outputs: [{ name: 'amount', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
    dependencies: [
      { componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary', inputName: 'regularGross' },
      { componentCode: 'PAYFULL02_SPECIAL_REWARD_WAGE', outputName: 'amount', inputName: 'specialReward' },
      { componentCode: reserveableSource, outputName: 'value', inputName: 'specialRewardReserveable' },
      { componentCode: rateSource, outputName: 'rate', inputName: 'rate' },
    ],
    method: { kind: 'expression', outputs: { amount: {
      kind: 'binary', operator: '*',
      left: add(regularGrossOutput, {
        kind: 'if', condition: reserveableOutput, then: specialRewardOutput, else: zero,
      }),
      right: rateOutput,
    } } },
    tracePolicy: 'FULL',
  }
}

const specialRewardHolidayReserve = specialRewardReserveComponent(
  'PAYRUN01_HOLIDAY_RESERVE', 'PAYFULL02_SPECIAL_REWARD_HOLIDAY_RESERVEABLE', 'PAYRUN01_HOLIDAY_RATE',
)
const specialRewardYearEndReserve = specialRewardReserveComponent(
  'PAYRUN01_YEAR_END_RESERVE', 'PAYFULL02_SPECIAL_REWARD_YEAR_END_RESERVEABLE', 'PAYRUN01_YEAR_END_RATE',
)

const prePensionWageBase = moneyComponent('PAYFULL02_PRE_PENSION_WAGE_BASE', [
  { componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary', inputName: 'grossSalary' },
  { componentCode: 'PAYRUN01_EMPLOYEE_PENSION', outputName: 'amount', inputName: 'employeePension' },
], subtract(output('NL_REGULAR_WAGE', 'grossSalary'), output('PAYRUN01_EMPLOYEE_PENSION', 'amount')))

const socialWageBase = moneyComponent('PAYFULL02_SOCIAL_WAGE_BASE', [
  { componentCode: 'PAYFULL02_PRE_PENSION_WAGE_BASE', outputName: 'amount', inputName: 'regularSocialWage' },
  { componentCode: 'PAYFULL02_SPECIAL_REWARD_WAGE', outputName: 'amount', inputName: 'specialReward' },
], add(output('PAYFULL02_PRE_PENSION_WAGE_BASE', 'amount'), output('PAYFULL02_SPECIAL_REWARD_WAGE', 'amount')))

const pensionableBase: PayrollComponentDefinition = {
  id: 'system:payfull02:pensionable-wage',
  code: 'PAYFULL02_PENSIONABLE_WAGE',
  version: '2026.1-payfull02',
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-12-31',
  ownership: { kind: 'SYSTEM' },
  processingScope: 'INCOME_RELATIONSHIP',
  inputs: [
    { name: 'gross', valueType: 'MONEY', required: true },
    { name: 'franchise', valueType: 'MONEY', required: true },
    { name: 'maximum', valueType: 'MONEY', required: true },
    { name: 'partTimeFactor', valueType: 'DECIMAL', required: true },
  ],
  outputs: [{ name: 'amount', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
  dependencies: [
    { componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary', inputName: 'gross' },
    { componentCode: 'PAYFULL02_PENSION_FRANCHISE_MONTHLY', outputName: 'amount', inputName: 'franchise' },
    { componentCode: 'PAYFULL02_PENSION_MAXIMUM_MONTHLY', outputName: 'amount', inputName: 'maximum' },
    { componentCode: 'PAYFULL02_PENSION_PART_TIME_FACTOR', outputName: 'factor', inputName: 'partTimeFactor' },
  ],
  method: { kind: 'expression', outputs: { amount: {
    kind: 'call', operator: 'MIN', arguments: [
      { kind: 'call', operator: 'MAX', arguments: [zero, subtract(
        output('NL_REGULAR_WAGE', 'grossSalary'),
        { kind: 'binary', operator: '*', left: output('PAYFULL02_PENSION_FRANCHISE_MONTHLY', 'amount'), right: output('PAYFULL02_PENSION_PART_TIME_FACTOR', 'factor') },
      )] },
      { kind: 'call', operator: 'MAX', arguments: [zero, subtract(
        { kind: 'binary', operator: '*', left: output('PAYFULL02_PENSION_MAXIMUM_MONTHLY', 'amount'), right: output('PAYFULL02_PENSION_PART_TIME_FACTOR', 'factor') },
        { kind: 'binary', operator: '*', left: output('PAYFULL02_PENSION_FRANCHISE_MONTHLY', 'amount'), right: output('PAYFULL02_PENSION_PART_TIME_FACTOR', 'factor') },
      )] },
    ],
  } } },
  tracePolicy: 'FULL',
}

function pensionContribution(code: 'PAYRUN01_EMPLOYEE_PENSION' | 'PAYRUN01_EMPLOYER_PENSION', rateCode: string): PayrollComponentDefinition {
  return {
    id: `system:payfull02:${code.toLowerCase()}`,
    code,
    version: '2026.1-payfull02',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    ownership: { kind: 'SYSTEM' },
    processingScope: 'INCOME_RELATIONSHIP',
    inputs: [
      { name: 'pensionableWage', valueType: 'MONEY', required: true },
      { name: 'rate', valueType: 'PERCENTAGE', required: true },
    ],
    outputs: [{ name: 'amount', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
    dependencies: [
      { componentCode: 'PAYFULL02_PENSIONABLE_WAGE', outputName: 'amount', inputName: 'pensionableWage' },
      { componentCode: rateCode, outputName: 'rate', inputName: 'rate' },
    ],
    method: { kind: 'expression', outputs: { amount: {
      kind: 'binary', operator: '*', left: output('PAYFULL02_PENSIONABLE_WAGE', 'amount'), right: output(rateCode, 'rate'),
    } } },
    tracePolicy: 'FULL',
  }
}

const employeePension = pensionContribution('PAYRUN01_EMPLOYEE_PENSION', 'PAYFULL02_EMPLOYEE_PENSION_RATE')
const employerPension = pensionContribution('PAYRUN01_EMPLOYER_PENSION', 'PAYFULL02_EMPLOYER_PENSION_RATE')

const taxableWageBase = moneyComponent('PAYRUN01_WAGE_TAX_BASE', [
  { componentCode: 'PAYFULL02_PRE_PENSION_WAGE_BASE', outputName: 'amount', inputName: 'prePensionWageBase' },
], output('PAYFULL02_PRE_PENSION_WAGE_BASE', 'amount'))

function cappedSocialWageBase(
  code: 'PAYRUN01_EMPLOYEE_INSURANCE_BASE' | 'PAYRUN01_ZVW_BASE',
  openingComponentCode: 'PAYFULL02_OPENING_EMPLOYEE_INSURANCE_WAGE' | 'PAYFULL02_OPENING_ZVW_WAGE',
): readonly [PayrollComponentDefinition, PayrollComponentDefinition] {
  const openingInput = code === 'PAYRUN01_EMPLOYEE_INSURANCE_BASE' ? 'openingInsuranceWage' : 'openingZvwWage'
  const capRemaining = code === 'PAYRUN01_EMPLOYEE_INSURANCE_BASE'
    ? 'PAYFULL02_EMPLOYEE_INSURANCE_CAP_REMAINING'
    : 'PAYFULL02_ZVW_CAP_REMAINING'
  const remaining = moneyComponent(capRemaining, [
    { componentCode: 'PAYFULL02_ANNUAL_SOCIAL_WAGE_MAX', outputName: 'amount', inputName: 'annualMaximum' },
    { componentCode: openingComponentCode, outputName: 'amount', inputName: openingInput },
  ], {
    kind: 'call', operator: 'MAX', arguments: [zero,
      subtract(output('PAYFULL02_ANNUAL_SOCIAL_WAGE_MAX', 'amount'), output(openingComponentCode, 'amount'))],
  })
  const base = moneyComponent(code, [
    { componentCode: 'PAYFULL02_SOCIAL_WAGE_BASE', outputName: 'amount', inputName: 'socialWageBase' },
    { componentCode: capRemaining, outputName: 'amount', inputName: 'remainingAnnualMaximum' },
  ], {
    kind: 'call', operator: 'MIN', arguments: [
      output('PAYFULL02_SOCIAL_WAGE_BASE', 'amount'),
      output(capRemaining, 'amount'),
    ],
  })
  return [remaining, { ...base, id: `system:payfull02:${code.toLowerCase()}`, version: '2026.1-payfull02' }]
}

const [employeeInsuranceCapRemaining, employeeInsuranceBase] = cappedSocialWageBase(
  'PAYRUN01_EMPLOYEE_INSURANCE_BASE', 'PAYFULL02_OPENING_EMPLOYEE_INSURANCE_WAGE',
)
const [zvwCapRemaining, zvwBase] = cappedSocialWageBase('PAYRUN01_ZVW_BASE', 'PAYFULL02_OPENING_ZVW_WAGE')

const cumulativeTaxableWage = moneyComponent('PAYFULL02_CUMULATIVE_TAXABLE_WAGE', [
  { componentCode: 'PAYFULL02_OPENING_TAXABLE_WAGE', outputName: 'amount', inputName: 'openingTaxableWage' },
  { componentCode: 'PAYFULL02_TAXABLE_WAGE', outputName: 'amount', inputName: 'periodTaxableWage' },
], add(output('PAYFULL02_OPENING_TAXABLE_WAGE', 'amount'), output('PAYFULL02_TAXABLE_WAGE', 'amount')))

const cumulativeGrossWage = moneyComponent('PAYFULL02_CUMULATIVE_GROSS_WAGE', [
  { componentCode: 'PAYRUN01_YTD_BASE', outputName: 'amount', inputName: 'openingGrossWage' },
  { componentCode: 'PAYFULL02_GROSS_WAGE', outputName: 'amount', inputName: 'periodGrossWage' },
], add(output('PAYRUN01_YTD_BASE', 'amount'), output('PAYFULL02_GROSS_WAGE', 'amount')))

const cumulativeWageTax = moneyComponent('PAYFULL02_CUMULATIVE_WAGE_TAX', [
  { componentCode: 'PAYFULL02_OPENING_WAGE_TAX', outputName: 'amount', inputName: 'openingWageTax' },
  { componentCode: 'PAYFULL02_TOTAL_WAGE_TAX', outputName: 'amount', inputName: 'periodWageTax' },
], add(output('PAYFULL02_OPENING_WAGE_TAX', 'amount'), output('PAYFULL02_TOTAL_WAGE_TAX', 'amount')))

const cumulativeEmployeeInsuranceWage = moneyComponent('PAYFULL02_CUMULATIVE_EMPLOYEE_INSURANCE_WAGE', [
  { componentCode: 'PAYFULL02_OPENING_EMPLOYEE_INSURANCE_WAGE', outputName: 'amount', inputName: 'openingInsuranceWage' },
  { componentCode: 'PAYRUN01_EMPLOYEE_INSURANCE_BASE', outputName: 'amount', inputName: 'periodInsuranceWage' },
], add(output('PAYFULL02_OPENING_EMPLOYEE_INSURANCE_WAGE', 'amount'), output('PAYRUN01_EMPLOYEE_INSURANCE_BASE', 'amount')))

const cumulativeZvwWage = moneyComponent('PAYFULL02_CUMULATIVE_ZVW_WAGE', [
  { componentCode: 'PAYFULL02_OPENING_ZVW_WAGE', outputName: 'amount', inputName: 'openingZvwWage' },
  { componentCode: 'PAYRUN01_ZVW_BASE', outputName: 'amount', inputName: 'periodZvwWage' },
], add(output('PAYFULL02_OPENING_ZVW_WAGE', 'amount'), output('PAYRUN01_ZVW_BASE', 'amount')))

const controls: PayrollRulePackage['controls'] = [
  {
    code: 'PAYFULL02-CTRL-001-REGULAR-VARIABLE-WAGE-CLASSIFIED',
    severity: 'BLOCKING',
    expression: { kind: 'binary', operator: '=', left: output('PAYFULL02_RECURRING_WAGE_CLASSIFIED', 'value'), right: { kind: 'boolean', value: true } },
  },
  {
    code: 'PAYFULL02-CTRL-002-SPECIAL-REWARD-PROFILE-READY',
    severity: 'BLOCKING',
    expression: { kind: 'binary', operator: 'OR',
      left: { kind: 'binary', operator: '=', left: output('PAYFULL02_SPECIAL_REWARD_WAGE', 'amount'), right: zero },
      right: { kind: 'binary', operator: '=', left: output('PAYFULL02_SPECIAL_REWARD_TAX', 'profileSupported'), right: { kind: 'boolean', value: true } },
    },
  },
  {
    code: 'PAYFULL02-CTRL-012-PENSIONABLE-SPECIAL-REWARD-UNSUPPORTED',
    severity: 'BLOCKING',
    expression: { kind: 'binary', operator: 'OR',
      left: { kind: 'binary', operator: '=', left: output('PAYFULL02_SPECIAL_REWARD_WAGE', 'amount'), right: zero },
      right: { kind: 'binary', operator: '=', left: output('PAYFULL02_SPECIAL_REWARD_PENSIONABLE', 'value'), right: { kind: 'boolean', value: false } },
    },
  },
  {
    code: 'PAYFULL02-CTRL-003-NET-REIMBURSEMENT-TAX-TREATMENT',
    severity: 'BLOCKING',
    expression: { kind: 'binary', operator: '=', left: output('PAYFULL02_REIMBURSEMENT_TAX_FREE', 'value'), right: { kind: 'boolean', value: true } },
  },
  {
    code: 'PAYFULL02-CTRL-004-NET-DEDUCTION-AUTHORIZED',
    severity: 'BLOCKING',
    expression: { kind: 'binary', operator: '=', left: output('PAYFULL02_DEDUCTION_AUTHORIZED', 'value'), right: { kind: 'boolean', value: true } },
  },
  {
    code: 'PAYFULL02-CTRL-005-NET-NONNEGATIVE',
    severity: 'BLOCKING',
    expression: { kind: 'binary', operator: '>=', left: output('PAYFULL02_NET_PAY', 'amount'), right: zero },
  },
  {
    code: 'PAYFULL02-CTRL-006-2026-SOCIAL-WAGE-MAXIMUM',
    severity: 'BLOCKING',
    expression: { kind: 'binary', operator: '=', left: output('PAYFULL02_ANNUAL_SOCIAL_WAGE_MAX', 'amount'), right: { kind: 'literal', valueType: 'MONEY', value: '79409.00' } },
  },
  {
    code: 'PAYFULL02-CTRL-007-EMPLOYEE-INSURANCE-OPENING-IN-RANGE',
    severity: 'BLOCKING',
    expression: { kind: 'binary', operator: 'AND',
      left: { kind: 'binary', operator: '>=', left: output('PAYFULL02_OPENING_EMPLOYEE_INSURANCE_WAGE', 'amount'), right: zero },
      right: { kind: 'binary', operator: '<=', left: output('PAYFULL02_OPENING_EMPLOYEE_INSURANCE_WAGE', 'amount'), right: output('PAYFULL02_ANNUAL_SOCIAL_WAGE_MAX', 'amount') } },
  },
  {
    code: 'PAYFULL02-CTRL-008-ZVW-OPENING-IN-RANGE',
    severity: 'BLOCKING',
    expression: { kind: 'binary', operator: 'AND',
      left: { kind: 'binary', operator: '>=', left: output('PAYFULL02_OPENING_ZVW_WAGE', 'amount'), right: zero },
      right: { kind: 'binary', operator: '<=', left: output('PAYFULL02_OPENING_ZVW_WAGE', 'amount'), right: output('PAYFULL02_ANNUAL_SOCIAL_WAGE_MAX', 'amount') } },
  },
  {
    code: 'PAYFULL02-CTRL-009-EMPLOYEE-PENSION-WITHIN-GROSS',
    severity: 'BLOCKING',
    expression: { kind: 'binary', operator: '>=', left: output('NL_REGULAR_WAGE', 'grossSalary'), right: output('PAYRUN01_EMPLOYEE_PENSION', 'amount') },
  },
  {
    code: 'PAYFULL02-CTRL-010-PENSION-PLAN-ACTIVE',
    severity: 'BLOCKING',
    expression: { kind: 'binary', operator: '=', left: output('PAYFULL02_PENSION_PLAN_ACTIVE', 'value'), right: { kind: 'boolean', value: true } },
  },
  {
    code: 'PAYFULL02-CTRL-011-PENSION-SHARES-NONNEGATIVE',
    severity: 'BLOCKING',
    expression: { kind: 'binary', operator: 'AND',
      left: { kind: 'binary', operator: '>=', left: output('PAYFULL02_EMPLOYEE_PENSION_RATE', 'rate'), right: { kind: 'literal', valueType: 'PERCENTAGE', value: '0.00' } },
      right: { kind: 'binary', operator: '>=', left: output('PAYFULL02_EMPLOYER_PENSION_RATE', 'rate'), right: { kind: 'literal', valueType: 'PERCENTAGE', value: '0.00' } } },
  },
  {
    code: 'PAYFULL02-CTRL-013-PENSION-PART-TIME-FACTOR-IN-RANGE',
    severity: 'BLOCKING',
    expression: { kind: 'binary', operator: 'AND',
      left: { kind: 'binary', operator: '>', left: output('PAYFULL02_PENSION_PART_TIME_FACTOR', 'factor'), right: { kind: 'literal', valueType: 'DECIMAL', value: '0' } },
      right: { kind: 'binary', operator: '<=', left: output('PAYFULL02_PENSION_PART_TIME_FACTOR', 'factor'), right: { kind: 'literal', valueType: 'DECIMAL', value: '1' } } },
  },
]

const mappings: readonly PayrollResultMapping[] = [
  { key: 'net_reimbursement', componentCode: 'PAYFULL02_NET_REIMBURSEMENT', outputName: 'amount' },
  { key: 'net_deduction', componentCode: 'PAYFULL02_NET_DEDUCTION', outputName: 'amount' },
  { key: 'net_correction', componentCode: 'PAYFULL02_NET_CORRECTION', outputName: 'amount' },
  { key: 'variable_regular_wage', componentCode: 'PAYFULL02_CLASSIFIED_REGULAR_VARIABLE_WAGE', outputName: 'amount' },
  { key: 'variable_regular_wage_source', componentCode: 'PAYFULL02_VARIABLE_REGULAR_WAGE', outputName: 'amount' },
  { key: 'special_reward_wage', componentCode: 'PAYFULL02_SPECIAL_REWARD_WAGE', outputName: 'amount' },
  { key: 'special_reward_wage_tax', componentCode: 'PAYFULL02_SPECIAL_REWARD_TAX', outputName: 'withholding' },
  { key: 'special_reward_tax_rate', componentCode: 'PAYFULL02_SPECIAL_REWARD_TAX', outputName: 'effectiveRatePercent' },
  { key: 'pensionable_wage', componentCode: 'PAYFULL02_PENSIONABLE_WAGE', outputName: 'amount' },
  { key: 'taxable_wage', componentCode: 'PAYFULL02_TAXABLE_WAGE', outputName: 'amount' },
  { key: 'employee_insurance_base', componentCode: 'PAYRUN01_EMPLOYEE_INSURANCE_BASE', outputName: 'amount' },
  { key: 'zvw_base', componentCode: 'PAYRUN01_ZVW_BASE', outputName: 'amount' },
  { key: 'employer_awf', componentCode: 'PAYRUN01_AWF_COST', outputName: 'amount' },
  { key: 'employer_aof', componentCode: 'PAYRUN01_AOF_COST', outputName: 'amount' },
  { key: 'employer_wko', componentCode: 'PAYRUN01_WKO_COST', outputName: 'amount' },
  { key: 'employer_whk', componentCode: 'PAYRUN01_WHK_COST', outputName: 'amount' },
  { key: 'employer_zvw', componentCode: 'PAYRUN01_ZVW_COST', outputName: 'amount' },
  { key: 'cumulative_taxable_wage', componentCode: 'PAYFULL02_CUMULATIVE_TAXABLE_WAGE', outputName: 'amount' },
  { key: 'cumulative_gross_wage', componentCode: 'PAYFULL02_CUMULATIVE_GROSS_WAGE', outputName: 'amount' },
  { key: 'cumulative_wage_tax', componentCode: 'PAYFULL02_CUMULATIVE_WAGE_TAX', outputName: 'amount' },
  { key: 'cumulative_employee_insurance_wage', componentCode: 'PAYFULL02_CUMULATIVE_EMPLOYEE_INSURANCE_WAGE', outputName: 'amount' },
  { key: 'cumulative_zvw_wage', componentCode: 'PAYFULL02_CUMULATIVE_ZVW_WAGE', outputName: 'amount' },
]

/**
 * Adds explainable take-home pay and employer-cost rows to the existing 2026
 * graph. The separate PAYFULL02 composition id/hash leaves prior PAYRUN01
 * snapshots reproducible. Special remuneration uses the separately pinned
 * 2026 white-table withholding rule and fails closed for unsupported profiles.
 */
export function createPayfull02RulePackage(
  kind: Payrun01CompositionKind,
  options: Payrun01RulePackageOptions = {},
): PayrollRulePackage {
  const base = createPayrun01RulePackage(kind, options)
  const supportCaoExactGross = options.supportCaoExactGross === true
  const compositionId = `${base.compositionId}+PAYFULL02-${kind}-NET-EMPLOYER-2026.3${supportCaoExactGross ? '+CAO-GROSS-TOTAL-2026.1' : ''}`
  const replacedComponents = new Set([
    'NL_REGULAR_WAGE', 'PAYRUN01_WAGE_TAX_BASE', 'PAYRUN01_EMPLOYEE_INSURANCE_BASE', 'PAYRUN01_ZVW_BASE',
    'PAYRUN01_EMPLOYEE_PENSION', 'PAYRUN01_EMPLOYER_PENSION', 'PAYRUN01_HOLIDAY_RESERVE', 'PAYRUN01_YEAR_END_RESERVE',
  ])
  const baseComponents = base.components.filter((component) => !replacedComponents.has(component.code)).map((component) => {
    if (component.method.kind !== 'registeredRule') return component
    return {
      ...component,
      parameters: PAYFULL02_PARAMETERS,
      method: { ...component.method, parameterSetHash: PAYFULL02_PARAMETER_SET_SHA256 },
    }
  })
  const components = [
    ...baseComponents,
    classifiedRegularVariableWage,
    supportCaoExactGross ? createCaoAwareRegularWageComponent() : grossWithRegularVariableWage,
    ...(supportCaoExactGross
      ? [...inputSources, caoExactGrossAppliedSource, caoExactGrossAmountSource]
      : inputSources),
    specialRewardTax,
    grossIncludingSpecialReward,
    taxableWageIncludingSpecialReward,
    wageTaxIncludingSpecialReward,
    pensionableBase,
    employeePension,
    employerPension,
    prePensionWageBase,
    socialWageBase,
    taxableWageBase,
    employeeInsuranceCapRemaining,
    employeeInsuranceBase,
    zvwCapRemaining,
    zvwBase,
    netPayAfterOtherItems,
    employerCostWithReimbursements,
    specialRewardHolidayReserve,
    specialRewardYearEndReserve,
    cumulativeTaxableWage,
    cumulativeGrossWage,
    cumulativeWageTax,
    cumulativeEmployeeInsuranceWage,
    cumulativeZvwWage,
  ]
  const resultMappings = [
    ...base.resultMappings.filter((mapping) => !['gross_salary', 'net_salary', 'total_employer_cost', 'taxable_wage', 'wage_tax', 'cumulative_gross_wage'].includes(mapping.key)),
    { key: 'gross_salary', componentCode: 'PAYFULL02_GROSS_WAGE', outputName: 'amount' },
    { key: 'wage_tax', componentCode: 'PAYFULL02_TOTAL_WAGE_TAX', outputName: 'amount' },
    { key: 'net_salary', componentCode: 'PAYFULL02_NET_PAY', outputName: 'amount' },
    { key: 'total_employer_cost', componentCode: 'PAYFULL02_TOTAL_EMPLOYER_COST', outputName: 'amount' },
    ...mappings,
  ] satisfies readonly PayrollResultMapping[]
  const allControls = [...base.controls, ...controls]
  const roundingDefinitions: readonly PayrollRoundingDefinition[] = [
    ...(base.roundingDefinitions ?? []),
    NL_2026_SPECIAL_REWARD_WITHHOLDING_ROUNDING,
  ]
  const packageHash = sha256(stableSerialize({
    basePackageHash: base.metadata?.packageHash,
    compositionId,
    components,
    controls: allControls,
    resultMappings,
    roundingDefinitions,
    specialRewardSource: NL_2026_SPECIAL_REWARD_TABLE_SOURCE,
    specialRewardParameters: NL_2026_SPECIAL_REWARD_PARAMETERS,
  }))
  const packageParameterSetHash = PAYFULL02_PARAMETER_SET_SHA256

  return Object.freeze({
    ...base,
    compositionId,
    metadata: Object.freeze({
      ...base.metadata!,
      packageHash,
      parameterSetHash: packageParameterSetHash,
      sourceMetadata: Object.freeze({
        ...base.metadata!.sourceMetadata,
        parameterSetSha256: packageParameterSetHash,
        specialRewardTablePublisher: NL_2026_SPECIAL_REWARD_TABLE_SOURCE.publisher,
        specialRewardTableTitle: NL_2026_SPECIAL_REWARD_TABLE_SOURCE.title,
        specialRewardTableVersion: NL_2026_SPECIAL_REWARD_TABLE_SOURCE.version,
        specialRewardTableUrl: NL_2026_SPECIAL_REWARD_TABLE_SOURCE.url,
        specialRewardTableSha256: NL_2026_SPECIAL_REWARD_TABLE_SOURCE.sha256,
        specialRewardParameterSetSha256: NL_2026_SPECIAL_REWARD_PARAMETER_SET_SHA256,
        specialRewardImplementationSha256: NL_2026_SPECIAL_REWARD_IMPLEMENTATION_SHA256,
      }),
    }),
    components: Object.freeze(components),
    controls: Object.freeze(allControls),
    resultMappings: Object.freeze(resultMappings),
    roundingDefinitions: Object.freeze(roundingDefinitions),
  })
}

export const PAYFULL02_RULE_REGISTRY: readonly PayrollRegisteredRule[] = Object.freeze([
  ...PAYRUN01_RULE_REGISTRY.map((rule) => ({ ...rule, parameterSetHash: PAYFULL02_PARAMETER_SET_SHA256 })),
  createNl2026SpecialRewardRegisteredRule({
    packageId: NL_2026_PACKAGE_ID,
    packageVersion: NL_2026_PACKAGE_VERSION,
    component: specialRewardTax,
  }),
])
