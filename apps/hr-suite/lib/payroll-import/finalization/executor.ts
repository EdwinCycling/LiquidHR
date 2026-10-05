import {
  evaluateControl02FinalizationGate,
  type FinalizationEvidence,
} from './execution-gate'
import {
  assertFinalizationCompletionProof,
  assertFinalizationHash,
  FinalizationLedgerContractError,
  type FinalizationCompletionEvidence,
} from './ledger-contract'
import type {
  PayrollFinalizationAction,
  PayrollFinalizationPlan,
} from './planner'

export type PayrollFinalizationActionWriter = (action: PayrollFinalizationAction) => Promise<void>
export type PayrollFinalizationActionReadbackVerifier = (action: PayrollFinalizationAction) => Promise<unknown>
export type PayrollFinalizationCurrentStateReader = (plan: PayrollFinalizationPlan) => Promise<unknown>

export type PayrollFinalizationCurrentStateProof = {
  sourceHash: string
  analysisHash: string
  coreStateHash: string
  sourceImmutable: true
  readbackVerified: true
}

export type PayrollFinalizationActionCompletion = {
  actionId: string
  completionProof: FinalizationCompletionEvidence
}

export type PayrollFinalizationExecutionInput = {
  plan: PayrollFinalizationPlan
  evidence: FinalizationEvidence
  /**
   * The writer is deliberately injected so the planner remains pure. It is
   * never called while the server-side activation gate or plan gate is closed.
   */
  writeAction?: PayrollFinalizationActionWriter
  /**
   * Reads the just-written Core state back and returns the immutable proof
   * bound to this action's source, analysis and Core-state hashes. The
   * executor validates the returned shape before it can report COMPLETED.
   */
  verifyAction?: PayrollFinalizationActionReadbackVerifier
  /**
   * Re-reads the authoritative source/Core snapshot immediately before any
   * action writer can run. This is mandatory because the current planner
   * input is not a transaction-coupled source/Core snapshot.
   */
  readCurrentState?: PayrollFinalizationCurrentStateReader
}

export type PayrollFinalizationExecutionResult = {
  status: 'BLOCKED' | 'COMPLETED'
  blockers: readonly string[]
  executedActionIds: readonly string[]
  completionProofs: readonly PayrollFinalizationActionCompletion[]
  currentStateProof: PayrollFinalizationCurrentStateProof | null
}

function completionProof(
  value: unknown,
  plan: PayrollFinalizationPlan,
): FinalizationCompletionEvidence {
  const checkpoint = value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, 'completionProof')
    ? value
    : { completionProof: value }
  return assertFinalizationCompletionProof(checkpoint, {
    sourceHash: plan.sourceHash.toLowerCase(),
    analysisHash: plan.analysisHash.toLowerCase(),
    coreStateHash: plan.coreStateHash.toLowerCase(),
  })
}

function currentStateProof(
  value: unknown,
  plan: PayrollFinalizationPlan,
): PayrollFinalizationCurrentStateProof {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_CURRENT_STATE_PROOF_INVALID')
  }
  const proof = value as Record<string, unknown>
  if (proof.sourceImmutable !== true || proof.readbackVerified !== true) {
    throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_CURRENT_STATE_PROOF_INVALID')
  }
  const sourceHash = assertFinalizationHash(String(proof.sourceHash ?? ''), 'source')
  const analysisHash = assertFinalizationHash(String(proof.analysisHash ?? ''), 'analysis')
  const coreStateHash = assertFinalizationHash(String(proof.coreStateHash ?? ''), 'core_state')
  if (sourceHash !== plan.sourceHash.toLowerCase()
    || analysisHash !== plan.analysisHash.toLowerCase()
    || coreStateHash !== plan.coreStateHash.toLowerCase()) {
    throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_CURRENT_STATE_PROOF_STATE_STALE')
  }
  return { sourceHash, analysisHash, coreStateHash, sourceImmutable: true, readbackVerified: true }
}

function hasValidPlanReferences(plan: PayrollFinalizationPlan): boolean {
  const people = new Map(plan.people.map((person) => [person.sourcePersonRef, new Set([person.sourcePersonRef, ...person.sourceIncomeRefs])]))
  const actionKeys = new Set<string>()
  for (const person of plan.people) {
    for (const action of person.actions) {
      const knownSourceRefs = people.get(action.sourcePersonRef)
      if (!knownSourceRefs || action.sourceRefs.length === 0 || action.sourceRefs.some((sourceRef) => !knownSourceRefs.has(sourceRef))) {
        return false
      }
      if (actionKeys.has(action.idempotencyKey)) return false
      actionKeys.add(action.idempotencyKey)
    }
  }
  return /^[a-f0-9]{64}$/i.test(plan.planHash)
}

