import { describe, expect, it } from 'vitest'
import {
  FixedDecimal,
  PayrollEngineError,
  applyPayrollRounding,
  applyPayrollRoundingToRatio,
  buildCalculationInputs,
  calculatePayroll,
  forkSystemComponent,
  sha256,
  stableSerialize,
  type PayrollComponentDefinition,
  type PayrollRegisteredRule,
  type PayrollRoundingDefinition,
  type PayrollRulePackage,
  type PayrollSourceSnapshot,
} from '../src/index'

const snapshot = (amount = '4000.12345678'): PayrollSourceSnapshot => ({
  id: 'registered-rule-snapshot',
  sourceTenantId: 'tenant-test',
  sourceHrGroupId: 'group-test',
  sourceAdministrationId: 'administration-test',
  sourceEmployeeId: 'employee-test',
  sourceEmploymentId: 'employment-test',
  sourceIncomeRelationshipId: 'income-relationship-test',
  periodReference: { year: 2026, month: 9 },
  canonicalSource: {
    schemaVersion: 'payroll-source-v1',
    compensation: { entries: [{ parttimeAmount: amount, currencyCode: 'EUR', paymentFrequency: 'Monthly' }] },
  },
  sourceVersionVector: { employment: 'v1', salary: 'v1' },
  sourceGaps: [],
  sourceHash: 'b'.repeat(64),
  createdAt: '2026-09-30T08:00:00.000Z',
})

const packageId = 'PAYROLL-TEST-RULES'
const packageVersion = '1.0.0'
const ruleKey = 'test.exact-copy'
const ruleVersion = '1.0.0'
const implementationHash = sha256('trusted-static-implementation-v1')
const parameterSetHash = sha256(stableSerialize({}))
const packageMetadata = {
  packageId,
  version: packageVersion,
  packageHash: sha256('test-package-content'),
  parameterSetHash,
  sourceMetadata: { reference: 'fixture://registered-rule-test' },
} as const

function ruleComponent(): PayrollComponentDefinition {
  return {
    id: 'system-tax-rule-id',
    code: 'test_tax_rule',
    version: '1.0.0',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    ownership: { kind: 'SYSTEM' },
    processingScope: 'INCOME_RELATIONSHIP',
    inputs: [{ name: 'wage', valueType: 'MONEY', required: true }],
    outputs: [{ name: 'Tax', valueType: 'MONEY' }],
    dependencies: [{ componentCode: 'gross_salary', outputName: 'Amount', inputName: 'wage' }],
    parameters: {},
    method: { kind: 'registeredRule', ruleKey, ruleVersion, implementationHash, parameterSetHash },
    tracePolicy: 'FULL',
  }
}

function rulePackage(
  component: PayrollComponentDefinition = ruleComponent(),
  overrides: Partial<PayrollRulePackage> = {},
): PayrollRulePackage {
  const source: PayrollComponentDefinition = {
    id: 'gross-source-id',
    code: 'gross_salary',
    version: '1.0.0',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    ownership: { kind: 'SYSTEM' },
    processingScope: 'INCOME_RELATIONSHIP',
    inputs: [],
    outputs: [{ name: 'Amount', valueType: 'MONEY' }],
    dependencies: [],
    method: { kind: 'source', path: ['compensation', 'entries', 0, 'parttimeAmount'] },
    tracePolicy: 'FULL',
  }
  return {
    compositionId: 'registered-rule-composition-v1',
    metadata: packageMetadata,
    components: [source, component],
    controls: [],
    resultMappings: [{ key: 'tax', componentCode: 'test_tax_rule', outputName: 'Tax' }],
    ...overrides,
  }
}

function roundingDefinition(overrides: Partial<PayrollRoundingDefinition> = {}): PayrollRoundingDefinition {
  return {
    id: 'registered-rule-month-cent-rounding',
    componentCode: 'test_tax_rule',
    stage: 'monthly-tax-result',
    ruleVersion,
    packageId,
    packageVersion,
    mode: 'ARITHMETIC',
    decimalPlaces: 2,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    provenance: {
      sourceReference: 'Belastingdienst Rekenvoorschriften 2026, par. 2.2.5',
      sourceHash: sha256('official-source-fixture'),
    },
    ...overrides,
  }
}

function registry(execute?: PayrollRegisteredRule['execute']): readonly PayrollRegisteredRule[] {
  const component = ruleComponent()
  return [{
    ruleKey,
    ruleVersion,
    implementationHash,
    parameterSetHash,
    packageId,
    packageVersion,
    allowedComponents: [{ id: component.id, code: component.code, version: component.version }],
    inputs: component.inputs,
    outputs: component.outputs,
    execute: execute ?? ((context) => ({
      outputs: { Tax: context.inputs.wage! },
      trace: [{ code: 'copy-wage', values: { taxableWage: context.inputs.wage! }, sourceReference: 'fixture://exact-copy' }],
    })),
  }]
}

function expectEngineError(action: () => unknown, code: string): void {
  try {
    action()
    throw new Error(`Expected PayrollEngineError ${code}`)
  } catch (error) {
    if (!(error instanceof PayrollEngineError)) throw error
    expect(error.code).toBe(code)
  }
}

