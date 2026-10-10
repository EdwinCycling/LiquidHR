import { readFileSync } from 'node:fs'
import { NL_2026_TEST_ENGINE, NL_2026_TEST_SCENARIO } from './nl-2026-calculation-service'
import { PayrollEngineError } from '@liquid-hr/payroll-engine'
import { describe, expect, it, vi } from 'vitest'
import type {
  PayrollCalculationInputs,
  PayrollCalculationResult,
  PayrollResultMapping,
  PayrollSourceSnapshot,
} from '@liquid-hr/payroll-engine'
import { GC_NL_001_RESULT_COMPONENTS, GC_NL_001_RULE_PACKAGE } from '@liquid-hr/payroll-engine'
import type {
  PayrollCalculationInputSetRow,
  PayrollCalculationRunRow,
  PayrollComponentResultRow,
  PayrollControlRow,
  PayrollDatabase,
  PayrollGoldenCaseRunRow,
  PayrollPeriodRow,
  PayrollSourceSnapshotRow,
} from './database'
import {
  createSyntheticPayrollService,
  SyntheticPayrollServiceError,
  type SyntheticPayrollEngine,
  type PayrollTestScenario,
} from './synthetic-calculation-service'
import { PayrollCalculationRepositoryError, type PayrollCalculationRepository } from './calculation-repository'
import { createSyntheticPayrollSnapshot } from './synthetic-source'

const scope = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '10000000-0000-4000-8000-000000000002',
  administrationId: '10000000-0000-4000-8000-000000000003',
}
const payrollAdministrationId = '10000000-0000-4000-8000-000000000004'
const actorUserId = '10000000-0000-4000-8000-000000000005'
const runId = '10000000-0000-4000-8000-000000000006'
const inputSetId = '10000000-0000-4000-8000-000000000007'
const periodId = '10000000-0000-4000-8000-000000000008'
const snapshotId = '80000000-0000-4000-8000-000000000001'
const fixedNow = new Date('2026-09-30T12:00:00.000Z')

