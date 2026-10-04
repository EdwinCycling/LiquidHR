import { describe, expect, it, vi } from 'vitest'
import type { PayrollCalculationRunRow, PayrollDatabase } from './database'
import {
  createPayrollCalculationRepository,
  PayrollCalculationRepositoryError,
} from './calculation-repository'
import type { PayrollSupabaseClient } from './supabase-types'

const scope = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '10000000-0000-4000-8000-000000000002',
  administrationId: '10000000-0000-4000-8000-000000000003',
}
const payrollAdministrationId = '10000000-0000-4000-8000-000000000004'
const actorUserId = '10000000-0000-4000-8000-000000000005'
const runId = '10000000-0000-4000-8000-000000000006'
const inputSetId = '10000000-0000-4000-8000-000000000007'

const runRow: PayrollCalculationRunRow = {
  id: runId,
  payroll_administration_id: payrollAdministrationId,
  source_tenant_id: scope.tenantId,
  source_hr_group_id: scope.hrGroupId,
  source_administration_id: scope.administrationId,
  calculation_input_set_id: inputSetId,
  run_type: 'GOLDEN_CASE',
  status: 'PENDING',
  started_at: null,
  finished_at: null,
  result_hash: null,
  created_at: '2026-09-30T10:00:00.000Z',
  created_by_user_id: actorUserId,
  updated_at: '2026-09-30T10:00:00.000Z',
  updated_by_user_id: actorUserId,
}

function makeClient(seed: Record<string, Array<Record<string, unknown>>>) {
  const rows = Object.fromEntries(Object.entries(seed).map(([table, tableRows]) => [table, [...tableRows]]))
  const queryLog: Array<{ table: string; filters: Array<[string, unknown]>; update: Record<string, unknown> | null }> = []
  const from = vi.fn((table: string) => {
    const filters: Array<[string, unknown]> = []
    let operation: 'select' | 'update' = 'select'
    let updateValues: Record<string, unknown> | null = null
    const entry: { table: string; filters: Array<[string, unknown]>; update: Record<string, unknown> | null } = {
      table,
      filters,
      update: updateValues,
    }
    queryLog.push(entry)
    const query = {
      select: vi.fn(() => query),
      update: vi.fn((values: Record<string, unknown>) => {
        operation = 'update'
        updateValues = values
        entry.update = values
        return query
      }),
      eq: vi.fn((column: string, value: unknown) => {
        filters.push([column, value])
        return query
      }),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      returns: vi.fn(() => query),
      maybeSingle: vi.fn(async () => {
        const tableRows = rows[table] ?? []
        const rowIndex = tableRows.findIndex((candidate) => filters.every(([column, value]) => candidate[column] === value))
        if (rowIndex < 0) return { data: null, error: null }
        const currentRow = tableRows[rowIndex]
        if (!currentRow) return { data: null, error: null }
        if (operation === 'update' && updateValues) {
          tableRows[rowIndex] = { ...currentRow, ...updateValues }
          return { data: tableRows[rowIndex], error: null }
        }
        return { data: currentRow, error: null }
      }),
    }
    return query
  })
  const client = { from } as unknown as PayrollSupabaseClient
  return { client, from, queryLog, rows }
}

