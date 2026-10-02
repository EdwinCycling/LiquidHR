import { describe, expect, it } from 'vitest'
import {
  FixedDecimal,
  PayrollEngineError,
  PAYROLL_ENGINE_VERSION,
  appendPayrollComponentVersion,
  buildCalculationInputs,
  calculatePayroll,
  configureCustomerComponent,
  forkSystemComponent,
  sha256,
  type PayrollComponentDefinition,
  type PayrollRulePackage,
  type PayrollSourceSnapshot,
} from '../src/index'
import {
  GC_NL_001_RESULT_COMPONENTS,
  GC_NL_001_RULE_PACKAGE,
} from '../src/golden-cases/gc-nl-001'

const sourceSnapshot = (canonicalSource: PayrollSourceSnapshot['canonicalSource'] = {
  schemaVersion: 'payroll-source-v1',
  compensation: {
    entries: [{ parttimeAmount: '4000.00', currencyCode: 'EUR', paymentFrequency: 'Monthly' }],
  },
}) => ({
  id: 'snapshot-gc1',
  sourceTenantId: 'tenant-gc1',
  sourceHrGroupId: 'group-gc1',
  sourceAdministrationId: 'administration-gc1',
  sourceEmployeeId: 'employee-gc1',
  sourceEmploymentId: 'employment-gc1',
  sourceIncomeRelationshipId: 'income-relationship-gc1',
  periodReference: { year: 2026, month: 9 },
  canonicalSource,
  sourceVersionVector: { employment: 'v1', salary: 'v1' },
  sourceGaps: [],
  sourceHash: 'a'.repeat(64),
  createdAt: '2026-09-25T08:00:00.000Z',
}) satisfies PayrollSourceSnapshot