function makeRepository(capabilityEnabled = true) {
  const calls: string[] = []
  let period: PayrollPeriodRow | null = null
  let sourceSnapshot: PayrollSourceSnapshotRow | null = null
  let inputSet: PayrollCalculationInputSetRow | null = null
  let run: PayrollCalculationRunRow | null = null
  let componentResults: PayrollComponentResultRow[] = []
  let trace: PayrollDatabase['public']['Tables']['calculation_traces']['Row'] | null = null
  let controls: PayrollControlRow[] = []
  let goldenCase: PayrollGoldenCaseRunRow | null = null

  const repository: PayrollCalculationRepository = {
    getPayrollAdministrationGate: vi.fn(async () => {
      calls.push('get-administration')
      return { id: payrollAdministrationId, capabilityEnabled, status: 'ACTIVE' as const }
    }),
    getPayrollPeriod: vi.fn(async () => {
      calls.push('get-period')
      return period
    }),
    insertPayrollPeriod: vi.fn(async (_scope, _payrollAdministrationId, values) => {
      calls.push('insert-period')
      const insertedPeriod: PayrollPeriodRow = {
        ...values,
        id: periodId,
        status: values.status ?? 'DRAFT',
        created_at: fixedNow.toISOString(),
        created_by_user_id: values.created_by_user_id ?? null,
        updated_at: fixedNow.toISOString(),
        updated_by_user_id: values.updated_by_user_id ?? null,
      }
      period = insertedPeriod
      return insertedPeriod
    }),
    insertSourceSnapshot: vi.fn(async (_scope, _payrollAdministrationId, values) => {
      calls.push('insert-snapshot')
      const insertedSnapshot: PayrollSourceSnapshotRow = {
        ...values,
        id: values.id ?? snapshotId,
        created_at: fixedNow.toISOString(),
        created_by_user_id: values.created_by_user_id ?? null,
      }
      sourceSnapshot = insertedSnapshot
      return insertedSnapshot
    }),
    insertCalculationInputSet: vi.fn(async (_scope, _payrollAdministrationId, values) => {
      calls.push('insert-input-set')
      const insertedInputSet: PayrollCalculationInputSetRow = {
        ...values,
        id: inputSetId,
        created_at: fixedNow.toISOString(),
        created_by_user_id: values.created_by_user_id ?? null,
      }
      inputSet = insertedInputSet
      return insertedInputSet
    }),
    insertCalculationRun: vi.fn(async (_scope, _payrollAdministrationId, values) => {
      calls.push('insert-run:PENDING')
      const insertedRun: PayrollCalculationRunRow = {
        ...values,
        id: runId,
        status: values.status ?? 'PENDING',
        started_at: values.started_at ?? null,
        finished_at: values.finished_at ?? null,
        result_hash: values.result_hash ?? null,
        created_at: fixedNow.toISOString(),
        created_by_user_id: values.created_by_user_id ?? null,
        updated_at: fixedNow.toISOString(),
        updated_by_user_id: values.updated_by_user_id ?? null,
      }
      run = insertedRun
      return insertedRun
    }),
    markCalculationRunRunning: vi.fn(async (_scope, _payrollAdministrationId, _runId, _actorUserId, startedAt) => {
      calls.push('mark-running')
      if (!run) throw new Error('Run must exist before RUNNING.')
      run = { ...run, status: 'RUNNING', started_at: startedAt }
      return run
    }),
    markCalculationRunSucceeded: vi.fn(async (_scope, _payrollAdministrationId, _runId, _actorUserId, finishedAt, resultHash) => {
      calls.push('mark-succeeded')
      if (!run) throw new Error('Run must exist before SUCCEEDED.')
      run = { ...run, status: 'SUCCEEDED', finished_at: finishedAt, result_hash: resultHash }
      return run
    }),
    markCalculationRunFailed: vi.fn(async (_scope, _payrollAdministrationId, _runId, _actorUserId, finishedAt) => {
      calls.push('mark-failed')
      if (!run) throw new Error('Run must exist before FAILED.')
      run = { ...run, status: 'FAILED', finished_at: finishedAt, result_hash: null }
      return run
    }),
    insertComponentResults: vi.fn(async (
      _scope,
      _payrollAdministrationId,
      values: Parameters<PayrollCalculationRepository['insertComponentResults']>[2],
    ) => {
      calls.push('insert-components')
      const insertedResults: PayrollComponentResultRow[] = values.map((value, index) => ({
        ...value,
        id: `90000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        amount: typeof value.amount === 'number' ? value.amount : value.amount === null ? null : Number(value.amount),
        result_payload: value.result_payload ?? {},
        created_at: fixedNow.toISOString(),
        created_by_user_id: actorUserId,
        updated_at: fixedNow.toISOString(),
        updated_by_user_id: actorUserId,
      }))
      componentResults = insertedResults
      return insertedResults
    }),
    insertCalculationTrace: vi.fn(async (_scope, _payrollAdministrationId, values) => {
      calls.push('insert-trace')
      const insertedTrace: PayrollDatabase['public']['Tables']['calculation_traces']['Row'] = {
        ...values,
        id: 'a0000000-0000-4000-8000-000000000001',
        created_at: fixedNow.toISOString(),
        created_by_user_id: actorUserId,
      }
      trace = insertedTrace
      return insertedTrace
    }),
    insertPayrollControls: vi.fn(async (
      _scope,
      _payrollAdministrationId,
      values: Parameters<PayrollCalculationRepository['insertPayrollControls']>[2],
    ) => {
      calls.push('insert-controls')
      const insertedControls: PayrollControlRow[] = values.map((value, index) => ({
        ...value,
        id: `b0000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        detail_payload: value.detail_payload ?? {},
        created_at: fixedNow.toISOString(),
        created_by_user_id: actorUserId,
        updated_at: fixedNow.toISOString(),
        updated_by_user_id: actorUserId,
      }))
      controls = insertedControls
      return insertedControls
    }),
    insertGoldenCaseRun: vi.fn(async (_scope, _payrollAdministrationId, values) => {
      calls.push('insert-golden-case')
      const insertedGoldenCase: PayrollGoldenCaseRunRow = {
        ...values,
        id: 'c0000000-0000-4000-8000-000000000001',
        created_at: fixedNow.toISOString(),
        created_by_user_id: actorUserId,
        expected_result_hash: values.expected_result_hash ?? null,
      }
      goldenCase = insertedGoldenCase
      return insertedGoldenCase
    }),
    listPayrollRunSummaries: vi.fn(async () => []),
    getLatestSyntheticArtifacts: vi.fn(async (_scope, _payrollAdministrationId, _compositionId, _runId, _caseKey, runType) => {
      calls.push('get-latest')
      if (!run || !inputSet || !sourceSnapshot || !period || !trace || (runType !== 'INDIVIDUAL_PAYROLL' && !goldenCase)) return null
      return { run, inputSet, sourceSnapshot, payrollPeriod: period, componentResults, trace, controls, goldenCase }
    }),
  }

  return { repository, calls, getRun: () => run }
}

