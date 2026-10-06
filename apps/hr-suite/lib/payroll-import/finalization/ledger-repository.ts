import 'server-only'

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { Json } from '@scope/db'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  assertConfirmedDecisionForPersistence,
  assertFinalizationCompletionProof,
  assertFinalizationHash,
  assertFinalizationUuid,
  eventFingerprint,
  FinalizationLedgerContractError,
  type FinalizationLedgerEventType,
  type FinalizationLedgerStatus,
} from './ledger-contract'
import {
  stableSerialize,
  type ConfirmedPayrollImportDecision,
  type PayrollImportPersonDecision,
} from './decision-contract'
import type {
  PayrollFinalizationAction,
  PayrollFinalizationPlan,
  PayrollFinalizationPlannerInput,
} from './planner'
import { buildPayrollFinalizationPlan } from './planner'
import type {
  Control02FinalizationClient,
  FinalizationEventRpcArgs,
  FinalizationEventRpcResult,
  FinalizationPlanInvalidationRpcArgs,
  FinalizationPlanInvalidationRpcResult,
  PayrollImportDecisionRow,
  PayrollImportFinalizationPlanRow,
  PayrollImportFinalizationPlanEventRow,
  PayrollImportFinalizationActionRow,
  PayrollImportFinalizationActionEventRow,
} from './ledger-database'

export type FinalizationLedgerScope = {
  tenantId: string
  hrGroupId: string
  batchId: string
  administrationId: string
}

export type PersistDecisionInput = FinalizationLedgerScope & {
  importPersonId: string
  decision: ConfirmedPayrollImportDecision
  actorUserId: string
  sourceHash: string
  analysisHash: string
  coreStateHash: string
  contractVersion: string | null
  schemaVersion: string | null
}

export type PersistedDecision = {
  id: string
  scope: FinalizationLedgerScope & { importPersonId: string }
  decision: PayrollImportPersonDecision
  decisionVersion: number
  decisionHash: string
  sourceHash: string
  analysisHash: string
  coreStateHash: string
  contractVersion: string | null
  schemaVersion: string | null
  confirmerUserId: string
  confirmedAt: string
}

export type PersistPlanInput = {
  plannerInput: PayrollFinalizationPlannerInput
  actorUserId: string
}

export type FinalizationLedgerAction = {
  row: Omit<PayrollImportFinalizationActionRow, 'lease_owner' | 'lease_token_hash'>
  status: FinalizationLedgerStatus
}

export type ClaimedFinalizationLedgerAction = FinalizationLedgerAction & {
  leaseCapability: { token: string; owner: string; expiresAt: string }
}

export type FinalizationLedgerEvent = PayrollImportFinalizationActionEventRow
export type FinalizationLedgerPlanEvent = PayrollImportFinalizationPlanEventRow

export type FinalizationLedgerPlanStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'BLOCKED'
  | 'INVALIDATED'

export type FinalizationLedgerPlan = {
  row: PayrollImportFinalizationPlanRow
  status: FinalizationLedgerPlanStatus
  isFresh: boolean
}

export class FinalizationLedgerError extends Error {
  constructor(readonly code: string, readonly status = 500) {
    super(code)
    this.name = 'FinalizationLedgerError'
  }
}

function adminClient(): Control02FinalizationClient {
  return createAdminClient() as unknown as Control02FinalizationClient
}

function jsonValue(value: unknown): Json {
  return value as Json
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function databaseError(message: string, status = 500): never {
  const code = message.match(/PAYROLL_FINALIZATION_[A-Z0-9_.:-]+/)?.[0] ?? 'PAYROLL_FINALIZATION_DATABASE_ERROR'
  throw new FinalizationLedgerError(code, status)
}

function handleError(error: { code?: string; message?: string } | null, fallback = 'PAYROLL_FINALIZATION_DATABASE_ERROR'): void {
  if (!error) return
  const message = error.message ?? ''
  const code = error.code === '23505'
    ? 'PAYROLL_FINALIZATION_IDEMPOTENCY_CONFLICT'
    : message.match(/PAYROLL_FINALIZATION_[A-Z0-9_.:-]+/)?.[0] ?? fallback
  throw new FinalizationLedgerError(code, error.code === '23505' ? 409 : 500)
}

function decisionFromRow(row: PayrollImportDecisionRow): PersistedDecision {
  if (typeof row.decision_payload !== 'object' || row.decision_payload === null || Array.isArray(row.decision_payload)) {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_DECISION_INVALID')
  }
  return {
    id: row.id,
    scope: {
      tenantId: row.tenant_id,
      hrGroupId: row.hr_group_id,
      batchId: row.batch_id,
      administrationId: row.administration_id,
      importPersonId: row.import_person_id,
    },
    decision: row.decision_payload as unknown as PayrollImportPersonDecision,
    decisionVersion: row.decision_version,
    decisionHash: row.decision_hash,
    sourceHash: row.source_hash,
    analysisHash: row.analysis_hash,
    coreStateHash: row.core_state_hash,
    contractVersion: row.contract_version,
    schemaVersion: row.schema_version,
    confirmerUserId: row.confirmer_user_id,
    confirmedAt: row.confirmed_at,
  }
}

function confirmedDecisionFromRecord(record: PersistedDecision): ConfirmedPayrollImportDecision {
  return {
    decision: record.decision,
    decisionVersion: record.decisionVersion,
    confirmerUserId: record.confirmerUserId,
    confirmedAt: record.confirmedAt,
    sourceHash: record.sourceHash,
    analysisHash: record.analysisHash,
    coreStateHash: record.coreStateHash,
    decisionHash: record.decisionHash,
  }
}

function actionStatus(value: string): FinalizationLedgerStatus {
  const statuses: readonly FinalizationLedgerStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'BLOCKED']
  if (!statuses.includes(value as FinalizationLedgerStatus)) {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_ACTION_STATE_INVALID')
  }
  return value as FinalizationLedgerStatus
}

function actionFromRow(row: PayrollImportFinalizationActionRow): FinalizationLedgerAction {
  const { lease_owner: leaseOwner, lease_token_hash: leaseTokenHash, ...safeRow } = row
  void leaseOwner
  void leaseTokenHash
  return { row: safeRow, status: actionStatus(row.status) }
}

function hashLeaseToken(token: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new FinalizationLedgerError('PAYROLL_FINALIZATION_LEASE_TOKEN_INVALID', 422)
  return createHash('sha256').update(token).digest('hex')
}

function stableDecisionPayload(value: PayrollImportPersonDecision): string {
  return stableSerialize(value)
}