describe('registered system rules', () => {
  it('runs one pinned trusted rule with frozen inputs, package provenance and scope identity', () => {
    let executionContextFrozen = false
    let passedRoundingDefinitions: readonly PayrollRoundingDefinition[] | undefined
    const execute: PayrollRegisteredRule['execute'] = (context) => {
      executionContextFrozen = Object.isFrozen(context) && Object.isFrozen(context.inputs)
        && Object.isFrozen(context.parameters) && Object.isFrozen(context.roundingDefinitions)
      passedRoundingDefinitions = context.roundingDefinitions
      return {
        outputs: { Tax: context.inputs.wage! },
        trace: [{ code: 'copy-wage', values: { taxableWage: context.inputs.wage! }, sourceReference: 'fixture://exact-copy' }],
      }
    }
    const definition = roundingDefinition()
    const inputs = buildCalculationInputs(snapshot(), rulePackage(undefined, { roundingDefinitions: [definition] }), {
      scopeInstanceIds: { INCOME_RELATIONSHIP: 'synthetic-income-relationship-uuid' },
    })
    const result = calculatePayroll(inputs, registry(execute))

    expect(executionContextFrozen).toBe(true)
    expect(passedRoundingDefinitions).toEqual([definition])
    expect(Object.isFrozen(passedRoundingDefinitions)).toBe(true)
    expect(result.componentResults.find((item) => item.componentCode === 'test_tax_rule')?.outputs)
      .toEqual([{ name: 'Tax', valueType: 'MONEY', value: '4000.12345678' }])
    expect(result.packageMetadata?.packageHash).toBe(packageMetadata.packageHash)
    expect(result.trace.find((item) => item.componentCode === 'test_tax_rule')?.rulePackageProvenance)
      .toEqual({ packageId, version: packageVersion, packageHash: packageMetadata.packageHash, parameterSetHash })
    expect(result.trace.every((step) => step.rulePackageProvenance?.packageHash === packageMetadata.packageHash)).toBe(true)
    expect(result.componentResults.find((item) => item.componentCode === 'test_tax_rule')?.nodeIdentity)
      .toEqual({
        componentCode: 'test_tax_rule',
        componentVersion: '1.0.0',
        scopeKind: 'INCOME_RELATIONSHIP',
        scopeInstanceId: 'synthetic-income-relationship-uuid',
      })
    expect(result.trace.find((item) => item.componentCode === 'test_tax_rule')?.registeredRuleTrace?.[0]?.sourceReference)
      .toBe('fixture://exact-copy')
  })

  it('rejects missing pins, customer execution, copied registered methods and schema drift', () => {
    const inputs = buildCalculationInputs(snapshot(), rulePackage())
    expectEngineError(() => calculatePayroll(inputs), 'REGISTERED_RULE_UNAVAILABLE')
    expectEngineError(() => calculatePayroll(inputs, [{
      ...registry()[0]!,
      implementationHash: sha256('different-implementation'),
    }]), 'REGISTERED_RULE_IDENTITY_MISMATCH')

    const customerMethod = { ...ruleComponent(), ownership: { kind: 'CUSTOMER_CUSTOM' as const } }
    expectEngineError(() => buildCalculationInputs(snapshot(), rulePackage(customerMethod)), 'REGISTERED_RULE_SYSTEM_ONLY')
    expectEngineError(() => forkSystemComponent(ruleComponent(), {
      id: 'customer-fork-id',
      code: 'customer_tax_rule',
      version: '1.0.0',
      effectiveFrom: '2026-01-01',
      forkedAt: '2026-09-30T10:00:00.000Z',
    }), 'REGISTERED_RULE_SYSTEM_ONLY')

    const mismatchedSchema = [{ ...registry()[0]!, inputs: [{ name: 'wage', valueType: 'MONEY' as const, required: false }] }]
    expectEngineError(() => calculatePayroll(inputs, mismatchedSchema), 'REGISTERED_RULE_SCHEMA_MISMATCH')
  })

  it('rejects promises and output/trace contract violations', () => {
    const inputs = buildCalculationInputs(snapshot(), rulePackage())
    const asyncRule = {
      ...registry()[0]!,
      execute: (() => Promise.resolve({ outputs: { Tax: { valueType: 'MONEY', value: '1' } }, trace: [] })) as unknown as PayrollRegisteredRule['execute'],
    }
    expectEngineError(() => calculatePayroll(inputs, [asyncRule]), 'REGISTERED_RULE_ASYNC_UNSUPPORTED')

    const extraOutput = {
      ...registry()[0]!,
      execute: (context: Parameters<PayrollRegisteredRule['execute']>[0]) => ({
        outputs: { Tax: context.inputs.wage!, Other: context.inputs.wage! }, trace: [],
      }),
    }
    expectEngineError(() => calculatePayroll(inputs, [extraOutput]), 'REGISTERED_RULE_OUTPUT_INVALID')

    const oversizedTrace = {
      ...registry()[0]!,
      execute: (context: Parameters<PayrollRegisteredRule['execute']>[0]) => ({
        outputs: { Tax: context.inputs.wage! },
        trace: [{ code: 'step', values: {}, sourceReference: 'x'.repeat(2_049) }],
      }),
    }
    expectEngineError(() => calculatePayroll(inputs, [oversizedTrace]), 'REGISTERED_RULE_TRACE_INVALID')
  })

  it('reserves iteration as unsupported and hashes scoped identities into the input', () => {
    const component = ruleComponent()
    const base = rulePackage(component)
    const iterative = {
      ...base,
      iterativeClusters: [{
        id: 'reserved-cluster',
        version: '1.0.0',
        componentCodes: [component.code],
        policy: {
          version: '1.0.0',
          minimumIterations: 1,
          maximumIterations: 10,
          tolerance: '0.01',
          comparisonPrecision: { decimalPlaces: 2, mode: 'ARITHMETIC' as const },
          outputSelectors: [{ componentCode: component.code, outputName: 'Tax' }],
        },
      }],
    }
    expectEngineError(() => buildCalculationInputs(snapshot(), iterative), 'ITERATIVE_CLUSTER_UNSUPPORTED')

    const first = buildCalculationInputs(snapshot(), base, { scopeInstanceIds: { INCOME_RELATIONSHIP: 'ikv-1' } })
    const second = buildCalculationInputs(snapshot(), base, { scopeInstanceIds: { INCOME_RELATIONSHIP: 'ikv-2' } })
    expect(first.inputHash).not.toBe(second.inputHash)
    expect(calculatePayroll(first, registry()).resultHash).not.toBe(calculatePayroll(second, registry()).resultHash)
  })
})