/**
 * Execute a previously reviewed plan only after every server-side gate has
 * passed. CONTROL02 currently has no enabled XML activation version, so this
 * function returns BLOCKED before invoking any writer. Keeping the writer
 * behind this function makes an accidental route-level or client-level bypass
 * impossible.
 */
export async function executePayrollFinalizationPlan(
  input: PayrollFinalizationExecutionInput,
): Promise<PayrollFinalizationExecutionResult> {
  const blockers = new Set<string>()
  const gate = evaluateControl02FinalizationGate(input.evidence)
  if (!gate.allowed) {
    for (const blocker of gate.blockers) blockers.add(blocker)
  }

  if (!hasValidPlanReferences(input.plan)) blockers.add('PLAN_REFERENCES_INVALID')
  if (input.plan.status === 'BLOCKED') blockers.add('PLAN_BLOCKED')
  if (!input.plan.canExecute) blockers.add('PLAN_NOT_EXECUTABLE')
  if (!input.writeAction) blockers.add('ACTION_WRITER_UNAVAILABLE')
  if (!input.verifyAction) blockers.add('ACTION_READBACK_VERIFIER_UNAVAILABLE')
  if (!input.readCurrentState) blockers.add('CURRENT_STATE_PREFLIGHT_UNAVAILABLE')

  for (const person of input.plan.people) {
    if (person.status === 'BLOCKED') blockers.add('PERSON_BLOCKED')
    if (person.actions.some(({ type }) => type === 'BLOCKED' || type === 'REQUIRES_REVIEW')) {
      blockers.add('PERSON_ACTION_REQUIRES_REVIEW')
    }
  }

  // This branch is intentionally reached for all current XML plans. Do not
  // invoke an injected writer when a single gate or precondition is missing.
  if (blockers.size > 0) {
    return {
      status: 'BLOCKED',
      blockers: [...blockers].sort(),
      executedActionIds: [],
      completionProofs: [],
      currentStateProof: null,
    }
  }

  const executedActionIds: string[] = []
  const completionProofs: PayrollFinalizationActionCompletion[] = []
  const actions = input.plan.people.flatMap((person) => person.actions)
  let verifiedCurrentState: PayrollFinalizationCurrentStateProof | null = null
  try {
    verifiedCurrentState = currentStateProof(await input.readCurrentState!(input.plan), input.plan)
  } catch (error) {
    blockers.add(error instanceof FinalizationLedgerContractError
      ? error.code
      : 'CURRENT_STATE_PREFLIGHT_FAILED')
  }
  if (actions.length === 0) blockers.add('PLAN_ACTIONS_EMPTY')

  if (blockers.size > 0) {
    return {
      status: 'BLOCKED',
      blockers: [...blockers].sort(),
      executedActionIds,
      completionProofs,
      currentStateProof: verifiedCurrentState,
    }
  }

  for (const person of input.plan.people) {
    for (const action of person.actions) {
      try {
        await input.writeAction!(action)
      } catch {
        blockers.add('ACTION_WRITE_FAILED')
        break
      }
      executedActionIds.push(action.actionId)

      try {
        const readback = await input.verifyAction!(action)
        completionProofs.push({
          actionId: action.actionId,
          completionProof: completionProof(readback, input.plan),
        })
      } catch (error) {
        blockers.add(error instanceof FinalizationLedgerContractError
          ? error.code
          : 'ACTION_READBACK_FAILED')
        break
      }
    }
    if (blockers.size > 0) break
  }

  if (blockers.size > 0 || completionProofs.length !== actions.length) {
    if (completionProofs.length !== actions.length) blockers.add('ACTION_READBACK_INCOMPLETE')
    return {
      status: 'BLOCKED',
      blockers: [...blockers].sort(),
      executedActionIds,
      completionProofs,
      currentStateProof: verifiedCurrentState,
    }
  }

  return {
    status: 'COMPLETED',
    blockers: [],
    executedActionIds,
    completionProofs,
    currentStateProof: verifiedCurrentState,
  }
}