function planStatus(value: string): FinalizationLedgerPlanStatus {
  const statuses: readonly FinalizationLedgerPlanStatus[] = [
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'FAILED',
    'BLOCKED',
    'INVALIDATED',
  ]
  if (!statuses.includes(value as FinalizationLedgerPlanStatus)) {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_PLAN_STATE_INVALID')
  }
  return value as FinalizationLedgerPlanStatus
}

function planFromRow(
  row: PayrollImportFinalizationPlanRow,
  freshness?: { sourceHash: string; analysisHash: string; coreStateHash: string },
): FinalizationLedgerPlan {
  const status = planStatus(row.status)
  return {
    row,
    status,
    isFresh: freshness === undefined
      || (row.source_hash === freshness.sourceHash
        && row.analysis_hash === freshness.analysisHash
        && row.core_state_hash === freshness.coreStateHash),
  }
}

function ensureRecordMatchesContext(record: PersistedDecision, input: PersistPlanInput): void {
  const batch = input.plannerInput.batch
  if (record.scope.tenantId !== batch.tenantId
    || record.scope.hrGroupId !== batch.hrGroupId
    || record.scope.batchId !== batch.batchId
    || record.scope.administrationId !== batch.administrationId
    || record.sourceHash !== batch.sourceHash
    || record.analysisHash !== batch.analysisHash
    || record.coreStateHash !== input.plannerInput.currentCoreStateHash
    || record.confirmerUserId !== input.actorUserId) {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_DECISION_SCOPE_OR_STATE_MISMATCH', 409)
  }
}

function actionPayload(
  input: PersistPlanInput,
  plan: PayrollFinalizationPlan,
  planId: string,
  decision: PersistedDecision,
  action: PayrollFinalizationAction,
  sequenceNo: number,
): Partial<PayrollImportFinalizationActionRow> {
  const batch = input.plannerInput.batch
  const targetEmploymentId = isUuid(action.targetEmploymentId) ? action.targetEmploymentId : null
  const targetEmploymentRef = action.targetEmploymentRef ?? (action.targetEmploymentId && !targetEmploymentId ? action.targetEmploymentId : null)
  return {
    tenant_id: batch.tenantId,
    hr_group_id: batch.hrGroupId,
    administration_id: batch.administrationId,
    batch_id: batch.batchId,
    plan_id: planId,
    import_person_id: decision.scope.importPersonId,
    decision_id: decision.id,
    sequence_no: sequenceNo,
    action_id: action.actionId,
    idempotency_key: action.idempotencyKey,
    source_person_ref: action.sourcePersonRef,
    source_income_ref: action.sourceIncomeRef ?? null,
    target_employee_id: isUuid(action.targetEmployeeId) ? action.targetEmployeeId : null,
    target_employee_ref: action.targetEmployeeRef ?? null,
    target_employment_id: targetEmploymentId,
    target_employment_ref: targetEmploymentRef,
    target_income_relationship_id: isUuid(action.targetIncomeRelationshipId) ? action.targetIncomeRelationshipId : null,
    action_type: action.type,
    source_payroll_tax_number: action.sourcePayrollTaxNumber ?? null,
    source_ikv_number: action.sourceIkvNumber ?? null,
    source_starts_on: action.sourceStartsOn ?? null,
    source_ends_on: action.sourceEndsOn ?? null,
    source_refs: jsonValue([...action.sourceRefs]),
    preconditions: jsonValue([...action.preconditions]),
    depends_on_action_ids: [...action.dependsOnActionIds],
    plan_hash: plan.planHash,
    decision_hash: decision.decisionHash,
    source_hash: batch.sourceHash,
    analysis_hash: batch.analysisHash,
    core_state_hash: input.plannerInput.currentCoreStateHash,
    contract_version: plan.contractVersion,
    schema_version: plan.schemaVersion,
    status: 'PENDING',
    attempt_count: 0,
    checkpoint: jsonValue(targetEmploymentRef ? { targetEmploymentRef } : {}),
  }
}

const immutableActionFields = [
  'tenant_id',
  'hr_group_id',
  'administration_id',
  'batch_id',
  'plan_id',
  'import_person_id',
  'decision_id',
  'sequence_no',
  'action_id',
  'idempotency_key',
  'source_person_ref',
  'source_income_ref',
  'target_employee_id',
  'target_employee_ref',
  'target_employment_id',
  'target_employment_ref',
  'target_income_relationship_id',
  'action_type',
  'source_payroll_tax_number',
  'source_ikv_number',
  'source_starts_on',
  'source_ends_on',
  'source_refs',
  'preconditions',
  'depends_on_action_ids',
  'plan_hash',
  'decision_hash',
  'source_hash',
  'analysis_hash',
  'core_state_hash',
  'contract_version',
  'schema_version',
] as const satisfies readonly (keyof PayrollImportFinalizationActionRow)[]

function assertPersistedActionMatchesDraft(
  row: PayrollImportFinalizationActionRow,
  draft: Partial<PayrollImportFinalizationActionRow>,
): void {
  for (const field of immutableActionFields) {
    if (stableSerialize(row[field]) !== stableSerialize(draft[field])) {
      throw new FinalizationLedgerError('PAYROLL_FINALIZATION_PLAN_IDEMPOTENCY_CONFLICT', 409)
    }
  }
}

function rpcResult(data: FinalizationEventRpcResult[] | null): FinalizationEventRpcResult {
  const result = data?.[0]
  if (!result) throw new FinalizationLedgerError('PAYROLL_FINALIZATION_EVENT_READBACK_FAILED')
  actionStatus(result.status)
  if (!isUuid(result.event_id)) throw new FinalizationLedgerError('PAYROLL_FINALIZATION_EVENT_READBACK_FAILED')
  return result
}

function invalidationRpcResult(data: FinalizationPlanInvalidationRpcResult[] | null): FinalizationPlanInvalidationRpcResult {
  const result = data?.[0]
  if (!result || !isUuid(result.plan_id) || planStatus(result.status) !== 'INVALIDATED') {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_PLAN_READBACK_FAILED')
  }
  return result
}

