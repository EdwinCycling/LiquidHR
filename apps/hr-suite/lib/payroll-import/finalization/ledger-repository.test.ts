import { describe, expect, it } from 'vitest'
import { confirmPayrollImportDecision, type PayrollImportDecisionSource } from './decision-contract'
import {
  persistConfirmedPayrollImportDecision,
  persistFinalizationPlan,
  readFinalizationActionEvents,
  readFinalizationLedger,
  type PersistDecisionInput,
} from './ledger-repository'
import type {
  Control02FinalizationClient,
  FinalizationEventRpcArgs,
  FinalizationPlanInvalidationRpcArgs,
  FinalizationPlanInvalidationRpcResult,
  PayrollImportFinalizationActionEventRow,
  PayrollImportFinalizationActionRow,
  PayrollImportFinalizationPlanRow,
  PayrollImportDecisionRow,
} from './ledger-database'
import type { Json } from '@scope/db'
import type { PayrollFinalizationPlannerInput } from './planner'

const actorUserId = '7c7e170a-60d2-4b8e-a9e8-a341c5d04b1d'
const tenantId = '00000000-0000-4000-8000-000000000001'
const hrGroupId = '00000000-0000-4000-8000-000000000002'
const administrationId = '00000000-0000-4000-8000-000000000003'
const batchId = '00000000-0000-4000-8000-000000000004'
const importPersonId = '00000000-0000-4000-8000-000000000005'
const employeeId = '00000000-0000-4000-8000-000000000006'
const employmentId = '00000000-0000-4000-8000-000000000007'
const sourceHash = 'a'.repeat(64)
const analysisHash = 'b'.repeat(64)
const coreStateHash = 'c'.repeat(64)

type FakeError = { code?: string; message?: string }
type QueryResult<T> = { data: T | null; error: FakeError | null }
type FilterValue = string | number

type FakeSelectBuilder = {
  eq: (column: string, value: FilterValue) => FakeSelectBuilder
  maybeSingle: () => Promise<QueryResult<PayrollImportDecisionRow>>
}

type FakeInsertBuilder = {
  select: (columns: string) => {
    single: () => Promise<QueryResult<PayrollImportDecisionRow>>
  }
}

type FakeDecisionTable = {
  insert: (row: Partial<PayrollImportDecisionRow>) => FakeInsertBuilder
  select: (columns: string) => FakeSelectBuilder
}

function required<T>(value: T | null | undefined, field: string): T {
  if (value === null || value === undefined) throw new Error(`missing fake row field: ${field}`)
  return value
}

class DecisionPersistenceFake {
  readonly rows: PayrollImportDecisionRow[] = []
  readonly planRows: PayrollImportFinalizationPlanRow[] = []
  readonly invalidationCalls: FinalizationPlanInvalidationRpcArgs[] = []
  failNextInvalidation = false
  private nextId = 100

  client(): Control02FinalizationClient {
    return {
      from: (table: string) => {
        if (table === 'payroll_import_decisions') return this.table()
        if (table === 'payroll_import_finalization_plans') return this.planTable()
        throw new Error(`unexpected table: ${table}`)
      },
      rpc: (name: string, args: FinalizationPlanInvalidationRpcArgs) => this.rpc(name, args),
    } as unknown as Control02FinalizationClient
  }

  private planTable(): FinalizationTable<PayrollImportFinalizationPlanRow> {
    return new FinalizationTable(
      () => this.planRows,
      () => undefined,
    )
  }

  private rpc(
    name: string,
    args: FinalizationPlanInvalidationRpcArgs,
  ): Promise<{ data: FinalizationPlanInvalidationRpcResult[] | null; error: FakeError | null }> {
    if (name !== 'invalidate_payroll_import_finalization_plan') throw new Error(`unexpected rpc: ${name}`)
    this.invalidationCalls.push(args)
    if (this.failNextInvalidation) {
      this.failNextInvalidation = false
      return Promise.resolve({ data: null, error: { code: 'XX000', message: 'temporary invalidation failure' } })
    }
    const plan = this.planRows.find((row) => row.tenant_id === args.requested_tenant_id
      && row.hr_group_id === args.requested_hr_group_id
      && row.batch_id === args.requested_batch_id
      && row.plan_hash === args.requested_plan_hash)
    if (!plan) return Promise.resolve({ data: null, error: { code: 'P0002', message: 'PAYROLL_FINALIZATION_PLAN_NOT_FOUND' } })
    if (plan.status !== 'INVALIDATED') {
      plan.status = 'INVALIDATED'
      plan.invalidated_by_user_id = args.requested_actor_user_id
      plan.invalidation_reason = args.requested_reason
      plan.invalidated_at = '2026-10-05T10:00:00.000Z'
    }
    return Promise.resolve({
      data: [{ plan_id: plan.id, status: plan.status }],
      error: null,
    })
  }