describe('explicit versioned rounding', () => {
  const base = roundingDefinition()
  const definition = (mode: PayrollRoundingDefinition['mode'], extra: Partial<PayrollRoundingDefinition> = {}): PayrollRoundingDefinition => ({
    ...base,
    mode,
    decimalPlaces: mode === 'ROUND_DOWN_TO_MULTIPLE' || mode === 'NO_ROUNDING' ? undefined : 0,
    targetMultiple: undefined,
    ...extra,
  }) as PayrollRoundingDefinition

  it('distinguishes floor from truncation and supports arithmetic, ceiling, multiples and no rounding', () => {
    expect(applyPayrollRounding(FixedDecimal.parse('-1.2'), definition('FLOOR')).toString()).toBe('-2')
    expect(applyPayrollRounding(FixedDecimal.parse('-1.2'), definition('TRUNCATE')).toString()).toBe('-1')
    expect(applyPayrollRounding(FixedDecimal.parse('1.2'), definition('CEILING')).toString()).toBe('2')
    expect(applyPayrollRounding(FixedDecimal.parse('-1.25'), definition('ARITHMETIC', { decimalPlaces: 1 })).toString()).toBe('-1.3')
    expect(applyPayrollRounding(FixedDecimal.parse('-1.26'), definition('ROUND_DOWN_TO_MULTIPLE', { targetMultiple: '0.5' })).toString()).toBe('-1.5')
    expect(applyPayrollRounding(FixedDecimal.parse('1.234567890123456789'), definition('NO_ROUNDING')).toString())
      .toBe('1.234567890123456789')
  })

  it('rounds rational values directly and refuses hidden division scale or lossy serialization', () => {
    expect(applyPayrollRoundingToRatio(FixedDecimal.parse('1'), FixedDecimal.parse('3'), definition('ARITHMETIC', { decimalPlaces: 2 })).toString(2))
      .toBe('0.33')
    expect(applyPayrollRoundingToRatio(FixedDecimal.parse('-1'), FixedDecimal.parse('3'), definition('FLOOR', { decimalPlaces: 2 })).toString(2))
      .toBe('-0.34')
    expect(applyPayrollRoundingToRatio(FixedDecimal.parse('1'), FixedDecimal.parse('3'), definition('CEILING', { decimalPlaces: 2 })).toString(2))
      .toBe('0.34')
    expect(FixedDecimal.parse('1').divideExact(FixedDecimal.parse('8')).toString()).toBe('0.125')
    expectEngineError(() => FixedDecimal.parse('1').divideExact(FixedDecimal.parse('3')), 'DECIMAL_DIVISION_ROUNDING_REQUIRED')
    expectEngineError(() => FixedDecimal.parse('1.234').toString(2), 'DECIMAL_SERIALIZATION_LOSS')
    expect(FixedDecimal.parse('1.2300').toString(2)).toBe('1.23')
  })

  it('rejects incomplete provenance and overlapping policies for a stage', () => {
    const component = ruleComponent()
    expectEngineError(() => buildCalculationInputs(snapshot(), rulePackage(component, {
      roundingDefinitions: [roundingDefinition({ provenance: { sourceReference: 'missing hash', sourceHash: 'invalid' } })],
    })), 'ROUNDING_DEFINITION_INVALID')
    expectEngineError(() => buildCalculationInputs(snapshot(), rulePackage(component, {
      roundingDefinitions: [base, { ...base, id: 'second-policy', effectiveFrom: '2026-09-01' }],
    })), 'ROUNDING_DEFINITION_OVERLAP')
  })
})