async function recordEvent(
  client: Control02FinalizationClient,
  input: {
    scope: Pick<FinalizationLedgerScope, 'tenantId' | 'hrGroupId' | 'batchId'>
    actionId: string
    eventType: FinalizationLedgerEventType
    eventKey: string
    actorUserId: string
    attemptNumber: number
    sourceHash: string
    analysisHash: string
    coreStateHash: string
    checkpoint: Json
    errorCode?: string | null
    leaseUntil?: string | null
    leaseOwner?: string | null
    leaseTokenHash?: string | null
  },
): Promise<FinalizationEventRpcResult> {
  const args: FinalizationEventRpcArgs = {
    requested_tenant_id: input.scope.tenantId,
    requested_hr_group_id: input.scope.hrGroupId,
    requested_batch_id: input.scope.batchId,
    requested_action_id: input.actionId,
    requested_event_key: input.eventKey,
    requested_event_type: input.eventType,
    requested_actor_user_id: input.actorUserId,
    requested_attempt_number: input.attemptNumber,
    requested_source_hash: input.sourceHash,
    requested_analysis_hash: input.analysisHash,
    requested_core_state_hash: input.coreStateHash,
    requested_checkpoint: input.checkpoint,
    requested_error_code: input.errorCode ?? null,
    requested_lease_until: input.leaseUntil ?? null,
    requested_lease_owner: input.leaseOwner ?? null,
    requested_lease_token_hash: input.leaseTokenHash ?? null,
  }
  const { data, error } = await client.rpc('record_payroll_import_finalization_event', args)
  if (error) {
    const conflict = /NOT_CLAIMABLE|DEPENDENCIES_INCOMPLETE|STATE_CONFLICT|CONFLICT|INVALIDATED|STATE_HASH_MISMATCH|PLAN_INCOMPLETE|IDENTITY_MISMATCH/.test(error.message)
    databaseError(error.message, conflict ? 409 : 500)
  }
  return rpcResult(data)
}

async function readAction(
  client: Control02FinalizationClient,
  scope: Pick<FinalizationLedgerScope, 'tenantId' | 'hrGroupId' | 'batchId'> & Partial<Pick<FinalizationLedgerScope, 'administrationId'>>,
  actionId: string,
): Promise<FinalizationLedgerAction> {
  let query = client
    .from('payroll_import_finalization_actions')
    .select('*')
    .eq('tenant_id', scope.tenantId)
    .eq('hr_group_id', scope.hrGroupId)
    .eq('batch_id', scope.batchId)
    .eq('action_id', actionId)
  if (scope.administrationId) query = query.eq('administration_id', scope.administrationId)
  const { data, error } = await query.maybeSingle()
  if (error) handleError(error)
  if (!data) throw new FinalizationLedgerError('PAYROLL_FINALIZATION_ACTION_NOT_FOUND', 404)
  const action = actionFromRow(data)
  const planResult = await client
    .from('payroll_import_finalization_plans')
    .select('*')
    .eq('tenant_id', scope.tenantId)
    .eq('hr_group_id', scope.hrGroupId)
    .eq('batch_id', scope.batchId)
    .eq('id', data.plan_id)
    .maybeSingle()
  if (planResult.error) handleError(planResult.error, 'PAYROLL_FINALIZATION_PLAN_READ_FAILED')
  if (!planResult.data) throw new FinalizationLedgerError('PAYROLL_FINALIZATION_PLAN_NOT_FOUND', 404)
  const plan = planFromRow(planResult.data)
  if (plan.status === 'INVALIDATED') {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_PLAN_INVALIDATED', 409)
  }
  if (plan.row.plan_hash !== data.plan_hash
    || plan.row.source_hash !== data.source_hash
    || plan.row.analysis_hash !== data.analysis_hash
    || plan.row.core_state_hash !== data.core_state_hash) {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_PLAN_STATE_STALE', 409)
  }
  return action
}

async function readPlanRow(
  client: Control02FinalizationClient,
  scope: Pick<FinalizationLedgerScope, 'tenantId' | 'hrGroupId' | 'batchId'>,
  planHash: string,
): Promise<PayrollImportFinalizationPlanRow> {
  const result = await client
    .from('payroll_import_finalization_plans')
    .select('*')
    .eq('tenant_id', scope.tenantId)
    .eq('hr_group_id', scope.hrGroupId)
    .eq('batch_id', scope.batchId)
    .eq('plan_hash', planHash)
    .maybeSingle()
  if (result.error) handleError(result.error, 'PAYROLL_FINALIZATION_PLAN_READ_FAILED')
  if (!result.data) throw new FinalizationLedgerError('PAYROLL_FINALIZATION_PLAN_NOT_FOUND', 404)
  return result.data
}

async function invalidateSupersededPlans(
  input: PersistPlanInput,
  currentPlanHash: string,
  client: Control02FinalizationClient,
): Promise<void> {
  const batch = input.plannerInput.batch
  await invalidateIncompletePlans({
    tenantId: batch.tenantId,
    hrGroupId: batch.hrGroupId,
    administrationId: batch.administrationId,
    batchId: batch.batchId,
  }, input.actorUserId, currentPlanHash, client)
}

async function invalidateIncompletePlans(
  scope: FinalizationLedgerScope,
  actorUserId: string,
  currentPlanHash: string | null,
  client: Control02FinalizationClient,
): Promise<void> {
  const result = await client
    .from('payroll_import_finalization_plans')
    .select('*')
    .eq('tenant_id', scope.tenantId)
    .eq('hr_group_id', scope.hrGroupId)
    .eq('batch_id', scope.batchId)
    .eq('administration_id', scope.administrationId)
  if (result.error) handleError(result.error, 'PAYROLL_FINALIZATION_PLAN_READ_FAILED')
  for (const row of result.data ?? []) {
    if (row.plan_hash === currentPlanHash
      || row.status === 'COMPLETED'
      || row.status === 'INVALIDATED') continue
    try {
      await invalidateFinalizationPlan({
        tenantId: scope.tenantId,
        hrGroupId: scope.hrGroupId,
        administrationId: scope.administrationId,
        batchId: scope.batchId,
        planHash: row.plan_hash,
        actorUserId,
        reason: 'PLAN_SUPERSEDED',
      }, client)
    } catch (error) {
      if (!(error instanceof FinalizationLedgerError)
        || error.code !== 'PAYROLL_FINALIZATION_PLAN_ALREADY_COMPLETED') throw error
    }
  }
}

/**
 * A newly persisted decision supersedes every incomplete plan in the same
 * batch and administration. Existing pending actions remain immutable and
 * cannot be claimed once their parent plan is invalidated.
 */
export async function invalidateFinalizationPlansAfterDecisionChange(
  input: Pick<FinalizationLedgerScope, 'tenantId' | 'hrGroupId' | 'administrationId' | 'batchId'> & { actorUserId: string },
  client: Control02FinalizationClient = adminClient(),
): Promise<void> {
  await invalidateIncompletePlans(input, input.actorUserId, null, client)
}

async function readLatestDecisionRecords(
  plannerInput: PayrollFinalizationPlannerInput,
  client: Control02FinalizationClient,
): Promise<readonly PersistedDecision[]> {
  const personIds = [...new Set(plannerInput.people.map((person) => person.decisionSource.personId))]
  for (const personId of personIds) assertFinalizationUuid(personId, 'import_person_id')
  if (personIds.length === 0) return []
  const result = await client
    .from('payroll_import_decisions')
    .select('*')
    .eq('tenant_id', plannerInput.batch.tenantId)
    .eq('hr_group_id', plannerInput.batch.hrGroupId)
    .eq('administration_id', plannerInput.batch.administrationId)
    .eq('batch_id', plannerInput.batch.batchId)
    .in('import_person_id', personIds)
    .order('decision_version', { ascending: false })
  if (result.error) handleError(result.error, 'PAYROLL_FINALIZATION_DECISION_READ_FAILED')
  const latest = new Map<string, PersistedDecision>()
  for (const row of result.data ?? []) {
    if (!latest.has(row.import_person_id)) latest.set(row.import_person_id, decisionFromRow(row))
  }
  return [...latest.values()]
}

