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

export type Payrun01CompositionKind =
  | 'KINDEROPVANG_TEST'
  | 'DEMO_COMPANY_TEST'
  | 'LEGACY_COMPANY_TEST'
  | 'CUSTOMER_STANDARD'

export interface Payrun01RulePackageOptions {
  readonly pensionCalculation?: 'INCLUDED' | 'EXCLUDED'
  readonly pensionCompliance?: 'VERIFIED' | 'TEST_ONLY_UNVERIFIED'
  /**
   * Use the period-gross source for a non-full payroll period. The source
   * provider must supply an explicit, hash-bound period gross and full-period
   * marker; the package never infers a partial amount from a contract factor.
   */
  readonly supportPartialPeriods?: boolean
  /**
   * Preserve an explicitly sourced CAO period gross through the customer
   * PAYFULL02 graph. The source provider sets this only for a supported CAO
   * calculation; ordinary salaries keep the existing component composition.
   */
  readonly supportCaoExactGross?: boolean
  /** Add a source-classified fixed cash supplement to gross without changing contractual salary. */
  readonly supportClassifiedGrossSupplement?: boolean
  /** Apply a source-backed employee all-levy deduction using its VCR opening balances and cap. */
  readonly supportAllLevyDeduction?: boolean
  /** Reconcile a versioned pension total to the employee share, assigning any rounded cent remainder to the employer. */
  readonly allocatePensionRoundingRemainderToEmployer?: boolean
}