function makeEngine(shouldThrow = false): SyntheticPayrollEngine {
  const amounts: Record<string, string> = {
    gross_salary: '4000.00',
    employee_pension: '125.00',
    wage_tax: '700.00',
    net_salary: '3175.00',
    employer_pension: '250.00',
    employer_insurance: '400.00',
    employer_zvw: '260.00',
    holiday_allowance_accrual: '320.00',
    total_employer_cost: '4910.00',
  }
  return {
    buildInputs: (sourceSnapshot: PayrollSourceSnapshot, effectiveDate: string): PayrollCalculationInputs => ({
      sourceSnapshotId: sourceSnapshot.id,
      sourceHash: sourceSnapshot.sourceHash,
      periodReference: sourceSnapshot.periodReference,
      effectiveDate,
      engineVersion: '0.1.0-m0',
      rulePackageCompositionId: 'RPC-GC1-V1',
      rulePackageCompositionHash: 'd'.repeat(64),
      inputHash: 'b'.repeat(64),
      components: GC_NL_001_RESULT_COMPONENTS.map((mapping) => ({
        id: `${mapping.componentCode}-id`,
        code: mapping.componentCode,
        version: '1.0.0',
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
        ownership: { kind: 'SYSTEM' as const },
        processingScope: mapping.componentCode === 'total_employer_cost' ? 'EMPLOYER' as const : 'INCOME_RELATIONSHIP' as const,
        inputs: [],
        outputs: [{ name: mapping.outputName, valueType: 'MONEY' as const, rounding: { scale: 2, mode: 'HALF_UP' as const } }],
        dependencies: [],
        method: { kind: 'source' as const, path: ['compensation', 'entries', 0, 'parttimeAmount'] },
        tracePolicy: 'FULL' as const,
      })),
      controls: [],
      resultMappings: GC_NL_001_RESULT_COMPONENTS,
      resolvedSourceValues: {},
    }),
    calculate: (inputs): PayrollCalculationResult => {
      if (shouldThrow) throw new Error('Raw engine error must not reach UI.')
      return {
        status: 'CALCULATED',
        sourceSnapshotId: inputs.sourceSnapshotId,
        sourceHash: inputs.sourceHash,
        periodReference: inputs.periodReference,
        effectiveDate: inputs.effectiveDate,
        engineVersion: inputs.engineVersion,
        rulePackageCompositionId: inputs.rulePackageCompositionId,
        rulePackageCompositionHash: inputs.rulePackageCompositionHash,
        inputHash: inputs.inputHash,
        resultHash: 'c'.repeat(64),
        componentResults: GC_NL_001_RESULT_COMPONENTS.map((mapping) => ({
          componentId: `${mapping.componentCode}-id`,
          componentCode: mapping.componentCode,
          version: '1.0.0',
          processingScope: mapping.componentCode === 'total_employer_cost' ? 'EMPLOYER' as const : 'INCOME_RELATIONSHIP' as const,
          outputs: [{ name: mapping.outputName, valueType: 'MONEY' as const, value: amounts[mapping.key] ?? '' }],
        })),
        resultRows: GC_NL_001_RESULT_COMPONENTS.map((mapping) => ({
          key: mapping.key,
          componentCode: mapping.componentCode,
          outputName: mapping.outputName,
          valueType: 'MONEY' as const,
          value: amounts[mapping.key] ?? '',
        })),
        trace: [],
        controls: [{ code: 'GC1-CTRL-020', status: 'PASS', actual: '4000.00', expected: '4000.00' }],
      }
    },
  }
}