function decisionSnapshotSignature(record: PersistedDecision): string {
  return stableSerialize({
    id: record.id,
    importPersonId: record.scope.importPersonId,
    decisionVersion: record.decisionVersion,
    decision: record.decision,
    decisionHash: record.decisionHash,
    sourceHash: record.sourceHash,
    analysisHash: record.analysisHash,
    coreStateHash: record.coreStateHash,
    contractVersion: record.contractVersion,
    schemaVersion: record.schemaVersion,
    confirmerUserId: record.confirmerUserId,
    confirmedAt: record.confirmedAt,
  })
}

function assertDecisionSnapshotUnchanged(
  expected: readonly PersistedDecision[],
  actual: readonly PersistedDecision[],
): void {
  const expectedByPerson = new Map(expected.map((record) => [record.scope.importPersonId, decisionSnapshotSignature(record)]))
  const actualByPerson = new Map(actual.map((record) => [record.scope.importPersonId, decisionSnapshotSignature(record)]))
  if (expectedByPerson.size !== actualByPerson.size) {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_DECISION_STATE_CHANGED', 409)
  }
  for (const [personId, signature] of expectedByPerson) {
    if (actualByPerson.get(personId) !== signature) {
      throw new FinalizationLedgerError('PAYROLL_FINALIZATION_DECISION_STATE_CHANGED', 409)
    }
  }
}

async function assertCurrentDecisionSnapshot(
  plannerInput: PayrollFinalizationPlannerInput,
  expected: readonly PersistedDecision[],
  client: Control02FinalizationClient,
): Promise<void> {
  const actual = await readLatestDecisionRecords(plannerInput, client)
  assertDecisionSnapshotUnchanged(expected, actual)
}

async function assertPlanDecisionSnapshot(
  plannerInput: PayrollFinalizationPlannerInput,
  expected: readonly PersistedDecision[],
  plan: PayrollImportFinalizationPlanRow,
  actorUserId: string,
  client: Control02FinalizationClient,
): Promise<void> {
  try {
    await assertCurrentDecisionSnapshot(plannerInput, expected, client)
  } catch (error) {
    if (error instanceof FinalizationLedgerError
      && error.code === 'PAYROLL_FINALIZATION_DECISION_STATE_CHANGED'
      && plan.status !== 'COMPLETED'
      && plan.status !== 'INVALIDATED') {
      await invalidateFinalizationPlan({
        tenantId: plan.tenant_id,
        hrGroupId: plan.hr_group_id,
        administrationId: plan.administration_id,
        batchId: plan.batch_id,
        planHash: plan.plan_hash,
        actorUserId,
        reason: 'DECISION_CHANGED',
      }, client)
    }
    throw error
  }
}

export async function persistConfirmedPayrollImportDecision(
  input: PersistDecisionInput,
  client: Control02FinalizationClient = adminClient(),
): Promise<PersistedDecision> {
  const context = {
    actorUserId: assertFinalizationUuid(input.actorUserId, 'actor_user_id'),
    sourceHash: assertFinalizationHash(input.sourceHash, 'source'),
    analysisHash: assertFinalizationHash(input.analysisHash, 'analysis'),
    coreStateHash: assertFinalizationHash(input.coreStateHash, 'core_state'),
    contractVersion: input.contractVersion,
    schemaVersion: input.schemaVersion,
  }
  assertFinalizationUuid(input.tenantId, 'tenant_id')
  assertFinalizationUuid(input.hrGroupId, 'hr_group_id')
  assertFinalizationUuid(input.batchId, 'batch_id')
  assertFinalizationUuid(input.administrationId, 'administration_id')
  assertFinalizationUuid(input.importPersonId, 'import_person_id')
  const decision = assertConfirmedDecisionForPersistence(input.decision, context)
  const rowInput = {
    tenant_id: input.tenantId,
    hr_group_id: input.hrGroupId,
    administration_id: input.administrationId,
    batch_id: input.batchId,
    import_person_id: input.importPersonId,
    decision_version: decision.decisionVersion,
    decision_payload: jsonValue(decision.decision),
    decision_hash: decision.decisionHash,
    source_hash: decision.sourceHash,
    analysis_hash: decision.analysisHash,
    core_state_hash: decision.coreStateHash,
    contract_version: input.contractVersion,
    schema_version: input.schemaVersion,
    confirmer_user_id: decision.confirmerUserId,
    confirmed_at: decision.confirmedAt,
  }
  const inserted = await client.from('payroll_import_decisions').insert(rowInput).select('*').single()
  if (!inserted.error && inserted.data) {
    await invalidateFinalizationPlansAfterDecisionChange({
      tenantId: input.tenantId,
      hrGroupId: input.hrGroupId,
      administrationId: input.administrationId,
      batchId: input.batchId,
      actorUserId: input.actorUserId,
    }, client)
    return decisionFromRow(inserted.data)
  }
  if (inserted.error?.code !== '23505') handleError(inserted.error, 'PAYROLL_FINALIZATION_DECISION_PERSIST_FAILED')

  const existing = await client
    .from('payroll_import_decisions')
    .select('*')
    .eq('tenant_id', input.tenantId)
    .eq('hr_group_id', input.hrGroupId)
    .eq('batch_id', input.batchId)
    .eq('import_person_id', input.importPersonId)
    .eq('decision_version', decision.decisionVersion)
    .maybeSingle()
  if (existing.error) handleError(existing.error)
  if (!existing.data) {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_DECISION_IDEMPOTENCY_CONFLICT', 409)
  }
  const stored = decisionFromRow(existing.data)
  if (stored.decisionVersion !== decision.decisionVersion
    || stored.confirmerUserId !== decision.confirmerUserId
    || stored.sourceHash !== decision.sourceHash
    || stored.analysisHash !== decision.analysisHash
    || stored.coreStateHash !== decision.coreStateHash
    || stored.contractVersion !== input.contractVersion
    || stored.schemaVersion !== input.schemaVersion) {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_DECISION_IDEMPOTENCY_CONFLICT', 409)
  }

  // The confirmation timestamp is metadata, not a second decision. A retry
  // from the same actor at the same version may receive a fresh timestamp
  // from the caller; preserve the first immutable confirmation when the
  // canonical payload and state fingerprints are unchanged.
  if (stableDecisionPayload(stored.decision) !== stableDecisionPayload(decision.decision)) {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_DECISION_IDEMPOTENCY_CONFLICT', 409)
  }
  await invalidateFinalizationPlansAfterDecisionChange({
    tenantId: input.tenantId,
    hrGroupId: input.hrGroupId,
    administrationId: input.administrationId,
    batchId: input.batchId,
    actorUserId: input.actorUserId,
  }, client)
  return stored
}