function source(
  code: string,
  outputName: string,
  valueType: PayrollComponentDefinition['outputs'][number]['valueType'],
  path: readonly (string | number)[],
  version = '2026.1',
): PayrollComponentDefinition {
  return {
    id: `system:payrun01:${code.toLowerCase()}`,
    code,
    version,
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
const additionalHoursCashSource = 'PAYRUN01 TEST scenario formula: full-time monthly salary multiplied by 12 and cash-compensated approved hours, divided by full-time weekly hours multiplied by 52.2; round the period total HALF_UP to cents.'
const additionalHoursCashSourceHash = sha256(stableSerialize({
  reference: additionalHoursCashSource,
  formula: 'fullTimeMonthlySalary * 12 * cashCompensatedHours / (fulltimeHoursPerWeek * 52.2)',
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

const contractualSalaryPartialPeriodRounding: PayrollRoundingDefinition = {
  ...contractualSalaryRounding,
  id: 'payrun01-contractual-period-salary-cents-2026.2',
  ruleVersion: '2026.2',
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

const partialPeriodSources: readonly PayrollComponentDefinition[] = [
  source('PAYRUN01_PERIOD_GROSS', 'amount', 'MONEY', ['regularWage', 'grossAmount'], '2026.2'),
  source('PAYRUN01_FULL_PERIOD', 'value', 'BOOLEAN', ['regularWage', 'fullPeriod'], '2026.2'),
]

const contractualSalaryWithPartialPeriods: PayrollComponentDefinition = {
  ...contractualSalaryComponent,
  id: 'system:payrun01:contractual-salary-period-aware',
  version: '2026.2',
  inputs: [
    ...contractualSalaryInputs,
    { name: 'periodGross', valueType: 'MONEY', required: true },
    { name: 'fullPeriod', valueType: 'BOOLEAN', required: true },
  ],
  dependencies: [
    ...contractualSalaryComponent.dependencies,
    { componentCode: 'PAYRUN01_PERIOD_GROSS', outputName: 'amount', inputName: 'periodGross' },
    { componentCode: 'PAYRUN01_FULL_PERIOD', outputName: 'value', inputName: 'fullPeriod' },
  ],
  method: {
    kind: 'expression',
    outputs: {
      amount: {
        kind: 'if',
        condition: output('PAYRUN01_FULL_PERIOD', 'value'),
        then: {
          kind: 'ratio',
          numerator: {
            kind: 'binary', operator: '*',
            left: { kind: 'output', componentCode: 'PAYRUN01_FULLTIME_MONTHLY', outputName: 'amount' },
            right: { kind: 'output', componentCode: 'PAYRUN01_CONTRACT_HOURS', outputName: 'hours' },
          },
          denominator: { kind: 'output', componentCode: 'PAYRUN01_FULLTIME_HOURS', outputName: 'hours' },
          roundingDefinitionId: contractualSalaryPartialPeriodRounding.id,
        },
        else: output('PAYRUN01_PERIOD_GROSS', 'amount'),
      },
    },
  },
}

export const PAYRUN01_RULE_REGISTRY = NL_2026_RULE_REGISTRY

function moneyComponent(
  code: string,
  outputName: string,
  inputs: readonly PayrollComponentInputDefinition[],
  dependencies: PayrollComponentDefinition['dependencies'],
  expression: PayrollExpression,
  version = '2026.1',
): PayrollComponentDefinition {
  return {
    id: `system:payrun01:${code.toLowerCase()}`,
    code,
    version,
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

function percentCost(code: string, rateCode: string, assessmentBaseCode: string): PayrollComponentDefinition {
  return moneyComponent(
    code,
    'amount',
    [
      { name: 'assessmentBase', valueType: 'MONEY', required: true },
      { name: 'rate', valueType: 'PERCENTAGE', required: true },
    ],
    [
      { componentCode: assessmentBaseCode, outputName: 'amount', inputName: 'assessmentBase' },
      { componentCode: rateCode, outputName: 'rate', inputName: 'rate' },
    ],
    { kind: 'binary', operator: '*', left: output(assessmentBaseCode, 'amount'), right: output(rateCode, 'rate') },
    '2026.2',
  )
}

const valueSources = [
  source('PAYRUN01_FULLTIME_MONTHLY', 'amount', 'MONEY', ['regularWage', 'fulltimeMonthlyAmount']),
  source('PAYRUN01_CONTRACT_HOURS', 'hours', 'DECIMAL', ['regularWage', 'contractHoursPerWeek']),
  source('PAYRUN01_FULLTIME_HOURS', 'hours', 'DECIMAL', ['regularWage', 'fulltimeHoursPerWeek']),
  source('PAYRUN01_ADDITIONAL_CASH_HOURS', 'hours', 'DECIMAL', ['payrollOwned', 'actualWorkProjection', 'cashCompensatedHours']),
  source('PAYRUN01_EMPLOYEE_PENSION', 'amount', 'MONEY', ['payrollOwned', 'amounts', 'employeePension']),
  source('PAYRUN01_EMPLOYER_PENSION', 'amount', 'MONEY', ['payrollOwned', 'amounts', 'employerPension']),
  source('PAYRUN01_WAGE_TAX_BASE', 'amount', 'MONEY', ['payrollOwned', 'fiscalBases', 'wageTax'], '2026.2'),
  source('PAYRUN01_EMPLOYEE_INSURANCE_BASE', 'amount', 'MONEY', ['payrollOwned', 'fiscalBases', 'employeeInsurance'], '2026.2'),
  source('PAYRUN01_ZVW_BASE', 'amount', 'MONEY', ['payrollOwned', 'fiscalBases', 'zvw'], '2026.2'),
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

const classifiedGrossSupplementSources: readonly PayrollComponentDefinition[] = [
  source('PAYRUN01_FIXED_GROSS_SUPPLEMENT', 'amount', 'MONEY', ['payrollOwned', 'amounts', 'fixedGrossSupplement'], '2026.3'),
  source('PAYRUN01_FIXED_GROSS_SUPPLEMENT_RESERVEABLE', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'fixedGrossSupplementReserveable'], '2026.3'),
  source('PAYRUN01_FIXED_GROSS_SUPPLEMENT_IN_WAGE_TAX_BASE', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'fixedGrossSupplementIncludedInWageTaxBase'], '2026.4'),
  source('PAYRUN01_FIXED_GROSS_SUPPLEMENT_IN_EMPLOYEE_INSURANCE_BASE', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'fixedGrossSupplementIncludedInEmployeeInsuranceBase'], '2026.4'),
  source('PAYRUN01_FIXED_GROSS_SUPPLEMENT_IN_ZVW_BASE', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'fixedGrossSupplementIncludedInZvwBase'], '2026.4'),
]

function fiscalBaseWithClassifiedSupplement(code: string, fiscalBaseCode: string, includedFlagCode: string): PayrollComponentDefinition {
  return moneyComponent(
    code,
    'amount',
    [
      { name: 'fiscalBase', valueType: 'MONEY', required: true },
      { name: 'supplement', valueType: 'MONEY', required: true },
      { name: 'alreadyIncluded', valueType: 'BOOLEAN', required: true },
    ],
    [
      { componentCode: fiscalBaseCode, outputName: 'amount', inputName: 'fiscalBase' },
      { componentCode: 'PAYRUN01_FIXED_GROSS_SUPPLEMENT', outputName: 'amount', inputName: 'supplement' },
      { componentCode: includedFlagCode, outputName: 'value', inputName: 'alreadyIncluded' },
    ],
    {
      kind: 'if',
      condition: output(includedFlagCode, 'value'),
      then: output(fiscalBaseCode, 'amount'),
      else: {
        kind: 'binary', operator: '+',
        left: output(fiscalBaseCode, 'amount'),
        right: output('PAYRUN01_FIXED_GROSS_SUPPLEMENT', 'amount'),
      },
    },
    '2026.1',
  )
}

const wageTaxBaseWithClassifiedSupplement = fiscalBaseWithClassifiedSupplement(
  'PAYRUN01_WAGE_TAX_BASE_WITH_CLASSIFIED_SUPPLEMENT',
  'PAYRUN01_WAGE_TAX_BASE',
  'PAYRUN01_FIXED_GROSS_SUPPLEMENT_IN_WAGE_TAX_BASE',
)
const employeeInsuranceBaseWithClassifiedSupplement = fiscalBaseWithClassifiedSupplement(
  'PAYRUN01_EMPLOYEE_INSURANCE_BASE_WITH_CLASSIFIED_SUPPLEMENT',
  'PAYRUN01_EMPLOYEE_INSURANCE_BASE',
  'PAYRUN01_FIXED_GROSS_SUPPLEMENT_IN_EMPLOYEE_INSURANCE_BASE',
)
const zvwBaseWithClassifiedSupplement = fiscalBaseWithClassifiedSupplement(
  'PAYRUN01_ZVW_BASE_WITH_CLASSIFIED_SUPPLEMENT',
  'PAYRUN01_ZVW_BASE',
  'PAYRUN01_FIXED_GROSS_SUPPLEMENT_IN_ZVW_BASE',
)
const classifiedSupplementFiscalBases = [
  wageTaxBaseWithClassifiedSupplement,
  employeeInsuranceBaseWithClassifiedSupplement,
  zvwBaseWithClassifiedSupplement,
] as const

const allLevyDeductionSources: readonly PayrollComponentDefinition[] = [
  source('PAYRUN01_ALL_LEVY_RATE', 'rate', 'PERCENTAGE', ['payrollOwned', 'parameters', 'allLevyRate'], '2026.3'),
  source('PAYRUN01_ALL_LEVY_PERIOD_MAXIMUM', 'amount', 'MONEY', ['payrollOwned', 'parameters', 'allLevyPeriodMaximum'], '2026.3'),
  source('PAYRUN01_ALL_LEVY_ELIGIBLE', 'value', 'BOOLEAN', ['payrollOwned', 'controls', 'allLevyEligible'], '2026.3'),
  source('PAYRUN01_ALL_LEVY_PERIODS_BEFORE', 'periods', 'DECIMAL', ['payrollOwned', 'cumulatives', 'allLevyPeriodsBefore'], '2026.3'),
  source('PAYRUN01_ALL_LEVY_WAGE_BEFORE', 'amount', 'MONEY', ['payrollOwned', 'cumulatives', 'allLevyWageBefore'], '2026.3'),
  source('PAYRUN01_ALL_LEVY_CONTRIBUTION_BEFORE', 'amount', 'MONEY', ['payrollOwned', 'cumulatives', 'allLevyContributionBefore'], '2026.3'),
]

const additionalHoursCashRounding: PayrollRoundingDefinition = {
  id: 'payrun01-additional-hours-total-cents-2026.1',
  componentCode: 'PAYRUN01_ADDITIONAL_CASH_AMOUNT',
  stage: 'ADDITIONAL_HOURS_TOTAL',
  ruleVersion: '2026.1',
  packageId: NL_2026_PACKAGE_ID,
  packageVersion: NL_2026_PACKAGE_VERSION,
  mode: 'ARITHMETIC',
  decimalPlaces: 2,
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-12-31',
  provenance: { sourceReference: additionalHoursCashSource, sourceHash: additionalHoursCashSourceHash },
}

const additionalHoursCashAmount: PayrollComponentDefinition = {
  id: 'system:payrun01:additional-hours-cash-amount',
  code: 'PAYRUN01_ADDITIONAL_CASH_AMOUNT',
  version: '2026.1',
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-12-31',
  ownership: { kind: 'SYSTEM' },
  processingScope: 'INCOME_RELATIONSHIP',
  inputs: [
    { name: 'fullTimeMonthlySalary', valueType: 'MONEY', required: true },
    { name: 'fulltimeHoursPerWeek', valueType: 'DECIMAL', required: true },
    { name: 'cashCompensatedHours', valueType: 'DECIMAL', required: true },
  ],
  outputs: [{ name: 'amount', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
  dependencies: [
    { componentCode: 'PAYRUN01_FULLTIME_MONTHLY', outputName: 'amount', inputName: 'fullTimeMonthlySalary' },
    { componentCode: 'PAYRUN01_FULLTIME_HOURS', outputName: 'hours', inputName: 'fulltimeHoursPerWeek' },
    { componentCode: 'PAYRUN01_ADDITIONAL_CASH_HOURS', outputName: 'hours', inputName: 'cashCompensatedHours' },
  ],
  method: {
    kind: 'expression',
    outputs: {
      amount: {
        kind: 'ratio',
        numerator: {
          kind: 'binary', operator: '*',
          left: {
            kind: 'binary', operator: '*',
            left: output('PAYRUN01_FULLTIME_MONTHLY', 'amount'),
            right: { kind: 'literal', valueType: 'DECIMAL', value: '12' },
          },
          right: output('PAYRUN01_ADDITIONAL_CASH_HOURS', 'hours'),
        },
        denominator: {
          kind: 'binary', operator: '*',
          left: output('PAYRUN01_FULLTIME_HOURS', 'hours'),
          right: { kind: 'literal', valueType: 'DECIMAL', value: '52.2' },
        },
        roundingDefinitionId: additionalHoursCashRounding.id,
      },
    },
  },
  tracePolicy: 'FULL',
}

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

const regularWageWithClassifiedSupplement: PayrollComponentDefinition = {
  ...regularWage,
  id: 'system:nl-2026:nl-regular-wage-payrun01-classified-supplement',
  version: '2026.2-payrun01',
  inputs: [
    ...regularWage.inputs,
    { name: 'fixedGrossSupplement', valueType: 'MONEY', required: true },
  ],
  dependencies: [
    ...regularWage.dependencies,
    { componentCode: 'PAYRUN01_FIXED_GROSS_SUPPLEMENT', outputName: 'amount', inputName: 'fixedGrossSupplement' },
  ],
  method: {
    kind: 'expression',
    outputs: {
      grossSalary: {
        kind: 'binary', operator: '+',
        left: {
          kind: 'binary', operator: '+',
          left: output('PAYRUN01_CONTRACTUAL_SALARY', 'amount'),
          right: output('PAYRUN01_ADDITIONAL_CASH_AMOUNT', 'amount'),
        },
        right: output('PAYRUN01_FIXED_GROSS_SUPPLEMENT', 'amount'),
      },
    },
  },
}

const classifiedSupplementReserveBase: PayrollComponentDefinition = moneyComponent(
  'PAYRUN01_CLASSIFIED_RESERVE_BASE',
  'amount',
  [
    { name: 'grossSalary', valueType: 'MONEY', required: true },
    { name: 'supplement', valueType: 'MONEY', required: true },
    { name: 'reserveable', valueType: 'BOOLEAN', required: true },
  ],
  [
    { componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary', inputName: 'grossSalary' },
    { componentCode: 'PAYRUN01_FIXED_GROSS_SUPPLEMENT', outputName: 'amount', inputName: 'supplement' },
    { componentCode: 'PAYRUN01_FIXED_GROSS_SUPPLEMENT_RESERVEABLE', outputName: 'value', inputName: 'reserveable' },
  ],
  {
    kind: 'if',
    condition: output('PAYRUN01_FIXED_GROSS_SUPPLEMENT_RESERVEABLE', 'value'),
    then: output('NL_REGULAR_WAGE', 'grossSalary'),
    else: {
      kind: 'binary', operator: '-',
      left: output('NL_REGULAR_WAGE', 'grossSalary'),
      right: output('PAYRUN01_FIXED_GROSS_SUPPLEMENT', 'amount'),
    },
  },
  '2026.3',
)

function reserveOnClassifiedBase(
  code: 'PAYRUN01_HOLIDAY_RESERVE' | 'PAYRUN01_YEAR_END_RESERVE',
  rateCode: 'PAYRUN01_HOLIDAY_RATE' | 'PAYRUN01_YEAR_END_RATE',
): PayrollComponentDefinition {
  return moneyComponent(
    code,
    'amount',
    [
      { name: 'gross', valueType: 'MONEY', required: true },
      { name: 'rate', valueType: 'PERCENTAGE', required: true },
    ],
    [
      { componentCode: 'PAYRUN01_CLASSIFIED_RESERVE_BASE', outputName: 'amount', inputName: 'gross' },
      { componentCode: rateCode, outputName: 'rate', inputName: 'rate' },
    ],
    {
      kind: 'binary', operator: '*',
      left: output('PAYRUN01_CLASSIFIED_RESERVE_BASE', 'amount'),
      right: output(rateCode, 'rate'),
    },
    '2026.3',
  )
}

const taxableWage: PayrollComponentDefinition = {
  ...NL_2026_RULE_PACKAGE.components.find((component) => component.code === 'NL_TAXABLE_WAGE')!,
  id: 'system:nl-2026:nl-taxable-wage-payrun01',
  version: '2026.2-payrun01',
  inputs: [
    { name: 'wageTaxBase', valueType: 'MONEY', required: true },
  ],
  outputs: [{ name: 'taxableWage', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
  dependencies: [
    { componentCode: 'PAYRUN01_WAGE_TAX_BASE', outputName: 'amount', inputName: 'wageTaxBase' },
  ],
  method: {
    kind: 'expression',
    outputs: {
      taxableWage: output('PAYRUN01_WAGE_TAX_BASE', 'amount'),
    },
  },
  tracePolicy: 'FULL',
}

const taxableWageWithClassifiedSupplement: PayrollComponentDefinition = {
  ...taxableWage,
  id: 'system:nl-2026:nl-taxable-wage-payrun01-classified-supplement',
  version: '2026.3-payrun01',
  dependencies: [
    { componentCode: wageTaxBaseWithClassifiedSupplement.code, outputName: 'amount', inputName: 'wageTaxBase' },
  ],
  method: {
    kind: 'expression',
    outputs: { taxableWage: output(wageTaxBaseWithClassifiedSupplement.code, 'amount') },
  },
}

const baseWageTax = NL_2026_RULE_PACKAGE.components.find((component) => component.code === 'NL_WAGE_TAX')!
const wageTax: PayrollComponentDefinition = {
  ...baseWageTax,
  dependencies: baseWageTax.dependencies.map((dependency) => dependency.inputName === 'grossSalary'
    ? { ...dependency, componentCode: 'NL_TAXABLE_WAGE', outputName: 'taxableWage' }
    : dependency),
}

const awf = percentCost('PAYRUN01_AWF_COST', 'PAYRUN01_AWF_RATE', 'PAYRUN01_EMPLOYEE_INSURANCE_BASE')
const aof = percentCost('PAYRUN01_AOF_COST', 'PAYRUN01_AOF_RATE', 'PAYRUN01_EMPLOYEE_INSURANCE_BASE')
const wko = percentCost('PAYRUN01_WKO_COST', 'PAYRUN01_WKO_RATE', 'PAYRUN01_EMPLOYEE_INSURANCE_BASE')
const whk = percentCost('PAYRUN01_WHK_COST', 'PAYRUN01_WHK_RATE', 'PAYRUN01_EMPLOYEE_INSURANCE_BASE')
const zvw = percentCost('PAYRUN01_ZVW_COST', 'PAYRUN01_ZVW_RATE', 'PAYRUN01_ZVW_BASE')

const awfAfterAllLevy = percentCost('PAYRUN01_AWF_COST', 'PAYRUN01_AWF_RATE', 'PAYRUN01_EMPLOYEE_INSURANCE_BASE_AFTER_ALL_LEVY')
const aofAfterAllLevy = percentCost('PAYRUN01_AOF_COST', 'PAYRUN01_AOF_RATE', 'PAYRUN01_EMPLOYEE_INSURANCE_BASE_AFTER_ALL_LEVY')
const wkoAfterAllLevy = percentCost('PAYRUN01_WKO_COST', 'PAYRUN01_WKO_RATE', 'PAYRUN01_EMPLOYEE_INSURANCE_BASE_AFTER_ALL_LEVY')
const whkAfterAllLevy = percentCost('PAYRUN01_WHK_COST', 'PAYRUN01_WHK_RATE', 'PAYRUN01_EMPLOYEE_INSURANCE_BASE_AFTER_ALL_LEVY')
const zvwAfterAllLevy = percentCost('PAYRUN01_ZVW_COST', 'PAYRUN01_ZVW_RATE', 'PAYRUN01_ZVW_BASE_AFTER_ALL_LEVY')

const awfWithClassifiedSupplement = percentCost('PAYRUN01_AWF_COST', 'PAYRUN01_AWF_RATE', employeeInsuranceBaseWithClassifiedSupplement.code)
const aofWithClassifiedSupplement = percentCost('PAYRUN01_AOF_COST', 'PAYRUN01_AOF_RATE', employeeInsuranceBaseWithClassifiedSupplement.code)
const wkoWithClassifiedSupplement = percentCost('PAYRUN01_WKO_COST', 'PAYRUN01_WKO_RATE', employeeInsuranceBaseWithClassifiedSupplement.code)
const whkWithClassifiedSupplement = percentCost('PAYRUN01_WHK_COST', 'PAYRUN01_WHK_RATE', employeeInsuranceBaseWithClassifiedSupplement.code)
const zvwWithClassifiedSupplement = percentCost('PAYRUN01_ZVW_COST', 'PAYRUN01_ZVW_RATE', zvwBaseWithClassifiedSupplement.code)

const awfWithClassifiedSupplementAfterAllLevy = percentCost('PAYRUN01_AWF_COST', 'PAYRUN01_AWF_RATE', 'PAYRUN01_EMPLOYEE_INSURANCE_BASE_AFTER_ALL_LEVY')
const aofWithClassifiedSupplementAfterAllLevy = percentCost('PAYRUN01_AOF_COST', 'PAYRUN01_AOF_RATE', 'PAYRUN01_EMPLOYEE_INSURANCE_BASE_AFTER_ALL_LEVY')
const wkoWithClassifiedSupplementAfterAllLevy = percentCost('PAYRUN01_WKO_COST', 'PAYRUN01_WKO_RATE', 'PAYRUN01_EMPLOYEE_INSURANCE_BASE_AFTER_ALL_LEVY')
const whkWithClassifiedSupplementAfterAllLevy = percentCost('PAYRUN01_WHK_COST', 'PAYRUN01_WHK_RATE', 'PAYRUN01_EMPLOYEE_INSURANCE_BASE_AFTER_ALL_LEVY')
const zvwWithClassifiedSupplementAfterAllLevy = percentCost('PAYRUN01_ZVW_COST', 'PAYRUN01_ZVW_RATE', 'PAYRUN01_ZVW_BASE_AFTER_ALL_LEVY')

function employerInsuranceFor(
  selectedAwf: PayrollComponentDefinition,
  selectedAof: PayrollComponentDefinition,
  selectedWko: PayrollComponentDefinition,
  selectedWhk: PayrollComponentDefinition,
  selectedZvw: PayrollComponentDefinition,
): PayrollComponentDefinition {
  const selected = [
    { component: selectedAwf, inputName: 'awf' },
    { component: selectedAof, inputName: 'aof' },
    { component: selectedWko, inputName: 'wko' },
    { component: selectedWhk, inputName: 'whk' },
    { component: selectedZvw, inputName: 'zvw' },
  ] as const
  return moneyComponent(
    'PAYRUN01_EMPLOYER_INSURANCE',
    'amount',
    ['awf', 'aof', 'wko', 'whk', 'zvw'].map((name) => ({ name, valueType: 'MONEY' as const, required: true })),
    selected.map(({ component, inputName }) => ({
      componentCode: component.code,
      outputName: 'amount',
      inputName,
    })),
    {
      kind: 'binary', operator: '+',
      left: {
        kind: 'binary', operator: '+',
        left: { kind: 'binary', operator: '+', left: output(selectedAwf.code, 'amount'), right: output(selectedAof.code, 'amount') },
        right: { kind: 'binary', operator: '+', left: output(selectedWko.code, 'amount'), right: output(selectedWhk.code, 'amount') },
      },
      right: output(selectedZvw.code, 'amount'),
    },
  )
}

const employerInsurance = employerInsuranceFor(awf, aof, wko, whk, zvw)
const employerInsuranceAfterAllLevy = employerInsuranceFor(
  awfAfterAllLevy, aofAfterAllLevy, wkoAfterAllLevy, whkAfterAllLevy, zvwAfterAllLevy,
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

const taxableWageWithoutPension: PayrollComponentDefinition = {
  ...taxableWage,
  id: 'system:nl-2026:nl-taxable-wage-payrun01-fiscal-base',
}

const netPayWithoutPension: PayrollComponentDefinition = {
  ...netPay,
  id: 'system:payrun01:net-pay-before-pfzw',
  inputs: [
    { name: 'gross', valueType: 'MONEY', required: true },
    { name: 'tax', valueType: 'MONEY', required: true },
  ],
  dependencies: [
    { componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary', inputName: 'gross' },
    { componentCode: 'NL_WAGE_TAX', outputName: 'wageTax', inputName: 'tax' },
  ],
  method: {
    kind: 'expression',
    outputs: {
      amount: {
        kind: 'binary', operator: '-',
        left: output('NL_REGULAR_WAGE', 'grossSalary'),
        right: output('NL_WAGE_TAX', 'wageTax'),
      },
    },
  },
}

const zeroMoney: PayrollExpression = { kind: 'literal', valueType: 'MONEY', value: '0.00' }
const onePeriod: PayrollExpression = { kind: 'literal', valueType: 'DECIMAL', value: '1' }

const allLevyDeduction: PayrollComponentDefinition = {
  id: 'system:payrun01:all-levy-deduction-vcr',
  code: 'PAYRUN01_ALL_LEVY_DEDUCTION',
  version: '2026.1',
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-12-31',
  ownership: { kind: 'SYSTEM' },
  processingScope: 'INCOME_RELATIONSHIP',
  inputs: [
    { name: 'cashWage', valueType: 'MONEY', required: true },
    { name: 'rate', valueType: 'PERCENTAGE', required: true },
    { name: 'periodMaximum', valueType: 'MONEY', required: true },
    { name: 'eligible', valueType: 'BOOLEAN', required: true },
    { name: 'periodsBefore', valueType: 'DECIMAL', required: true },
    { name: 'wageBefore', valueType: 'MONEY', required: true },
    { name: 'contributionBefore', valueType: 'MONEY', required: true },
  ],
  outputs: [
    { name: 'contributionBase', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } },
    { name: 'amount', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } },
  ],
  dependencies: [
    { componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary', inputName: 'cashWage' },
    { componentCode: 'PAYRUN01_ALL_LEVY_RATE', outputName: 'rate', inputName: 'rate' },
    { componentCode: 'PAYRUN01_ALL_LEVY_PERIOD_MAXIMUM', outputName: 'amount', inputName: 'periodMaximum' },
    { componentCode: 'PAYRUN01_ALL_LEVY_ELIGIBLE', outputName: 'value', inputName: 'eligible' },
    { componentCode: 'PAYRUN01_ALL_LEVY_PERIODS_BEFORE', outputName: 'periods', inputName: 'periodsBefore' },
    { componentCode: 'PAYRUN01_ALL_LEVY_WAGE_BEFORE', outputName: 'amount', inputName: 'wageBefore' },
    { componentCode: 'PAYRUN01_ALL_LEVY_CONTRIBUTION_BEFORE', outputName: 'amount', inputName: 'contributionBefore' },
  ],
  method: {
    kind: 'expression',
    outputs: {
      contributionBase: {
        kind: 'if',
        condition: output('PAYRUN01_ALL_LEVY_ELIGIBLE', 'value'),
        then: {
          kind: 'call', operator: 'MAX', arguments: [zeroMoney, {
            kind: 'binary', operator: '-',
            left: {
              kind: 'call', operator: 'MIN', arguments: [
                {
                  kind: 'binary', operator: '+',
                  left: output('PAYRUN01_ALL_LEVY_WAGE_BEFORE', 'amount'),
                  right: output('NL_REGULAR_WAGE', 'grossSalary'),
                },
                {
                  kind: 'binary', operator: '*',
                  left: output('PAYRUN01_ALL_LEVY_PERIOD_MAXIMUM', 'amount'),
                  right: {
                    kind: 'binary', operator: '+',
                    left: output('PAYRUN01_ALL_LEVY_PERIODS_BEFORE', 'periods'),
                    right: onePeriod,
                  },
                },
              ],
            },
            right: {
              kind: 'call', operator: 'MIN', arguments: [
                output('PAYRUN01_ALL_LEVY_WAGE_BEFORE', 'amount'),
                {
                  kind: 'binary', operator: '*',
                  left: output('PAYRUN01_ALL_LEVY_PERIOD_MAXIMUM', 'amount'),
                  right: output('PAYRUN01_ALL_LEVY_PERIODS_BEFORE', 'periods'),
                },
              ],
            },
          }],
        },
        else: zeroMoney,
      },
      amount: {
        kind: 'if',
        condition: output('PAYRUN01_ALL_LEVY_ELIGIBLE', 'value'),
        then: {
          kind: 'call', operator: 'MAX', arguments: [zeroMoney, {
            kind: 'binary', operator: '-',
            left: {
              kind: 'binary', operator: '*',
              left: {
                kind: 'call', operator: 'MIN', arguments: [
                  {
                    kind: 'binary', operator: '+',
                    left: output('PAYRUN01_ALL_LEVY_WAGE_BEFORE', 'amount'),
                    right: output('NL_REGULAR_WAGE', 'grossSalary'),
                  },
                  {
                    kind: 'binary', operator: '*',
                    left: output('PAYRUN01_ALL_LEVY_PERIOD_MAXIMUM', 'amount'),
                    right: {
                      kind: 'binary', operator: '+',
                      left: output('PAYRUN01_ALL_LEVY_PERIODS_BEFORE', 'periods'),
                      right: onePeriod,
                    },
                  },
                ],
              },
              right: output('PAYRUN01_ALL_LEVY_RATE', 'rate'),
            },
            right: output('PAYRUN01_ALL_LEVY_CONTRIBUTION_BEFORE', 'amount'),
          }],
        },
        else: zeroMoney,
      },
    },
  },
  tracePolicy: 'FULL',
}

function baseAfterAllLevyDeduction(code: string, rawBaseCode: string): PayrollComponentDefinition {
  return moneyComponent(
    code,
    'amount',
    [
      { name: 'wageBase', valueType: 'MONEY', required: true },
      { name: 'deduction', valueType: 'MONEY', required: true },
    ],
    [
      { componentCode: rawBaseCode, outputName: 'amount', inputName: 'wageBase' },
      { componentCode: 'PAYRUN01_ALL_LEVY_DEDUCTION', outputName: 'amount', inputName: 'deduction' },
    ],
    {
      kind: 'call', operator: 'MAX', arguments: [zeroMoney, {
        kind: 'binary', operator: '-',
        left: output(rawBaseCode, 'amount'),
        right: output('PAYRUN01_ALL_LEVY_DEDUCTION', 'amount'),
      }],
    },
    '2026.3',
  )
}

const wageTaxBaseAfterAllLevy = baseAfterAllLevyDeduction('PAYRUN01_WAGE_TAX_BASE_AFTER_ALL_LEVY', 'PAYRUN01_WAGE_TAX_BASE')
const employeeInsuranceBaseAfterAllLevy = baseAfterAllLevyDeduction('PAYRUN01_EMPLOYEE_INSURANCE_BASE_AFTER_ALL_LEVY', 'PAYRUN01_EMPLOYEE_INSURANCE_BASE')
const zvwBaseAfterAllLevy = baseAfterAllLevyDeduction('PAYRUN01_ZVW_BASE_AFTER_ALL_LEVY', 'PAYRUN01_ZVW_BASE')
const wageTaxBaseWithClassifiedSupplementAfterAllLevy = baseAfterAllLevyDeduction(
  wageTaxBaseAfterAllLevy.code,
  wageTaxBaseWithClassifiedSupplement.code,
)
const employeeInsuranceBaseWithClassifiedSupplementAfterAllLevy = baseAfterAllLevyDeduction(
  employeeInsuranceBaseAfterAllLevy.code,
  employeeInsuranceBaseWithClassifiedSupplement.code,
)
const zvwBaseWithClassifiedSupplementAfterAllLevy = baseAfterAllLevyDeduction(
  zvwBaseAfterAllLevy.code,
  zvwBaseWithClassifiedSupplement.code,
)

function taxableWageAfterAllLevyFor(base: PayrollComponentDefinition, suffix: string): PayrollComponentDefinition {
  return {
    ...taxableWage,
    id: `system:nl-2026:nl-taxable-wage-payrun01-after-all-levy-${suffix}`,
    version: '2026.4-payrun01',
    dependencies: [
      { componentCode: base.code, outputName: 'amount', inputName: 'wageTaxBase' },
    ],
    method: {
      kind: 'expression',
      outputs: { taxableWage: output(base.code, 'amount') },
    },
  }
}

const taxableWageAfterAllLevy = taxableWageAfterAllLevyFor(wageTaxBaseAfterAllLevy, 'standard')
const taxableWageWithClassifiedSupplementAfterAllLevy = taxableWageAfterAllLevyFor(
  wageTaxBaseWithClassifiedSupplementAfterAllLevy,
  'classified-supplement',
)

function netPayAfterAllLevy(pensionIncluded: boolean): PayrollComponentDefinition {
  const deductions = [
    { componentCode: 'NL_WAGE_TAX', outputName: 'wageTax', inputName: 'tax' },
    ...(pensionIncluded ? [{ componentCode: 'PAYRUN01_EMPLOYEE_PENSION', outputName: 'amount', inputName: 'pension' }] : []),
    { componentCode: 'PAYRUN01_ALL_LEVY_DEDUCTION', outputName: 'amount', inputName: 'allLevy' },
  ]
  const deductionExpression = deductions.slice(1).reduce<PayrollExpression>(
    (sum, dependency) => ({
      kind: 'binary',
      operator: '+',
      left: sum,
      right: output(dependency.componentCode, dependency.outputName),
    }),
    output(deductions[0]!.componentCode, deductions[0]!.outputName),
  )
  return {
    ...netPay,
    id: `system:payrun01:net-pay-after-all-levy${pensionIncluded ? '' : '-before-pfzw'}`,
    version: '2026.3',
    inputs: [
      { name: 'gross', valueType: 'MONEY', required: true },
      ...deductions.map((dependency) => ({ name: dependency.inputName, valueType: 'MONEY' as const, required: true })),
    ],
    dependencies: [
      { componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary', inputName: 'gross' },
      ...deductions,
    ],
    method: {
      kind: 'expression',
      outputs: {
        amount: {
          kind: 'binary', operator: '-',
          left: output('NL_REGULAR_WAGE', 'grossSalary'),
          right: deductionExpression,
        },
      },
    },
  }
}

const totalEmployerCostBeforePfzw = moneyComponent(
  'PAYRUN01_TOTAL_EMPLOYER_COST',
  'amount',
  [
    { name: 'gross', valueType: 'MONEY', required: true },
    { name: 'insurance', valueType: 'MONEY', required: true },
    { name: 'holiday', valueType: 'MONEY', required: true },
    { name: 'yearEnd', valueType: 'MONEY', required: true },
  ],
  [
    { componentCode: 'NL_REGULAR_WAGE', outputName: 'grossSalary', inputName: 'gross' },
    { componentCode: 'PAYRUN01_EMPLOYER_INSURANCE', outputName: 'amount', inputName: 'insurance' },
    { componentCode: 'PAYRUN01_HOLIDAY_RESERVE', outputName: 'amount', inputName: 'holiday' },
    { componentCode: 'PAYRUN01_YEAR_END_RESERVE', outputName: 'amount', inputName: 'yearEnd' },
  ],
  {
    kind: 'binary', operator: '+',
    left: {
      kind: 'binary', operator: '+',
      left: output('NL_REGULAR_WAGE', 'grossSalary'),
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
    code: 'PAYRUN01-CTRL-016-TAXABLE-WAGE-FISCAL-BASE', severity: 'BLOCKING' as const,
    expression: {
      kind: 'binary' as const, operator: '=',
      left: output('NL_TAXABLE_WAGE', 'taxableWage'),
      right: output('PAYRUN01_WAGE_TAX_BASE', 'amount'),
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

function afterLevyFiscalBaseComponents(supplement: boolean): readonly PayrollComponentDefinition[] {
  return supplement
    ? [
      wageTaxBaseWithClassifiedSupplementAfterAllLevy,
      employeeInsuranceBaseWithClassifiedSupplementAfterAllLevy,
      zvwBaseWithClassifiedSupplementAfterAllLevy,
    ]
    : [wageTaxBaseAfterAllLevy, employeeInsuranceBaseAfterAllLevy, zvwBaseAfterAllLevy]
}

function employerPremiumComponents(supplement: boolean, afterLevy: boolean): readonly PayrollComponentDefinition[] {
  if (supplement && afterLevy) {
    return [
      awfWithClassifiedSupplementAfterAllLevy,
      aofWithClassifiedSupplementAfterAllLevy,
      wkoWithClassifiedSupplementAfterAllLevy,
      whkWithClassifiedSupplementAfterAllLevy,
      zvwWithClassifiedSupplementAfterAllLevy,
    ]
  }
  if (supplement) return [awfWithClassifiedSupplement, aofWithClassifiedSupplement, wkoWithClassifiedSupplement, whkWithClassifiedSupplement, zvwWithClassifiedSupplement]
  if (afterLevy) return [awfAfterAllLevy, aofAfterAllLevy, wkoAfterAllLevy, whkAfterAllLevy, zvwAfterAllLevy]
  return [awf, aof, wko, whk, zvw]
}

function employerInsuranceComponent(supplement: boolean, afterLevy: boolean): PayrollComponentDefinition {
  if (!supplement) return afterLevy ? employerInsuranceAfterAllLevy : employerInsurance
  const selectedPremiums = employerPremiumComponents(supplement, afterLevy)
  return employerInsuranceFor(
    selectedPremiums[0]!,
    selectedPremiums[1]!,
    selectedPremiums[2]!,
    selectedPremiums[3]!,
    selectedPremiums[4]!,
  )
}

function taxableWageComponent(supplement: boolean, afterLevy: boolean): PayrollComponentDefinition {
  if (afterLevy) return supplement ? taxableWageWithClassifiedSupplementAfterAllLevy : taxableWageAfterAllLevy
  return supplement ? taxableWageWithClassifiedSupplement : taxableWage
}

function scenarioComponentsFor(options: {
  readonly supportPartialPeriods: boolean
  readonly supportClassifiedGrossSupplement: boolean
  readonly supportAllLevyDeduction: boolean
}): readonly PayrollComponentDefinition[] {
  const { supportPartialPeriods, supportClassifiedGrossSupplement, supportAllLevyDeduction } = options
  return [
    ...valueSources,
    ...(supportClassifiedGrossSupplement ? classifiedGrossSupplementSources : []),
    ...(supportClassifiedGrossSupplement ? classifiedSupplementFiscalBases : []),
    ...(supportAllLevyDeduction ? allLevyDeductionSources : []),
    ...(supportPartialPeriods ? partialPeriodSources : []),
    additionalHoursCashAmount,
    supportPartialPeriods ? contractualSalaryWithPartialPeriods : contractualSalaryComponent,
    ...(supportClassifiedGrossSupplement ? [classifiedSupplementReserveBase] : []),
    ...(supportAllLevyDeduction
      ? [allLevyDeduction, ...afterLevyFiscalBaseComponents(supportClassifiedGrossSupplement)]
      : []),
    ...employerPremiumComponents(supportClassifiedGrossSupplement, supportAllLevyDeduction),
    employerInsuranceComponent(supportClassifiedGrossSupplement, supportAllLevyDeduction),
    ...(supportClassifiedGrossSupplement
      ? [
        reserveOnClassifiedBase('PAYRUN01_HOLIDAY_RESERVE', 'PAYRUN01_HOLIDAY_RATE'),
        reserveOnClassifiedBase('PAYRUN01_YEAR_END_RESERVE', 'PAYRUN01_YEAR_END_RATE'),
      ]
      : [holidayReserve, yearEndReserve]),
    supportAllLevyDeduction ? netPayAfterAllLevy(true) : netPay,
    cumulativeGross,
    cumulativeHolidayReserve,
    cumulativeYearEndReserve,
    totalEmployerCost,
  ]
}

function scenarioComponentsWithoutPensionFor(options: {
  readonly supportPartialPeriods: boolean
  readonly supportClassifiedGrossSupplement: boolean
  readonly supportAllLevyDeduction: boolean
}): readonly PayrollComponentDefinition[] {
  const { supportPartialPeriods, supportClassifiedGrossSupplement, supportAllLevyDeduction } = options
  return [
    ...valueSources.filter((component) => !['PAYRUN01_EMPLOYEE_PENSION', 'PAYRUN01_EMPLOYER_PENSION'].includes(component.code)),
    ...(supportClassifiedGrossSupplement ? classifiedGrossSupplementSources : []),
    ...(supportClassifiedGrossSupplement ? classifiedSupplementFiscalBases : []),
    ...(supportAllLevyDeduction ? allLevyDeductionSources : []),
    ...(supportPartialPeriods ? partialPeriodSources : []),
    additionalHoursCashAmount,
    supportPartialPeriods ? contractualSalaryWithPartialPeriods : contractualSalaryComponent,
    ...(supportClassifiedGrossSupplement ? [classifiedSupplementReserveBase] : []),
    ...(supportAllLevyDeduction
      ? [allLevyDeduction, ...afterLevyFiscalBaseComponents(supportClassifiedGrossSupplement)]
      : []),
    ...employerPremiumComponents(supportClassifiedGrossSupplement, supportAllLevyDeduction),
    employerInsuranceComponent(supportClassifiedGrossSupplement, supportAllLevyDeduction),
    ...(supportClassifiedGrossSupplement
      ? [
        reserveOnClassifiedBase('PAYRUN01_HOLIDAY_RESERVE', 'PAYRUN01_HOLIDAY_RATE'),
        reserveOnClassifiedBase('PAYRUN01_YEAR_END_RESERVE', 'PAYRUN01_YEAR_END_RATE'),
      ]
      : [holidayReserve, yearEndReserve]),
    supportAllLevyDeduction ? netPayAfterAllLevy(false) : netPayWithoutPension,
    cumulativeGross,
    cumulativeHolidayReserve,
    cumulativeYearEndReserve,
    totalEmployerCostBeforePfzw,
  ]
}

/**
 * Add the same NL-2026 statutory wage engine to an explicit, versioned
 * Payroll arrangement composition. Scenario differences are input/config
 * differences, never employee-name checks or a second calculator.
 */
export function createPayrun01RulePackage(
  kind: Payrun01CompositionKind,
  options: Payrun01RulePackageOptions = {},
): PayrollRulePackage {
  const pensionCalculation = options.pensionCalculation ?? (kind === 'KINDEROPVANG_TEST' ? 'EXCLUDED' : 'INCLUDED')
  const pensionIncluded = pensionCalculation === 'INCLUDED'
  const testOnlyPensionCompliance = pensionIncluded && options.pensionCompliance === 'TEST_ONLY_UNVERIFIED'
  const supportPartialPeriods = options.supportPartialPeriods === true
  const supportClassifiedGrossSupplement = options.supportClassifiedGrossSupplement === true
  const supportAllLevyDeduction = options.supportAllLevyDeduction === true
  const compositionId = testOnlyPensionCompliance
    ? `${NL_2026_RULE_PACKAGE.compositionId}+PAYRUN01-${kind}-PENSION-TEST-UNVERIFIED-2026.3`
    : kind === 'LEGACY_COMPANY_TEST' && !pensionIncluded
      ? `${NL_2026_RULE_PACKAGE.compositionId}+PAYRUN01-${kind}-PENSION-BLOCKED-2026.3`
      : `${NL_2026_RULE_PACKAGE.compositionId}+PAYRUN01-${kind}-2026.2`
  const optionSuffixes = [
    supportPartialPeriods ? 'PARTIAL-PERIODS-2026.1' : undefined,
    supportClassifiedGrossSupplement ? 'CLASSIFIED-GROSS-SUPPLEMENT-2026.2' : undefined,
    supportAllLevyDeduction ? 'ALL-LEVY-DEDUCTION-2026.1' : undefined,
  ].filter((suffix): suffix is string => suffix !== undefined)
  const effectiveCompositionId = optionSuffixes.reduce((id, suffix) => `${id}+${suffix}`, compositionId)
  const systemComponents = NL_2026_RULE_PACKAGE.components
    .filter((component) => !['NL_REGULAR_WAGE', 'NL_TAXABLE_WAGE', 'NL_WAGE_TAX', 'NL_NET_PAY'].includes(component.code))
    .concat([
      supportClassifiedGrossSupplement ? regularWageWithClassifiedSupplement : regularWage,
      supportAllLevyDeduction
        ? taxableWageComponent(supportClassifiedGrossSupplement, true)
        : supportClassifiedGrossSupplement
          ? taxableWageWithClassifiedSupplement
          : pensionIncluded ? taxableWage : taxableWageWithoutPension,
      wageTax,
    ])
  const scenarioOptions = { supportPartialPeriods, supportClassifiedGrossSupplement, supportAllLevyDeduction }
  const selectedScenarioComponents = pensionIncluded
    ? scenarioComponentsFor(scenarioOptions)
    : scenarioComponentsWithoutPensionFor(scenarioOptions)
  const scenarioControls = controls.map((control) => {
      if (control.code === 'PAYRUN01-CTRL-009-PENSION-RULE-READY'
        && (testOnlyPensionCompliance || (!pensionIncluded && kind === 'KINDEROPVANG_TEST'))) {
        return { ...control, severity: 'WARNING' as const }
      }
      if (supportAllLevyDeduction && control.code === 'PAYRUN01-CTRL-016-TAXABLE-WAGE-FISCAL-BASE') {
        return {
          ...control,
          expression: {
            kind: 'binary' as const,
            operator: '=' as const,
            left: output('NL_TAXABLE_WAGE', 'taxableWage'),
            right: output(wageTaxBaseAfterAllLevy.code, 'amount'),
          },
        }
      }
      if (!supportAllLevyDeduction && supportClassifiedGrossSupplement && pensionIncluded
        && control.code === 'PAYRUN01-CTRL-016-TAXABLE-WAGE-FISCAL-BASE') {
        return {
          ...control,
          expression: {
            kind: 'binary' as const,
            operator: '=' as const,
            left: output('NL_TAXABLE_WAGE', 'taxableWage'),
            right: output(wageTaxBaseWithClassifiedSupplement.code, 'amount'),
          },
        }
      }
      if (!pensionIncluded && control.code === 'PAYRUN01-CTRL-016-TAXABLE-WAGE-FISCAL-BASE') {
        return {
          ...control,
            code: 'PAYRUN01-CTRL-016-TAXABLE-WAGE-FISCAL-BASE-RECONCILIATION',
          expression: {
            kind: 'binary' as const,
            operator: '=' as const,
            left: output('NL_TAXABLE_WAGE', 'taxableWage'),
            right: output(supportClassifiedGrossSupplement
              ? wageTaxBaseWithClassifiedSupplement.code
              : 'PAYRUN01_WAGE_TAX_BASE', 'amount'),
          },
        }
      }
      if (!pensionIncluded && control.code === 'PAYRUN01-CTRL-017-GROSS-NET-PENSION-RECONCILIATION') {
        const expectedNet: PayrollExpression = supportAllLevyDeduction
          ? {
            kind: 'binary',
            operator: '-',
            left: {
              kind: 'binary',
              operator: '-',
              left: output('NL_REGULAR_WAGE', 'grossSalary'),
              right: output('NL_WAGE_TAX', 'wageTax'),
            },
            right: output('PAYRUN01_ALL_LEVY_DEDUCTION', 'amount'),
          }
          : {
            kind: 'binary',
            operator: '-',
            left: output('NL_REGULAR_WAGE', 'grossSalary'),
            right: output('NL_WAGE_TAX', 'wageTax'),
          }
        return {
          ...control,
          code: 'PAYRUN01-CTRL-017-GROSS-NET-RECONCILIATION',
          expression: {
            kind: 'binary' as const,
            operator: '=' as const,
            left: output('PAYRUN01_NET_PAY', 'amount'),
            right: expectedNet,
          },
        }
      }
      if (supportAllLevyDeduction && pensionIncluded && control.code === 'PAYRUN01-CTRL-017-GROSS-NET-PENSION-RECONCILIATION') {
        return {
          ...control,
          expression: {
            kind: 'binary' as const,
            operator: '=' as const,
            left: output('PAYRUN01_NET_PAY', 'amount'),
            right: {
              kind: 'binary' as const,
              operator: '-' as const,
              left: {
                kind: 'binary' as const,
                operator: '-' as const,
                left: {
                  kind: 'binary' as const,
                  operator: '-' as const,
                  left: output('NL_REGULAR_WAGE', 'grossSalary'),
                  right: output('NL_WAGE_TAX', 'wageTax'),
                },
                right: output('PAYRUN01_EMPLOYEE_PENSION', 'amount'),
              },
              right: output('PAYRUN01_ALL_LEVY_DEDUCTION', 'amount'),
            },
          },
        }
      }
      return control
    })
  const optionResultMappings: readonly PayrollResultMapping[] = [
    ...(supportClassifiedGrossSupplement
      ? [{ key: 'fixed_gross_supplement', componentCode: 'PAYRUN01_FIXED_GROSS_SUPPLEMENT', outputName: 'amount' }]
      : []),
    ...(supportAllLevyDeduction
      ? [
        { key: 'all_levy_contribution_base', componentCode: 'PAYRUN01_ALL_LEVY_DEDUCTION', outputName: 'contributionBase' },
        { key: 'all_levy_deduction', componentCode: 'PAYRUN01_ALL_LEVY_DEDUCTION', outputName: 'amount' },
        { key: 'wage_tax_base_after_all_levy', componentCode: wageTaxBaseAfterAllLevy.code, outputName: 'amount' },
        { key: 'employee_insurance_base_after_all_levy', componentCode: employeeInsuranceBaseAfterAllLevy.code, outputName: 'amount' },
        { key: 'zvw_base_after_all_levy', componentCode: zvwBaseAfterAllLevy.code, outputName: 'amount' },
      ]
      : []),
  ]
  const selectedResultMappings = [
    ...(!pensionIncluded
      ? resultMappings.filter((row) => row.key !== 'employee_pension' && row.key !== 'employer_pension')
      : resultMappings),
    ...optionResultMappings,
  ]
  const roundingDefinitions = [
    ...(NL_2026_RULE_PACKAGE.roundingDefinitions ?? []),
    supportPartialPeriods ? contractualSalaryPartialPeriodRounding : contractualSalaryRounding,
    additionalHoursCashRounding,
  ]
  const packageHash = sha256(stableSerialize({
    basePackageHash: NL_2026_RULE_PACKAGE.metadata?.packageHash,
    compositionId: effectiveCompositionId,
    kind,
    pensionCalculation,
    pensionCompliance: options.pensionCompliance ?? 'VERIFIED',
    supportPartialPeriods,
    ...(supportClassifiedGrossSupplement ? { supportClassifiedGrossSupplement: true } : {}),
    ...(supportAllLevyDeduction ? { supportAllLevyDeduction: true } : {}),
    components: [...systemComponents, ...selectedScenarioComponents],
    controls: scenarioControls,
    resultMappings: selectedResultMappings,
    roundingDefinitions,
  }))

  return Object.freeze({
    ...NL_2026_RULE_PACKAGE,
    compositionId: effectiveCompositionId,
    metadata: Object.freeze({ ...NL_2026_RULE_PACKAGE.metadata!, packageHash }),
    components: Object.freeze([...systemComponents, ...selectedScenarioComponents]),
    controls: Object.freeze([...scenarioControls]),
    roundingDefinitions: Object.freeze(roundingDefinitions),
    resultMappings: Object.freeze([...selectedResultMappings]),
  })
}
