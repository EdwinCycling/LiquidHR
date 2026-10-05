import {
  evaluateControl02FinalizationGate,
  type FinalizationEvidence,
} from './execution-gate'
import type {
  PayrollFinalizationAction,
  PayrollFinalizationPlan,
} from './planner'

export type PayrollFinalizationActionWriter = (action: PayrollFinalizationAction) => Promise<void>

export type PayrollFinalizationExecutionInput = {
  plan: PayrollFinalizationPlan
  evidence: FinalizationEvidence
  /**
   * The writer is deliberately injected so the planner remains pure. It is
   * never called while the server-side activation gate or plan gate is closed.
   */
  writeAction?: PayrollFinalizationActionWriter
}

export type PayrollFinalizationExecutionResult = {
  status: 'BLOCKED' | 'COMPLETED'
  blockers: readonly string[]
  executedActionIds: readonly string[]
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
    }
  }

  const executedActionIds: string[] = []
  for (const person of input.plan.people) {
    for (const action of person.actions) {
      await input.writeAction!(action)
      executedActionIds.push(action.actionId)
    }
  }

  return {
    status: 'COMPLETED',
    blockers: [],
    executedActionIds,
  }
}