export async function persistFinalizationPlan(
  input: PersistPlanInput,
  client: Control02FinalizationClient = adminClient(),
): Promise<readonly FinalizationLedgerAction[]> {
  if (input.plannerInput.currentUserId !== input.actorUserId) {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_DECISION_ACTOR_MISMATCH', 409)
  }
  const clientForRead = client
  const decisionRecords = await readLatestDecisionRecords(input.plannerInput, clientForRead)
  const decisionByPerson = new Map(decisionRecords.map((record) => [record.scope.importPersonId, record]))
  const serverPlannerInput: PayrollFinalizationPlannerInput = {
    ...input.plannerInput,
    people: input.plannerInput.people.map((person) => ({
      ...person,
      confirmedDecision: decisionByPerson.has(person.decisionSource.personId)
        ? confirmedDecisionFromRecord(decisionByPerson.get(person.decisionSource.personId)!)
        : null,
    })),
  }
  const serverInput: PersistPlanInput = { ...input, plannerInput: serverPlannerInput }
  const batch = serverPlannerInput.batch
  const plan = buildPayrollFinalizationPlan(serverPlannerInput)
  assertFinalizationUuid(batch.tenantId, 'tenant_id')
  assertFinalizationUuid(batch.hrGroupId, 'hr_group_id')
  assertFinalizationUuid(batch.batchId, 'batch_id')
  assertFinalizationUuid(batch.administrationId, 'administration_id')
  assertFinalizationUuid(input.actorUserId, 'actor_user_id')
  assertFinalizationHash(plan.planHash, 'plan')
  assertFinalizationHash(batch.sourceHash, 'source')
  assertFinalizationHash(batch.analysisHash, 'analysis')
  assertFinalizationHash(input.plannerInput.currentCoreStateHash, 'core_state')

  const sourcePersonDecision = new Map<string, PersistedDecision>()
  for (const person of plan.people) {
    const plannerPerson = serverPlannerInput.people.find((candidate) => candidate.sourceRef === person.sourcePersonRef)
    const decision = plannerPerson ? decisionByPerson.get(plannerPerson.decisionSource.personId) : undefined
    if (!decision) throw new FinalizationLedgerError('PAYROLL_FINALIZATION_DECISION_REQUIRED', 409)
    ensureRecordMatchesContext(decision, serverInput)
    sourcePersonDecision.set(person.sourcePersonRef, decision)
  }

  let sequenceNo = 0
  const draftDescriptors = plan.people.flatMap((person) => {
    const decision = sourcePersonDecision.get(person.sourcePersonRef)
    if (!decision) throw new FinalizationLedgerError('PAYROLL_FINALIZATION_DECISION_REQUIRED', 409)
    return person.actions.map((action) => ({ decision, action, sequenceNo: ++sequenceNo }))
  })
  if (draftDescriptors.length === 0) return []

  // Re-read immediately before creating the plan. A decision confirmation
  // may have won a concurrent race after the planner's first read; stale
  // decision snapshots must never become a new actionable plan.
  await assertCurrentDecisionSnapshot(input.plannerInput, decisionRecords, client)
  await invalidateSupersededPlans(input, plan.planHash, client)

  const planInsert: Partial<PayrollImportFinalizationPlanRow> = {
    tenant_id: batch.tenantId,
    hr_group_id: batch.hrGroupId,
    administration_id: batch.administrationId,
    batch_id: batch.batchId,
    plan_hash: plan.planHash,
    source_hash: batch.sourceHash,
    analysis_hash: batch.analysisHash,
    core_state_hash: input.plannerInput.currentCoreStateHash,
    contract_version: plan.contractVersion,
    schema_version: plan.schemaVersion,
    expected_action_count: draftDescriptors.length,
    completed_action_count: 0,
    status: plan.status === 'BLOCKED' || !plan.canExecute ? 'BLOCKED' : 'PENDING',
    created_by_user_id: input.actorUserId,
  }
  const { error: planUpsertError } = await client
    .from('payroll_import_finalization_plans')
    .upsert(planInsert, { onConflict: 'tenant_id,hr_group_id,batch_id,plan_hash', ignoreDuplicates: true })
  if (planUpsertError) handleError(planUpsertError, 'PAYROLL_FINALIZATION_PLAN_PERSIST_FAILED')

  const persistedPlan = planFromRow(
    await readPlanRow(client, batch, plan.planHash),
    {
      sourceHash: batch.sourceHash,
      analysisHash: batch.analysisHash,
      coreStateHash: input.plannerInput.currentCoreStateHash,
    },
  )
  if (persistedPlan.row.administration_id !== batch.administrationId
    || persistedPlan.row.expected_action_count !== draftDescriptors.length
    || persistedPlan.row.contract_version !== plan.contractVersion
    || persistedPlan.row.schema_version !== plan.schemaVersion) {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_PLAN_IDEMPOTENCY_CONFLICT', 409)
  }
  if (!persistedPlan.isFresh) {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_PLAN_STATE_STALE', 409)
  }
  if (persistedPlan.status === 'INVALIDATED') {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_PLAN_INVALIDATED', 409)
  }

  // The plan upsert is a separate database statement. Revalidate after it
  // and invalidate the just-created plan if a concurrent decision won the
  // race while the row was being inserted.
  await assertPlanDecisionSnapshot(
    input.plannerInput,
    decisionRecords,
    persistedPlan.row,
    input.actorUserId,
    client,
  )

  const drafts = draftDescriptors.map(({ decision, action, sequenceNo: itemSequenceNo }) =>
    actionPayload(serverInput, plan, persistedPlan.row.id, decision, action, itemSequenceNo))

  const { error: upsertError } = await client
    .from('payroll_import_finalization_actions')
    .upsert(drafts, { onConflict: 'tenant_id,hr_group_id,batch_id,idempotency_key', ignoreDuplicates: true })
  if (upsertError) handleError(upsertError, 'PAYROLL_FINALIZATION_PLAN_PERSIST_FAILED')

  const keys = drafts.map((draft) => String(draft.idempotency_key))
  const readback = await client
    .from('payroll_import_finalization_actions')
    .select('*')
    .eq('tenant_id', batch.tenantId)
    .eq('hr_group_id', batch.hrGroupId)
    .eq('batch_id', batch.batchId)
    .in('idempotency_key', keys)
    .order('sequence_no')
  if (readback.error) handleError(readback.error, 'PAYROLL_FINALIZATION_PLAN_READBACK_FAILED')
  if (!readback.data || readback.data.length !== drafts.length) {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_PLAN_READBACK_INCOMPLETE')
  }

  // The action upsert is another statement boundary. A decision change in
  // that window invalidates the plan before any transition event is written.
  await assertPlanDecisionSnapshot(
    input.plannerInput,
    decisionRecords,
    persistedPlan.row,
    input.actorUserId,
    client,
  )

  const rowByKey = new Map(readback.data.map((row) => [row.idempotency_key, row]))
  for (const draft of drafts) {
    const row = rowByKey.get(String(draft.idempotency_key))
    if (!row) {
      throw new FinalizationLedgerError('PAYROLL_FINALIZATION_PLAN_IDEMPOTENCY_CONFLICT', 409)
    }
    assertPersistedActionMatchesDraft(row, draft)
  }

  const persistAsBlocked = plan.status === 'BLOCKED' || !plan.canExecute
  if ((persistAsBlocked || persistedPlan.status === 'BLOCKED')
    && (persistedPlan.status === 'PENDING' || persistedPlan.status === 'BLOCKED')) {
    const blockReason = plan.blockers[0] ?? 'PLAN_NOT_EXECUTABLE'
    for (const row of readback.data) {
      if (row.status !== 'PENDING') continue
      await recordEvent(client, {
        scope: {
          tenantId: batch.tenantId,
          hrGroupId: batch.hrGroupId,
          batchId: batch.batchId,
        },
        actionId: row.action_id,
        eventType: 'BLOCKED',
        eventKey: eventFingerprint({ actionId: row.action_id, eventType: 'BLOCKED', attemptNumber: row.attempt_count, planHash: plan.planHash, checkpoint: row.checkpoint, errorCode: blockReason }),
        actorUserId: input.actorUserId,
        attemptNumber: row.attempt_count,
        sourceHash: batch.sourceHash,
        analysisHash: input.plannerInput.batch.analysisHash,
        coreStateHash: input.plannerInput.currentCoreStateHash,
        checkpoint: jsonValue(row.checkpoint),
        errorCode: blockReason,
      })
    }
  } else if (persistedPlan.status === 'PENDING') {
    for (const row of readback.data) {
      if (row.status !== 'PENDING') continue
      await recordEvent(client, {
        scope: {
          tenantId: batch.tenantId,
          hrGroupId: batch.hrGroupId,
          batchId: batch.batchId,
        },
        actionId: row.action_id,
        eventType: 'PLANNED',
        eventKey: eventFingerprint({ actionId: row.action_id, eventType: 'PLANNED', attemptNumber: 0, planHash: plan.planHash, checkpoint: row.checkpoint }),
        actorUserId: input.actorUserId,
        attemptNumber: 0,
        sourceHash: batch.sourceHash,
        analysisHash: input.plannerInput.batch.analysisHash,
        coreStateHash: input.plannerInput.currentCoreStateHash,
        checkpoint: jsonValue(row.checkpoint),
      })
    }
  }
  const actions = await readFinalizationLedger({
    ...batch,
    planId: persistedPlan.row.id,
    planHash: persistedPlan.row.plan_hash,
  }, client)
  return actions
}