  private table(): FakeDecisionTable {
    return {
      insert: (input) => ({
        select: () => ({
          single: async () => {
            const duplicate = this.rows.find((row) => row.tenant_id === input.tenant_id
              && row.hr_group_id === input.hr_group_id
              && row.batch_id === input.batch_id
              && row.import_person_id === input.import_person_id
              && row.decision_version === input.decision_version)
            if (duplicate) {
              return {
                data: null,
                error: { code: '23505', message: 'duplicate decision version' },
              }
            }
            const row: PayrollImportDecisionRow = {
              id: `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, '0')}`,
              tenant_id: required(input.tenant_id, 'tenant_id'),
              hr_group_id: required(input.hr_group_id, 'hr_group_id'),
              administration_id: required(input.administration_id, 'administration_id'),
              batch_id: required(input.batch_id, 'batch_id'),
              import_person_id: required(input.import_person_id, 'import_person_id'),
              decision_version: required(input.decision_version, 'decision_version'),
              decision_payload: required(input.decision_payload, 'decision_payload'),
              decision_hash: required(input.decision_hash, 'decision_hash'),
              source_hash: required(input.source_hash, 'source_hash'),
              analysis_hash: required(input.analysis_hash, 'analysis_hash'),
              core_state_hash: required(input.core_state_hash, 'core_state_hash'),
              contract_version: input.contract_version ?? null,
              schema_version: input.schema_version ?? null,
              confirmer_user_id: required(input.confirmer_user_id, 'confirmer_user_id'),
              confirmed_at: required(input.confirmed_at, 'confirmed_at'),
              created_at: '2026-10-05T10:00:00.000Z',
            }
            this.rows.push(row)
            return { data: row, error: null }
          },
        }),
      }),
      select: () => this.selectBuilder([]),
    }
  }

  private selectBuilder(filters: readonly (readonly [string, FilterValue])[]): FakeSelectBuilder {
    return {
      eq: (column, value) => this.selectBuilder([...filters, [column, value]]),
      maybeSingle: async () => {
        const matches = this.rows.filter((row) => filters.every(([column, value]) => {
          const current = row[column as keyof PayrollImportDecisionRow]
          return current === value
        }))
        return { data: matches[0] ?? null, error: null }
      },
    }
  }
}

type RowsResult<T> = { data: T[] | null; error: FakeError | null }
type QueryFilter = { kind: 'eq'; column: string; value: FilterValue }
  | { kind: 'in'; column: string; values: readonly FilterValue[] }

class RowsQuery<T extends object> implements PromiseLike<RowsResult<T>> {
  private readonly filters: readonly QueryFilter[]
  private readonly ordering: { column: string; ascending: boolean } | null
  private readonly maxRows: number | null

  constructor(
    private readonly readRows: () => readonly T[],
    filters: readonly QueryFilter[] = [],
    ordering: { column: string; ascending: boolean } | null = null,
    maxRows: number | null = null,
  ) {
    this.filters = filters
    this.ordering = ordering
    this.maxRows = maxRows
  }

  eq(column: string, value: FilterValue): RowsQuery<T> {
    return new RowsQuery(this.readRows, [...this.filters, { kind: 'eq', column, value }], this.ordering, this.maxRows)
  }

  in(column: string, values: readonly FilterValue[]): RowsQuery<T> {
    return new RowsQuery(this.readRows, [...this.filters, { kind: 'in', column, values }], this.ordering, this.maxRows)
  }

  order(column: string, options?: { ascending?: boolean }): RowsQuery<T> {
    return new RowsQuery(this.readRows, this.filters, { column, ascending: options?.ascending ?? true }, this.maxRows)
  }

  limit(value: number): RowsQuery<T> {
    return new RowsQuery(this.readRows, this.filters, this.ordering, value)
  }

  maybeSingle(): Promise<{ data: T | null; error: FakeError | null }> {
    return Promise.resolve({ data: this.matchingRows()[0] ?? null, error: null })
  }

  then<TResult1 = RowsResult<T>, TResult2 = never>(
    onfulfilled?: ((value: RowsResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.rowsResult()).then(onfulfilled ?? undefined, onrejected ?? undefined)
  }

  private matchingRows(): T[] {
    const rows = this.readRows().filter((row) => this.filters.every((filter) => {
      const value = row[filter.column as keyof T]
      if (filter.kind === 'eq') return value === filter.value
      return filter.values.includes(value as FilterValue)
    }))
    if (!this.ordering) return rows
    const { column, ascending } = this.ordering
    return rows.sort((left, right) => {
      const leftValue = String(left[column as keyof T] ?? '')
      const rightValue = String(right[column as keyof T] ?? '')
      const comparison = leftValue.localeCompare(rightValue)
      return ascending ? comparison : -comparison
    })
  }

  private rowsResult(): RowsResult<T> {
    const rows = this.matchingRows()
    return { data: this.maxRows === null ? rows : rows.slice(0, this.maxRows), error: null }
  }
}

type UpsertHandler<T extends object> = (
  values: readonly Partial<T>[],
  options: { onConflict?: string; ignoreDuplicates?: boolean },
) => void

class FinalizationTable<T extends object> {
  constructor(
    private readonly readRows: () => readonly T[],
    private readonly handleUpsert: UpsertHandler<T>,
  ) {}

