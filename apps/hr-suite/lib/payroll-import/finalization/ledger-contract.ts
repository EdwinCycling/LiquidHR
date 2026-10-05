import { createHash } from 'node:crypto'

import {
  confirmPayrollImportDecision,
  stableSerialize,
  type ConfirmedPayrollImportDecision,
} from './decision-contract'

export type FinalizationLedgerStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'BLOCKED'

export type FinalizationLedgerEventType =
  | 'PLANNED'
  | 'CLAIMED'
  | 'CHECKPOINT'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRY'
  | 'RECOVERED'
  | 'BLOCKED'

export type FinalizationLedgerState = {
  status: FinalizationLedgerStatus
  attemptCount: number
  leaseUntil: string | null
  completedAt: string | null
  lastErrorCode: string | null
  checkpoint: Record<string, unknown>
}

export type FinalizationLedgerTransition = {
  eventType: FinalizationLedgerEventType
  attemptNumber: number
  now: string
  leaseUntil?: string | null
  checkpoint: Record<string, unknown>
  errorCode?: string | null
}

export type FinalizationLedgerTransitionResult = {
  status: FinalizationLedgerStatus
  attemptCount: number
  leaseUntil: string | null
  completedAt: string | null
  lastErrorCode: string | null
}

export class FinalizationLedgerContractError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'FinalizationLedgerContractError'
  }
}

const hashPattern = /^[0-9a-f]{64}$/i
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const errorCodePattern = /^[A-Z][A-Z0-9_.:-]{0,63}$/

function timestamp(value: string, code: string): number {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new FinalizationLedgerContractError(code)
  return parsed
}

function requireLease(value: string | null | undefined, now: number, code: string): string {
  if (!value || timestamp(value, code) <= now) throw new FinalizationLedgerContractError(code)
  return value
}

function requireAttempt(current: FinalizationLedgerState, requested: number): void {
  if (!Number.isInteger(requested) || requested < 0 || requested !== current.attemptCount) {
    throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_ATTEMPT_CONFLICT')
  }
}

function requireErrorCode(value: string | null | undefined): string {
  if (!value || !errorCodePattern.test(value)) throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_ERROR_CODE_REQUIRED')
  return value
}

export function transitionFinalizationLedgerState(
  current: FinalizationLedgerState,
  transition: FinalizationLedgerTransition,
): FinalizationLedgerTransitionResult {
  const now = timestamp(transition.now, 'PAYROLL_FINALIZATION_TIMESTAMP_INVALID')
  const checkpoint = transition.checkpoint
  if (checkpoint === null || Array.isArray(checkpoint) || typeof checkpoint !== 'object') {
    throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_CHECKPOINT_INVALID')
  }

  let status = current.status
  let attemptCount = current.attemptCount
  let leaseUntil: string | null = current.leaseUntil
  let completedAt = current.completedAt
  let lastErrorCode = current.lastErrorCode

  switch (transition.eventType) {
    case 'PLANNED':
      if (current.status !== 'PENDING' || transition.attemptNumber !== 0 || transition.leaseUntil != null) {
        throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_EVENT_STATE_CONFLICT')
      }
      status = 'PENDING'
      leaseUntil = null
      completedAt = null
      lastErrorCode = null
      break
    case 'CLAIMED':
      if (current.status !== 'PENDING' || transition.attemptNumber !== current.attemptCount + 1) {
        throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_ACTION_NOT_CLAIMABLE')
      }
      status = 'IN_PROGRESS'
      attemptCount = transition.attemptNumber
      leaseUntil = requireLease(transition.leaseUntil, now, 'PAYROLL_FINALIZATION_LEASE_INVALID')
      completedAt = null
      lastErrorCode = null
      break
    case 'CHECKPOINT':
      if (current.status !== 'IN_PROGRESS') {
        throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_CHECKPOINT_CONFLICT')
      }
      requireAttempt(current, transition.attemptNumber)
      leaseUntil = requireLease(transition.leaseUntil, now, 'PAYROLL_FINALIZATION_LEASE_INVALID')
      break
    case 'COMPLETED':
      if (current.status !== 'IN_PROGRESS') {
        throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_COMPLETION_CONFLICT')
      }
      requireAttempt(current, transition.attemptNumber)
      status = 'COMPLETED'
      leaseUntil = null
      completedAt = transition.now
      lastErrorCode = null
      break
    case 'FAILED':
      if (current.status !== 'IN_PROGRESS') {
        throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_FAILURE_CONFLICT')
      }
      requireAttempt(current, transition.attemptNumber)
      status = 'FAILED'
      leaseUntil = null
      completedAt = null
      lastErrorCode = requireErrorCode(transition.errorCode)
      break
    case 'RETRY':
      if (current.status !== 'FAILED') {
        throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_RETRY_CONFLICT')
      }
      requireAttempt(current, transition.attemptNumber)
      status = 'PENDING'
      leaseUntil = null
      completedAt = null
      lastErrorCode = null
      break
    case 'RECOVERED':
      if (current.status !== 'IN_PROGRESS' || !current.leaseUntil || timestamp(current.leaseUntil, 'PAYROLL_FINALIZATION_LEASE_INVALID') > now) {
        throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_RECOVERY_CONFLICT')
      }
      requireAttempt(current, transition.attemptNumber)
      status = 'PENDING'
      leaseUntil = null
      completedAt = null
      lastErrorCode = transition.errorCode ? requireErrorCode(transition.errorCode) : 'LEASE_EXPIRED'
      break
    case 'BLOCKED':
      if (current.status !== 'PENDING' && current.status !== 'FAILED') {
        throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_BLOCK_CONFLICT')
      }
      requireAttempt(current, transition.attemptNumber)
      status = 'BLOCKED'
      leaseUntil = null
      completedAt = null
      lastErrorCode = transition.errorCode ? requireErrorCode(transition.errorCode) : null
      break
  }

  return { status, attemptCount, leaseUntil, completedAt, lastErrorCode }
}