function sourceSalaryComponent(code = 'gross_salary'): PayrollComponentDefinition {
  return {
    id: `id-${code}`,
    code,
    version: '1.0.0',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    ownership: { kind: 'SYSTEM' },
    processingScope: 'INCOME_RELATIONSHIP',
    inputs: [],
    outputs: [{ name: 'Amount', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
    dependencies: [],
    method: {
      kind: 'source',
      path: ['compensation', 'entries', 0, 'parttimeAmount'],
    },
    tracePolicy: 'FULL',
  }
}

function simplePackage(components: readonly PayrollComponentDefinition[]): PayrollRulePackage {
  return { compositionId: 'test-composition-v1', components, controls: [], resultMappings: [] }
}

describe('fixed decimal arithmetic', () => {
  it('keeps money arithmetic exact and rounds without floating point', () => {
    const sum = FixedDecimal.parse('0.10').add(FixedDecimal.parse('0.20'))
    expect(sum.toString()).toBe('0.3')
    expect(FixedDecimal.parse('1.005').round(2, 'HALF_UP').toString(2)).toBe('1.01')
    expect(FixedDecimal.parse('-1.005').round(2, 'HALF_UP').toString(2)).toBe('-1.01')
    expect(FixedDecimal.parse('1.025').round(2, 'HALF_EVEN').toString(2)).toBe('1.02')
    expect(() => FixedDecimal.parse('1e-2')).toThrow(PayrollEngineError)
  })
})

describe('PAYLAB M0 payroll engine', () => {
  it('matches the synthetic GC-NL-001 totals and keeps holiday accrual outside net salary', () => {
    const inputs = buildCalculationInputs(sourceSnapshot(), GC_NL_001_RULE_PACKAGE)
    const result = calculatePayroll(inputs)

    expect(PAYROLL_ENGINE_VERSION).toBe(result.engineVersion)
    expect(result.status).toBe('CALCULATED')
    expect(result.componentResults).toHaveLength(9)
    expect(result.resultRows.map((row) => row.key)).toEqual(GC_NL_001_RESULT_COMPONENTS.map((row) => row.key))
    expect(Object.fromEntries(result.resultRows.map((row) => [row.key, row.value]))).toEqual({
      gross_salary: '4000.00',
      employee_pension: '125.00',
      wage_tax: '700.00',
      net_salary: '3175.00',
      employer_pension: '250.00',
      employer_insurance: '400.00',
      employer_zvw: '260.00',
      holiday_allowance_accrual: '320.00',
      total_employer_cost: '4910.00',
    })
    expect(result.controls.length).toBeGreaterThan(0)
    expect(result.controls.every((control) => control.status === 'PASS')).toBe(true)
    expect(result.trace.map((step) => step.componentCode)).toEqual([
      'employee_pension',
      'employer_insurance',
      'employer_pension',
      'employer_zvw',
      'gross_salary',
      'holiday_allowance_accrual',
      'total_employer_cost',
      'wage_tax',
      'net_salary',
    ])
    expect(result.trace.find((step) => step.componentCode === 'net_salary')?.dependencyRefs)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ componentCode: 'gross_salary' }),
        expect.objectContaining({ componentCode: 'employee_pension' }),
        expect.objectContaining({ componentCode: 'wage_tax' }),
      ]))
  })

  it('hashes inputs and outputs deterministically and ignores definition order', () => {
    const snapshot = sourceSnapshot()
    const forwardInputs = buildCalculationInputs(snapshot, GC_NL_001_RULE_PACKAGE)
    const reverseInputs = buildCalculationInputs(snapshot, {
      ...GC_NL_001_RULE_PACKAGE,
      components: [...GC_NL_001_RULE_PACKAGE.components].reverse(),
    })
    const first = calculatePayroll(forwardInputs)
    const second = calculatePayroll(reverseInputs)

    expect(forwardInputs.inputHash).toMatch(/^[0-9a-f]{64}$/)
    expect(first.inputHash).toBe(forwardInputs.inputHash)
    expect(first.inputHash).toBe(second.inputHash)
    expect(first.rulePackageCompositionHash).toBe(second.rulePackageCompositionHash)
    expect(first.resultHash).toBe(second.resultHash)
    expect(first.trace).toEqual(second.trace)
  })

  it('does not include generated snapshot identity or capture time in result hashes', () => {
    const originalSnapshot = sourceSnapshot()
    const replaySnapshot = {
      ...originalSnapshot,
      id: 'snapshot-replay',
      createdAt: '2026-09-26T09:00:00.000Z',
    }
    const originalInputs = buildCalculationInputs(originalSnapshot, GC_NL_001_RULE_PACKAGE)
    const replayInputs = buildCalculationInputs(replaySnapshot, GC_NL_001_RULE_PACKAGE)

    expect(originalInputs.inputHash).toBe(replayInputs.inputHash)
    expect(calculatePayroll(originalInputs).resultHash).toBe(calculatePayroll(replayInputs).resultHash)
  })

  it('uses a pure SHA-256 implementation with standard vectors', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('rejects JavaScript-number money and invalid dependency graphs', () => {
    expect(() => buildCalculationInputs(sourceSnapshot({
      compensation: { entries: [{ parttimeAmount: 4000 }] },
    }), GC_NL_001_RULE_PACKAGE)).toThrow(/exact decimal string/)

    const broken = sourceSalaryComponent()
    const consumer: PayrollComponentDefinition = {
      ...sourceSalaryComponent('net_salary'),
      inputs: [{ name: 'salary', valueType: 'MONEY', required: true }],
      dependencies: [{ componentCode: 'gross_salary', outputName: 'Missing', inputName: 'salary' }],
      method: { kind: 'passThrough', outputs: { Amount: 'salary' } },
    }
    expect(() => buildCalculationInputs(sourceSnapshot(), simplePackage([broken, consumer])))
      .toThrow(/output/i)

    const cyclicSource: Record<string, unknown> = {}
    cyclicSource.self = cyclicSource
    const cyclicSnapshot = {
      ...sourceSnapshot(),
      canonicalSource: cyclicSource as unknown as PayrollSourceSnapshot['canonicalSource'],
    }
    expect(() => buildCalculationInputs(cyclicSnapshot, GC_NL_001_RULE_PACKAGE)).toThrow(/cyclic source/i)
  })

  it('rejects cycles, incompatible dependency types, and expression resource abuse', () => {
    const left: PayrollComponentDefinition = {
      ...sourceSalaryComponent('left'),
      inputs: [{ name: 'right', valueType: 'MONEY', required: true }],
      dependencies: [{ componentCode: 'right', outputName: 'Amount', inputName: 'right' }],
      method: { kind: 'passThrough', outputs: { Amount: 'right' } },
    }
    const right: PayrollComponentDefinition = {
      ...sourceSalaryComponent('right'),
      inputs: [{ name: 'left', valueType: 'MONEY', required: true }],
      dependencies: [{ componentCode: 'left', outputName: 'Amount', inputName: 'left' }],
      method: { kind: 'passThrough', outputs: { Amount: 'left' } },
    }
    expect(() => buildCalculationInputs(sourceSnapshot(), simplePackage([left, right])))
      .toThrow(/cycle/i)

    const depthAbuse = sourceSalaryComponent('deep')
    const method = { kind: 'expression', outputs: { Amount: { kind: 'literal', valueType: 'MONEY', value: '1.00' } } } as const
    const tooDeep = { ...depthAbuse, method: { ...method, outputs: { Amount: wrapDeeply(method.outputs.Amount, 40) } } }
    expect(() => buildCalculationInputs(sourceSnapshot(), simplePackage([tooDeep])))
      .toThrow(/depth|budget/i)
  })

  it('validates detached customer forks and permits historical system versions without overlap', () => {
    const original = sourceSalaryComponent()
    const firstVersion = { ...original, effectiveTo: '2026-12-31' }
    const historical = { ...original, version: '1.1.0', effectiveFrom: '2027-01-01' }
    const fork: PayrollComponentDefinition = {
      ...original,
      id: 'customer-id',
      code: 'customer_gross_salary',
      ownership: {
        kind: 'CUSTOMER_FORK',
        origin: { id: original.id, code: original.code, version: original.version },
        forkedAt: '2026-09-30T10:00:00.000Z',
      },
    }
    const active = buildCalculationInputs(sourceSnapshot(), simplePackage([firstVersion, historical]))
    expect(active.components.map((component) => component.version)).toEqual(['1.0.0'])
    expect(() => buildCalculationInputs(sourceSnapshot(), simplePackage([original, fork])))
      .not.toThrow()
    expect(() => buildCalculationInputs(sourceSnapshot(), simplePackage([{
      ...fork,
      id: original.id,
      code: original.code,
    }]))).toThrow(/fork.*distinct|distinct.*origin/i)
    expect(() => buildCalculationInputs(sourceSnapshot(), simplePackage([{
      ...fork,
      ownership: { kind: 'CUSTOMER_CUSTOM' },
    }]))).not.toThrow()
    expect(() => buildCalculationInputs(sourceSnapshot(), simplePackage([{
      ...fork,
      ownership: {
        kind: 'CUSTOMER_CUSTOM',
        origin: { id: original.id, code: original.code, version: original.version },
        forkedAt: '2026-09-30T10:00:00.000Z',
      },
    } as PayrollComponentDefinition]))).toThrow(/CUSTOMER_CUSTOM.*origin|origin.*CUSTOMER_CUSTOM/i)
    const impersonator: PayrollComponentDefinition = {
      ...historical,
      id: 'customer-impersonator',
      ownership: { kind: 'CUSTOMER_CUSTOM' },
    }
    expect(() => buildCalculationInputs(sourceSnapshot(), simplePackage([firstVersion, historical, impersonator])))
      .toThrow(/identity.*reused|identity collision/i)
  })

  it('keeps system definitions immutable and creates detached forks and append-only versions', () => {
    const system = sourceSalaryComponent()
    expect(() => configureCustomerComponent(system, { processingScope: 'EMPLOYEE' }))
      .toThrow(/system components are immutable/i)

    const fork = forkSystemComponent(system, {
      id: 'customer-gross-id',
      code: 'customer_gross_salary',
      version: '1.0.0',
      effectiveFrom: '2026-01-01',
      forkedAt: '2026-09-30T10:00:00.000Z',
      overrides: { processingScope: 'EMPLOYEE' },
    })
    expect(fork.ownership).toEqual({
      kind: 'CUSTOMER_FORK',
      origin: { id: system.id, code: system.code, version: system.version },
      forkedAt: '2026-09-30T10:00:00.000Z',
    })
    expect(fork.id).not.toBe(system.id)
    expect(fork.code).not.toBe(system.code)
    ;(system.method as { kind: 'source'; path: (string | number)[] }).path.push('changed-after-fork')
    expect(fork.method).toMatchObject({ path: ['compensation', 'entries', 0, 'parttimeAmount'] })

    const published = { ...sourceSalaryComponent(), effectiveTo: '2026-12-31' }
    const publishedJson = JSON.stringify(published)
    const next = { ...sourceSalaryComponent(), version: '1.1.0', effectiveFrom: '2027-01-01' }
    const history = appendPayrollComponentVersion([published], next)
    expect(history.map((version) => [version.version, version.effectiveFrom, version.effectiveTo])).toEqual([
      ['1.0.0', '2026-01-01', '2026-12-31'],
      ['1.1.0', '2027-01-01', null],
    ])
    expect(history[0]).toEqual(published)
    expect(JSON.stringify(published)).toBe(publishedJson)
    expect(() => appendPayrollComponentVersion([sourceSalaryComponent()], next)).toThrow(/open-ended/i)
    const effective2027 = buildCalculationInputs(sourceSnapshot(), simplePackage(history), { effectiveDate: '2027-01-01' })
    expect(effective2027.components[0]?.version).toBe('1.1.0')
    expect(() => appendPayrollComponentVersion(history, { ...next, effectiveFrom: '2026-06-01', version: '1.2.0' }))
      .toThrow(/append|overlap/i)

    const custom = { ...sourceSalaryComponent('customer_custom'), ownership: { kind: 'CUSTOMER_CUSTOM' as const } }
    const forgedPatch = {
      id: system.id,
      code: system.code,
      ownership: { kind: 'SYSTEM' },
    } as unknown as Parameters<typeof configureCustomerComponent>[1]
    expect(() => configureCustomerComponent(custom, forgedPatch)).toThrow(/unsupported property/i)
    const forgedForkOptions = {
      id: 'another-customer-id',
      code: 'another_customer_code',
      version: '1.0.0',
      effectiveFrom: '2026-01-01',
      forkedAt: '2026-09-30T10:00:00.000Z',
      overrides: { ownership: { kind: 'SYSTEM' } },
    } as unknown as Parameters<typeof forkSystemComponent>[1]
    expect(() => forkSystemComponent(system, forgedForkOptions)).toThrow(/unsupported property/i)
  })
})

