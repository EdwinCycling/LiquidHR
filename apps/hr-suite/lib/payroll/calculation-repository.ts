import 'server-only'

import type {
  PayrollCalculationInputSetRow,
  PayrollCalculationRunRow,
  PayrollCalculationRunType,
  PayrollComponentResultRow,
  PayrollControlRow,
  PayrollDatabase,
  PayrollGoldenCaseRunRow,
  PayrollJson,
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

export type PayrollRunSummary = {
  readonly run: PayrollCalculationRunRow
  readonly inputSet: PayrollCalculationInputSetRow
  readonly sourceSnapshot: PayrollSourceSnapshotRow
  readonly payrollPeriod: PayrollPeriodRow
}

type PayrollCalculationTraceRow = PayrollDatabase['public']['Tables']['calculation_traces']['Row']
type PayrollInsert<Table extends keyof PayrollDatabase['public']['Tables']> = PayrollDatabase['public']['Tables'][Table]['Insert']

export interface PayrollCalculationRepository {
  getPayrollAdministrationGate(scope: PayrollScope, payrollAdministrationId: string): Promise<PayrollAdministrationGate | null>
  getPayrollPeriod(scope: PayrollScope, payrollAdministrationId: string, year: number, month: number): Promise<PayrollPeriodRow | null>
  insertPayrollPeriod(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'payroll_periods'>): Promise<PayrollPeriodRow>
  insertSourceSnapshot(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'source_snapshots'>): Promise<PayrollSourceSnapshotRow>
  getOrCreateSourceSnapshot?(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'source_snapshots'>): Promise<PayrollSourceSnapshotRow>
  insertCalculationInputSet(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'calculation_input_sets'>): Promise<PayrollCalculationInputSetRow>
  getOrCreateCalculationInputSet?(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'calculation_input_sets'>): Promise<PayrollCalculationInputSetRow>
  insertCalculationRun(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'calculation_runs'>): Promise<PayrollCalculationRunRow>
  markCalculationRunRunning(scope: PayrollScope, payrollAdministrationId: string, runId: string, actorUserId: string, startedAt: string): Promise<PayrollCalculationRunRow>
  markCalculationRunSucceeded(scope: PayrollScope, payrollAdministrationId: string, runId: string, actorUserId: string, finishedAt: string, resultHash: string): Promise<PayrollCalculationRunRow>
  markCalculationRunSucceededWithConcept?(
    scope: PayrollScope,
    payrollAdministrationId: string,
    runId: string,
    payrollPeriodId: string,
    sourceEmploymentId: string,
    actorUserId: string,
    finishedAt: string,
    resultHash: string,
    eventPayload: PayrollJson,
  ): Promise<PayrollCalculationRunRow>
  markCalculationRunFailed(scope: PayrollScope, payrollAdministrationId: string, runId: string, actorUserId: string, finishedAt: string): Promise<PayrollCalculationRunRow>
  insertComponentResults(scope: PayrollScope, payrollAdministrationId: string, rows: readonly PayrollInsert<'component_results'>[]): Promise<readonly PayrollComponentResultRow[]>
  insertCalculationTrace(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'calculation_traces'>): Promise<PayrollCalculationTraceRow>
  insertPayrollControls(scope: PayrollScope, payrollAdministrationId: string, rows: readonly PayrollInsert<'payroll_controls'>[]): Promise<readonly PayrollControlRow[]>
  insertGoldenCaseRun(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'golden_case_runs'>): Promise<PayrollGoldenCaseRunRow>
  getLatestSyntheticArtifacts(
    scope: PayrollScope,
    payrollAdministrationId: string,
    compositionId?: string,
    runId?: string,
    caseKey?: string,
    runType?: PayrollCalculationRunType,
    period?: { readonly year: number; readonly month: number },
  ): Promise<PayrollCalculationArtifacts | null>
  listPayrollRunSummaries(
    scope: PayrollScope,
    payrollAdministrationId: string,
    options?: {
      readonly employeeId?: string
      readonly runType?: PayrollCalculationRunType
      readonly limit?: number
    },
  ): Promise<readonly PayrollRunSummary[]>
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

function canonicalValue(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalValue(entry)}`).join(',')}}`
}

function hasSameContent<Row extends Record<string, unknown>>(
  stored: Row,
  requested: Record<string, unknown>,
  fields: readonly string[],
): boolean {
  return fields.every((field) => canonicalValue(stored[field]) === canonicalValue(requested[field]))
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

function assertPayrollPeriodBoundaries(period: Pick<PayrollPeriodRow, 'period_year' | 'period_month' | 'starts_on' | 'ends_on'>): void {
  const { period_year: year, period_month: month } = period
  if (!Number.isInteger(year) || year < 2000 || year > 2200 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new PayrollCalculationRepositoryError('PAYROLL_PERIOD_BOUNDARIES_INVALID')
  }
  const startsOn = `${year}-${String(month).padStart(2, '0')}-01`
  const endsOn = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  if (period.starts_on !== startsOn || period.ends_on !== endsOn) {
    throw new PayrollCalculationRepositoryError('PAYROLL_PERIOD_BOUNDARIES_INVALID')
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeDatabaseErrorCode(error: unknown): string | null {
  if (!isRecord(error) || typeof error.code !== 'string') return null
  return /^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/.test(error.code) ? error.code : null
}

function throwOnError(error: unknown): void {
  if (!error) return
  const databaseCode = safeDatabaseErrorCode(error)
  throw new PayrollCalculationRepositoryError(databaseCode ? `PAYROLL_DB_${databaseCode}` : undefined)
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
    if (data) assertPayrollPeriodBoundaries(data)
    return data
  }

  async insertPayrollPeriod(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'payroll_periods'>): Promise<PayrollPeriodRow> {
    assertScopedInsert(scope, payrollAdministrationId, row)
    assertPayrollPeriodBoundaries(row)
    const { data, error } = await this.client.from('payroll_periods').insert(row).select('*').single()
    if (error?.code === '23505') throw new PayrollCalculationRepositoryError('PAYROLL_PERIOD_ALREADY_EXISTS')
    throwOnError(error)
    if (!data) throw new PayrollCalculationRepositoryError()
    assertPayrollPeriodBoundaries(data)
    return data
  }

  async insertSourceSnapshot(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'source_snapshots'>): Promise<PayrollSourceSnapshotRow> {
    assertScopedInsert(scope, payrollAdministrationId, row)
    const { data, error } = await this.client.from('source_snapshots').insert(row).select('*').single()
    throwOnError(error)
    if (!data) throw new PayrollCalculationRepositoryError()
    return data
  }

  async getOrCreateSourceSnapshot(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'source_snapshots'>): Promise<PayrollSourceSnapshotRow> {
    assertScopedInsert(scope, payrollAdministrationId, row)
    const id = row.id
    if (!id) throw new PayrollCalculationRepositoryError('PAYROLL_PERSISTED_INPUT_ID_INVALID')
    assertUuid(id)
    const fields = [
      'id', 'payroll_administration_id', 'source_tenant_id', 'source_hr_group_id', 'source_administration_id',
      'source_employee_id', 'source_employment_id', 'source_income_relationship_id', 'period_reference',
      'source_payload', 'source_version_vector', 'source_hash',
    ] as const
    const read = async (): Promise<PayrollSourceSnapshotRow | null> => {
      const { data, error } = await applyPayrollScopeFilter(
        this.client.from('source_snapshots').select('*').eq('id', id).eq('payroll_administration_id', payrollAdministrationId),
        assertPayrollScope(scope),
      ).maybeSingle()
      throwOnError(error)
      if (data) assertScopedInsert(scope, payrollAdministrationId, data)
      return data
    }
    const matches = (stored: PayrollSourceSnapshotRow) => hasSameContent(
      stored as unknown as Record<string, unknown>,
      row as Record<string, unknown>,
      fields,
    )
    const existing = await read()
    if (existing) {
      if (!matches(existing)) throw new PayrollCalculationRepositoryError('PAYROLL_PERSISTED_INPUT_CONFLICT')
      return existing
    }

    const { data, error } = await this.client.from('source_snapshots').insert(row).select('*').single()
    if (isUniqueViolation(error)) {
      const raced = await read()
      if (raced && matches(raced)) return raced
      throw new PayrollCalculationRepositoryError('PAYROLL_PERSISTED_INPUT_CONFLICT')
    }
    throwOnError(error)
    if (!data) throw new PayrollCalculationRepositoryError()
    assertScopedInsert(scope, payrollAdministrationId, data)
    if (!matches(data)) throw new PayrollCalculationRepositoryError('PAYROLL_PERSISTED_INPUT_CONFLICT')
    return data
  }

  async insertCalculationInputSet(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'calculation_input_sets'>): Promise<PayrollCalculationInputSetRow> {
    assertScopedInsert(scope, payrollAdministrationId, row)
    const { data, error } = await this.client.from('calculation_input_sets').insert(row).select('*').single()
    throwOnError(error)
    if (!data) throw new PayrollCalculationRepositoryError()
    return data
  }

  async getOrCreateCalculationInputSet(scope: PayrollScope, payrollAdministrationId: string, row: PayrollInsert<'calculation_input_sets'>): Promise<PayrollCalculationInputSetRow> {
    assertScopedInsert(scope, payrollAdministrationId, row)
    const id = row.id
    if (!id) throw new PayrollCalculationRepositoryError('PAYROLL_PERSISTED_INPUT_ID_INVALID')
    assertUuid(id)
    const fields = [
      'id', 'payroll_administration_id', 'source_tenant_id', 'source_hr_group_id', 'source_administration_id',
      'source_snapshot_id', 'payroll_period_id', 'rule_package_composition_id', 'engine_version', 'input_hash',
    ] as const
    const read = async (): Promise<PayrollCalculationInputSetRow | null> => {
      const { data, error } = await applyPayrollScopeFilter(
        this.client.from('calculation_input_sets').select('*').eq('id', id).eq('payroll_administration_id', payrollAdministrationId),
        assertPayrollScope(scope),
      ).maybeSingle()
      throwOnError(error)
      if (data) assertScopedInsert(scope, payrollAdministrationId, data)
      return data
    }
    const matches = (stored: PayrollCalculationInputSetRow) => hasSameContent(
      stored as unknown as Record<string, unknown>,
      row as Record<string, unknown>,
      fields,
    )
    const existing = await read()
    if (existing) {
      if (!matches(existing)) throw new PayrollCalculationRepositoryError('PAYROLL_PERSISTED_INPUT_CONFLICT')
      return existing
    }

    const { data, error } = await this.client.from('calculation_input_sets').insert(row).select('*').single()
    if (isUniqueViolation(error)) {
      const raced = await read()
      if (raced && matches(raced)) return raced
      throw new PayrollCalculationRepositoryError('PAYROLL_PERSISTED_INPUT_CONFLICT')
    }
    throwOnError(error)
    if (!data) throw new PayrollCalculationRepositoryError()
    assertScopedInsert(scope, payrollAdministrationId, data)
    if (!matches(data)) throw new PayrollCalculationRepositoryError('PAYROLL_PERSISTED_INPUT_CONFLICT')
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

  async markCalculationRunSucceededWithConcept(
    scope: PayrollScope,
    payrollAdministrationId: string,
    runId: string,
    payrollPeriodId: string,
    sourceEmploymentId: string,
    actorUserId: string,
    finishedAt: string,
    resultHash: string,
    eventPayload: PayrollJson,
  ): Promise<PayrollCalculationRunRow> {
    const validatedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    assertUuid(runId)
    assertUuid(payrollPeriodId)
    assertUuid(sourceEmploymentId)
    assertUuid(actorUserId)
    assertValidHash(resultHash)
    if (!eventPayload || typeof eventPayload !== 'object' || Array.isArray(eventPayload)) {
      throw new PayrollCalculationRepositoryError('PAYRUN01_LIFECYCLE_PAYLOAD_INVALID')
    }
    const { data, error } = await this.client.rpc('payrun01_mark_succeeded_with_concept', {
      p_payroll_administration_id: payrollAdministrationId,
      p_source_tenant_id: validatedScope.tenantId,
      p_source_hr_group_id: validatedScope.hrGroupId,
      p_source_administration_id: validatedScope.administrationId,
      p_calculation_run_id: runId,
      p_payroll_period_id: payrollPeriodId,
      p_source_employment_id: sourceEmploymentId,
      p_actor_user_id: actorUserId,
      p_finished_at: finishedAt,
      p_result_hash: resultHash,
      p_event_payload: eventPayload,
    })
    throwOnError(error)
    const row = Array.isArray(data) ? data[0] : data
    if (!row || row.id !== runId || row.status !== 'SUCCEEDED' || row.result_hash !== resultHash) {
      throw new PayrollCalculationRepositoryError('PAYRUN01_CONCEPT_FINALIZATION_MISMATCH')
    }
    return row as PayrollCalculationRunRow
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

  async getLatestSyntheticArtifacts(
    scope: PayrollScope,
    payrollAdministrationId: string,
    compositionId?: string,
    runId?: string,
    caseKey?: string,
    runType: PayrollCalculationRunType = 'GOLDEN_CASE',
    period?: { readonly year: number; readonly month: number },
  ): Promise<PayrollCalculationArtifacts | null> {
    const validatedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)

    if (runId !== undefined) assertUuid(runId)
    if (caseKey !== undefined && !/^[A-Z0-9][A-Z0-9-]{0,63}$/.test(caseKey)) throw new PayrollCalculationRepositoryError()
    if (caseKey !== undefined && runType !== 'GOLDEN_CASE') throw new PayrollCalculationRepositoryError()

    let periodId: string | undefined
    if (period !== undefined) {
      const periodRow = await this.getPayrollPeriod(scope, payrollAdministrationId, period.year, period.month)
      if (!periodRow) return null
      periodId = periodRow.id
    }

    let selectedRunId = runId
    if (caseKey !== undefined && runId === undefined) {
      const caseQuery = this.client.from('golden_case_runs').select('calculation_run_id')
        .eq('payroll_administration_id', payrollAdministrationId)
        .eq('case_key', caseKey)
        .order('created_at', { ascending: false })
        .limit(1)
      const { data: caseRun, error: caseError } = await applyPayrollScopeFilter(caseQuery, validatedScope).maybeSingle()
      throwOnError(caseError)
      if (!caseRun) return null
      selectedRunId = caseRun.calculation_run_id
    }

    let query = this.client.from('calculation_runs')
      .select('*, calculation_input_sets!calculation_runs_input_set_scope_fk!inner(rule_package_composition_id, payroll_period_id)')
      .eq('payroll_administration_id', payrollAdministrationId)
      .eq('run_type', runType)
    if (compositionId) query = query.eq('calculation_input_sets.rule_package_composition_id', compositionId)
    if (periodId) query = query.eq('calculation_input_sets.payroll_period_id', periodId)
    if (selectedRunId !== undefined) query = query.eq('id', selectedRunId)
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
    if (caseKey !== undefined && goldenCaseResult.data?.case_key !== caseKey) return null

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

  async listPayrollRunSummaries(
    scope: PayrollScope,
    payrollAdministrationId: string,
    options: { readonly employeeId?: string; readonly runType?: PayrollCalculationRunType; readonly limit?: number } = {},
  ): Promise<readonly PayrollRunSummary[]> {
    const validatedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    if (options.employeeId !== undefined) assertUuid(options.employeeId)
    const limit = options.limit ?? 100
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new PayrollCalculationRepositoryError('PAYROLL_RUN_LIMIT_INVALID')

    let employeeSnapshotIds: string[] | null = null
    if (options.employeeId !== undefined) {
      const { data: snapshots, error } = await applyPayrollScopeFilter(
        this.client.from('source_snapshots').select('id')
          .eq('payroll_administration_id', payrollAdministrationId)
          .eq('source_employee_id', options.employeeId)
          .order('created_at', { ascending: false })
          .limit(limit * 10),
        validatedScope,
      ).returns<Array<Pick<PayrollSourceSnapshotRow, 'id'>>>()
      throwOnError(error)
      employeeSnapshotIds = (snapshots ?? []).map((snapshot) => snapshot.id)
      if (employeeSnapshotIds.length === 0) return []
    }

    let inputSetQuery = this.client.from('calculation_input_sets').select('*')
      .eq('payroll_administration_id', payrollAdministrationId)
      .order('created_at', { ascending: false })
      .limit(limit * 4)
    if (employeeSnapshotIds) inputSetQuery = inputSetQuery.in('source_snapshot_id', employeeSnapshotIds)
    const { data: inputSets, error: inputSetError } = await applyPayrollScopeFilter(inputSetQuery, validatedScope)
      .returns<PayrollCalculationInputSetRow[]>()
    throwOnError(inputSetError)
    if (!inputSets?.length) return []

    let runQuery = this.client.from('calculation_runs').select('*')
      .eq('payroll_administration_id', payrollAdministrationId)
      .in('calculation_input_set_id', inputSets.map((inputSet) => inputSet.id))
      .order('created_at', { ascending: false })
      .limit(limit)
    if (options.runType) runQuery = runQuery.eq('run_type', options.runType)
    const { data: runs, error: runError } = await applyPayrollScopeFilter(runQuery, validatedScope)
      .returns<PayrollCalculationRunRow[]>()
    throwOnError(runError)
    if (!runs?.length) return []

    const selectedInputSets = new Map(inputSets.map((inputSet) => [inputSet.id, inputSet]))
    const snapshotIds = [...new Set(runs.flatMap((run) => {
      const inputSet = selectedInputSets.get(run.calculation_input_set_id)
      return inputSet ? [inputSet.source_snapshot_id] : []
    }))]
    const periodIds = [...new Set(runs.flatMap((run) => {
      const inputSet = selectedInputSets.get(run.calculation_input_set_id)
      return inputSet ? [inputSet.payroll_period_id] : []
    }))]
    if (snapshotIds.length !== new Set(runs.map((run) => selectedInputSets.get(run.calculation_input_set_id)?.source_snapshot_id)).size
      || periodIds.length !== new Set(runs.map((run) => selectedInputSets.get(run.calculation_input_set_id)?.payroll_period_id)).size) {
      throw new PayrollCalculationRepositoryError()
    }

    const [snapshotsResult, periodsResult] = await Promise.all([
      applyPayrollScopeFilter(this.client.from('source_snapshots').select('*')
        .eq('payroll_administration_id', payrollAdministrationId).in('id', snapshotIds), validatedScope)
        .returns<PayrollSourceSnapshotRow[]>(),
      applyPayrollScopeFilter(this.client.from('payroll_periods').select('*')
        .eq('payroll_administration_id', payrollAdministrationId).in('id', periodIds), validatedScope)
        .returns<PayrollPeriodRow[]>(),
    ])
    throwOnError(snapshotsResult.error)
    throwOnError(periodsResult.error)
    const snapshots = new Map((snapshotsResult.data ?? []).map((snapshot) => [snapshot.id, snapshot]))
    const periods = new Map((periodsResult.data ?? []).map((period) => [period.id, period]))

    return runs.map((run) => {
      const inputSet = selectedInputSets.get(run.calculation_input_set_id)
      const sourceSnapshot = inputSet ? snapshots.get(inputSet.source_snapshot_id) : undefined
      const payrollPeriod = inputSet ? periods.get(inputSet.payroll_period_id) : undefined
      if (!inputSet || !sourceSnapshot || !payrollPeriod) throw new PayrollCalculationRepositoryError()
      return { run, inputSet, sourceSnapshot, payrollPeriod }
    })
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