export type ReadFinalizationLedgerScope = Pick<FinalizationLedgerScope, 'tenantId' | 'hrGroupId' | 'batchId'>
  & Partial<Pick<FinalizationLedgerScope, 'administrationId'>>
  & Partial<{ planId: string; planHash: string }>

/**
 * Reads the complete batch ledger when no plan filter is supplied. Callers
 * that are reading one persisted plan must provide both immutable plan
 * identity fields so superseded plans cannot leak into the response.
 */
export async function readFinalizationLedger(
  scope: ReadFinalizationLedgerScope,
  client: Control02FinalizationClient = adminClient(),
): Promise<readonly FinalizationLedgerAction[]> {
  let query = client
    .from('payroll_import_finalization_actions')
    .select('*')
    .eq('tenant_id', scope.tenantId)
    .eq('hr_group_id', scope.hrGroupId)
    .eq('batch_id', scope.batchId)
    .order('sequence_no')
  if (scope.administrationId) query = query.eq('administration_id', scope.administrationId)
  if (scope.planId) query = query.eq('plan_id', scope.planId)
  if (scope.planHash) query = query.eq('plan_hash', scope.planHash)
  const result = await query
  if (result.error) handleError(result.error, 'PAYROLL_FINALIZATION_LEDGER_READ_FAILED')
  return (result.data ?? []).map(actionFromRow)
}

export type ReadFinalizationPlanInput = FinalizationLedgerScope & {
  planHash: string
  sourceHash?: string
  analysisHash?: string
  coreStateHash?: string
}

export async function readFinalizationPlan(
  input: ReadFinalizationPlanInput,
  client: Control02FinalizationClient = adminClient(),
): Promise<FinalizationLedgerPlan> {
  assertFinalizationUuid(input.tenantId, 'tenant_id')
  assertFinalizationUuid(input.hrGroupId, 'hr_group_id')
  assertFinalizationUuid(input.batchId, 'batch_id')
  assertFinalizationUuid(input.administrationId, 'administration_id')
  const planHash = assertFinalizationHash(input.planHash, 'plan')
  const freshness = input.sourceHash !== undefined
    && input.analysisHash !== undefined
    && input.coreStateHash !== undefined
    ? {
      sourceHash: assertFinalizationHash(input.sourceHash, 'source'),
      analysisHash: assertFinalizationHash(input.analysisHash, 'analysis'),
      coreStateHash: assertFinalizationHash(input.coreStateHash, 'core_state'),
    }
    : undefined
  const row = await readPlanRow(client, input, planHash)
  if (row.administration_id !== input.administrationId) {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_PLAN_SCOPE_MISMATCH', 403)
  }
  return planFromRow(row, freshness)
}

