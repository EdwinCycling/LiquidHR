import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  FixedDecimal,
  PayrollEngineError,
  buildCalculationInputs,
  calculatePayroll,
  sha256,
  stableSerialize,
  type PayrollExpression,
  type PayrollSourceSnapshot,
} from '@liquid-hr/payroll-engine'
import {
  NL_2026_CONTROLS,
  NL_2026_IMPLEMENTATION_SHA256,
  NL_2026_PACKAGE_HASH,
  NL_2026_PACKAGE_ID,
  NL_2026_PACKAGE_VERSION,
  NL_2026_PARAMETERS,
  NL_2026_PARAMETER_METADATA,
  NL_2026_RESULT_COMPONENTS,
  NL_2026_SYSTEM_COMPONENTS,
  NL_2026_ROUNDING_DEFINITIONS,
  NL_2026_RULE_PACKAGE,
  NL_2026_RULE_REGISTRY,
  NL_2026_SOURCE_METADATA,
} from '../src/index'

interface OracleCase {
  readonly id: string
  readonly taxableMonthlyWage: string
  readonly payrollTaxCredit: boolean
  readonly annualizedWage: string
  readonly tableAnnualWage: string
  readonly annualTaxBeforeCredits: string
  readonly annualGeneralCredit: string
  readonly annualTheoreticalLabourCredit: string
  readonly annualLabourCredit: string
  readonly annualTaxAfterCredits: string
  readonly wageTax: string
  readonly labourCredit: string
  readonly netPay: string
  readonly officialTableMonthlyWage: string
}

const testDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(testDirectory, '../../..')
const oracleCases = JSON.parse(await readFile(resolve(repositoryRoot, 'docs/payroll/research/oracle/nl2026-expected.json'), 'utf8')) as readonly OracleCase[]

function sourceSnapshot(
  grossAmount: string,
  payrollTaxCredit: boolean,
  overrides: Readonly<Record<string, unknown>> = {},
  sourceId = 'snapshot-nl-2026-test',
): PayrollSourceSnapshot {
  const regularWage = {
    fiscalYear: '2026',
    table: 'WHITE',
    residence: 'NL',
    ageCategory: 'UNDER_AOW',
    herleiding: 'STD',
    timePeriod: 'MONTH',
    payrollTaxCredit,
    regularWage: true,
    fullPeriod: true,
    hasSpecialSituation: false,
    incomeRelationshipCount: '1',
    grossAmount,
    ...overrides,
  }
  const canonicalSource = { regularWage }
  return {
    id: sourceId,
    sourceTenantId: 'tenant-nl-2026-synthetic',
    sourceHrGroupId: 'group-nl-2026-synthetic',
    sourceAdministrationId: 'administration-nl-2026-synthetic',
    sourceEmployeeId: 'employee-nl-2026-synthetic',
    sourceEmploymentId: 'employment-nl-2026-synthetic',
    sourceIncomeRelationshipId: 'ikv-nl-2026-synthetic',
    periodReference: { year: 2026, month: 9 },
    canonicalSource,
    sourceVersionVector: { employment: 'synthetic-v1', incomeRelationship: 'synthetic-v1' },
    sourceGaps: [],
    sourceHash: sha256(stableSerialize(canonicalSource)),
    createdAt: '2026-09-30T08:00:00.000Z',
  } satisfies PayrollSourceSnapshot
}

function calculate(snapshot: PayrollSourceSnapshot) {
  return calculatePayroll(buildCalculationInputs(snapshot, NL_2026_RULE_PACKAGE, {
    scopeInstanceIds: { INCOME_RELATIONSHIP: snapshot.sourceIncomeRelationshipId! },
  }), NL_2026_RULE_REGISTRY)
}

function mappedValues(result: ReturnType<typeof calculatePayroll>): Readonly<Record<string, string | boolean>> {
  return Object.fromEntries(result.resultRows.map((row) => [row.key, row.value]))
}

function registeredTrace(result: ReturnType<typeof calculatePayroll>) {
  return result.trace.find((step) => step.componentCode === 'NL_WAGE_TAX')?.registeredRuleTrace ?? []
}

function normalizedDecimal(value: string): string {
  return FixedDecimal.parse(value).toString()
}

function normalizedMoney(value: string): string {
  return FixedDecimal.parse(value).toString(2)
}

function expectEngineCode(operation: () => unknown, code: string): void {
  try {
    operation()
    throw new Error(`Expected PayrollEngineError ${code}`)
  } catch (error) {
    expect(error).toBeInstanceOf(PayrollEngineError)
    expect((error as PayrollEngineError).code).toBe(code)
  }
}

