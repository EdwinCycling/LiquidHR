import 'server-only'

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
import { applyPayrollScopeFilter, assertPayrollScope, type PayrollScope } from './scope'
import { createPayrollSupabaseClient } from './supabase-client'
import type { PayrollSupabaseClient } from './supabase-types'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PayrollAdministrationGate = {
  readonly id: string
  readonly capabilityEnabled: boolean
  readonly status: 'ACTIVE' | 'SUSPENDED'
}

export type PayrollCalculationArtifacts = {
  readonly run: PayrollCalculationRunRow
  readonly inputSet: PayrollCalculationInputSetRow
  readonly sourceSnapshot: PayrollSourceSnapshotRow
  readonly payrollPeriod: PayrollPeriodRow
  readonly componentResults: readonly PayrollComponentResultRow[]
  readonly trace: PayrollCalculationTraceRow | null
  readonly controls: readonly PayrollControlRow[]
  readonly goldenCase: PayrollGoldenCaseRunRow | null
}

type PayrollCalculationTraceRow = PayrollDatabase['public']['Tables']['calculation_traces']['Row']
type PayrollInsert<Table extends keyof PayrollDatabase['public']['Tables']> = PayrollDatabase['public']['Tables'][Table]['Insert']

export interface PayrollCalculationRepository {
  getPayrollAdministrationGate(scope: PayrollScope, payrollAdministrationId: string): Promise<PayrollAdministrationGate | null>
  getPayrollPeriod(scope: PayrollScope, payrollAdministrationId: string, year: number, month: number): Promise<PayrollPeriodRow | null>
  insertPayrollPeriod(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'payroll_periods'>): Promise<PayrollPeriodRow>
  insertSourceSnapshot(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'source_snapshots'>): Promise<PayrollSourceSnapshotRow>
  insertCalculationInputSet(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'calculation_input_sets'>): Promise<PayrollCalculationInputSetRow>
  insertCalculationRun(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'calculation_runs'>): Promise<PayrollCalculationRunRow>
  markCalculationRunRunning(scope: PayrollScope, payrollAdministrationId: string, runId: string, actorUserId: string, startedAt: string): Promise<PayrollCalculationRunRow>
  markCalculationRunSucceeded(scope: PayrollScope, payrollAdministrationId: string, runId: string, actorUserId: string, finishedAt: string, resultHash: string): Promise<PayrollCalculationRunRow>
  markCalculationRunFailed(scope: PayrollScope, payrollAdministrationId: string, runId: string, actorUserId: string, finishedAt: string): Promise<PayrollCalculationRunRow>
  insertComponentResults(scope: PayrollScope, payrollAdministrationId: string, rows: readonly PayrollInsert<'component_results'>[]): Promise<readonly PayrollComponentResultRow[]>
  insertCalculationTrace(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'calculation_traces'>): Promise<PayrollCalculationTraceRow>
  insertPayrollControls(scope: PayrollScope, payrollAdministrationId: string, rows: readonly PayrollInsert<'payroll_controls'>[]): Promise<readonly PayrollControlRow[]>
  insertGoldenCaseRun(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'golden_case_runs'>): Promise<PayrollGoldenCaseRunRow>
  getLatestSyntheticArtifacts(scope: PayrollScope, payrollAdministrationId: string, compositionId?: string): Promise<PayrollCalculationArtifacts | null>
}

export class PayrollCalculationRepositoryError extends Error {
  constructor(readonly code = 'PAYROLL_REPOSITORY_FAILURE') {
    super('Payroll Lab calculation data could not be read or written.')
    this.name = 'PayrollCalculationRepositoryError'
  }
}

function assertUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) throw new PayrollCalculationRepositoryError()
}

function assertValidHash(value: string): void {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new PayrollCalculationRepositoryError()
}