function createService(
  repository: PayrollCalculationRepository,
  engine: SyntheticPayrollEngine,
  isEnabled = true,
  scenario?: PayrollTestScenario,
) {
  return createSyntheticPayrollService({
    repository,
    engine,
    ...(scenario ? { scenario } : {}),
    isEnabled: () => isEnabled,
    now: () => new Date(fixedNow),
    createId: () => snapshotId,
  })
}

const BAND_STATUS_MAPPING: PayrollResultMapping = {
  key: 'band_status',
  componentCode: 'synthetic_band_status',
  outputName: 'status',
}

function makeCategoricalOutputEngine(): SyntheticPayrollEngine {
  const engine = makeEngine()
  return {
    buildInputs: (snapshot, effectiveDate) => {
      const inputs = engine.buildInputs(snapshot, effectiveDate)
      const template = inputs.components[0]!
      const categoricalComponent = {
        ...template,
        id: 'synthetic-band-status-id',
        code: BAND_STATUS_MAPPING.componentCode,
        processingScope: 'EMPLOYMENT' as const,
        outputs: [{ name: BAND_STATUS_MAPPING.outputName, valueType: 'STRING' as const }],
      }
      return {
        ...inputs,
        components: [...inputs.components, categoricalComponent],
        resultMappings: [...inputs.resultMappings, BAND_STATUS_MAPPING],
      }
    },
    calculate: (inputs) => {
      const result = engine.calculate(inputs)
      return {
        ...result,
        componentResults: [...result.componentResults, {
          componentId: 'synthetic-band-status-id',
          componentCode: BAND_STATUS_MAPPING.componentCode,
          version: '1.0.0',
          processingScope: 'EMPLOYMENT',
          outputs: [{ name: BAND_STATUS_MAPPING.outputName, valueType: 'STRING', value: 'WITHIN_BAND' }],
        }],
        resultRows: [...result.resultRows, {
          ...BAND_STATUS_MAPPING,
          valueType: 'STRING',
          value: 'WITHIN_BAND',
        }],
      }
    },
  }
}

