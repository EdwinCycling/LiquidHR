import 'server-only'

import type { Json } from '@scope/db'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  assertConfirmedDecisionForPersistence,
  assertFinalizationHash,
  assertFinalizationUuid,
  eventFingerprint,
  FinalizationLedgerContractError,
  type FinalizationLedgerEventType,
  type FinalizationLedgerStatus,
} from './ledger-contract'
import type {
  ConfirmedPayrollImportDecision,
  PayrollImportPersonDecision,
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
  PayrollImportDecisionRow,
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
  row: PayrollImportFinalizationActionRow
  status: FinalizationLedgerStatus
}

export type FinalizationLedgerEvent = PayrollImportFinalizationActionEventRow

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
  return { row, status: actionStatus(row.status) }
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

function rpcResult(data: FinalizationEventRpcResult[] | null): FinalizationEventRpcResult {
  const result = data?.[0]
  if (!result) throw new FinalizationLedgerError('PAYROLL_FINALIZATION_EVENT_READBACK_FAILED')
  actionStatus(result.status)
  if (!isUuid(result.event_id)) throw new FinalizationLedgerError('PAYROLL_FINALIZATION_EVENT_READBACK_FAILED')
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
  }
  const { data, error } = await client.rpc('record_payroll_import_finalization_event', args)
  if (error) {
    const conflict = error.message.includes('NOT_CLAIMABLE') || error.message.includes('STATE_CONFLICT') || error.message.includes('CONFLICT')
    databaseError(error.message, conflict ? 409 : 500)
  }
  return rpcResult(data)
}

async function readAction(
  client: Control02FinalizationClient,
  scope: Pick<FinalizationLedgerScope, 'tenantId' | 'hrGroupId' | 'batchId'>,
  actionId: string,
): Promise<FinalizationLedgerAction> {
  const { data, error } = await client
    .from('payroll_import_finalization_actions')
    .select('*')
    .eq('tenant_id', scope.tenantId)
    .eq('hr_group_id', scope.hrGroupId)
    .eq('batch_id', scope.batchId)
    .eq('action_id', actionId)
    .maybeSingle()
  if (error) handleError(error)
  if (!data) throw new FinalizationLedgerError('PAYROLL_FINALIZATION_ACTION_NOT_FOUND', 404)
  return actionFromRow(data)
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
  if (!inserted.error && inserted.data) return decisionFromRow(inserted.data)
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
  if (!existing.data || existing.data.decision_hash !== decision.decisionHash) {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_DECISION_IDEMPOTENCY_CONFLICT', 409)
  }
  const stored = decisionFromRow(existing.data)
  if (stored.confirmerUserId !== decision.confirmerUserId
    || stored.sourceHash !== decision.sourceHash
    || stored.analysisHash !== decision.analysisHash
    || stored.coreStateHash !== decision.coreStateHash
    || stored.contractVersion !== input.contractVersion
    || stored.schemaVersion !== input.schemaVersion) {
    throw new FinalizationLedgerError('PAYROLL_FINALIZATION_DECISION_IDEMPOTENCY_CONFLICT', 409)
  }
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
  const drafts = plan.people.flatMap((person) => {
    const decision = sourcePersonDecision.get(person.sourcePersonRef)
    if (!decision) throw new FinalizationLedgerError('PAYROLL_FINALIZATION_DECISION_REQUIRED', 409)
    return person.actions.map((action) => actionPayload(serverInput, plan, decision, action, ++sequenceNo))
  })
  if (drafts.length === 0) return []

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

  const rowByKey = new Map(readback.data.map((row) => [row.idempotency_key, row]))
  for (const draft of drafts) {
    const row = rowByKey.get(String(draft.idempotency_key))
    if (!row
      || row.action_id !== draft.action_id
      || row.plan_hash !== draft.plan_hash
      || row.decision_hash !== draft.decision_hash
      || row.source_hash !== draft.source_hash
      || row.analysis_hash !== draft.analysis_hash
      || row.core_state_hash !== draft.core_state_hash
      || row.decision_id !== draft.decision_id) {
      throw new FinalizationLedgerError('PAYROLL_FINALIZATION_PLAN_IDEMPOTENCY_CONFLICT', 409)
    }
  }

  for (const row of readback.data) {
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
      analysisHash: batch.analysisHash,
      coreStateHash: input.plannerInput.currentCoreStateHash,
      checkpoint: jsonValue(row.checkpoint),
    })
  }
  const actions = await readFinalizationLedger(batch, client)
  return actions
}

export async function readFinalizationLedger(
  scope: Pick<FinalizationLedgerScope, 'tenantId' | 'hrGroupId' | 'batchId'>,
  client: Control02FinalizationClient = adminClient(),
): Promise<readonly FinalizationLedgerAction[]> {
  const result = await client
    .from('payroll_import_finalization_actions')
    .select('*')
    .eq('tenant_id', scope.tenantId)
    .eq('hr_group_id', scope.hrGroupId)
    .eq('batch_id', scope.batchId)
    .order('sequence_no')
  if (result.error) handleError(result.error, 'PAYROLL_FINALIZATION_LEDGER_READ_FAILED')
  return (result.data ?? []).map(actionFromRow)
}