export async function invalidateFinalizationPlan(
  input: FinalizationLedgerScope & { planHash: string; actorUserId: string; reason: string },
  client: Control02FinalizationClient = adminClient(),
): Promise<FinalizationLedgerPlan> {
  assertFinalizationUuid(input.tenantId, 'tenant_id')
  assertFinalizationUuid(input.hrGroupId, 'hr_group_id')
  assertFinalizationUuid(input.batchId, 'batch_id')
  assertFinalizationUuid(input.administrationId, 'administration_id')
  assertFinalizationUuid(input.actorUserId, 'actor_user_id')
  const planHash = assertFinalizationHash(input.planHash, 'plan')
  if (!/^[A-Z][A-Z0-9_.:-]{0,63}$/.test(input.reason)) {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_PLAN_INVALIDATION_INPUT_INVALID', 422)
  }
  const args: FinalizationPlanInvalidationRpcArgs = {
    requested_tenant_id: input.tenantId,
    requested_hr_group_id: input.hrGroupId,
    requested_batch_id: input.batchId,
    requested_plan_hash: planHash,
    requested_actor_user_id: input.actorUserId,
    requested_reason: input.reason,
  }
  const { data, error } = await client.rpc('invalidate_payroll_import_finalization_plan', args)
  if (error) databaseError(error.message, error.code === '23505' ? 409 : 500)
  invalidationRpcResult(data)
  return readFinalizationPlan({ ...input, planHash }, client)
}

export async function readFinalizationPlanEvents(
  input: FinalizationLedgerScope & { planHash: string },
  client: Control02FinalizationClient = adminClient(),
): Promise<readonly FinalizationLedgerPlanEvent[]> {
  const plan = await readFinalizationPlan(input, client)
  const result = await client
    .from('payroll_import_finalization_plan_events')
    .select('*')
    .eq('tenant_id', input.tenantId)
    .eq('hr_group_id', input.hrGroupId)
    .eq('batch_id', input.batchId)
    .eq('plan_id', plan.row.id)
    .order('created_at')
  if (result.error) handleError(result.error, 'PAYROLL_FINALIZATION_PLAN_EVENT_READ_FAILED')
  return result.data ?? []
}

export async function readFinalizationActionEvents(
  scope: Pick<FinalizationLedgerScope, 'tenantId' | 'hrGroupId' | 'batchId'> & Partial<Pick<FinalizationLedgerScope, 'administrationId'>>,
  actionId: string,
  client: Control02FinalizationClient = adminClient(),
): Promise<readonly FinalizationLedgerEvent[]> {
  const query = client
    .from('payroll_import_finalization_action_events')
    .select('*')
    .eq('tenant_id', scope.tenantId)
    .eq('hr_group_id', scope.hrGroupId)
    .eq('batch_id', scope.batchId)
    .eq('action_id', actionId)
    .order('created_at')
  if (scope.administrationId) {
    const action = await readAction(client, scope, actionId)
    if (action.row.administration_id !== scope.administrationId) return []
  }
  const result = await query
  if (result.error) handleError(result.error, 'PAYROLL_FINALIZATION_EVENT_READ_FAILED')
  return result.data ?? []
}

export async function claimNextFinalizationAction(
  input: FinalizationLedgerScope & { actorUserId: string; leaseMs?: number },
  client: Control02FinalizationClient = adminClient(),
): Promise<ClaimedFinalizationLedgerAction | null> {
  const pending = await client
    .from('payroll_import_finalization_actions')
    .select('*')
    .eq('tenant_id', input.tenantId)
    .eq('hr_group_id', input.hrGroupId)
    .eq('batch_id', input.batchId)
    .eq('administration_id', input.administrationId)
    .eq('status', 'PENDING')
    .order('sequence_no')
    .limit(1)
    .maybeSingle()
  if (pending.error) handleError(pending.error, 'PAYROLL_FINALIZATION_CLAIM_READ_FAILED')
  if (!pending.data) return null
  const action = actionFromRow(pending.data)
  const leaseOwner = randomUUID()
  const leaseToken = randomBytes(32).toString('base64url')
  const leaseTokenHash = hashLeaseToken(leaseToken)
  const leaseMs = input.leaseMs ?? 5 * 60_000
  if (!Number.isSafeInteger(leaseMs) || leaseMs < 5_000 || leaseMs > 15 * 60_000) {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_LEASE_DURATION_INVALID', 422)
  }
  const leaseUntil = new Date(Date.now() + leaseMs).toISOString()
  try {
    await recordEvent(client, {
      scope: input,
      actionId: action.row.action_id,
      eventType: 'CLAIMED',
      eventKey: eventFingerprint({ actionId: action.row.action_id, eventType: 'CLAIMED', attemptNumber: action.row.attempt_count + 1, planHash: action.row.plan_hash, leaseUntil, leaseOwner }),
      actorUserId: input.actorUserId,
      attemptNumber: action.row.attempt_count + 1,
      sourceHash: action.row.source_hash,
      analysisHash: action.row.analysis_hash,
      coreStateHash: action.row.core_state_hash,
      checkpoint: jsonValue(action.row.checkpoint),
      leaseUntil,
      leaseOwner,
      leaseTokenHash,
    })
  } catch (error) {
    if (error instanceof FinalizationLedgerError
      && ['PAYROLL_FINALIZATION_ACTION_NOT_CLAIMABLE', 'PAYROLL_FINALIZATION_ACTION_DEPENDENCIES_INCOMPLETE'].includes(error.code)) return null
    throw error
  }
  const claimed = await readAction(client, input, action.row.action_id)
  return { ...claimed, leaseCapability: { token: leaseToken, owner: leaseOwner, expiresAt: leaseUntil } }
}

export async function checkpointFinalizationAction(
  input: FinalizationLedgerScope & { actorUserId: string; actionId: string; attemptNumber: number; checkpoint: Json; leaseUntil: string; leaseToken: string; leaseOwner: string },
  client: Control02FinalizationClient = adminClient(),
): Promise<FinalizationLedgerAction> {
  const action = await readAction(client, input, input.actionId)
  if (action.status !== 'IN_PROGRESS') throw new FinalizationLedgerError('PAYROLL_FINALIZATION_CHECKPOINT_CONFLICT', 409)
  await recordEvent(client, {
    scope: input,
    actionId: input.actionId,
    eventType: 'CHECKPOINT',
    eventKey: eventFingerprint({ actionId: input.actionId, eventType: 'CHECKPOINT', attemptNumber: input.attemptNumber, planHash: action.row.plan_hash, checkpoint: input.checkpoint, leaseUntil: input.leaseUntil, leaseOwner: input.leaseOwner }),
    actorUserId: input.actorUserId,
    attemptNumber: input.attemptNumber,
    sourceHash: action.row.source_hash,
    analysisHash: action.row.analysis_hash,
    coreStateHash: action.row.core_state_hash,
    checkpoint: input.checkpoint,
    leaseUntil: input.leaseUntil,
    leaseOwner: input.leaseOwner,
    leaseTokenHash: hashLeaseToken(input.leaseToken),
  })
  return readAction(client, input, input.actionId)
}
export async function completeFinalizationAction(
  input: FinalizationLedgerScope & { actorUserId: string; actionId: string; attemptNumber: number; checkpoint: Json; leaseToken: string; leaseOwner: string },
  client: Control02FinalizationClient = adminClient(),
): Promise<FinalizationLedgerAction> {
  const action = await readAction(client, input, input.actionId)
  if (action.status !== 'IN_PROGRESS') throw new FinalizationLedgerError('PAYROLL_FINALIZATION_COMPLETION_CONFLICT', 409)
  try {
    assertFinalizationCompletionProof(input.checkpoint, {
      sourceHash: action.row.source_hash,
      analysisHash: action.row.analysis_hash,
      coreStateHash: action.row.core_state_hash,
    })
  } catch (error) {
    if (error instanceof FinalizationLedgerContractError) {
      throw new FinalizationLedgerError(error.code, 422)
    }
    throw error
  }
  await recordEvent(client, {
    scope: input,
    actionId: input.actionId,
    eventType: 'COMPLETED',
    eventKey: eventFingerprint({ actionId: input.actionId, eventType: 'COMPLETED', attemptNumber: input.attemptNumber, planHash: action.row.plan_hash, checkpoint: input.checkpoint, leaseOwner: input.leaseOwner }),
    actorUserId: input.actorUserId,
    attemptNumber: input.attemptNumber,
    sourceHash: action.row.source_hash,
    analysisHash: action.row.analysis_hash,
    coreStateHash: action.row.core_state_hash,
    checkpoint: input.checkpoint,
    leaseOwner: input.leaseOwner,
    leaseTokenHash: hashLeaseToken(input.leaseToken),
  })
  return readAction(client, input, input.actionId)
}