describe('NL 2026 regular monthly wage package', () => {
  it.each(oracleCases)('matches independent oracle $id', (expected) => {
    const result = calculate(sourceSnapshot(expected.taxableMonthlyWage, expected.payrollTaxCredit, {}, `snapshot-${expected.id}`))
    const values = mappedValues(result)

    expect(result.status).toBe('CALCULATED')
    expect(values).toEqual({
      gross_salary: expected.taxableMonthlyWage,
      taxable_wage: expected.taxableMonthlyWage,
      wage_tax: expected.wageTax,
      net_salary: expected.netPay,
    })
    expect(result.resultRows).toHaveLength(4)
    expect(result.resultRows.every((row) => row.valueType === 'MONEY')).toBe(true)
    expect(result.controls).toHaveLength(NL_2026_CONTROLS.length)
    expect(result.controls.every((control) => control.status === 'PASS')).toBe(true)

    const trace = new Map(registeredTrace(result).map((step) => [step.code, step]))
    expect(trace.get('rounding.annual-table-wage')?.values.unroundedValue?.value).toBe(normalizedDecimal(expected.annualizedWage))
    expect(trace.get('rounding.annual-table-wage')?.values.roundedValue?.value).toBe(expected.tableAnnualWage)
    expect(trace.get('rounding.tax-before-credits')?.values.roundedValue?.value).toBe(expected.annualTaxBeforeCredits)
    expect(trace.get('credit.application-and-cap')?.values.appliedGeneralCredit?.value).toBe(normalizedMoney(expected.annualGeneralCredit))
    expect(trace.get('credit.labour-credit-steps')?.values.theoreticalLabourCredit?.value
      ?? trace.get('credit.application-and-cap')?.values.theoreticalLabourCredit?.value).toBe(normalizedMoney(expected.annualTheoreticalLabourCredit))
    expect(trace.get('credit.application-and-cap')?.values.appliedLabourCredit?.value).toBe(normalizedMoney(expected.annualLabourCredit))
    expect(trace.get('credit.application-and-cap')?.values.annualTaxAfterCredits?.value).toBe(normalizedMoney(expected.annualTaxAfterCredits))
    expect(trace.get('result.period-values')?.values.appliedLabourCreditMonthly?.value).toBe(normalizedMoney(expected.labourCredit))
    expect(trace.get('result.period-values')?.values.tablePeriodWage?.value).toBe(normalizedMoney(expected.officialTableMonthlyWage))
  })

  it('exposes the explicit SYSTEM source-to-tax-to-net component chain and bound classifications', () => {
    const componentsByCode = new Map(NL_2026_SYSTEM_COMPONENTS.map((component) => [component.code, component]))
    expect(componentsByCode.get('NL_REGULAR_WAGE')?.method).toEqual({ kind: 'source', path: ['regularWage', 'grossAmount'] })
    expect(componentsByCode.get('NL_TAXABLE_WAGE')?.method).toEqual({ kind: 'passThrough', outputs: { taxableWage: 'grossSalary' } })
    expect(componentsByCode.get('NL_WAGE_TAX')?.method.kind).toBe('registeredRule')
    expect(componentsByCode.get('NL_NET_PAY')?.method.kind).toBe('expression')
    expect(NL_2026_SYSTEM_COMPONENTS.every((component) => component.ownership.kind === 'SYSTEM')).toBe(true)
    expect(NL_2026_SYSTEM_COMPONENTS.every((component) => component.processingScope === 'INCOME_RELATIONSHIP')).toBe(true)
    expect(componentsByCode.get('NL_WAGE_TAX')?.dependencies.map((dependency) => dependency.inputName)).toEqual(expect.arrayContaining([
      'fiscalYear', 'table', 'residence', 'ageCategory', 'herleiding', 'timePeriod', 'payrollTaxCredit',
      'regularWage', 'fullPeriod', 'hasSpecialSituation', 'incomeRelationshipCount', 'grossSalary', 'taxableWage',
    ]))
    expect(NL_2026_RULE_PACKAGE.resultMappings.map((mapping) => mapping.key)).toEqual([
      'gross_salary', 'taxable_wage', 'wage_tax', 'net_salary',
    ])
    expect(NL_2026_RULE_PACKAGE.controls).toEqual(NL_2026_CONTROLS)
    expect(NL_2026_CONTROLS.map((control) => control.code)).toEqual([
      'NL2026-CTRL-001-TAXABLE-WAGE-RECONCILIATION',
      'NL2026-CTRL-002-NET-PAY-RECONCILIATION',
      'NL2026-CTRL-003-NONNEGATIVE-WAGE-TAX',
      'NL2026-CTRL-004-NONNEGATIVE-NET-PAY',
    ])
  })

  it('blocks a deliberately broken net-pay reconciliation', () => {
    const netPay = NL_2026_SYSTEM_COMPONENTS.find((component) => component.code === 'NL_NET_PAY')
    if (!netPay || netPay.method.kind !== 'expression') throw new Error('NL net-pay component is missing.')
    const originalNetSalary = netPay.method.outputs.netSalary
    if (!originalNetSalary) throw new Error('NL net-pay expression is missing.')
    const deliberatelyWrongNetSalary: PayrollExpression = {
      kind: 'binary',
      operator: '+',
      left: originalNetSalary,
      right: { kind: 'literal', valueType: 'MONEY', value: '0.01' },
    }
    const brokenComponents = NL_2026_SYSTEM_COMPONENTS.map((component) => component.code === 'NL_NET_PAY'
      ? {
        ...netPay,
        method: { ...netPay.method, outputs: { ...netPay.method.outputs, netSalary: deliberatelyWrongNetSalary } },
      }
      : component)
    const brokenPackage = { ...NL_2026_RULE_PACKAGE, components: brokenComponents }
    const snapshot = sourceSnapshot('4000.00', true)
    const result = calculatePayroll(buildCalculationInputs(snapshot, brokenPackage, {
      scopeInstanceIds: { INCOME_RELATIONSHIP: snapshot.sourceIncomeRelationshipId! },
    }), NL_2026_RULE_REGISTRY)

    expect(result.status).toBe('BLOCKED')
    expect(result.controls.find((control) => control.code === 'NL2026-CTRL-002-NET-PAY-RECONCILIATION'))
      .toEqual({ code: 'NL2026-CTRL-002-NET-PAY-RECONCILIATION', status: 'FAIL', actual: false, expected: true })
  })

  it('rejects unsupported and incomplete profiles instead of defaulting a classification', () => {
    const unsupportedProfiles: readonly { readonly overrides: Readonly<Record<string, unknown>>; readonly code: string }[] = [
      { overrides: { fiscalYear: '2027' }, code: 'NL2026_UNSUPPORTED_FISCAL_YEAR' },
      { overrides: { table: 'GREEN' }, code: 'NL2026_UNSUPPORTED_TABLE' },
      { overrides: { residence: 'BE' }, code: 'NL2026_UNSUPPORTED_RESIDENCE' },
      { overrides: { ageCategory: 'AT_OR_ABOVE_AOW' }, code: 'NL2026_UNSUPPORTED_AGE_CATEGORY' },
      { overrides: { herleiding: 'AG' }, code: 'NL2026_UNSUPPORTED_HERLEIDING' },
      { overrides: { timePeriod: 'WEEK' }, code: 'NL2026_UNSUPPORTED_TIME_PERIOD' },
      { overrides: { regularWage: false }, code: 'NL2026_UNSUPPORTED_NON_REGULAR_WAGE' },
      { overrides: { fullPeriod: false }, code: 'NL2026_UNSUPPORTED_INCOMPLETE_PERIOD' },
      { overrides: { hasSpecialSituation: true }, code: 'NL2026_UNSUPPORTED_SPECIAL_SITUATION' },
      { overrides: { incomeRelationshipCount: '2' }, code: 'NL2026_UNSUPPORTED_MULTIPLE_INCOME_RELATIONSHIPS' },
    ]

    for (const unsupportedProfile of unsupportedProfiles) {
      expectEngineCode(
        () => calculate(sourceSnapshot('4000.00', true, unsupportedProfile.overrides)),
        unsupportedProfile.code,
      )
    }

    expectEngineCode(
      () => calculate(sourceSnapshot('11092.51', true)),
      'NL2026_UNSUPPORTED_ABOVE_LMAX',
    )
    expectEngineCode(
      () => calculate(sourceSnapshot('4000.001', true)),
      'NL2026_UNSUPPORTED_MONEY_PRECISION',
    )
    expectEngineCode(
      () => calculate(sourceSnapshot('-0.01', true)),
      'NL2026_UNSUPPORTED_NEGATIVE_WAGE',
    )
    const missingProfile = sourceSnapshot('4000.00', true, { incomeRelationshipCount: undefined })
    expectEngineCode(() => buildCalculationInputs(missingProfile, NL_2026_RULE_PACKAGE), 'REQUIRED_INPUT_MISSING')
  })

  it('traces statutory rounding stages with exact inputs, results, differences and source pins', () => {
    const result = calculate(sourceSnapshot('4000.00', true))
    const steps = registeredTrace(result)
    const byCode = new Map(steps.map((step) => [step.code, step]))
    const annualWageRounding = byCode.get('rounding.annual-table-wage')
    expect(annualWageRounding?.values.roundingMode).toEqual({ valueType: 'STRING', value: 'ROUND_DOWN_TO_MULTIPLE' })
    expect(annualWageRounding?.values.targetMultiple).toEqual({ valueType: 'DECIMAL', value: '54' })
    expect(annualWageRounding?.values.unroundedValue).toEqual({ valueType: 'DECIMAL', value: '48000' })
    expect(annualWageRounding?.values.roundedValue).toEqual({ valueType: 'DECIMAL', value: '47952' })
    expect(annualWageRounding?.values.roundingDifference).toEqual({ valueType: 'DECIMAL', value: '-48' })
    expect(annualWageRounding?.values.roundingRuleVersion).toEqual({ valueType: 'STRING', value: '2026.1' })
    expect(annualWageRounding?.values.statutorySourceHash).toEqual({
      valueType: 'STRING', value: NL_2026_SOURCE_METADATA.calculationRulesSha256,
    })
    expect(byCode.get('rounding.labour-credit-build-1')?.values.decimalPlaces).toEqual({ valueType: 'DECIMAL', value: '5' })
    expect(byCode.get('rounding.period-wage-tax')?.values.unroundedValue).toEqual({ valueType: 'STRING', value: '9824/12' })
    expect(byCode.get('rounding.period-wage-tax')?.values.roundedValue).toEqual({ valueType: 'DECIMAL', value: '818.67' })
    expect(byCode.get('rounding.period-wage-tax')?.values.roundingDifference).toEqual({ valueType: 'STRING', value: '0.04/12' })
    expect(byCode.get('credit.labour-credit-steps')?.values.theoreticalLabourCredit).toEqual({ valueType: 'MONEY', value: '5532.00' })
    expect(byCode.get('result.period-values')?.values.appliedLabourCreditMonthly).toEqual({ valueType: 'MONEY', value: '461.00' })
  })

  it('pins component parameters, package composition and normalized calculator source', async () => {
    const normalizedCalculator = (await readFile(resolve(testDirectory, '../src/regular-wage/calculator.ts'), 'utf8'))
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
    const implementationHash = createHash('sha256').update(normalizedCalculator, 'utf8').digest('hex')
    expect(NL_2026_IMPLEMENTATION_SHA256).toBe(implementationHash)

    const component = NL_2026_SYSTEM_COMPONENTS.find((candidate) => candidate.code === 'NL_WAGE_TAX')
    if (!component || component.method.kind !== 'registeredRule') throw new Error('Registered NL wage-tax component is missing.')
    const parameterSetHash = sha256(stableSerialize(NL_2026_PARAMETERS))
    expect(component.parameters).toEqual(NL_2026_PARAMETERS)
    expect(component.method.implementationHash).toBe(implementationHash)
    expect(component.method.parameterSetHash).toBe(parameterSetHash)
    expect(NL_2026_RULE_PACKAGE.metadata?.parameterSetHash).toBe(parameterSetHash)
    expect(NL_2026_RULE_PACKAGE.metadata?.packageId).toBe(NL_2026_PACKAGE_ID)
    expect(NL_2026_RULE_PACKAGE.metadata?.version).toBe(NL_2026_PACKAGE_VERSION)
    expect(NL_2026_RULE_PACKAGE.metadata?.packageHash).toBe(NL_2026_PACKAGE_HASH)

    const packageHashInput = {
      packageId: NL_2026_PACKAGE_ID,
      version: NL_2026_PACKAGE_VERSION,
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-12-31',
      implementationHash,
      parameters: NL_2026_PARAMETERS,
      parameterMetadata: NL_2026_PARAMETER_METADATA,
      sourceMetadata: NL_2026_RULE_PACKAGE.metadata?.sourceMetadata,
      components: NL_2026_SYSTEM_COMPONENTS,
      controls: NL_2026_CONTROLS,
      roundingDefinitions: NL_2026_ROUNDING_DEFINITIONS,
      resultMappings: NL_2026_RESULT_COMPONENTS,
    }
    expect(sha256(stableSerialize(packageHashInput))).toBe(NL_2026_PACKAGE_HASH)
    expect(NL_2026_SOURCE_METADATA.calculationRulesSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(NL_2026_SOURCE_METADATA.parameterAppendixSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(NL_2026_SOURCE_METADATA.handbookSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(NL_2026_ROUNDING_DEFINITIONS).toHaveLength(13)
  })

  it('produces deterministic result and input hashes for a fixed source snapshot', () => {
    const snapshot = sourceSnapshot('4000.00', true)
    const first = calculate(snapshot)
    const second = calculate(snapshot)
    expect(first.inputHash).toBe(second.inputHash)
    expect(first.rulePackageCompositionHash).toBe(second.rulePackageCompositionHash)
    expect(first.resultHash).toBe(second.resultHash)
    expect(first.packageMetadata).toEqual(second.packageMetadata)
  })
})