export async function readFinalizationActionEvents(
  scope: Pick<FinalizationLedgerScope, 'tenantId' | 'hrGroupId' | 'batchId'>,
  actionId: string,
  client: Control02FinalizationClient = adminClient(),
): Promise<readonly FinalizationLedgerEvent[]> {
  const result = await client
    .from('payroll_import_finalization_action_events')
    .select('*')
    .eq('tenant_id', scope.tenantId)
    .eq('hr_group_id', scope.hrGroupId)
    .eq('batch_id', scope.batchId)
    .eq('action_id', actionId)
    .order('created_at')
  if (result.error) handleError(result.error, 'PAYROLL_FINALIZATION_EVENT_READ_FAILED')
  return result.data ?? []
}

export async function claimNextFinalizationAction(
  input: FinalizationLedgerScope & { actorUserId: string; leaseMs?: number },
  client: Control02FinalizationClient = adminClient(),
): Promise<FinalizationLedgerAction | null> {
  const pending = await client
    .from('payroll_import_finalization_actions')
    .select('*')
    .eq('tenant_id', input.tenantId)
    .eq('hr_group_id', input.hrGroupId)
    .eq('batch_id', input.batchId)
    .eq('status', 'PENDING')
    .order('sequence_no')
    .limit(1)
    .maybeSingle()
  if (pending.error) handleError(pending.error, 'PAYROLL_FINALIZATION_CLAIM_READ_FAILED')
  if (!pending.data) return null
  const action = actionFromRow(pending.data)
  const leaseUntil = new Date(Date.now() + (input.leaseMs ?? 5 * 60_000)).toISOString()
  try {
    await recordEvent(client, {
      scope: input,
      actionId: action.row.action_id,
      eventType: 'CLAIMED',
      eventKey: eventFingerprint({ actionId: action.row.action_id, eventType: 'CLAIMED', attemptNumber: action.row.attempt_count + 1, planHash: action.row.plan_hash, leaseUntil }),
      actorUserId: input.actorUserId,
      attemptNumber: action.row.attempt_count + 1,
      sourceHash: action.row.source_hash,
      analysisHash: action.row.analysis_hash,
      coreStateHash: action.row.core_state_hash,
      checkpoint: jsonValue(action.row.checkpoint),
      leaseUntil,
    })
  } catch (error) {
    if (error instanceof FinalizationLedgerError && error.code === 'PAYROLL_FINALIZATION_ACTION_NOT_CLAIMABLE') return null
    throw error
  }
  return readAction(client, input, action.row.action_id)
}

export async function checkpointFinalizationAction(
  input: FinalizationLedgerScope & { actorUserId: string; actionId: string; attemptNumber: number; checkpoint: Json; leaseUntil: string },
  client: Control02FinalizationClient = adminClient(),
): Promise<FinalizationLedgerAction> {
  const action = await readAction(client, input, input.actionId)
  if (action.status !== 'IN_PROGRESS') throw new FinalizationLedgerError('PAYROLL_FINALIZATION_CHECKPOINT_CONFLICT', 409)
  await recordEvent(client, {
    scope: input,
    actionId: input.actionId,
    eventType: 'CHECKPOINT',
    eventKey: eventFingerprint({ actionId: input.actionId, eventType: 'CHECKPOINT', attemptNumber: input.attemptNumber, planHash: action.row.plan_hash, checkpoint: input.checkpoint, leaseUntil: input.leaseUntil }),
    actorUserId: input.actorUserId,
    attemptNumber: input.attemptNumber,
    sourceHash: action.row.source_hash,
    analysisHash: action.row.analysis_hash,
    coreStateHash: action.row.core_state_hash,
    checkpoint: input.checkpoint,
    leaseUntil: input.leaseUntil,
  })
  return readAction(client, input, input.actionId)
}
export async function completeFinalizationAction(
  input: FinalizationLedgerScope & { actorUserId: string; actionId: string; attemptNumber: number; checkpoint: Json },
  client: Control02FinalizationClient = adminClient(),
): Promise<FinalizationLedgerAction> {
  const action = await readAction(client, input, input.actionId)
  if (action.status !== 'IN_PROGRESS') throw new FinalizationLedgerError('PAYROLL_FINALIZATION_COMPLETION_CONFLICT', 409)
  await recordEvent(client, {
    scope: input,
    actionId: input.actionId,
    eventType: 'COMPLETED',
    eventKey: eventFingerprint({ actionId: input.actionId, eventType: 'COMPLETED', attemptNumber: input.attemptNumber, planHash: action.row.plan_hash, checkpoint: input.checkpoint }),
    actorUserId: input.actorUserId,
    attemptNumber: input.attemptNumber,
    sourceHash: action.row.source_hash,
    analysisHash: action.row.analysis_hash,
    coreStateHash: action.row.core_state_hash,
    checkpoint: input.checkpoint,
  })
  return readAction(client, input, input.actionId)
}

export async function failFinalizationAction(
  input: FinalizationLedgerScope & { actorUserId: string; actionId: string; attemptNumber: number; checkpoint: Json; errorCode: string },
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
      eventKey: eventFingerprint({ actionId: input.actionId, eventType: 'FAILED', attemptNumber: input.attemptNumber, planHash: action.row.plan_hash, checkpoint: input.checkpoint, errorCode }),
      actorUserId: input.actorUserId,
      attemptNumber: input.attemptNumber,
      sourceHash: action.row.source_hash,
      analysisHash: action.row.analysis_hash,
      coreStateHash: action.row.core_state_hash,
      checkpoint: input.checkpoint,
      errorCode,
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