  select(columns: string): RowsQuery<T> {
    void columns
    return new RowsQuery(this.readRows)
  }

  upsert(
    values: Partial<T> | readonly Partial<T>[],
    options: { onConflict?: string; ignoreDuplicates?: boolean },
  ): Promise<{ data: null; error: FakeError | null }> {
    this.handleUpsert(Array.isArray(values) ? values : [values], options)
    return Promise.resolve({ data: null, error: null })
  }
}

class FinalizationPlanPersistenceFake {
  readonly decisionRows: PayrollImportDecisionRow[] = []
  readonly planRows: PayrollImportFinalizationPlanRow[] = []
  readonly actionRows: PayrollImportFinalizationActionRow[] = []
  readonly actionEvents: PayrollImportFinalizationActionEventRow[] = []
  readonly invalidationCalls: FinalizationPlanInvalidationRpcArgs[] = []
  beforePlanUpsert: (() => void) | null = null
  private nextId = 100

  client(): Control02FinalizationClient {
    return {
      from: (table: string) => {
        if (table === 'payroll_import_decisions') {
          return new FinalizationTable(
            () => this.decisionRows,
            () => undefined,
          )
        }
        if (table === 'payroll_import_finalization_plans') {
          return new FinalizationTable(
            () => this.planRows,
            (values, options) => this.upsertPlans(values, options),
          )
        }
        if (table === 'payroll_import_finalization_actions') {
          return new FinalizationTable(
            () => this.actionRows,
            (values, options) => this.upsertActions(values, options),
          )
        }
        if (table === 'payroll_import_finalization_action_events') {
          return new FinalizationTable(
            () => this.actionEvents,
            () => undefined,
          )
        }
        throw new Error(`unexpected table: ${table}`)
      },
      rpc: (name: string, args: FinalizationEventRpcArgs | FinalizationPlanInvalidationRpcArgs) => {
        if (name === 'record_payroll_import_finalization_event') {
          return this.recordEvent(name, args as FinalizationEventRpcArgs)
        }
        if (name === 'invalidate_payroll_import_finalization_plan') {
          return this.invalidatePlan(args as FinalizationPlanInvalidationRpcArgs)
        }
        throw new Error(`unexpected rpc: ${name}`)
      },
    } as unknown as Control02FinalizationClient
  }

  private upsertPlans(
    values: readonly Partial<PayrollImportFinalizationPlanRow>[],
    options: { onConflict?: string; ignoreDuplicates?: boolean },
  ): void {
    this.beforePlanUpsert?.()
    this.beforePlanUpsert = null
    for (const value of values) {
      const duplicate = this.planRows.some((row) => row.tenant_id === value.tenant_id
        && row.hr_group_id === value.hr_group_id
        && row.batch_id === value.batch_id
        && row.plan_hash === value.plan_hash)
      if (duplicate && options.ignoreDuplicates) continue
      if (duplicate) throw new Error('unexpected plan overwrite')
      this.planRows.push({
        id: this.id(),
        tenant_id: required(value.tenant_id, 'tenant_id'),
        hr_group_id: required(value.hr_group_id, 'hr_group_id'),
        administration_id: required(value.administration_id, 'administration_id'),
        batch_id: required(value.batch_id, 'batch_id'),
        plan_hash: required(value.plan_hash, 'plan_hash'),
        source_hash: required(value.source_hash, 'source_hash'),
        analysis_hash: required(value.analysis_hash, 'analysis_hash'),
        core_state_hash: required(value.core_state_hash, 'core_state_hash'),
        contract_version: value.contract_version ?? null,
        schema_version: value.schema_version ?? null,
        expected_action_count: required(value.expected_action_count, 'expected_action_count'),
        completed_action_count: value.completed_action_count ?? 0,
        status: required(value.status, 'status'),
        created_by_user_id: required(value.created_by_user_id, 'created_by_user_id'),
        invalidated_by_user_id: value.invalidated_by_user_id ?? null,
        invalidation_reason: value.invalidation_reason ?? null,
        invalidated_at: value.invalidated_at ?? null,
        created_at: '2026-10-05T10:00:00.000Z',
        updated_at: '2026-10-05T10:00:00.000Z',
      })
    }
  }

  private invalidatePlan(
    args: FinalizationPlanInvalidationRpcArgs,
  ): Promise<{ data: FinalizationPlanInvalidationRpcResult[] | null; error: FakeError | null }> {
    this.invalidationCalls.push(args)
    const plan = this.planRows.find((row) => row.tenant_id === args.requested_tenant_id
      && row.hr_group_id === args.requested_hr_group_id
      && row.batch_id === args.requested_batch_id
      && row.plan_hash === args.requested_plan_hash)
    if (!plan) return Promise.resolve({ data: null, error: { code: 'P0002', message: 'PAYROLL_FINALIZATION_PLAN_NOT_FOUND' } })
    plan.status = 'INVALIDATED'
    plan.invalidated_by_user_id = args.requested_actor_user_id
    plan.invalidation_reason = args.requested_reason
    plan.invalidated_at = '2026-10-05T10:00:00.000Z'
    return Promise.resolve({ data: [{ plan_id: plan.id, status: plan.status }], error: null })
  }