export function assertFinalizationHash(value: string, field: string): string {
  if (!hashPattern.test(value)) throw new FinalizationLedgerContractError(`${field.toUpperCase()}_HASH_INVALID`)
  return value.toLowerCase()
}

export function assertFinalizationUuid(value: string, field: string): string {
  if (!uuidPattern.test(value)) throw new FinalizationLedgerContractError(`${field.toUpperCase()}_INVALID`)
  return value
}

export type DecisionPersistenceContext = {
  actorUserId: string
  sourceHash: string
  analysisHash: string
  coreStateHash: string
  contractVersion: string | null
  schemaVersion: string | null
}

export function assertConfirmedDecisionForPersistence(
  decision: ConfirmedPayrollImportDecision,
  context: DecisionPersistenceContext,
): ConfirmedPayrollImportDecision {
  try {
    assertFinalizationUuid(context.actorUserId, 'actor_user_id')
    assertFinalizationHash(context.sourceHash, 'source')
    assertFinalizationHash(context.analysisHash, 'analysis')
    assertFinalizationHash(context.coreStateHash, 'core_state')
    const recomputed = confirmPayrollImportDecision({
      decision: decision.decision,
      decisionVersion: decision.decisionVersion,
      confirmerUserId: decision.confirmerUserId,
      confirmedAt: decision.confirmedAt,
      sourceHash: decision.sourceHash,
      analysisHash: decision.analysisHash,
      coreStateHash: decision.coreStateHash,
    })
    if (recomputed.decisionHash !== decision.decisionHash) {
      throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_DECISION_HASH_MISMATCH')
    }
    if (decision.confirmerUserId !== context.actorUserId) {
      throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_DECISION_ACTOR_MISMATCH')
    }
    if (decision.sourceHash !== context.sourceHash
      || decision.analysisHash !== context.analysisHash
      || decision.coreStateHash !== context.coreStateHash) {
      throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_DECISION_STATE_STALE')
    }
    return recomputed
  } catch (error) {
    if (error instanceof FinalizationLedgerContractError) throw error
    throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_DECISION_INVALID')
  }
}

export function eventFingerprint(input: {
  actionId: string
  eventType: FinalizationLedgerEventType
  attemptNumber: number
  planHash: string
  checkpoint?: unknown
  leaseUntil?: string | null
  errorCode?: string | null
}): string {
  const value = stableSerialize(input)
  const hash = createHash('sha256').update(value, 'utf8').digest('hex')
  return `control02-${hash}-${input.eventType.toLowerCase()}`
}