export async function failFinalizationAction(
  input: FinalizationLedgerScope & { actorUserId: string; actionId: string; attemptNumber: number; checkpoint: Json; errorCode: string; leaseToken: string; leaseOwner: string },
  client: Control02FinalizationClient = adminClient(),
): Promise<FinalizationLedgerAction> {
  const action = await readAction(client, input, input.actionId)
  if (action.status !== 'IN_PROGRESS') throw new FinalizationLedgerError('PAYROLL_FINALIZATION_FAILURE_CONFLICT', 409)
  try {
    const errorCode = new FinalizationLedgerContractError(input.errorCode).code
    if (!/^[A-Z][A-Z0-9_.:-]{0,63}$/.test(errorCode)) throw new Error('invalid')
    await recordEvent(client, {
      scope: input,
      actionId: input.actionId,
      eventType: 'FAILED',
      eventKey: eventFingerprint({ actionId: input.actionId, eventType: 'FAILED', attemptNumber: input.attemptNumber, planHash: action.row.plan_hash, checkpoint: input.checkpoint, errorCode, leaseOwner: input.leaseOwner }),
      actorUserId: input.actorUserId,
      attemptNumber: input.attemptNumber,
      sourceHash: action.row.source_hash,
      analysisHash: action.row.analysis_hash,
      coreStateHash: action.row.core_state_hash,
      checkpoint: input.checkpoint,
      errorCode,
      leaseOwner: input.leaseOwner,
      leaseTokenHash: hashLeaseToken(input.leaseToken),
    })
  } catch (error) {
    if (error instanceof FinalizationLedgerContractError) throw new FinalizationLedgerError('PAYROLL_FINALIZATION_ERROR_CODE_INVALID', 422)
    throw error
  }
  return readAction(client, input, input.actionId)
}

export async function retryFailedFinalizationAction(
  input: FinalizationLedgerScope & { actorUserId: string; actionId: string; attemptNumber: number; checkpoint: Json },
  client: Control02FinalizationClient = adminClient(),
): Promise<FinalizationLedgerAction> {
  const action = await readAction(client, input, input.actionId)
  if (action.status !== 'FAILED') throw new FinalizationLedgerError('PAYROLL_FINALIZATION_RETRY_CONFLICT', 409)
  await recordEvent(client, {
    scope: input,
    actionId: input.actionId,
    eventType: 'RETRY',
    eventKey: eventFingerprint({ actionId: input.actionId, eventType: 'RETRY', attemptNumber: input.attemptNumber, planHash: action.row.plan_hash, checkpoint: input.checkpoint }),
    actorUserId: input.actorUserId,
    attemptNumber: input.attemptNumber,
    sourceHash: action.row.source_hash,
    analysisHash: action.row.analysis_hash,
    coreStateHash: action.row.core_state_hash,
    checkpoint: input.checkpoint,
  })
  return readAction(client, input, input.actionId)
}

export async function recoverExpiredFinalizationAction(
  input: FinalizationLedgerScope & { actorUserId: string; actionId: string; attemptNumber: number; checkpoint: Json },
  client: Control02FinalizationClient = adminClient(),
): Promise<FinalizationLedgerAction> {
  const action = await readAction(client, input, input.actionId)
  if (action.status !== 'IN_PROGRESS' || !action.row.lease_until || Date.parse(action.row.lease_until) > Date.now()) {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_RECOVERY_CONFLICT', 409)
  }
  await recordEvent(client, {
    scope: input,
    actionId: input.actionId,
    eventType: 'RECOVERED',
    eventKey: eventFingerprint({ actionId: input.actionId, eventType: 'RECOVERED', attemptNumber: input.attemptNumber, planHash: action.row.plan_hash, checkpoint: input.checkpoint, errorCode: 'LEASE_EXPIRED' }),
    actorUserId: input.actorUserId,
    attemptNumber: input.attemptNumber,
    sourceHash: action.row.source_hash,
    analysisHash: action.row.analysis_hash,
    coreStateHash: action.row.core_state_hash,
    checkpoint: input.checkpoint,
    errorCode: 'LEASE_EXPIRED',
  })
  return readAction(client, input, input.actionId)
}

export async function blockFinalizationAction(
  input: FinalizationLedgerScope & { actorUserId: string; actionId: string; attemptNumber: number; checkpoint: Json; errorCode?: string },
  client: Control02FinalizationClient = adminClient(),
): Promise<FinalizationLedgerAction> {
  const action = await readAction(client, input, input.actionId)
  if (action.status !== 'PENDING' && action.status !== 'FAILED') throw new FinalizationLedgerError('PAYROLL_FINALIZATION_BLOCK_CONFLICT', 409)
  await recordEvent(client, {
    scope: input,
    actionId: input.actionId,
    eventType: 'BLOCKED',
    eventKey: eventFingerprint({ actionId: input.actionId, eventType: 'BLOCKED', attemptNumber: input.attemptNumber, planHash: action.row.plan_hash, checkpoint: input.checkpoint, errorCode: input.errorCode ?? null }),
    actorUserId: input.actorUserId,
    attemptNumber: input.attemptNumber,
    sourceHash: action.row.source_hash,
    analysisHash: action.row.analysis_hash,
    coreStateHash: action.row.core_state_hash,
    checkpoint: input.checkpoint,
    errorCode: input.errorCode ?? null,
  })
  return readAction(client, input, input.actionId)
}