function assertScopedInsert(
  scope: PayrollScope,
  payrollAdministrationId: string,
  row: {
    readonly payroll_administration_id: string
    readonly source_tenant_id: string
    readonly source_hr_group_id: string
    readonly source_administration_id: string
  },
): void {
  const validatedScope = assertPayrollScope(scope)
  assertUuid(payrollAdministrationId)
  if (
    row.payroll_administration_id !== payrollAdministrationId
    || row.source_tenant_id !== validatedScope.tenantId
    || row.source_hr_group_id !== validatedScope.hrGroupId
    || row.source_administration_id !== validatedScope.administrationId
  ) {
    throw new PayrollCalculationRepositoryError()
  }
}

function throwOnError(error: unknown): void {
  if (error) throw new PayrollCalculationRepositoryError()
}

class SupabasePayrollCalculationRepository implements PayrollCalculationRepository {
  constructor(private readonly client: PayrollSupabaseClient) {}

  async getPayrollAdministrationGate(scope: PayrollScope, payrollAdministrationId: string): Promise<PayrollAdministrationGate | null> {
    const validatedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)

    const { data, error } = await applyPayrollScopeFilter(
      this.client.from('payroll_administrations').select('id,capability_enabled,status').eq('id', payrollAdministrationId),
      validatedScope,
    ).maybeSingle()