describe('safe expression runtime', () => {
  it('runs bounded typed expressions with percentages, output refs, parameters, comparisons and functions', () => {
    const gross = sourceSalaryComponent()
    const bonus: PayrollComponentDefinition = {
      id: 'id-bonus',
      code: 'bonus',
      version: '1.0.0',
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      ownership: { kind: 'SYSTEM' },
      processingScope: 'INCOME_RELATIONSHIP',
      inputs: [{ name: 'gross', valueType: 'MONEY', required: true }],
      outputs: [{ name: 'Amount', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
      dependencies: [{ componentCode: 'gross_salary', outputName: 'Amount', inputName: 'gross' }],
      parameters: { minimum: { valueType: 'MONEY', value: '100.00' } },
      method: {
        kind: 'expression',
        outputs: {
          Amount: {
            kind: 'if',
            condition: {
              kind: 'binary', operator: 'AND',
              left: { kind: 'binary', operator: '>=', left: { kind: 'input', name: 'gross' }, right: { kind: 'parameter', name: 'minimum' } },
              right: { kind: 'unary', operator: 'NOT', operand: { kind: 'boolean', value: false } },
            },
            then: {
              kind: 'call', operator: 'MAX', arguments: [
                { kind: 'call', operator: 'ROUND', arguments: [
                  { kind: 'binary', operator: '*', left: { kind: 'output', componentCode: 'gross_salary', outputName: 'Amount' }, right: { kind: 'literal', valueType: 'PERCENTAGE', value: '2.50' } },
                  { kind: 'literal', valueType: 'DECIMAL', value: '2' },
                ] },
                { kind: 'literal', valueType: 'MONEY', value: '0.00' },
              ],
            },
            else: { kind: 'literal', valueType: 'MONEY', value: '0.00' },
          },
        },
      },
      tracePolicy: 'FULL',
    }
    const result = calculatePayroll(buildCalculationInputs(sourceSnapshot(), simplePackage([gross, bonus])))
    expect(result.componentResults.find((component) => component.componentCode === 'bonus')?.outputs)
      .toEqual([{ name: 'Amount', valueType: 'MONEY', value: '100.00' }])
  })
})

function wrapDeeply(node: object, count: number): object {
  let expression = node
  for (let index = 0; index < count; index += 1) {
    expression = { kind: 'unary', operator: 'ABS', operand: expression }
  }
  return expression
}
