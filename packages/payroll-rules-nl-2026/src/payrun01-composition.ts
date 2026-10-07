import {
  sha256,
  stableSerialize,
  type PayrollComponentDefinition,
  type PayrollComponentInputDefinition,
  type PayrollExpression,
  type PayrollRoundingDefinition,
  type PayrollResultMapping,
  type PayrollRulePackage,
} from '@liquid-hr/payroll-engine'
import { NL_2026_PACKAGE_ID, NL_2026_PACKAGE_VERSION, NL_2026_RULE_PACKAGE, NL_2026_RULE_REGISTRY } from './package-definition'

export type Payrun01CompositionKind = 'KINDEROPVANG_TEST' | 'DEMO_COMPANY_TEST'

function source(
  code: string,
  outputName: string,
  valueType: PayrollComponentDefinition['outputs'][number]['valueType'],
  path: readonly (string | number)[],
): PayrollComponentDefinition {
  return {
    id: `system:payrun01:${code.toLowerCase()}`,
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

function output(componentCode: string, outputName: string): PayrollExpression {
  return { kind: 'output', componentCode, outputName }
}

const contractualSalarySource = 'CAO Kinderopvang 2025-2026, article 4.2: part-time salary is proportional to the full-time salary and contracted hours; monthly currency precision is pinned to two decimal places for this supported calculation.'
const contractualSalarySourceHash = sha256(stableSerialize({
  reference: contractualSalarySource,
  url: 'https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/aantal-uren',
}))

const contractualSalaryRounding: PayrollRoundingDefinition = {
  id: 'payrun01-contractual-monthly-salary-cents-2026.1',
  componentCode: 'PAYRUN01_CONTRACTUAL_SALARY',
  stage: 'CONTRACTUAL_MONTHLY_SALARY',
  ruleVersion: '2026.1',
  packageId: NL_2026_PACKAGE_ID,
  packageVersion: NL_2026_PACKAGE_VERSION,
  mode: 'ARITHMETIC',
  decimalPlaces: 2,
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-12-31',
  provenance: { sourceReference: contractualSalarySource, sourceHash: contractualSalarySourceHash },
}

const contractualSalaryInputs: readonly PayrollComponentInputDefinition[] = [
  { name: 'fullTimeMonthlyAmount', valueType: 'MONEY', required: true },
  { name: 'contractHoursPerWeek', valueType: 'DECIMAL', required: true },
  { name: 'fullTimeHoursPerWeek', valueType: 'DECIMAL', required: true },
]

const contractualSalaryComponent: PayrollComponentDefinition = {
  id: 'system:payrun01:contractual-salary',
  code: 'PAYRUN01_CONTRACTUAL_SALARY',
  version: '2026.1',
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-12-31',
  ownership: { kind: 'SYSTEM' },
  processingScope: 'INCOME_RELATIONSHIP',
  inputs: contractualSalaryInputs,
  outputs: [{ name: 'amount', valueType: 'MONEY' }],
  dependencies: [
    { componentCode: 'PAYRUN01_FULLTIME_MONTHLY', outputName: 'amount', inputName: 'fullTimeMonthlyAmount' },
    { componentCode: 'PAYRUN01_CONTRACT_HOURS', outputName: 'hours', inputName: 'contractHoursPerWeek' },
    { componentCode: 'PAYRUN01_FULLTIME_HOURS', outputName: 'hours', inputName: 'fullTimeHoursPerWeek' },
  ],
  method: {
    kind: 'expression',
    outputs: {
      amount: {
        kind: 'ratio',
        numerator: {
          kind: 'binary', operator: '*',
          left: { kind: 'output', componentCode: 'PAYRUN01_FULLTIME_MONTHLY', outputName: 'amount' },
          right: { kind: 'output', componentCode: 'PAYRUN01_CONTRACT_HOURS', outputName: 'hours' },
        },
        denominator: { kind: 'output', componentCode: 'PAYRUN01_FULLTIME_HOURS', outputName: 'hours' },
        roundingDefinitionId: contractualSalaryRounding.id,
      },
    },
  },
  tracePolicy: 'FULL',
}

export const PAYRUN01_RULE_REGISTRY = NL_2026_RULE_REGISTRY

function moneyComponent(
  code: string,
  outputName: string,
  inputs: readonly PayrollComponentInputDefinition[],
  dependencies: PayrollComponentDefinition['dependencies'],
  expression: PayrollExpression,
): PayrollComponentDefinition {
  return {
    id: `system:payrun01:${code.toLowerCase()}`,
    code,
    version: '2026.1',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    ownership: { kind: 'SYSTEM' },
    processingScope: 'INCOME_RELATIONSHIP',
    inputs,
    outputs: [{ name: outputName, valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
    dependencies,
    method: { kind: 'expression', outputs: { [outputName]: expression } },
    tracePolicy: 'FULL',
  }
}

function percentCost(code: string, rateCode: string): PayrollComponentDefinition {
  return moneyComponent(
    code,
    'amount',
    [
      { name: 'gross', valueType: 'MONEY', required: true },
      { name: 'rate', valueType: 'PERCENTAGE', required: true },
    ],
    [
      { componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary', inputName: 'gross' },
      { componentCode: rateCode, outputName: 'rate', inputName: 'rate' },
    ],
    { kind: 'binary', operator: '*', left: output('NL_REGULAR_WAGE', 'grossSalary'), right: output(rateCode, 'rate') },
  )
}

const valueSources = [
  source('PAYRUN01_FULLTIME_MONTHLY', 'amount', 'MONEY', ['regularWage', 'fulltimeMonthlyAmount']),
  source('PAYRUN01_CONTRACT_HOURS', 'hours', 'DECIMAL', ['regularWage', 'contractHoursPerWeek']),
  source('PAYRUN01_FULLTIME_HOURS', 'hours', 'DECIMAL', ['regularWage', 'fulltimeHoursPerWeek']),
  source('PAYRUN01_ADDITIONAL_CASH_AMOUNT', 'amount', 'MONEY', ['payrollOwned', 'additionalHoursCashAmount']),
  source('PAYRUN01_EMPLOYEE_PENSION', 'amount', 'MONEY', ['payrollOwned', 'amounts', 'employeePension']),
  source('PAYRUN01_EMPLOYER_PENSION', 'amount', 'MONEY', ['payrollOwned', 'amounts', 'employerPension']),
  source('PAYRUN01_AWF_RATE', 'rate', 'PERCENTAGE', ['payrollOwned', 'employerRates', 'awf']),
  source('PAYRUN01_AOF_RATE', 'rate', 'PERCENTAGE', ['payrollOwned', 'employerRates', 'aof']),
  source('PAYRUN01_WKO_RATE', 'rate', 'PERCENTAGE', ['payrollOwned', 'employerRates', 'wko']),
  source('PAYRUN01_WHK_RATE', 'rate', 'PERCENTAGE', ['payrollOwned', 'employerRates', 'whk']),
  source('PAYRUN01_ZVW_RATE', 'rate', 'PERCENTAGE', ['payrollOwned', 'employerRates', 'zvw']),
  source('PAYRUN01_HOLIDAY_RATE', 'rate', 'PERCENTAGE', ['payrollOwned', 'reserveRates', 'holidayAllowance']),
  source('PAYRUN01_YEAR_END_RATE', 'rate', 'PERCENTAGE', ['payrollOwned', 'reserveRates', 'yearEnd']),
  source('PAYRUN01_SOURCE_READY', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'sourceReady']),
  source('PAYRUN01_EMPLOYMENT_START_CONSISTENT', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'employmentStartConsistent']),
  source('PAYRUN01_IKV_UNAMBIGUOUS', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'ikvUnambiguous']),
  source('PAYRUN01_SALARY_CONSISTENT', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'salaryConsistent']),
  source('PAYRUN01_HOURS_CONSISTENT', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'hoursConsistent']),
  source('PAYRUN01_NO_NORMAL_HOURS_DUPLICATE', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'normalHoursNotDuplicated']),
  source('PAYRUN01_ADDITIONAL_CLASSIFIED', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'additionalHoursSupported']),
  source('PAYRUN01_SOURCE_FRESH', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'sourceFresh']),
  source('PAYRUN01_COMPOSITION_SUPPORTED', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'compositionSupported']),
  source('PAYRUN01_PENSION_RULE_READY', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'pensionRuleReady']),
  source('PAYRUN01_SOCIAL_WAGE_CAP_CLEAR', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'socialWageCapClear']),
  source('PAYRUN01_CUMULATIVE_CONTINUITY', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'cumulativeContinuity']),
  source('PAYRUN01_RESERVATION_CONTINUITY', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'reservationContinuity']),
  source('PAYRUN01_HASHES_CONSISTENT', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'hashesConsistent']),
  source('PAYRUN01_YTD_BASE', 'amount', 'MONEY', ['payrollOwned', 'cumulatives', 'grossWageBeforePeriod']),
  source('PAYRUN01_HOLIDAY_YTD_BASE', 'amount', 'MONEY', ['payrollOwned', 'cumulatives', 'holidayReserveBeforePeriod']),
  source('PAYRUN01_YEAR_END_YTD_BASE', 'amount', 'MONEY', ['payrollOwned', 'cumulatives', 'yearEndReserveBeforePeriod']),
] as const