    throwOnError(error)
    return data ? {
      id: data.id,
      capabilityEnabled: data.capability_enabled,
      status: data.status,
    } : null
  }

  async getPayrollPeriod(scope: PayrollScope, payrollAdministrationId: string, year: number, month: number): Promise<PayrollPeriodRow | null> {
    const validatedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    if (!Number.isInteger(year) || year < 2000 || year > 2200 || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new PayrollCalculationRepositoryError()
    }

    const { data, error } = await applyPayrollScopeFilter(
      this.client.from('payroll_periods').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .eq('period_year', year)
        .eq('period_month', month),
      validatedScope,
    ).maybeSingle()

    throwOnError(error)
    return data
  }

  async insertPayrollPeriod(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'payroll_periods'>): Promise<PayrollPeriodRow> {
    assertScopedInsert(scope, payrollAdministrationId, row)
    const { data, error } = await this.client.from('payroll_periods').insert(row).select('*').single()
    if (error?.code === '23505') throw new PayrollCalculationRepositoryError('PAYROLL_PERIOD_ALREADY_EXISTS')
    throwOnError(error)
    if (!data) throw new PayrollCalculationRepositoryError()
    return data
  }

  async insertSourceSnapshot(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'source_snapshots'>): Promise<PayrollSourceSnapshotRow> {
    assertScopedInsert(scope, payrollAdministrationId, row)
    const { data, error } = await this.client.from('source_snapshots').insert(row).select('*').single()
    throwOnError(error)
    if (!data) throw new PayrollCalculationRepositoryError()
    return data
  }

  async insertCalculationInputSet(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'calculation_input_sets'>): Promise<PayrollCalculationInputSetRow> {
    assertScopedInsert(scope, payrollAdministrationId, row)
    const { data, error } = await this.client.from('calculation_input_sets').insert(row).select('*').single()
    throwOnError(error)
    if (!data) throw new PayrollCalculationRepositoryError()
    return data
  }

  async insertCalculationRun(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'calculation_runs'>): Promise<PayrollCalculationRunRow> {
    assertScopedInsert(scope, payrollAdministrationId, row)
    assertUuid(row.calculation_input_set_id)
    assertUuid(row.created_by_user_id ?? '')
    if (row.status !== 'PENDING' || row.started_at !== null || row.finished_at !== null || row.result_hash !== null) {
      throw new PayrollCalculationRepositoryError()
    }
    const { data, error } = await this.client.from('calculation_runs').insert(row).select('*').single()
    throwOnError(error)
    if (!data) throw new PayrollCalculationRepositoryError()
    return data
  }

  async markCalculationRunRunning(
    scope: PayrollScope,
    payrollAdministrationId: string,
    runId: string,
    actorUserId: string,
    startedAt: string,
  ): Promise<PayrollCalculationRunRow> {
    return await this.updateCalculationRun(scope, payrollAdministrationId, runId, actorUserId, {
      status: 'RUNNING',
      started_at: startedAt,
      finished_at: null,
      result_hash: null,
    }, 'PENDING')
  }

  async markCalculationRunSucceeded(
    scope: PayrollScope,
    payrollAdministrationId: string,
    runId: string,
    actorUserId: string,
    finishedAt: string,
    resultHash: string,
  ): Promise<PayrollCalculationRunRow> {
    assertValidHash(resultHash)
    return await this.updateCalculationRun(scope, payrollAdministrationId, runId, actorUserId, {
      status: 'SUCCEEDED',
      finished_at: finishedAt,
      result_hash: resultHash,
    }, 'RUNNING')
  }

  async markCalculationRunFailed(
    scope: PayrollScope,
    payrollAdministrationId: string,
    runId: string,
    actorUserId: string,
    finishedAt: string,
  ): Promise<PayrollCalculationRunRow> {
    const validatedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    assertUuid(runId)
    assertUuid(actorUserId)

    const { data: currentRun, error: readError } = await applyPayrollScopeFilter(
      this.client.from('calculation_runs').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .eq('id', runId),
      validatedScope,
    ).maybeSingle()
    throwOnError(readError)
    if (!currentRun || (currentRun.status !== 'PENDING' && currentRun.status !== 'RUNNING')) {
      throw new PayrollCalculationRepositoryError()
    }

    return await this.updateCalculationRun(scope, payrollAdministrationId, runId, actorUserId, {
      status: 'FAILED',
      started_at: currentRun.started_at,
      finished_at: finishedAt,
      result_hash: null,
    }, currentRun.status)
  }

  async insertComponentResults(
    scope: PayrollScope,
    payrollAdministrationId: string,
    rows: readonly PayrollInsert<'component_results'>[],
  ): Promise<readonly PayrollComponentResultRow[]> {
    if (rows.length === 0) return []
    for (const row of rows) {
      assertScopedInsert(scope, payrollAdministrationId, row)
      assertUuid(row.calculation_run_id)
    }
    const { data, error } = await this.client.from('component_results').insert([...rows]).select('*')
    throwOnError(error)
    if (!data) throw new PayrollCalculationRepositoryError()
    return data
  }

  async insertCalculationTrace(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: PayrollInsert<'calculation_traces'>,
  ): Promise<PayrollCalculationTraceRow> {
    assertScopedInsert(scope, payrollAdministrationId, row)
    assertUuid(row.calculation_run_id)
    const { data, error } = await this.client.from('calculation_traces').insert(row).select('*').single()
    throwOnError(error)
    if (!data) throw new PayrollCalculationRepositoryError()
    return data
  }

  async insertPayrollControls(
    scope: PayrollScope,
    payrollAdministrationId: string,
    rows: readonly PayrollInsert<'payroll_controls'>[],
  ): Promise<readonly PayrollControlRow[]> {
    if (rows.length === 0) return []
    for (const row of rows) {
      assertScopedInsert(scope, payrollAdministrationId, row)
      assertUuid(row.calculation_run_id)
    }
    const { data, error } = await this.client.from('payroll_controls').insert([...rows]).select('*')
    throwOnError(error)
    if (!data) throw new PayrollCalculationRepositoryError()
    return data
  }

  async insertGoldenCaseRun(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: PayrollInsert<'golden_case_runs'>,
  ): Promise<PayrollGoldenCaseRunRow> {
    assertScopedInsert(scope, payrollAdministrationId, row)
    assertUuid(row.calculation_run_id)
    const { data, error } = await this.client.from('golden_case_runs').insert(row).select('*').single()
    throwOnError(error)
    if (!data) throw new PayrollCalculationRepositoryError()
    return data
  }

  async getLatestSyntheticArtifacts(scope: PayrollScope, payrollAdministrationId: string, compositionId?: string): Promise<PayrollCalculationArtifacts | null> {
    const validatedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)

    let query = this.client.from('calculation_runs')
      .select('*, calculation_input_sets!calculation_runs_input_set_scope_fk!inner(rule_package_composition_id)')
      .eq('payroll_administration_id', payrollAdministrationId)
      .eq('run_type', 'GOLDEN_CASE')
    if (compositionId) query = query.eq('calculation_input_sets.rule_package_composition_id', compositionId)
    const { data: run, error: runError } = await applyPayrollScopeFilter(
      query.order('created_at', { ascending: false }).limit(1), validatedScope,
    ).returns<PayrollCalculationRunRow[]>().maybeSingle()
    throwOnError(runError)
    if (!run) return null

    const [inputSetResult, componentsResult, traceResult, controlsResult, goldenCaseResult] = await Promise.all([
      applyPayrollScopeFilter(this.client.from('calculation_input_sets').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .eq('id', run.calculation_input_set_id), validatedScope).maybeSingle(),
      applyPayrollScopeFilter(this.client.from('component_results').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .eq('calculation_run_id', run.id)
        .order('component_key', { ascending: true })
        .limit(100), validatedScope),
      applyPayrollScopeFilter(this.client.from('calculation_traces').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .eq('calculation_run_id', run.id), validatedScope).maybeSingle(),
      applyPayrollScopeFilter(this.client.from('payroll_controls').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .eq('calculation_run_id', run.id)
        .order('control_key', { ascending: true })
        .limit(100), validatedScope),
      applyPayrollScopeFilter(this.client.from('golden_case_runs').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .eq('calculation_run_id', run.id), validatedScope).maybeSingle(),
    ])
    throwOnError(inputSetResult.error)
    throwOnError(componentsResult.error)
    throwOnError(traceResult.error)
    throwOnError(controlsResult.error)
    throwOnError(goldenCaseResult.error)
    if (!inputSetResult.data || !componentsResult.data || !controlsResult.data) throw new PayrollCalculationRepositoryError()
    if (componentsResult.data.length >= 100 || controlsResult.data.length >= 100) throw new PayrollCalculationRepositoryError()

    const [sourceSnapshotResult, periodResult] = await Promise.all([
      applyPayrollScopeFilter(this.client.from('source_snapshots').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .eq('id', inputSetResult.data.source_snapshot_id), validatedScope).maybeSingle(),
      applyPayrollScopeFilter(this.client.from('payroll_periods').select('*')
        .eq('payroll_administration_id', payrollAdministrationId)
        .eq('id', inputSetResult.data.payroll_period_id), validatedScope).maybeSingle(),
    ])
    throwOnError(sourceSnapshotResult.error)
    throwOnError(periodResult.error)
    if (!sourceSnapshotResult.data || !periodResult.data) throw new PayrollCalculationRepositoryError()

    return {
      run,
      inputSet: inputSetResult.data,
      sourceSnapshot: sourceSnapshotResult.data,
      payrollPeriod: periodResult.data,
      componentResults: componentsResult.data,
      trace: traceResult.data,
      controls: controlsResult.data,
      goldenCase: goldenCaseResult.data,
    }
  }

  private async updateCalculationRun(
    scope: PayrollScope,
    payrollAdministrationId: string,
    runId: string,
    actorUserId: string,
    values: PayrollDatabase['public']['Tables']['calculation_runs']['Update'],
    requiredStatus: 'PENDING' | 'RUNNING',
  ): Promise<PayrollCalculationRunRow> {
    const validatedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    assertUuid(runId)
    assertUuid(actorUserId)

    const { data, error } = await applyPayrollScopeFilter(
      this.client.from('calculation_runs').update({
        ...values,
        updated_at: new Date().toISOString(),
        updated_by_user_id: actorUserId,
      }).eq('payroll_administration_id', payrollAdministrationId)
        .eq('id', runId)
        .eq('status', requiredStatus),
      validatedScope,
    ).select('*').maybeSingle()
    throwOnError(error)
    if (!data) throw new PayrollCalculationRepositoryError()
    return data
  }
}

export function createPayrollCalculationRepository(
  client: PayrollSupabaseClient = createPayrollSupabaseClient(),
): PayrollCalculationRepository {
  return new SupabasePayrollCalculationRepository(client)
}