function makeArtifactsClient(runId: string, caseKey: string, compositionId: string) {
  const snapshotId = '10000000-0000-4000-8000-000000000008'
  const periodId = '10000000-0000-4000-8000-000000000009'
  const rows: Record<string, Array<Record<string, unknown>>> = {
    calculation_runs: [{
      ...runRow,
      id: runId,
      status: 'SUCCEEDED',
      started_at: '2026-10-03T10:00:00.000Z',
      finished_at: '2026-10-03T10:00:01.000Z',
      result_hash: 'a'.repeat(64),
    }],
    calculation_input_sets: [{
      id: inputSetId,
      payroll_administration_id: payrollAdministrationId,
      source_tenant_id: scope.tenantId,
      source_hr_group_id: scope.hrGroupId,
      source_administration_id: scope.administrationId,
      source_snapshot_id: snapshotId,
      payroll_period_id: periodId,
      rule_package_composition_id: compositionId,
      engine_version: '0.2.0',
      input_hash: 'b'.repeat(64),
      created_at: '2026-10-03T10:00:00.000Z',
      created_by_user_id: actorUserId,
    }],
    source_snapshots: [{
      id: snapshotId,
      payroll_administration_id: payrollAdministrationId,
      source_tenant_id: scope.tenantId,
      source_hr_group_id: scope.hrGroupId,
      source_administration_id: scope.administrationId,
      source_employee_id: '10000000-0000-4000-8000-000000000010',
      source_employment_id: '10000000-0000-4000-8000-000000000011',
      source_income_relationship_id: null,
      period_reference: '2026-07',
      source_payload: {},
      source_version_vector: {},
      source_hash: 'c'.repeat(64),
      created_at: '2026-10-03T10:00:00.000Z',
      created_by_user_id: actorUserId,
    }],
    payroll_periods: [{
      id: periodId,
      payroll_administration_id: payrollAdministrationId,
      source_tenant_id: scope.tenantId,
      source_hr_group_id: scope.hrGroupId,
      source_administration_id: scope.administrationId,
      period_year: 2026,
      period_month: 7,
      starts_on: '2026-07-01',
      ends_on: '2026-07-31',
      status: 'OPEN',
      updated_at: '2026-10-03T10:00:00.000Z',
      updated_by_user_id: actorUserId,
      created_at: '2026-10-03T10:00:00.000Z',
      created_by_user_id: actorUserId,
    }],
    component_results: [],
    calculation_traces: [],
    payroll_controls: [],
    golden_case_runs: [{
      id: '10000000-0000-4000-8000-000000000012',
      payroll_administration_id: payrollAdministrationId,
      source_tenant_id: scope.tenantId,
      source_hr_group_id: scope.hrGroupId,
      source_administration_id: scope.administrationId,
      calculation_run_id: runId,
      case_key: caseKey,
      expected_result_hash: null,
      created_at: '2026-10-03T10:00:00.000Z',
      created_by_user_id: actorUserId,
    }],
  }
  const queryLog: Array<{ table: string; filters: Array<[string, unknown]> }> = []
  const from = (table: string) => {
    const filters: Array<[string, unknown]> = []
    let rowLimit: number | null = null
    queryLog.push({ table, filters })
    const matchingRows = () => (rows[table] ?? []).filter((row) => filters.every(([column, value]) => {
      if (column === 'calculation_input_sets.rule_package_composition_id') {
        return rows.calculation_input_sets?.find((inputSet) => inputSet.id === row.calculation_input_set_id)?.rule_package_composition_id === value
      }
      return row[column] === value
    })).slice(0, rowLimit ?? undefined)
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        filters.push([column, value])
        return query
      },
      order: () => query,
      limit: (limit: number) => {
        rowLimit = limit
        return query
      },
      returns: () => query,
      maybeSingle: async () => ({ data: matchingRows()[0] ?? null, error: null }),
      then: (
        onfulfilled: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown,
        onrejected?: (reason: unknown) => unknown,
      ) => Promise.resolve({ data: matchingRows(), error: null as null }).then(onfulfilled, onrejected),
    }
    return query
  }
  return { client: { from } as unknown as PayrollSupabaseClient, queryLog }
}

