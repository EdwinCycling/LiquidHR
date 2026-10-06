import type { FinalizationLedgerAction } from './ledger-repository'
import type { PayrollFinalizationActionType, PayrollFinalizationPlan } from './planner'

export type PayrollFinalizationResultState = 'NOT_STARTED' | 'IN_PROGRESS' | 'PARTIAL' | 'BLOCKED' | 'FAILED' | 'COMPLETED'

export type PayrollFinalizationResultSummary = {
  state: PayrollFinalizationResultState
  peopleTotal: number
  peopleNew: number
  peopleLinked: number
  peopleSkipped: number
  peopleNeedsReview: number
  peopleProcessed: number
  employmentCreated: number
  employmentReused: number
  incomeCreatedOrLinked: number
  incomeNoChange: number
  actionsCompleted: number
  actionsPending: number
  actionsFailed: number
  actionsBlocked: number
  actionsRecovering: number
  warnings: number
  missingConfirmations: number
}

function countActionTypes(plan: PayrollFinalizationPlan, types: readonly PayrollFinalizationActionType[]): number {
  return plan.people.reduce((total, person) => total + person.actions.filter((action) => types.includes(action.type)).length, 0)
}

export function summarizePayrollFinalizationResult(
  plan: PayrollFinalizationPlan,
  ledger: readonly FinalizationLedgerAction[],
): PayrollFinalizationResultSummary {
  const statusCounts = ledger.reduce((counts, { status }) => {
    counts[status] += 1
    return counts
  }, { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0, FAILED: 0, BLOCKED: 0 })
  const actionsTotal = ledger.length
  const actionsCompleted = statusCounts.COMPLETED
  const allCompleted = actionsTotal > 0 && actionsCompleted === actionsTotal
  const state: PayrollFinalizationResultState = allCompleted
    ? 'COMPLETED'
    : actionsCompleted > 0
      ? 'PARTIAL'
      : statusCounts.FAILED > 0
        ? 'FAILED'
        : statusCounts.BLOCKED > 0 || plan.status === 'BLOCKED'
          ? 'BLOCKED'
          : statusCounts.IN_PROGRESS > 0
            ? 'IN_PROGRESS'
            : 'NOT_STARTED'

  const mutatingActionTypes = new Set<PayrollFinalizationActionType>([
    'CREATE_EMPLOYEE',
    'ADD_ADMINISTRATION_ASSIGNMENT',
    'UPDATE_EMPLOYEE_FIELDS',
    'CREATE_DRAFT_EMPLOYMENT',
    'CREATE_INCOME_RELATIONSHIP',
    'LINK_INCOME_RELATIONSHIP',
  ])

  return {
    state,
    peopleTotal: plan.people.length,
    peopleNew: plan.people.filter((person) => person.actions.some(({ type }) => type === 'CREATE_EMPLOYEE')).length,
    peopleLinked: plan.people.filter((person) => person.actions.some(({ type }) => type === 'REUSE_EMPLOYEE')).length,
    peopleSkipped: plan.people.filter((person) => person.actions.length > 0
      && !person.actions.some(({ type }) => mutatingActionTypes.has(type))
      && person.status === 'READY_FOR_REVIEW').length,
    peopleNeedsReview: plan.people.filter((person) => person.status !== 'READY_FOR_REVIEW'
      || person.blockers.length > 0
      || person.actions.some(({ type }) => type === 'REQUIRES_REVIEW' || type === 'BLOCKED')).length,
    peopleProcessed: plan.people.filter((person) => person.actions.length > 0
      && person.actions.every((action) => ledger.some((entry) => entry.row.action_id === action.actionId && entry.status === 'COMPLETED'))).length,
    employmentCreated: countActionTypes(plan, ['CREATE_DRAFT_EMPLOYMENT']),
    employmentReused: countActionTypes(plan, ['REUSE_EMPLOYMENT']),
    incomeCreatedOrLinked: countActionTypes(plan, ['CREATE_INCOME_RELATIONSHIP', 'LINK_INCOME_RELATIONSHIP']),
    incomeNoChange: countActionTypes(plan, ['NO_CHANGE']),
    actionsCompleted,
    actionsPending: statusCounts.PENDING,
    actionsFailed: statusCounts.FAILED,
    actionsBlocked: statusCounts.BLOCKED,
    actionsRecovering: statusCounts.IN_PROGRESS,
    warnings: plan.people.reduce((total, person) => total + person.warnings.length, 0),
    missingConfirmations: plan.people.reduce((total, person) => total + person.blockers.filter((blocker) => (
      blocker.includes('CONFIRM') || blocker.includes('SELECTION_REQUIRED') || blocker.includes('DECISION_REQUIRED')
    )).length, 0),
  }
}