const regularWage: PayrollComponentDefinition = {
  ...NL_2026_RULE_PACKAGE.components.find((component) => component.code === 'NL_REGULAR_WAGE')!,
  id: 'system:nl-2026:nl-regular-wage-payrun01',
  version: '2026.1-payrun01',
  inputs: [
    { name: 'contractualSalary', valueType: 'MONEY', required: true },
    { name: 'additionalCashAmount', valueType: 'MONEY', required: true },
  ],
  outputs: [{ name: 'grossSalary', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
  dependencies: [
    { componentCode: 'PAYRUN01_CONTRACTUAL_SALARY', outputName: 'amount', inputName: 'contractualSalary' },
    { componentCode: 'PAYRUN01_ADDITIONAL_CASH_AMOUNT', outputName: 'amount', inputName: 'additionalCashAmount' },
  ],
  method: {
    kind: 'expression',
    outputs: {
      grossSalary: {
        kind: 'binary', operator: '+',
        left: output('PAYRUN01_CONTRACTUAL_SALARY', 'amount'),
        right: output('PAYRUN01_ADDITIONAL_CASH_AMOUNT', 'amount'),
      },
    },
    },
  tracePolicy: 'FULL',
}

const taxableWage: PayrollComponentDefinition = {
  ...NL_2026_RULE_PACKAGE.components.find((component) => component.code === 'NL_TAXABLE_WAGE')!,
  id: 'system:nl-2026:nl-taxable-wage-payrun01',
  version: '2026.1-payrun01',
  inputs: [
    { name: 'grossSalary', valueType: 'MONEY', required: true },
    { name: 'employeePension', valueType: 'MONEY', required: true },
  ],
  outputs: [{ name: 'taxableWage', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
  dependencies: [
    { componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary', inputName: 'grossSalary' },
    { componentCode: 'PAYRUN01_EMPLOYEE_PENSION', outputName: 'amount', inputName: 'employeePension' },
  ],
  method: {
    kind: 'expression',
    outputs: {
      taxableWage: {
        kind: 'binary', operator: '-',
        left: output('NL_REGULAR_WAGE', 'grossSalary'),
        right: output('PAYRUN01_EMPLOYEE_PENSION', 'amount'),
      },
    },
  },
  tracePolicy: 'FULL',
}

const baseWageTax = NL_2026_RULE_PACKAGE.components.find((component) => component.code === 'NL_WAGE_TAX')!
const wageTax: PayrollComponentDefinition = {
  ...baseWageTax,
  dependencies: baseWageTax.dependencies.map((dependency) => dependency.inputName === 'grossSalary'
    ? { ...dependency, componentCode: 'NL_TAXABLE_WAGE', outputName: 'taxableWage' }
    : dependency),
}

const payrun01SystemComponents = NL_2026_RULE_PACKAGE.components
  .filter((component) => !['NL_REGULAR_WAGE', 'NL_TAXABLE_WAGE', 'NL_WAGE_TAX', 'NL_NET_PAY'].includes(component.code))
  .concat([regularWage, taxableWage, wageTax])

const awf = percentCost('PAYRUN01_AWF_COST', 'PAYRUN01_AWF_RATE')
const aof = percentCost('PAYRUN01_AOF_COST', 'PAYRUN01_AOF_RATE')
const wko = percentCost('PAYRUN01_WKO_COST', 'PAYRUN01_WKO_RATE')
const whk = percentCost('PAYRUN01_WHK_COST', 'PAYRUN01_WHK_RATE')
const zvw = percentCost('PAYRUN01_ZVW_COST', 'PAYRUN01_ZVW_RATE')

const employerInsuranceDependencies = [
  { componentCode: awf.code, outputName: 'amount', inputName: 'awf' },
  { componentCode: aof.code, outputName: 'amount', inputName: 'aof' },
  { componentCode: wko.code, outputName: 'amount', inputName: 'wko' },
  { componentCode: whk.code, outputName: 'amount', inputName: 'whk' },
  { componentCode: zvw.code, outputName: 'amount', inputName: 'zvw' },
] as const

const employerInsurance = moneyComponent(
  'PAYRUN01_EMPLOYER_INSURANCE',
  'amount',
  ['awf', 'aof', 'wko', 'whk', 'zvw'].map((name) => ({ name, valueType: 'MONEY' as const, required: true })),
  employerInsuranceDependencies,
  {
    kind: 'binary', operator: '+',
    left: {
      kind: 'binary', operator: '+',
      left: { kind: 'binary', operator: '+', left: output(awf.code, 'amount'), right: output(aof.code, 'amount') },
      right: { kind: 'binary', operator: '+', left: output(wko.code, 'amount'), right: output(whk.code, 'amount') },
    },
    right: output(zvw.code, 'amount'),
  },
)

const holidayReserve = moneyComponent(
  'PAYRUN01_HOLIDAY_RESERVE',
  'amount',
  [
    { name: 'gross', valueType: 'MONEY', required: true },
    { name: 'rate', valueType: 'PERCENTAGE', required: true },
  ],
  [
    { componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary', inputName: 'gross' },
    { componentCode: 'PAYRUN01_HOLIDAY_RATE', outputName: 'rate', inputName: 'rate' },
  ],
  { kind: 'binary', operator: '*', left: output('NL_REGULAR_WAGE', 'grossSalary'), right: output('PAYRUN01_HOLIDAY_RATE', 'rate') },
)

const yearEndReserve = moneyComponent(
  'PAYRUN01_YEAR_END_RESERVE',
  'amount',
  [
    { name: 'gross', valueType: 'MONEY', required: true },
    { name: 'rate', valueType: 'PERCENTAGE', required: true },
  ],
  [
    { componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary', inputName: 'gross' },
    { componentCode: 'PAYRUN01_YEAR_END_RATE', outputName: 'rate', inputName: 'rate' },
  ],
  { kind: 'binary', operator: '*', left: output('NL_REGULAR_WAGE', 'grossSalary'), right: output('PAYRUN01_YEAR_END_RATE', 'rate') },
)

const netPay: PayrollComponentDefinition = {
  id: 'system:payrun01:net-pay',
  code: 'PAYRUN01_NET_PAY',
  version: '2026.1',
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-12-31',
  ownership: { kind: 'SYSTEM' },
  processingScope: 'INCOME_RELATIONSHIP',
  inputs: [
    { name: 'gross', valueType: 'MONEY', required: true },
    { name: 'tax', valueType: 'MONEY', required: true },
    { name: 'pension', valueType: 'MONEY', required: true },
  ],
  outputs: [{ name: 'amount', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
  dependencies: [
    { componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary', inputName: 'gross' },
    { componentCode: 'NL_WAGE_TAX', outputName: 'wageTax', inputName: 'tax' },
    { componentCode: 'PAYRUN01_EMPLOYEE_PENSION', outputName: 'amount', inputName: 'pension' },
  ],
  method: {
    kind: 'expression',
    outputs: {
      amount: {
        kind: 'binary', operator: '-',
        left: { kind: 'binary', operator: '-', left: output('NL_REGULAR_WAGE', 'grossSalary'), right: output('NL_WAGE_TAX', 'wageTax') },
        right: output('PAYRUN01_EMPLOYEE_PENSION', 'amount'),
      },
    },
  },
  tracePolicy: 'FULL',
}

const cumulativeGross = moneyComponent(
  'PAYRUN01_CUMULATIVE_GROSS',
  'amount',
  [
    { name: 'openingGross', valueType: 'MONEY', required: true },
    { name: 'gross', valueType: 'MONEY', required: true },
  ],
  [
    { componentCode: 'PAYRUN01_YTD_BASE', outputName: 'amount', inputName: 'openingGross' },
    { componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary', inputName: 'gross' },
  ],
  { kind: 'binary', operator: '+', left: output('PAYRUN01_YTD_BASE', 'amount'), right: output('NL_REGULAR_WAGE', 'grossSalary') },
)

const cumulativeHolidayReserve = moneyComponent(
  'PAYRUN01_CUMULATIVE_HOLIDAY_RESERVE',
  'amount',
  [
    { name: 'openingReserve', valueType: 'MONEY', required: true },
    { name: 'periodAccrual', valueType: 'MONEY', required: true },
  ],
  [
    { componentCode: 'PAYRUN01_HOLIDAY_YTD_BASE', outputName: 'amount', inputName: 'openingReserve' },
    { componentCode: 'PAYRUN01_HOLIDAY_RESERVE', outputName: 'amount', inputName: 'periodAccrual' },
  ],
  {
    kind: 'binary', operator: '+',
    left: output('PAYRUN01_HOLIDAY_YTD_BASE', 'amount'),
    right: output('PAYRUN01_HOLIDAY_RESERVE', 'amount'),
  },
)

const cumulativeYearEndReserve = moneyComponent(
  'PAYRUN01_CUMULATIVE_YEAR_END_RESERVE',
  'amount',
  [
    { name: 'openingReserve', valueType: 'MONEY', required: true },
    { name: 'periodAccrual', valueType: 'MONEY', required: true },
  ],
  [
    { componentCode: 'PAYRUN01_YEAR_END_YTD_BASE', outputName: 'amount', inputName: 'openingReserve' },
    { componentCode: 'PAYRUN01_YEAR_END_RESERVE', outputName: 'amount', inputName: 'periodAccrual' },
  ],
  {
    kind: 'binary', operator: '+',
    left: output('PAYRUN01_YEAR_END_YTD_BASE', 'amount'),
    right: output('PAYRUN01_YEAR_END_RESERVE', 'amount'),
  },
)

const totalEmployerCost = moneyComponent(
  'PAYRUN01_TOTAL_EMPLOYER_COST',
  'amount',
  [
    { name: 'gross', valueType: 'MONEY', required: true },
    { name: 'pension', valueType: 'MONEY', required: true },
    { name: 'insurance', valueType: 'MONEY', required: true },
    { name: 'holiday', valueType: 'MONEY', required: true },
    { name: 'yearEnd', valueType: 'MONEY', required: true },
  ],
  [
    { componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary', inputName: 'gross' },
    { componentCode: 'PAYRUN01_EMPLOYER_PENSION', outputName: 'amount', inputName: 'pension' },
    { componentCode: 'PAYRUN01_EMPLOYER_INSURANCE', outputName: 'amount', inputName: 'insurance' },
    { componentCode: 'PAYRUN01_HOLIDAY_RESERVE', outputName: 'amount', inputName: 'holiday' },
    { componentCode: 'PAYRUN01_YEAR_END_RESERVE', outputName: 'amount', inputName: 'yearEnd' },
  ],
  {
    kind: 'binary', operator: '+',
    left: {
      kind: 'binary', operator: '+',
      left: { kind: 'binary', operator: '+', left: output('NL_REGULAR_WAGE', 'grossSalary'), right: output('PAYRUN01_EMPLOYER_PENSION', 'amount') },
      right: output('PAYRUN01_EMPLOYER_INSURANCE', 'amount'),
    },
    right: {
      kind: 'binary', operator: '+',
      left: output('PAYRUN01_HOLIDAY_RESERVE', 'amount'),
      right: output('PAYRUN01_YEAR_END_RESERVE', 'amount'),
    },
  },
)

const zero: PayrollExpression = { kind: 'literal', valueType: 'MONEY', value: '0.00' }
const check = (code: string, sourceCode: string): PayrollRulePackage['controls'][number] => ({
  code,
  severity: 'BLOCKING',
  expression: { kind: 'binary', operator: '=', left: output(sourceCode, 'value'), right: { kind: 'boolean', value: true } },
})

const controls = [
  ...NL_2026_RULE_PACKAGE.controls.filter((control) => ![
    'NL2026-CTRL-001-TAXABLE-WAGE-RECONCILIATION',
    'NL2026-CTRL-002-NET-PAY-RECONCILIATION',
    'NL2026-CTRL-004-NONNEGATIVE-NET-PAY',
  ].includes(control.code)),
  {
    code: 'PAYRUN01-CTRL-016-TAXABLE-WAGE-AFTER-PENSION', severity: 'BLOCKING' as const,
    expression: {
      kind: 'binary' as const, operator: '=',
      left: output('NL_TAXABLE_WAGE', 'taxableWage'),
      right: { kind: 'binary' as const, operator: '-', left: output('NL_REGULAR_WAGE', 'grossSalary'), right: output('PAYRUN01_EMPLOYEE_PENSION', 'amount') },
    },
  },
  check('PAYRUN01-CTRL-001-SOURCE-COMPLETE', 'PAYRUN01_SOURCE_READY'),
  check('PAYRUN01-CTRL-018-EMPLOYMENT-START-CONSISTENT', 'PAYRUN01_EMPLOYMENT_START_CONSISTENT'),
  check('PAYRUN01-CTRL-002-IKV-UNAMBIGUOUS', 'PAYRUN01_IKV_UNAMBIGUOUS'),
  check('PAYRUN01-CTRL-003-SALARY-CONSISTENT', 'PAYRUN01_SALARY_CONSISTENT'),
  check('PAYRUN01-CTRL-004-SCHEDULE-CONSISTENT', 'PAYRUN01_HOURS_CONSISTENT'),
  check('PAYRUN01-CTRL-005-NORMAL-HOURS-NOT-DUPLICATED', 'PAYRUN01_NO_NORMAL_HOURS_DUPLICATE'),
  check('PAYRUN01-CTRL-006-ADDITIONAL-HOURS-SUPPORTED', 'PAYRUN01_ADDITIONAL_CLASSIFIED'),
  check('PAYRUN01-CTRL-007-SOURCE-FRESH', 'PAYRUN01_SOURCE_FRESH'),
  check('PAYRUN01-CTRL-008-COMPOSITION-SUPPORTED', 'PAYRUN01_COMPOSITION_SUPPORTED'),
  check('PAYRUN01-CTRL-009-PENSION-RULE-READY', 'PAYRUN01_PENSION_RULE_READY'),
  check('PAYRUN01-CTRL-010-SOCIAL-WAGE-CAP-CLEAR', 'PAYRUN01_SOCIAL_WAGE_CAP_CLEAR'),
  check('PAYRUN01-CTRL-011-CUMULATIVE-CONTINUITY', 'PAYRUN01_CUMULATIVE_CONTINUITY'),
  check('PAYRUN01-CTRL-012-RESERVATION-CONTINUITY', 'PAYRUN01_RESERVATION_CONTINUITY'),
  check('PAYRUN01-CTRL-013-HASHES-CONSISTENT', 'PAYRUN01_HASHES_CONSISTENT'),
  {
    code: 'PAYRUN01-CTRL-014-GROSS-NONNEGATIVE', severity: 'BLOCKING' as const,
    expression: { kind: 'binary', operator: '>=', left: output('NL_REGULAR_WAGE', 'grossSalary'), right: zero },
  },
  {
    code: 'PAYRUN01-CTRL-015-NET-NONNEGATIVE', severity: 'BLOCKING' as const,
    expression: { kind: 'binary', operator: '>=', left: output('PAYRUN01_NET_PAY', 'amount'), right: zero },
  },
  {
    code: 'PAYRUN01-CTRL-017-GROSS-NET-PENSION-RECONCILIATION', severity: 'BLOCKING' as const,
    expression: {
      kind: 'binary', operator: '=',
      left: output('PAYRUN01_NET_PAY', 'amount'),
      right: {
        kind: 'binary', operator: '-',
        left: { kind: 'binary', operator: '-', left: output('NL_REGULAR_WAGE', 'grossSalary'), right: output('NL_WAGE_TAX', 'wageTax') },
        right: output('PAYRUN01_EMPLOYEE_PENSION', 'amount'),
      },
    },
  },
] as const

const resultMappings: readonly PayrollResultMapping[] = [
  ...NL_2026_RULE_PACKAGE.resultMappings.filter((row) => row.key !== 'net_salary'),
  { key: 'contractual_salary', componentCode: 'PAYRUN01_CONTRACTUAL_SALARY', outputName: 'amount' },
  { key: 'additional_cash_amount', componentCode: 'PAYRUN01_ADDITIONAL_CASH_AMOUNT', outputName: 'amount' },
  { key: 'employee_pension', componentCode: 'PAYRUN01_EMPLOYEE_PENSION', outputName: 'amount' },
  { key: 'employer_pension', componentCode: 'PAYRUN01_EMPLOYER_PENSION', outputName: 'amount' },
  { key: 'net_salary', componentCode: 'PAYRUN01_NET_PAY', outputName: 'amount' },
  { key: 'employer_insurance', componentCode: 'PAYRUN01_EMPLOYER_INSURANCE', outputName: 'amount' },
  { key: 'holiday_allowance_reserve', componentCode: 'PAYRUN01_HOLIDAY_RESERVE', outputName: 'amount' },
  { key: 'year_end_reserve', componentCode: 'PAYRUN01_YEAR_END_RESERVE', outputName: 'amount' },
  { key: 'cumulative_gross', componentCode: 'PAYRUN01_CUMULATIVE_GROSS', outputName: 'amount' },
  { key: 'cumulative_holiday_reserve', componentCode: 'PAYRUN01_CUMULATIVE_HOLIDAY_RESERVE', outputName: 'amount' },
  { key: 'cumulative_year_end_reserve', componentCode: 'PAYRUN01_CUMULATIVE_YEAR_END_RESERVE', outputName: 'amount' },
  { key: 'total_employer_cost', componentCode: 'PAYRUN01_TOTAL_EMPLOYER_COST', outputName: 'amount' },
]

const scenarioComponents: readonly PayrollComponentDefinition[] = [
  ...valueSources,
  contractualSalaryComponent,
  awf,
  aof,
  wko,
  whk,
  zvw,
  employerInsurance,
  holidayReserve,
  yearEndReserve,
  netPay,
  cumulativeGross,
  cumulativeHolidayReserve,
  cumulativeYearEndReserve,
  totalEmployerCost,
]

/**
 * Add the same NL-2026 statutory wage engine to an explicit, versioned
 * Payroll arrangement composition. Scenario differences are input/config
 * differences, never employee-name checks or a second calculator.
 */
export function createPayrun01RulePackage(kind: Payrun01CompositionKind): PayrollRulePackage {
  const compositionId = `${NL_2026_RULE_PACKAGE.compositionId}+PAYRUN01-${kind}-2026.1`
  const packageHash = sha256(stableSerialize({
    basePackageHash: NL_2026_RULE_PACKAGE.metadata?.packageHash,
    compositionId,
    kind,
    components: scenarioComponents,
    controls,
    resultMappings,
    roundingDefinitions: [...(NL_2026_RULE_PACKAGE.roundingDefinitions ?? []), contractualSalaryRounding],
  }))

  return Object.freeze({
    ...NL_2026_RULE_PACKAGE,
    compositionId,
    metadata: Object.freeze({ ...NL_2026_RULE_PACKAGE.metadata!, packageHash }),
    components: Object.freeze([...payrun01SystemComponents, ...scenarioComponents]),
    controls: Object.freeze([...controls]),
    roundingDefinitions: Object.freeze([...(NL_2026_RULE_PACKAGE.roundingDefinitions ?? []), contractualSalaryRounding]),
    resultMappings: Object.freeze([...resultMappings]),
  })
}