describe('synthetic Payroll calculation service', () => {
  it('writes a scoped run through the artifact lifecycle and preserves exact values and component provenance', async () => {
    const { repository, calls } = makeRepository()
    const service = createService(repository, makeEngine())

    const result = await service.runSyntheticPayroll(scope, payrollAdministrationId, actorUserId)

    expect(calls).toEqual([
      'get-administration', 'get-period', 'insert-period', 'insert-snapshot', 'insert-input-set',
      'insert-run:PENDING', 'mark-running', 'insert-components', 'insert-trace', 'insert-controls',
      'insert-golden-case', 'mark-succeeded',
    ])
    expect(result.status).toBe('SUCCEEDED')
    expect(result.payrollPeriod).toEqual({ year: 2026, month: 9 })
    expect(result.sourceHash).toMatch(/^[0-9a-f]{64}$/)
    expect(result.inputHash).toBe('b'.repeat(64))
    expect(result.resultHash).toBe('c'.repeat(64))
    expect(result.components[0]?.key).toBe('gross_salary')
    expect(result.components[0]?.amount).toBe('4000.00')
    expect(result.components[0]?.payload).toMatchObject({
      amount: '4000.00',
      component: {
        version: '1.0.0',
        ownership: { kind: 'SYSTEM' },
        rounding: { scale: 2, mode: 'HALF_UP' },
      },
    })
    expect(result.controls).toEqual([{ key: 'GC1-CTRL-020', status: 'PASS', details: expect.any(Object) }])
  })

  it('keeps categorical component outputs out of the numeric amount column while preserving them in JSON', async () => {
    const { repository } = makeRepository()
    const scenario: PayrollTestScenario = {
      caseKey: 'GC-NL-001',
      compositionId: GC_NL_001_RULE_PACKAGE.compositionId,
      period: { year: 2026, month: 9 },
      expectedResults: [...GC_NL_001_RESULT_COMPONENTS, BAND_STATUS_MAPPING],
      createSnapshot: createSyntheticPayrollSnapshot,
    }
    const service = createService(repository, makeCategoricalOutputEngine(), true, scenario)

    await service.runSyntheticPayroll(scope, payrollAdministrationId, actorUserId)

    const persistedRows = vi.mocked(repository.insertComponentResults).mock.calls[0]?.[2] ?? []
    const bandStatus = persistedRows.find((row) => row.component_key === 'band_status')
    expect(bandStatus?.amount).toBeNull()
    expect(bandStatus?.result_payload).toMatchObject({
      amount: null,
      value: 'WITHIN_BAND',
      valueType: 'STRING',
    })
  })

  it('marks a calculation FAILED and exposes a safe code plus run ID when the engine throws', async () => {
    const { repository, calls, getRun } = makeRepository()
    const service = createService(repository, makeEngine(true))

    let thrown: unknown
    try {
      await service.runSyntheticPayroll(scope, payrollAdministrationId, actorUserId)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(SyntheticPayrollServiceError)
    expect(thrown).toMatchObject({ code: 'PAYROLL_CALCULATION_FAILED', runId })
    expect(String(thrown)).not.toContain('Raw engine error')
    expect(calls).toContain('mark-running')
    expect(calls).toContain('insert-trace')
    expect(calls).toContain('insert-golden-case')
    expect(calls[calls.length - 1]).toBe('mark-failed')
    expect(getRun()?.status).toBe('FAILED')
    expect(getRun()?.result_hash).toBeNull()
  })

  it('does not write when the Payroll capability is disabled', async () => {
    const { repository, calls } = makeRepository(false)
    const service = createService(repository, makeEngine())

    await expect(service.runSyntheticPayroll(scope, payrollAdministrationId, actorUserId)).rejects.toMatchObject({
      code: 'PAYROLL_CAPABILITY_DISABLED',
      runId: null,
    })
    expect(calls).toEqual(['get-administration'])
  })

  it('does not query or write when the feature flag is disabled', async () => {
    const { repository, calls } = makeRepository()
    const service = createService(repository, makeEngine(), false)

    await expect(service.runSyntheticPayroll(scope, payrollAdministrationId, actorUserId)).rejects.toMatchObject({
      code: 'PAYROLL_SYNTHETIC_MODE_DISABLED',
    })
    expect(calls).toEqual([])
  })
})


describe('NL-2026 scenario in the persisted calculation lifecycle', () => {
  it('persists actual rule outputs, distinct source identities and reproducible package trace', async () => {
    const { repository } = makeRepository()
    const service = createSyntheticPayrollService({ repository, engine: NL_2026_TEST_ENGINE, scenario: NL_2026_TEST_SCENARIO, isEnabled: () => true, now: () => fixedNow })
    NL_2026_TEST_ENGINE.calculate(NL_2026_TEST_ENGINE.buildInputs(NL_2026_TEST_SCENARIO.createSnapshot(scope, NL_2026_TEST_SCENARIO.period, { now: fixedNow }), '2026-09-01'))
    const first = await service.runSyntheticPayroll(scope, payrollAdministrationId, actorUserId)
    const second = await service.runSyntheticPayroll(scope, payrollAdministrationId, actorUserId)
    expect(first.status).toBe('SUCCEEDED')
    expect(Object.fromEntries(first.components.map((row) => [row.key, row.amount]))).toEqual({ gross_salary: '4000.00', taxable_wage: '4000.00', wage_tax: '818.67', net_salary: '3181.33' })
    expect(second.inputHash).toBe(first.inputHash)
    expect(second.resultHash).toBe(first.resultHash)
    expect(first.caseKey).toBe('CC-NL-2026-001')
    const snapshot = vi.mocked(repository.insertSourceSnapshot).mock.calls[0]?.[2]
    expect(snapshot?.source_employment_id).not.toBe(snapshot?.source_income_relationship_id)
    expect(snapshot?.source_employee_id).toBe(first.employeeId)
    const trace = JSON.stringify(first.trace)
    expect(trace).toContain('packageMetadata')
    expect(trace).toContain('unroundedValue')
    expect(trace).toContain('roundingDifference')
    const messages = JSON.parse(readFileSync(new URL('../../messages/nl/navigation.json', import.meta.url), 'utf8')) as Record<string, string>
    const payload = first.trace as { steps: readonly { registeredRuleTrace?: readonly { code: string }[] }[] }
    for (const step of payload.steps.flatMap((row) => row.registeredRuleTrace ?? [])) {
      expect(messages[`payrollLabTrace_${step.code.replaceAll('.', '_').replaceAll('-', '_')}`]).toBeDefined()
    }
    await service.getLatestSyntheticPayroll(scope, payrollAdministrationId)
    expect(repository.getLatestSyntheticArtifacts).toHaveBeenCalledWith(scope, payrollAdministrationId, NL_2026_TEST_SCENARIO.compositionId, undefined, NL_2026_TEST_SCENARIO.caseKey, 'GOLDEN_CASE', undefined)
    await service.getLatestSyntheticPayroll(scope, payrollAdministrationId, runId)
    expect(repository.getLatestSyntheticArtifacts).toHaveBeenLastCalledWith(scope, payrollAdministrationId, NL_2026_TEST_SCENARIO.compositionId, runId, undefined, 'GOLDEN_CASE', undefined)
  })
  it('stores controlled UNSUPPORTED trace and no financial outputs', async () => {
    const { repository, getRun } = makeRepository()
    const service = createSyntheticPayrollService({ repository, scenario: NL_2026_TEST_SCENARIO, engine: { ...NL_2026_TEST_ENGINE, calculate: () => { throw new PayrollEngineError('NL2026_UNSUPPORTED_TABLE', 'unsupported') } }, isEnabled: () => true, now: () => fixedNow })
    await expect(service.runSyntheticPayroll(scope, payrollAdministrationId, actorUserId)).rejects.toMatchObject({ code: 'PAYROLL_UNSUPPORTED', reasonCode: 'NL2026_UNSUPPORTED_TABLE' })
    expect(getRun()?.status).toBe('FAILED')
    expect(repository.insertComponentResults).not.toHaveBeenCalled()
    expect(vi.mocked(repository.insertCalculationTrace).mock.calls[0]?.[2].trace_payload).toMatchObject({ status: 'UNSUPPORTED', unsupportedReason: 'NL2026_UNSUPPORTED_TABLE' })
  })

  it('persists an individual run without a GoldenCase and binds lifecycle events to the source employment and period', async () => {
    const { repository, calls } = makeRepository()
    const persistInputReference = vi.fn(async () => { calls.push('persist-reference') })
    const recordLifecycleEvent = vi.fn(async () => undefined)
    const finalizeCalculationProvenance = vi.fn(async ({ inputSet, sourceSnapshot }: Parameters<NonNullable<PayrollTestScenario['finalizeCalculationProvenance']>>[0]) => {
      calls.push('finalize-provenance')
      expect(inputSet.source_snapshot_id).toBe(sourceSnapshot.id)
      return {
        pensionCalculation: {
          status: 'CALCULATED',
          inputSetId: inputSet.id,
          inputHash: inputSet.input_hash,
          sourceSnapshotId: sourceSnapshot.id,
          sourceHash: sourceSnapshot.source_hash,
          trace: [{ componentCode: 'PENSION_EMPLOYEE_SHARE', result: '1.00' }],
        },
      }
    })
    const scenario: PayrollTestScenario = {
      runType: 'INDIVIDUAL_PAYROLL',
      compositionId: GC_NL_001_RULE_PACKAGE.compositionId,
      period: { year: 2026, month: 10 },
      createSnapshot: createSyntheticPayrollSnapshot,
      resolveCalculationContext: async () => ({ provenance: { scenario: 'test' } }),
      persistInputReference,
      finalizeCalculationProvenance,
      recordLifecycleEvent,
    }
    const service = createService(repository, makeEngine(), true, scenario)

    const result = await service.runSyntheticPayroll(scope, payrollAdministrationId, actorUserId)
    await service.getLatestSyntheticPayroll(scope, payrollAdministrationId)

    expect(result.caseKey).toBeNull()
    expect(finalizeCalculationProvenance).toHaveBeenCalledTimes(1)
    expect(calls.indexOf('finalize-provenance')).toBeGreaterThan(calls.indexOf('insert-input-set'))
    expect(calls.indexOf('persist-reference')).toBeGreaterThan(calls.indexOf('finalize-provenance'))
    expect(result.inputHash).toBe('b'.repeat(64))
    expect(result.trace).toMatchObject({
      calculationContext: {
        scenario: 'test',
        pensionCalculation: {
          inputSetId,
          inputHash: 'b'.repeat(64),
          trace: [{ componentCode: 'PENSION_EMPLOYEE_SHARE', result: '1.00' }],
        },
      },
    })
    expect(calls).not.toContain('insert-golden-case')
    expect(persistInputReference).toHaveBeenCalledWith(expect.objectContaining({
      scope,
      payrollAdministrationId,
      actorUserId,
      payrollPeriod: expect.objectContaining({ id: periodId }),
    }))
    expect(recordLifecycleEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'CONCEPT',
      payrollPeriodId: periodId,
      sourceEmploymentId: '50000000-0000-4000-8000-000000000009',
      calculationRunId: runId,
      revision: 1,
      eventSequence: 1,
    }))
    expect(repository.getLatestSyntheticArtifacts).toHaveBeenLastCalledWith(
      scope,
      payrollAdministrationId,
      scenario.compositionId,
      undefined,
      undefined,
      'INDIVIDUAL_PAYROLL',
      undefined,
    )
  })

  it('reuses deterministic PAYRUN01 source and input rows after an input-reference persistence failure', async () => {
    const { repository, calls } = makeRepository()
    let persistedSnapshot: PayrollSourceSnapshotRow | null = null
    let persistedInputSet: PayrollCalculationInputSetRow | null = null
    repository.getOrCreateSourceSnapshot = vi.fn(async (inputScope, administrationId, row) => {
      calls.push('get-or-create-snapshot')
      if (persistedSnapshot) return persistedSnapshot
      persistedSnapshot = await repository.insertSourceSnapshot(inputScope, administrationId, row)
      return persistedSnapshot
    })
    repository.getOrCreateCalculationInputSet = vi.fn(async (inputScope, administrationId, row) => {
      calls.push('get-or-create-input-set')
      if (persistedInputSet) return persistedInputSet
      persistedInputSet = await repository.insertCalculationInputSet(inputScope, administrationId, row)
      return persistedInputSet
    })
    let referenceAttempt = 0
    const persistInputReference = vi.fn(async () => {
      referenceAttempt += 1
      if (referenceAttempt === 1) throw new PayrollCalculationRepositoryError()
    })
    const scenario: PayrollTestScenario = {
      runType: 'INDIVIDUAL_PAYROLL',
      reusePersistedInputs: true,
      compositionId: GC_NL_001_RULE_PACKAGE.compositionId,
      period: { year: 2026, month: 10 },
      createSnapshot: async (snapshotScope, period, options) => ({
        ...(await createSyntheticPayrollSnapshot(snapshotScope, period, options)),
        id: snapshotId,
      }),
      persistInputReference,
    }
    const service = createService(repository, makeEngine(), true, scenario)

    await expect(service.runSyntheticPayroll(scope, payrollAdministrationId, actorUserId)).rejects.toMatchObject({
      code: 'PAYROLL_PERSISTENCE_FAILED',
      runId: null,
    })
    const result = await service.runSyntheticPayroll(scope, payrollAdministrationId, actorUserId)

    expect(result.status).toBe('SUCCEEDED')
    expect(repository.getOrCreateSourceSnapshot).toHaveBeenCalledTimes(2)
    expect(repository.getOrCreateCalculationInputSet).toHaveBeenCalledTimes(2)
    expect(repository.insertSourceSnapshot).toHaveBeenCalledTimes(1)
    expect(repository.insertCalculationInputSet).toHaveBeenCalledTimes(1)
    expect(persistInputReference).toHaveBeenCalledTimes(2)
    const firstInputSetRow = vi.mocked(repository.getOrCreateCalculationInputSet).mock.calls[0]?.[2]
    const secondInputSetRow = vi.mocked(repository.getOrCreateCalculationInputSet).mock.calls[1]?.[2]
    expect(firstInputSetRow?.id).toBe(secondInputSetRow?.id)
    expect(calls.filter((call) => call === 'insert-snapshot')).toHaveLength(1)
    expect(calls.filter((call) => call === 'insert-input-set')).toHaveLength(1)
  })

  it('atomically marks an individual run succeeded with its concept event when supported', async () => {
    const { repository, calls, getRun } = makeRepository()
    const recordLifecycleEvent = vi.fn(async () => undefined)
    repository.markCalculationRunSucceededWithConcept = vi.fn(async (_scope, _payrollAdministrationId, _runId, _periodId, _employmentId, _actorUserId, finishedAt, resultHash, _eventPayload) => {
      void _eventPayload
      calls.push('mark-succeeded-with-concept')
      const running = getRun()
      if (!running) throw new Error('Run must exist before SUCCEEDED.')
      return { ...running, status: 'SUCCEEDED' as const, finished_at: finishedAt, result_hash: resultHash }
    })
    const scenario: PayrollTestScenario = {
      runType: 'INDIVIDUAL_PAYROLL',
      compositionId: GC_NL_001_RULE_PACKAGE.compositionId,
      period: { year: 2026, month: 10 },
      createSnapshot: createSyntheticPayrollSnapshot,
      persistInputReference: async () => undefined,
      recordLifecycleEvent,
    }
    const service = createService(repository, makeEngine(), true, scenario)

    const result = await service.runSyntheticPayroll(scope, payrollAdministrationId, actorUserId)

    expect(result.status).toBe('SUCCEEDED')
    expect(calls.at(-1)).toBe('mark-succeeded-with-concept')
    expect(recordLifecycleEvent).not.toHaveBeenCalled()
    expect(repository.markCalculationRunSucceeded).not.toHaveBeenCalled()
  })

  it('records a blocked lifecycle event against the employment when an individual run fails', async () => {
    const { repository } = makeRepository()
    const recordLifecycleEvent = vi.fn(async () => undefined)
    const scenario: PayrollTestScenario = {
      runType: 'INDIVIDUAL_PAYROLL',
      compositionId: GC_NL_001_RULE_PACKAGE.compositionId,
      period: { year: 2026, month: 10 },
      createSnapshot: createSyntheticPayrollSnapshot,
      persistInputReference: async () => undefined,
      recordLifecycleEvent,
    }
    const service = createService(repository, makeEngine(true), true, scenario)

    await expect(service.runSyntheticPayroll(scope, payrollAdministrationId, actorUserId)).rejects.toMatchObject({
      code: 'PAYROLL_CALCULATION_FAILED',
      runId,
    })

    expect(recordLifecycleEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'BLOCKED',
      payrollPeriodId: periodId,
      sourceEmploymentId: '50000000-0000-4000-8000-000000000009',
      calculationRunId: runId,
    }))
  })
})