  private upsertActions(
    values: readonly Partial<PayrollImportFinalizationActionRow>[],
    options: { onConflict?: string; ignoreDuplicates?: boolean },
  ): void {
    for (const value of values) {
      const duplicate = this.actionRows.some((row) => row.tenant_id === value.tenant_id
        && row.hr_group_id === value.hr_group_id
        && row.batch_id === value.batch_id
        && row.idempotency_key === value.idempotency_key)
      if (duplicate && options.ignoreDuplicates) continue
      if (duplicate) throw new Error('unexpected action overwrite')
      this.actionRows.push({
        id: this.id(),
        tenant_id: required(value.tenant_id, 'tenant_id'),
        hr_group_id: required(value.hr_group_id, 'hr_group_id'),
        administration_id: required(value.administration_id, 'administration_id'),
        batch_id: required(value.batch_id, 'batch_id'),
        plan_id: required(value.plan_id, 'plan_id'),
        import_person_id: required(value.import_person_id, 'import_person_id'),
        decision_id: required(value.decision_id, 'decision_id'),
        sequence_no: required(value.sequence_no, 'sequence_no'),
        action_id: required(value.action_id, 'action_id'),
        idempotency_key: required(value.idempotency_key, 'idempotency_key'),
        source_person_ref: required(value.source_person_ref, 'source_person_ref'),
        source_income_ref: value.source_income_ref ?? null,
        target_employee_id: value.target_employee_id ?? null,
        target_employee_ref: value.target_employee_ref ?? null,
        target_employment_id: value.target_employment_id ?? null,
        target_employment_ref: value.target_employment_ref ?? null,
        target_income_relationship_id: value.target_income_relationship_id ?? null,
        action_type: required(value.action_type, 'action_type'),
        source_payroll_tax_number: value.source_payroll_tax_number ?? null,
        source_ikv_number: value.source_ikv_number ?? null,
        source_starts_on: value.source_starts_on ?? null,
        source_ends_on: value.source_ends_on ?? null,
        source_refs: required(value.source_refs, 'source_refs'),
        preconditions: required(value.preconditions, 'preconditions'),
        plan_hash: required(value.plan_hash, 'plan_hash'),
        decision_hash: required(value.decision_hash, 'decision_hash'),
        source_hash: required(value.source_hash, 'source_hash'),
        analysis_hash: required(value.analysis_hash, 'analysis_hash'),
        core_state_hash: required(value.core_state_hash, 'core_state_hash'),
        contract_version: value.contract_version ?? null,
        schema_version: value.schema_version ?? null,
        status: value.status ?? 'PENDING',
        attempt_count: value.attempt_count ?? 0,
        lease_until: value.lease_until ?? null,
        last_attempt_at: value.last_attempt_at ?? null,
        completed_at: value.completed_at ?? null,
        last_error_code: value.last_error_code ?? null,
        checkpoint: value.checkpoint ?? {},
        created_at: '2026-10-05T10:00:00.000Z',
        updated_at: '2026-10-05T10:00:00.000Z',
      })
    }
  }

  private recordEvent(name: string, args: FinalizationEventRpcArgs): Promise<{ data: Array<{ action_id: string; status: string; attempt_count: number; event_id: string }> | null; error: FakeError | null }> {
    if (name !== 'record_payroll_import_finalization_event') throw new Error(`unexpected rpc: ${name}`)
    const action = this.actionRows.find((row) => row.tenant_id === args.requested_tenant_id
      && row.hr_group_id === args.requested_hr_group_id
      && row.batch_id === args.requested_batch_id
      && row.action_id === args.requested_action_id)
    if (!action) throw new Error('missing action for rpc')
    const existing = this.actionEvents.find((event) => event.tenant_id === args.requested_tenant_id
      && event.hr_group_id === args.requested_hr_group_id
      && event.batch_id === args.requested_batch_id
      && event.action_id === args.requested_action_id
      && event.event_key === args.requested_event_key)
    if (existing) {
      return Promise.resolve({ data: [{ action_id: action.action_id, status: action.status, attempt_count: action.attempt_count, event_id: existing.id }], error: null })
    }
    action.status = args.requested_event_type === 'BLOCKED' ? 'BLOCKED' : 'PENDING'
    action.last_error_code = args.requested_error_code ?? null
    action.checkpoint = args.requested_checkpoint ?? {}
    const plan = this.planRows.find((row) => row.id === action.plan_id)
    if (plan && args.requested_event_type === 'BLOCKED') plan.status = 'BLOCKED'
    const event: PayrollImportFinalizationActionEventRow = {
      id: this.id(),
      tenant_id: args.requested_tenant_id,
      hr_group_id: args.requested_hr_group_id,
      batch_id: args.requested_batch_id,
      action_id: args.requested_action_id,
      event_key: args.requested_event_key,
      event_type: args.requested_event_type,
      actor_user_id: args.requested_actor_user_id,
      attempt_number: args.requested_attempt_number,
      checkpoint: args.requested_checkpoint ?? {},
      error_code: args.requested_error_code ?? null,
      lease_until: args.requested_lease_until ?? null,
      source_hash: args.requested_source_hash,
      analysis_hash: args.requested_analysis_hash,
      core_state_hash: args.requested_core_state_hash,
      created_at: '2026-10-05T10:00:00.000Z',
    }
    this.actionEvents.push(event)
    return Promise.resolve({ data: [{ action_id: action.action_id, status: action.status, attempt_count: action.attempt_count, event_id: event.id }], error: null })
  }