describe('Payroll calculation repository scope and lifecycle', () => {
  it('keeps an exact legacy run lookup within the full scope and package', async () => {
    const { client, queryLog } = makeClient({ calculation_runs: [{ ...runRow, source_tenant_id: 'other-tenant' }] })
    const repository = createPayrollCalculationRepository(client)
    await expect(repository.getLatestSyntheticArtifacts(scope, payrollAdministrationId, 'RPC-GC1-V1', runId)).resolves.toBeNull()
    expect(queryLog[0]?.filters).toEqual(expect.arrayContaining([
      ['id', runId], ['payroll_administration_id', payrollAdministrationId],
      ['calculation_input_sets.rule_package_composition_id', 'RPC-GC1-V1'],
      ['source_tenant_id', scope.tenantId], ['source_hr_group_id', scope.hrGroupId],
      ['source_administration_id', scope.administrationId],
    ]))
  })

  it('rejects invalid legacy run identity before querying', async () => {
    const { client, from } = makeClient({})
    const repository = createPayrollCalculationRepository(client)
    await expect(repository.getLatestSyntheticArtifacts(scope, payrollAdministrationId, 'RPC-GC1-V1', 'invalid')).rejects.toThrow()
    expect(from).not.toHaveBeenCalled()
  })

  it.each([
    ['CAO-BENCH02-B1', '10000000-0000-4000-8000-000000000021', 'LHR_DEMO_OPEN_BANDS_2026:2026.07'],
    ['CAO-BENCH02-C1', '10000000-0000-4000-8000-000000000022', 'LHR_DEMO_OPEN_BANDS_2026:2026.07:C1-FREELY-NEGOTIATED'],
  ])('loads an exact %s run under its own composition and verifies its case link', async (caseKey, exactRunId, compositionId) => {
    const { client, queryLog } = makeArtifactsClient(exactRunId, caseKey, compositionId)
    const repository = createPayrollCalculationRepository(client)

    const artifacts = await repository.getLatestSyntheticArtifacts(scope, payrollAdministrationId, compositionId, exactRunId, caseKey)

    expect(artifacts?.run.id).toBe(exactRunId)
    expect(artifacts?.goldenCase?.case_key).toBe(caseKey)
    expect(queryLog[0]?.table).toBe('calculation_runs')
    expect(queryLog[0]?.filters).toEqual(expect.arrayContaining([
      ['id', exactRunId],
      ['payroll_administration_id', payrollAdministrationId],
      ['calculation_input_sets.rule_package_composition_id', compositionId],
      ['source_tenant_id', scope.tenantId],
      ['source_hr_group_id', scope.hrGroupId],
      ['source_administration_id', scope.administrationId],
    ]))
  })

  it('does not return an exact run when its persisted case link differs', async () => {
    const compositionId = 'LHR_DEMO_OPEN_BANDS_2026:2026.07:C1-FREELY-NEGOTIATED'
    const { client } = makeArtifactsClient(runId, 'CAO-BENCH02-C1', compositionId)
    const repository = createPayrollCalculationRepository(client)

    await expect(repository.getLatestSyntheticArtifacts(
      scope,
      payrollAdministrationId,
      compositionId,
      runId,
      'CAO-BENCH02-B1',
    )).resolves.toBeNull()
  })
  it('reads the Payroll administration only under the full source scope', async () => {
    const administrationRow = {
      id: payrollAdministrationId,
      capability_enabled: true,
      status: 'ACTIVE',
      source_tenant_id: scope.tenantId,
      source_hr_group_id: scope.hrGroupId,
      source_administration_id: scope.administrationId,
    }
    const { client, queryLog } = makeClient({ payroll_administrations: [administrationRow] })
    const repository = createPayrollCalculationRepository(client)

    await expect(repository.getPayrollAdministrationGate(scope, payrollAdministrationId)).resolves.toEqual({
      id: payrollAdministrationId,
      capabilityEnabled: true,
      status: 'ACTIVE',
    })
    expect(queryLog[0]?.filters).toEqual([
      ['id', payrollAdministrationId],
      ['source_tenant_id', scope.tenantId],
      ['source_hr_group_id', scope.hrGroupId],
      ['source_administration_id', scope.administrationId],
    ])
  })

  it('refuses inserts whose row scope differs from the trusted scope before touching Supabase', async () => {
    const { client, from } = makeClient({})
    const repository = createPayrollCalculationRepository(client)
    const wrongScopeRun: PayrollDatabase['public']['Tables']['calculation_runs']['Insert'] = {
      payroll_administration_id: payrollAdministrationId,
      source_tenant_id: scope.tenantId,
      source_hr_group_id: scope.hrGroupId,
      source_administration_id: '20000000-0000-4000-8000-000000000003',
      calculation_input_set_id: inputSetId,
      run_type: 'GOLDEN_CASE',
      status: 'PENDING',
      started_at: null,
      finished_at: null,
      result_hash: null,
      created_by_user_id: actorUserId,
      updated_by_user_id: actorUserId,
    }

    await expect(repository.insertCalculationRun(scope, payrollAdministrationId, wrongScopeRun)).rejects.toBeInstanceOf(PayrollCalculationRepositoryError)
    expect(from).not.toHaveBeenCalled()
  })

  it('allows PENDING to RUNNING to SUCCEEDED and rejects terminal mutation', async () => {
    const { client, queryLog, rows } = makeClient({ calculation_runs: [runRow as unknown as Record<string, unknown>] })
    const repository = createPayrollCalculationRepository(client)

    const running = await repository.markCalculationRunRunning(scope, payrollAdministrationId, runId, actorUserId, '2026-09-30T10:01:00.000Z')
    expect(running.status).toBe('RUNNING')
    expect(running.started_at).toBe('2026-09-30T10:01:00.000Z')
    expect(queryLog[0]?.filters).toContainEqual(['status', 'PENDING'])

    const succeeded = await repository.markCalculationRunSucceeded(scope, payrollAdministrationId, runId, actorUserId, '2026-09-30T10:02:00.000Z', 'a'.repeat(64))
    expect(succeeded.status).toBe('SUCCEEDED')
    expect(succeeded.result_hash).toBe('a'.repeat(64))
    await expect(repository.markCalculationRunFailed(scope, payrollAdministrationId, runId, actorUserId, '2026-09-30T10:03:00.000Z'))
      .rejects.toBeInstanceOf(PayrollCalculationRepositoryError)
    const storedRun = rows.calculation_runs?.[0]
    expect(storedRun?.status).toBe('SUCCEEDED')
    expect(storedRun?.result_hash).toBe('a'.repeat(64))
  })

  it('does not transition a run from a different scope or administration', async () => {
    const { client, rows, queryLog } = makeClient({ calculation_runs: [runRow as unknown as Record<string, unknown>] })
    const repository = createPayrollCalculationRepository(client)
    const otherScope = { ...scope, administrationId: '20000000-0000-4000-8000-000000000003' }

    await expect(repository.markCalculationRunRunning(otherScope, payrollAdministrationId, runId, actorUserId, '2026-09-30T10:01:00.000Z'))
      .rejects.toBeInstanceOf(PayrollCalculationRepositoryError)
    expect(queryLog[0]?.filters).toContainEqual(['source_administration_id', otherScope.administrationId])
    expect(rows.calculation_runs?.[0]?.status).toBe('PENDING')
  })
})
