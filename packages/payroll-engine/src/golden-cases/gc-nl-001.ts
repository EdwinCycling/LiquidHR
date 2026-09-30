import type {
  PayrollComponentDefinition,
  PayrollControlDefinition,
  PayrollExpression,
  PayrollResultMapping,
  PayrollRulePackage,
} from '../engine/types'

const EFFECTIVE_FROM = '2026-01-01'

function fixedAmountComponent(
  code: string,
  outputName: string,
  value: string,
  processingScope: PayrollComponentDefinition['processingScope'],
): PayrollComponentDefinition {
  return {
    id: `gc-nl-001-${code}`,
    code,
    version: '1.0.0',
    effectiveFrom: EFFECTIVE_FROM,
    effectiveTo: null,
    ownership: { kind: 'SYSTEM' },
    processingScope,
    inputs: [],
    outputs: [{ name: outputName, valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
    dependencies: [],
    parameters: { amount: { valueType: 'MONEY', value } },
    method: { kind: 'expression', outputs: { [outputName]: { kind: 'parameter', name: 'amount' } } },
    tracePolicy: 'FULL',
  }
}

function output(componentCode: string, outputName: string): PayrollExpression {
  return { kind: 'output', componentCode, outputName }
}

function moneyLiteral(value: string): PayrollExpression {
  return { kind: 'literal', valueType: 'MONEY', value }
}

function compare(componentCode: string, outputName: string, operator: '=' | '>=' | '>', value: string): PayrollExpression {
  return {
    kind: 'binary',
    operator,
    left: output(componentCode, outputName),
    right: moneyLiteral(value),
  }
}

const grossSalary: PayrollComponentDefinition = {
  id: 'gc-nl-001-gross-salary',
  code: 'gross_salary',
  version: '1.0.0',
  effectiveFrom: EFFECTIVE_FROM,
  effectiveTo: null,
  ownership: { kind: 'SYSTEM' },
  processingScope: 'INCOME_RELATIONSHIP',
  inputs: [],
  outputs: [{ name: 'Amount', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
  dependencies: [],
  method: { kind: 'source', path: ['compensation', 'entries', 0, 'parttimeAmount'] },
  tracePolicy: 'FULL',
}

const employeePension = fixedAmountComponent('employee_pension', 'EmployeeAmount', '125.00', 'INCOME_RELATIONSHIP')
const wageTax = fixedAmountComponent('wage_tax', 'EmployeeAmount', '700.00', 'INCOME_RELATIONSHIP')
const employerPension = fixedAmountComponent('employer_pension', 'EmployerAmount', '250.00', 'EMPLOYER')
const employerInsurance = fixedAmountComponent('employer_insurance', 'EmployerAmount', '400.00', 'EMPLOYER')
const employerZvw = fixedAmountComponent('employer_zvw', 'EmployerAmount', '260.00', 'EMPLOYER')

const netSalary: PayrollComponentDefinition = {
  id: 'gc-nl-001-net-salary',
  code: 'net_salary',
  version: '1.0.0',
  effectiveFrom: EFFECTIVE_FROM,
  effectiveTo: null,
  ownership: { kind: 'SYSTEM' },
  processingScope: 'INCOME_RELATIONSHIP',
  inputs: [
    { name: 'gross', valueType: 'MONEY', required: true },
    { name: 'employeePension', valueType: 'MONEY', required: true },
    { name: 'tax', valueType: 'MONEY', required: true },
  ],
  outputs: [{ name: 'Amount', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
  dependencies: [
    { componentCode: 'gross_salary', outputName: 'Amount', inputName: 'gross' },
    { componentCode: 'employee_pension', outputName: 'EmployeeAmount', inputName: 'employeePension' },
    { componentCode: 'wage_tax', outputName: 'EmployeeAmount', inputName: 'tax' },
  ],
  method: {
    kind: 'expression',
    outputs: {
      Amount: {
        kind: 'binary',
        operator: '-',
        left: {
          kind: 'binary',
          operator: '-',
          left: output('gross_salary', 'Amount'),
          right: output('employee_pension', 'EmployeeAmount'),
        },
        right: output('wage_tax', 'EmployeeAmount'),
      },
    },
  },
  tracePolicy: 'FULL',
}

const holidayAccrual: PayrollComponentDefinition = {
  id: 'gc-nl-001-holiday-allowance-accrual',
  code: 'holiday_allowance_accrual',
  version: '1.0.0',
  effectiveFrom: EFFECTIVE_FROM,
  effectiveTo: null,
  ownership: { kind: 'SYSTEM' },
  processingScope: 'INCOME_RELATIONSHIP',
  inputs: [{ name: 'gross', valueType: 'MONEY', required: true }],
  outputs: [{ name: 'PeriodAccrual', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
  dependencies: [{ componentCode: 'gross_salary', outputName: 'Amount', inputName: 'gross' }],
  method: {
    kind: 'expression',
    outputs: {
      PeriodAccrual: {
        kind: 'binary',
        operator: '*',
        left: output('gross_salary', 'Amount'),
        right: { kind: 'literal', valueType: 'PERCENTAGE', value: '8.00' },
      },
    },
  },
  tracePolicy: 'FULL',
}

const totalEmployerCost: PayrollComponentDefinition = {
  id: 'gc-nl-001-total-employer-cost',
  code: 'total_employer_cost',
  version: '1.0.0',
  effectiveFrom: EFFECTIVE_FROM,
  effectiveTo: null,
  ownership: { kind: 'SYSTEM' },
  processingScope: 'EMPLOYER',
  inputs: [
    { name: 'gross', valueType: 'MONEY', required: true },
    { name: 'employerPension', valueType: 'MONEY', required: true },
    { name: 'employerInsurance', valueType: 'MONEY', required: true },
    { name: 'employerZvw', valueType: 'MONEY', required: true },
  ],
  outputs: [{ name: 'Amount', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
  dependencies: [
    { componentCode: 'gross_salary', outputName: 'Amount', inputName: 'gross' },
    { componentCode: 'employer_pension', outputName: 'EmployerAmount', inputName: 'employerPension' },
    { componentCode: 'employer_insurance', outputName: 'EmployerAmount', inputName: 'employerInsurance' },
    { componentCode: 'employer_zvw', outputName: 'EmployerAmount', inputName: 'employerZvw' },
  ],
  method: { kind: 'aggregate', operation: 'SUM', inputNames: ['gross', 'employerPension', 'employerInsurance', 'employerZvw'] },
  tracePolicy: 'FULL',
}

export const GC_NL_001_RESULT_COMPONENTS: readonly PayrollResultMapping[] = Object.freeze([
  { key: 'gross_salary', componentCode: 'gross_salary', outputName: 'Amount' },
  { key: 'employee_pension', componentCode: 'employee_pension', outputName: 'EmployeeAmount' },
  { key: 'wage_tax', componentCode: 'wage_tax', outputName: 'EmployeeAmount' },
  { key: 'net_salary', componentCode: 'net_salary', outputName: 'Amount' },
  { key: 'employer_pension', componentCode: 'employer_pension', outputName: 'EmployerAmount' },
  { key: 'employer_insurance', componentCode: 'employer_insurance', outputName: 'EmployerAmount' },
  { key: 'employer_zvw', componentCode: 'employer_zvw', outputName: 'EmployerAmount' },
  { key: 'holiday_allowance_accrual', componentCode: 'holiday_allowance_accrual', outputName: 'PeriodAccrual' },
  { key: 'total_employer_cost', componentCode: 'total_employer_cost', outputName: 'Amount' },
])

const controls: readonly PayrollControlDefinition[] = Object.freeze([
  { code: 'GC1-CTRL-020', severity: 'BLOCKING', expression: compare('gross_salary', 'Amount', '=', '4000.00') },
  { code: 'GC1-CTRL-022', severity: 'BLOCKING', expression: compare('employee_pension', 'EmployeeAmount', '=', '125.00') },
  { code: 'GC1-CTRL-023', severity: 'BLOCKING', expression: compare('wage_tax', 'EmployeeAmount', '=', '700.00') },
  {
    code: 'GC1-CTRL-024',
    severity: 'BLOCKING',
    expression: {
      kind: 'binary',
      operator: '=',
      left: output('net_salary', 'Amount'),
      right: {
        kind: 'binary',
        operator: '-',
        left: {
          kind: 'binary',
          operator: '-',
          left: output('gross_salary', 'Amount'),
          right: output('employee_pension', 'EmployeeAmount'),
        },
        right: output('wage_tax', 'EmployeeAmount'),
      },
    },
  },
  { code: 'GC1-CTRL-025', severity: 'BLOCKING', expression: compare('holiday_allowance_accrual', 'PeriodAccrual', '=', '320.00') },
  { code: 'GC1-CTRL-026', severity: 'BLOCKING', expression: compare('total_employer_cost', 'Amount', '=', '4910.00') },
  { code: 'GC1-CTRL-021', severity: 'BLOCKING', expression: compare('employee_pension', 'EmployeeAmount', '>=', '0.00') },
])

export const GC_NL_001_RULE_PACKAGE: PayrollRulePackage = Object.freeze({
  compositionId: 'RPC-GC1-V1',
  components: Object.freeze([
    grossSalary,
    employeePension,
    wageTax,
    netSalary,
    employerPension,
    employerInsurance,
    employerZvw,
    holidayAccrual,
    totalEmployerCost,
  ]),
  controls,
  resultMappings: GC_NL_001_RESULT_COMPONENTS,
})