  private id(): string {
    return `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, '0')}`
  }
}

function decision(sourceFieldDecision: 'KEEP_CURRENT' | 'USE_SOURCE') {
  return confirmPayrollImportDecision({
    decision: {
      match: { action: 'REUSE_EMPLOYEE', employeeId, confirmed: true },
      incomeRelationshipBySourceRef: {
        income: { action: 'NO_CHANGE', confirmed: true },
      },
      employmentByIncomeRelationship: {
        income: { action: 'REUSE_EMPLOYMENT', employmentId, confirmed: true },
      },
      sourceFieldDecisions: { firstName: sourceFieldDecision },
    },
    decisionVersion: 1,
    confirmerUserId: actorUserId,
    confirmedAt: '2026-10-05T10:00:00.000Z',
    sourceHash,
    analysisHash,
    coreStateHash,
  })
}

function inputFor(confirmedDecision: ReturnType<typeof decision>): PersistDecisionInput {
  return {
    tenantId,
    hrGroupId,
    administrationId,
    batchId,
    importPersonId,
    decision: confirmedDecision,
    actorUserId,
    sourceHash,
    analysisHash,
    coreStateHash,
    contractVersion: 'CONTROL02-CORE-PAYROLL-DRAFT-1',
    schemaVersion: 'Loonaangifte-2026-v2.0',
  }
}

function pendingPlan(): PayrollImportFinalizationPlanRow {
  return {
    id: '00000000-0000-4000-8000-000000000008',
    tenant_id: tenantId,
    hr_group_id: hrGroupId,
    administration_id: administrationId,
    batch_id: batchId,
    plan_hash: 'd'.repeat(64),
    source_hash: sourceHash,
    analysis_hash: analysisHash,
    core_state_hash: coreStateHash,
    contract_version: 'CONTROL02-CORE-PAYROLL-DRAFT-1',
    schema_version: 'Loonaangifte-2026-v2.0',
    expected_action_count: 1,
    completed_action_count: 0,
    status: 'PENDING',
    created_by_user_id: actorUserId,
    invalidated_by_user_id: null,
    invalidation_reason: null,
    invalidated_at: null,
    created_at: '2026-10-05T09:00:00.000Z',
    updated_at: '2026-10-05T09:00:00.000Z',
  }
}

function blockedPlannerInput(): PayrollFinalizationPlannerInput {
  const sourcePersonRef = 'person-1'
  const sourceIncomeRef = 'person-1:123456789L01:1:2026-01-01'
  const plannerDecision = confirmPayrollImportDecision({
    decision: {
      match: { action: 'REUSE_EMPLOYEE', employeeId, confirmed: true },
      incomeRelationshipBySourceRef: {
        [sourceIncomeRef]: { action: 'CREATE', confirmed: true },
      },
      employmentByIncomeRelationship: {
        [sourceIncomeRef]: { action: 'REUSE_EMPLOYMENT', employmentId, confirmed: true },
      },
      sourceFieldDecisions: { firstName: 'KEEP_CURRENT' },
    },
    decisionVersion: 1,
    confirmerUserId: actorUserId,
    confirmedAt: '2026-10-05T10:00:00.000Z',
    sourceHash,
    analysisHash,
    coreStateHash,
  })
  const decisionSource: PayrollImportDecisionSource = {
    personId: importPersonId,
    matchStatus: 'EXACT',
    proposedEmployeeId: employeeId,
    sourceFields: ['firstName'],
    conflictingFields: [],
    incomeRelationships: [{ sourceRef: sourceIncomeRef }],
  }
  return {
    batch: {
      batchId,
      tenantId,
      hrGroupId,
      administrationId,
      sourceType: 'LOONAANGIFTE_XML',
      sourceHash,
      analysisHash,
      schemaVersion: 'Loonaangifte-2026-v2.0',
      officialSchemaValidated: true,
      sourceImmutable: true,
    },
    contractVersion: 'CONTROL02-CORE-PAYROLL-DRAFT-1',
    scopeInvariantMigrationApplied: false,
    currentUserId: actorUserId,
    currentCoreStateHash: coreStateHash,
    people: [{
      sourceRef: sourcePersonRef,
      decisionSource,
      confirmedDecision: plannerDecision,
      incomeRelationships: [{
        sourceRef: sourceIncomeRef,
        payrollTaxNumber: '123456789L01',
        ikvNumber: 1,
        startsOn: '2026-01-01',
        endsOn: '2026-01-31',
      }],
    }],
    coreState: {
      employees: [{ id: employeeId, tenantId, hrGroupId, administrationIds: [administrationId] }],
      employments: [{
        id: employmentId,
        employeeId,
        tenantId,
        hrGroupId,
        administrationId,
        status: 'CONFIRMED',
        validFrom: '2025-01-01',
        validUntilExclusive: null,
      }],
      incomeRelationships: [],
    },
  }
}

describe('CONTROL02 finalization decision repository', () => {
  it('inserts and reads back a server-confirmed decision, then replays idempotently', async () => {
    const fake = new DecisionPersistenceFake()
    const client = fake.client()
    const input = inputFor(decision('KEEP_CURRENT'))

    const first = await persistConfirmedPayrollImportDecision(input, client)
    const replay = await persistConfirmedPayrollImportDecision(input, client)

    expect(first).toMatchObject({
      id: '00000000-0000-4000-8000-000000000100',
      scope: { tenantId, hrGroupId, administrationId, batchId, importPersonId },
      decisionVersion: 1,
      decisionHash: input.decision.decisionHash,
      sourceHash,
      analysisHash,
      coreStateHash,
      contractVersion: input.contractVersion,
      schemaVersion: input.schemaVersion,
      confirmerUserId: actorUserId,
    })
    expect(first.decision).toEqual(input.decision.decision)
    expect(replay).toEqual(first)
    expect(fake.rows).toHaveLength(1)
  })

  it('rejects a same-version retry with a different decision hash', async () => {
    const fake = new DecisionPersistenceFake()
    const client = fake.client()
    await persistConfirmedPayrollImportDecision(inputFor(decision('KEEP_CURRENT')), client)

    await expect(
      persistConfirmedPayrollImportDecision(inputFor(decision('USE_SOURCE')), client),
    ).rejects.toMatchObject({
      code: 'PAYROLL_FINALIZATION_DECISION_IDEMPOTENCY_CONFLICT',
      status: 409,
    })
    expect(fake.rows).toHaveLength(1)
  })

  it('keeps the original immutable confirmation on a same-payload retry with a fresh timestamp', async () => {
    const fake = new DecisionPersistenceFake()
    const client = fake.client()
    const first = decision('KEEP_CURRENT')
    const retry = confirmPayrollImportDecision({
      decision: first.decision,
      decisionVersion: first.decisionVersion,
      confirmerUserId: first.confirmerUserId,
      confirmedAt: '2026-10-05T10:05:00.000Z',
      sourceHash: first.sourceHash,
      analysisHash: first.analysisHash,
      coreStateHash: first.coreStateHash,
    })

    const persisted = await persistConfirmedPayrollImportDecision(inputFor(first), client)
    const replay = await persistConfirmedPayrollImportDecision(inputFor(retry), client)

    expect(retry.decisionHash).not.toBe(first.decisionHash)
    expect(replay).toEqual(persisted)
    expect(replay.confirmedAt).toBe(first.confirmedAt)
    expect(fake.rows).toHaveLength(1)
  })

  it('invalidates incomplete plans when a new decision version is persisted', async () => {
    const fake = new DecisionPersistenceFake()
    fake.planRows.push(pendingPlan())

    await persistConfirmedPayrollImportDecision(inputFor(decision('KEEP_CURRENT')), fake.client())

    expect(fake.planRows[0]).toMatchObject({
      status: 'INVALIDATED',
      invalidated_by_user_id: actorUserId,
      invalidation_reason: 'PLAN_SUPERSEDED',
    })
    expect(fake.invalidationCalls).toHaveLength(1)
    expect(fake.invalidationCalls[0]).toMatchObject({
      requested_plan_hash: 'd'.repeat(64),
      requested_actor_user_id: actorUserId,
      requested_reason: 'PLAN_SUPERSEDED',
    })
  })

  it('retries plan invalidation after an identical decision save retry', async () => {
    const fake = new DecisionPersistenceFake()
    fake.planRows.push(pendingPlan())
    fake.failNextInvalidation = true
    const input = inputFor(decision('KEEP_CURRENT'))

    await expect(persistConfirmedPayrollImportDecision(input, fake.client())).rejects.toMatchObject({
      code: 'PAYROLL_FINALIZATION_DATABASE_ERROR',
      status: 500,
    })
    expect(fake.rows).toHaveLength(1)
    await expect(persistConfirmedPayrollImportDecision(input, fake.client())).resolves.toMatchObject({
      decisionVersion: 1,
    })

    expect(fake.planRows[0]?.status).toBe('INVALIDATED')
    expect(fake.invalidationCalls).toHaveLength(2)
  })

  it('persists a non-executable plan as BLOCKED and replays block events idempotently', async () => {
    const fake = new FinalizationPlanPersistenceFake()
    const plannerInput = blockedPlannerInput()
    const confirmedDecision = plannerInput.people[0]?.confirmedDecision
    if (!confirmedDecision) throw new Error('fixture decision missing')
    fake.decisionRows.push({
      id: '00000000-0000-4000-8000-000000000099',
      tenant_id: tenantId,
      hr_group_id: hrGroupId,
      administration_id: administrationId,
      batch_id: batchId,
      import_person_id: importPersonId,
      decision_version: confirmedDecision.decisionVersion,
      decision_payload: confirmedDecision.decision as unknown as Json,
      decision_hash: confirmedDecision.decisionHash,
      source_hash: sourceHash,
      analysis_hash: analysisHash,
      core_state_hash: coreStateHash,
      contract_version: plannerInput.contractVersion,
      schema_version: plannerInput.batch.schemaVersion,
      confirmer_user_id: actorUserId,
      confirmed_at: confirmedDecision.confirmedAt,
      created_at: '2026-10-05T10:00:00.000Z',
    })
    const persistInput = { plannerInput, actorUserId }

    const first = await persistFinalizationPlan(persistInput, fake.client())
    expect(first.length).toBeGreaterThan(0)
    expect(fake.planRows).toHaveLength(1)
    expect(fake.planRows[0]?.status).toBe('BLOCKED')
    expect(fake.actionEvents.length).toBe(first.length)
    expect(fake.actionEvents.every((event) => event.event_type === 'BLOCKED')).toBe(true)
    expect(first.every((action) => action.status === 'BLOCKED')).toBe(true)
    expect(fake.actionEvents.every((event) => event.error_code === 'SCOPE_INVARIANT_MIGRATION_NOT_APPLIED')).toBe(true)

    const eventCount = fake.actionEvents.length
    const replay = await persistFinalizationPlan(persistInput, fake.client())
    expect(replay).toEqual(first)
    expect(fake.actionEvents).toHaveLength(eventCount)
  })

  it('returns only current-plan actions when a superseded plan remains in the batch ledger', async () => {
    const fake = new FinalizationPlanPersistenceFake()
    const plannerInput = blockedPlannerInput()
    const confirmedDecision = plannerInput.people[0]?.confirmedDecision
    if (!confirmedDecision) throw new Error('fixture decision missing')
    fake.decisionRows.push({
      id: '00000000-0000-4000-8000-000000000099',
      tenant_id: tenantId,
      hr_group_id: hrGroupId,
      administration_id: administrationId,
      batch_id: batchId,
      import_person_id: importPersonId,
      decision_version: confirmedDecision.decisionVersion,
      decision_payload: confirmedDecision.decision as unknown as Json,
      decision_hash: confirmedDecision.decisionHash,
      source_hash: sourceHash,
      analysis_hash: analysisHash,
      core_state_hash: coreStateHash,
      contract_version: plannerInput.contractVersion,
      schema_version: plannerInput.batch.schemaVersion,
      confirmer_user_id: actorUserId,
      confirmed_at: confirmedDecision.confirmedAt,
      created_at: '2026-10-05T10:00:00.000Z',
    })
    const first = await persistFinalizationPlan({ plannerInput, actorUserId }, fake.client())
    const current = fake.actionRows[0]
    if (!current || !first[0]) throw new Error('ledger fixture missing')
    fake.actionRows.push({
      ...current,
      id: '00000000-0000-4000-8000-000000000009',
      plan_id: '00000000-0000-4000-8000-000000000008',
      action_id: 'payroll-finalize:superseded-action',
      idempotency_key: 'd'.repeat(64),
      plan_hash: 'd'.repeat(64),
    })

    const replay = await persistFinalizationPlan({ plannerInput, actorUserId }, fake.client())
    expect(replay).toEqual(first)
    expect(replay.map((action) => action.row.plan_hash)).toEqual([first[0].row.plan_hash])

    const batchRead = await readFinalizationLedger({ tenantId, hrGroupId, batchId }, fake.client())
    expect(batchRead).toHaveLength(first.length + 1)
  })

  it('invalidates and rejects a plan when a newer decision wins during plan insertion', async () => {
    const fake = new FinalizationPlanPersistenceFake()
    const plannerInput = blockedPlannerInput()
    const confirmedDecision = plannerInput.people[0]?.confirmedDecision
    if (!confirmedDecision) throw new Error('fixture decision missing')
    fake.decisionRows.push({
      id: '00000000-0000-4000-8000-000000000099',
      tenant_id: tenantId,
      hr_group_id: hrGroupId,
      administration_id: administrationId,
      batch_id: batchId,
      import_person_id: importPersonId,
      decision_version: confirmedDecision.decisionVersion,
      decision_payload: confirmedDecision.decision as unknown as Json,
      decision_hash: confirmedDecision.decisionHash,
      source_hash: sourceHash,
      analysis_hash: analysisHash,
      core_state_hash: coreStateHash,
      contract_version: plannerInput.contractVersion,
      schema_version: plannerInput.batch.schemaVersion,
      confirmer_user_id: actorUserId,
      confirmed_at: confirmedDecision.confirmedAt,
      created_at: '2026-10-05T10:00:00.000Z',
    })
    fake.beforePlanUpsert = () => {
      const changedDecision = confirmPayrollImportDecision({
        decision: {
          ...confirmedDecision.decision,
          sourceFieldDecisions: { firstName: 'USE_SOURCE' },
        },
        decisionVersion: 2,
        confirmerUserId: actorUserId,
        confirmedAt: '2026-10-05T10:01:00.000Z',
        sourceHash,
        analysisHash,
        coreStateHash,
      })
      fake.decisionRows.push({
        id: '00000000-0000-4000-8000-000000000098',
        tenant_id: tenantId,
        hr_group_id: hrGroupId,
        administration_id: administrationId,
        batch_id: batchId,
        import_person_id: importPersonId,
        decision_version: changedDecision.decisionVersion,
        decision_payload: changedDecision.decision as unknown as Json,
        decision_hash: changedDecision.decisionHash,
        source_hash: sourceHash,
        analysis_hash: analysisHash,
        core_state_hash: coreStateHash,
        contract_version: plannerInput.contractVersion,
        schema_version: plannerInput.batch.schemaVersion,
        confirmer_user_id: actorUserId,
        confirmed_at: changedDecision.confirmedAt,
        created_at: '2026-10-05T10:01:00.000Z',
      })
    }

    await expect(persistFinalizationPlan({ plannerInput, actorUserId }, fake.client())).rejects.toMatchObject({
      code: 'PAYROLL_FINALIZATION_DECISION_STATE_CHANGED',
      status: 409,
    })
    expect(fake.planRows).toHaveLength(1)
    expect(fake.planRows[0]?.status).toBe('INVALIDATED')
    expect(fake.actionRows).toHaveLength(0)
    expect(fake.invalidationCalls).toHaveLength(1)
    expect(fake.invalidationCalls[0]?.requested_reason).toBe('DECISION_CHANGED')
  })

  it('rejects action readback when its parent plan has been invalidated', async () => {
    const fake = new FinalizationPlanPersistenceFake()
    const plannerInput = blockedPlannerInput()
    const confirmedDecision = plannerInput.people[0]?.confirmedDecision
    if (!confirmedDecision) throw new Error('fixture decision missing')
    fake.decisionRows.push({
      id: '00000000-0000-4000-8000-000000000099',
      tenant_id: tenantId,
      hr_group_id: hrGroupId,
      administration_id: administrationId,
      batch_id: batchId,
      import_person_id: importPersonId,
      decision_version: confirmedDecision.decisionVersion,
      decision_payload: confirmedDecision.decision as unknown as Json,
      decision_hash: confirmedDecision.decisionHash,
      source_hash: sourceHash,
      analysis_hash: analysisHash,
      core_state_hash: coreStateHash,
      contract_version: plannerInput.contractVersion,
      schema_version: plannerInput.batch.schemaVersion,
      confirmer_user_id: actorUserId,
      confirmed_at: confirmedDecision.confirmedAt,
      created_at: '2026-10-05T10:00:00.000Z',
    })
    const actions = await persistFinalizationPlan({ plannerInput, actorUserId }, fake.client())
    const plan = fake.planRows[0]
    if (!plan || !actions[0]) throw new Error('ledger fixture missing')
    plan.status = 'INVALIDATED'

    await expect(readFinalizationActionEvents({
      tenantId,
      hrGroupId,
      administrationId,
      batchId,
    }, actions[0].row.action_id, fake.client())).rejects.toMatchObject({
      code: 'PAYROLL_FINALIZATION_PLAN_INVALIDATED',
      status: 409,
    })
  })

  it('rejects action readback when plan and action state hashes diverge', async () => {
    const fake = new FinalizationPlanPersistenceFake()
    const plannerInput = blockedPlannerInput()
    const confirmedDecision = plannerInput.people[0]?.confirmedDecision
    if (!confirmedDecision) throw new Error('fixture decision missing')
    fake.decisionRows.push({
      id: '00000000-0000-4000-8000-000000000099',
      tenant_id: tenantId,
      hr_group_id: hrGroupId,
      administration_id: administrationId,
      batch_id: batchId,
      import_person_id: importPersonId,
      decision_version: confirmedDecision.decisionVersion,
      decision_payload: confirmedDecision.decision as unknown as Json,
      decision_hash: confirmedDecision.decisionHash,
      source_hash: sourceHash,
      analysis_hash: analysisHash,
      core_state_hash: coreStateHash,
      contract_version: plannerInput.contractVersion,
      schema_version: plannerInput.batch.schemaVersion,
      confirmer_user_id: actorUserId,
      confirmed_at: confirmedDecision.confirmedAt,
      created_at: '2026-10-05T10:00:00.000Z',
    })
    const actions = await persistFinalizationPlan({ plannerInput, actorUserId }, fake.client())
    const plan = fake.planRows[0]
    if (!plan || !actions[0]) throw new Error('ledger fixture missing')
    plan.core_state_hash = 'e'.repeat(64)

    await expect(readFinalizationActionEvents({
      tenantId,
      hrGroupId,
      administrationId,
      batchId,
    }, actions[0].row.action_id, fake.client())).rejects.toMatchObject({
      code: 'PAYROLL_FINALIZATION_PLAN_STATE_STALE',
      status: 409,
    })
  })
})
