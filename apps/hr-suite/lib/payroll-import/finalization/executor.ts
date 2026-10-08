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

export type PayrollFinalizationActionPrecondition = {
  actionId: string
  planHash: string
  decisionHash: string
  sourceHash: string
  analysisHash: string
  coreStateHash: string
  tenantId: string
  hrGroupId: string
  administrationId: string
  batchId: string
  stateToken: string
  expectedVersions: Readonly<Record<string, string>>
  dependencyActionIds: readonly string[]
  preconditionsVerified: readonly string[]
  transactionallyEnforced: true
}
export type PayrollFinalizationActionWriter = (
  action: PayrollFinalizationAction,
  precondition: PayrollFinalizationActionPrecondition,
) => Promise<void>
export type PayrollFinalizationActionReadbackVerifier = (action: PayrollFinalizationAction) => Promise<unknown>
export type PayrollFinalizationCurrentStateReader = (
  plan: PayrollFinalizationPlan,
  action: PayrollFinalizationAction,
) => Promise<unknown>

export type PayrollFinalizationCurrentStateProof = {
  actionId: string
  decisionHash: string
  planHash: string
  sourceHash: string
  analysisHash: string
  coreStateHash: string
  tenantId: string
  hrGroupId: string
  administrationId: string
  batchId: string
  stateToken: string
  expectedVersions: Readonly<Record<string, string>>
  dependencyActionIds: readonly string[]
  preconditionsVerified: readonly string[]
  transactionallyEnforced: true
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
  action: PayrollFinalizationAction,
  completedActionIds: ReadonlySet<string>,
): PayrollFinalizationCurrentStateProof {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_CURRENT_STATE_PROOF_INVALID')
  }
  const proof = value as Record<string, unknown>
  if (proof.sourceImmutable !== true || proof.readbackVerified !== true) {
    throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_CURRENT_STATE_PROOF_INVALID')
  }
  const person = plan.people.find((candidate) => candidate.sourcePersonRef === action.sourcePersonRef)
  const verifiedPreconditions = Array.isArray(proof.preconditionsVerified) ? proof.preconditionsVerified : []
  const decisionHash = assertFinalizationHash(String(proof.decisionHash ?? ''), 'decision')
  const planHash = assertFinalizationHash(String(proof.planHash ?? ''), 'plan')
  if (!person?.decisionHash
    || decisionHash !== person.decisionHash.toLowerCase()
    || planHash !== plan.planHash.toLowerCase()
    || proof.actionId !== action.actionId
    || proof.tenantId !== plan.tenantId
    || proof.hrGroupId !== plan.hrGroupId
    || proof.administrationId !== plan.administrationId
    || proof.batchId !== plan.batchId
    || proof.transactionallyEnforced !== true
    || typeof proof.stateToken !== 'string'
    || proof.stateToken.trim().length === 0
    || proof.expectedVersions === null
    || typeof proof.expectedVersions !== 'object'
    || Array.isArray(proof.expectedVersions)
    || Object.keys(proof.expectedVersions).length === 0
    || Object.values(proof.expectedVersions).some((version) => typeof version !== 'string' || version.length === 0)
    || !Array.isArray(proof.dependencyActionIds)
    || proof.dependencyActionIds.some((id) => typeof id !== 'string' || !completedActionIds.has(id))
    || !Array.isArray(proof.preconditionsVerified)
    || action.preconditions.some((precondition) => !verifiedPreconditions.includes(precondition))
    || action.dependsOnActionIds.some((dependencyId) => !completedActionIds.has(dependencyId))) {
    throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_ACTION_PRECONDITION_INVALID')
  }
  const sourceHash = assertFinalizationHash(String(proof.sourceHash ?? ''), 'source')
  const analysisHash = assertFinalizationHash(String(proof.analysisHash ?? ''), 'analysis')
  const coreStateHash = assertFinalizationHash(String(proof.coreStateHash ?? ''), 'core_state')
  if (sourceHash !== plan.sourceHash.toLowerCase()
    || analysisHash !== plan.analysisHash.toLowerCase()) {
    throw new FinalizationLedgerContractError('PAYROLL_FINALIZATION_CURRENT_STATE_PROOF_STATE_STALE')
  }
  return {
    actionId: action.actionId,
    decisionHash,
    planHash,
    sourceHash,
    analysisHash,
    coreStateHash,
    tenantId: plan.tenantId,
    hrGroupId: plan.hrGroupId,
    administrationId: plan.administrationId,
    batchId: plan.batchId,
    stateToken: proof.stateToken as string,
    expectedVersions: proof.expectedVersions as Record<string, string>,
    dependencyActionIds: proof.dependencyActionIds as string[],
    preconditionsVerified: proof.preconditionsVerified as string[],
    transactionallyEnforced: true,
    sourceImmutable: true,
    readbackVerified: true,
  }
}

function hasValidPlanReferences(plan: PayrollFinalizationPlan): boolean {
  const people = new Map(plan.people.map((person) => [person.sourcePersonRef, new Set([person.sourcePersonRef, ...person.sourceIncomeRefs])]))
  const actionKeys = new Set<string>()
  const actionIds = new Set<string>()
  for (const person of plan.people) {
    for (const [index, action] of person.actions.entries()) {
      const knownSourceRefs = people.get(action.sourcePersonRef)
      if (!knownSourceRefs || action.sourceRefs.length === 0 || action.sourceRefs.some((sourceRef) => !knownSourceRefs.has(sourceRef))) {
        return false
      }
      if (actionKeys.has(action.idempotencyKey) || actionIds.has(action.actionId)) return false
      if (new Set(action.dependsOnActionIds).size !== action.dependsOnActionIds.length
        || action.dependsOnActionIds.some((dependencyId) => !person.actions.slice(0, index).some((prior) => prior.actionId === dependencyId))) return false
      actionKeys.add(action.idempotencyKey)
      actionIds.add(action.actionId)
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
  const completedActionIds = new Set<string>()
  let verifiedCurrentState: PayrollFinalizationCurrentStateProof | null = null
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
      let precondition: PayrollFinalizationCurrentStateProof
      try {
        precondition = currentStateProof(
          await input.readCurrentState!(input.plan, action),
          input.plan,
          action,
          completedActionIds,
        )
        verifiedCurrentState = precondition
      } catch (error) {
        blockers.add(error instanceof FinalizationLedgerContractError
          ? error.code
          : 'CURRENT_STATE_PREFLIGHT_FAILED')
        break
      }
      try {
        await input.writeAction!(action, {
          actionId: action.actionId,
          planHash: precondition.planHash,
          decisionHash: precondition.decisionHash,
          sourceHash: precondition.sourceHash,
          analysisHash: precondition.analysisHash,
          coreStateHash: precondition.coreStateHash,
          tenantId: precondition.tenantId,
          hrGroupId: precondition.hrGroupId,
          administrationId: precondition.administrationId,
          batchId: precondition.batchId,
          stateToken: precondition.stateToken,
          expectedVersions: precondition.expectedVersions,
          dependencyActionIds: action.dependsOnActionIds,
          preconditionsVerified: precondition.preconditionsVerified,
          transactionallyEnforced: true,
        })
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
        completedActionIds.add(action.actionId)
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
