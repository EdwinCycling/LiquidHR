import { describe, expect, it } from 'vitest'
import type { FinalizationLedgerAction } from './ledger-repository'
import type { PayrollFinalizationPlan } from './planner'
import { summarizePayrollFinalizationResult } from './result-summary'

function plan(status: PayrollFinalizationPlan['status'] = 'READY_FOR_REVIEW'): PayrollFinalizationPlan {
  return {
    batchId: 'batch',
    tenantId: 'tenant',
    hrGroupId: 'group',
    administrationId: 'administration',
    sourceHash: 'a'.repeat(64),
    analysisHash: 'b'.repeat(64),
    coreStateHash: 'c'.repeat(64),
    planHash: 'd'.repeat(64),
    status,
    canExecute: false,
    contractVersion: null,
    schemaVersion: null,
    blockers: [],
    people: [{
      sourcePersonRef: 'person-1',
      decisionHash: 'e'.repeat(64),
      decisionVersion: 1,
      confirmerUserId: 'actor',
      status: 'READY_FOR_REVIEW',
      warnings: ['EXPLICIT_SOURCE_FIELD_UPDATE'],
      blockers: [],
      sourceIncomeRefs: ['income-1'],
      actions: [
        { actionId: 'create-employee', type: 'CREATE_EMPLOYEE', sourcePersonRef: 'person-1', sourceRefs: ['person-1'], dependsOnActionIds: [], idempotencyKey: 'create', preconditions: [] },
        { actionId: 'draft-employment', type: 'CREATE_DRAFT_EMPLOYMENT', sourcePersonRef: 'person-1', sourceRefs: ['income-1'], dependsOnActionIds: ['create-employee'], idempotencyKey: 'employment', preconditions: [] },
        { actionId: 'create-ikv', type: 'CREATE_INCOME_RELATIONSHIP', sourcePersonRef: 'person-1', sourceIncomeRef: 'income-1', sourceRefs: ['income-1'], dependsOnActionIds: ['draft-employment'], idempotencyKey: 'income', preconditions: [] },
      ],
    }],
  } as unknown as PayrollFinalizationPlan
}

function ledger(statuses: readonly FinalizationLedgerAction['status'][]): readonly FinalizationLedgerAction[] {
  return statuses.map((status, index) => ({
    status,
    row: { action_id: ['create-employee', 'draft-employment', 'create-ikv'][index] ?? `action-${index}` },
  } as unknown as FinalizationLedgerAction))
}

describe('CONTROL02 ledger result summary', () => {
  it('reports intended work separately from the still-disabled execution', () => {
    const summary = summarizePayrollFinalizationResult(plan('BLOCKED'), ledger(['BLOCKED', 'BLOCKED', 'BLOCKED']))

    expect(summary).toMatchObject({
      state: 'BLOCKED',
      peopleTotal: 1,
      peopleNew: 1,
      peopleLinked: 0,
      peopleProcessed: 0,
      employmentCreated: 1,
      incomeCreatedOrLinked: 1,
      actionsBlocked: 3,
      actionsCompleted: 0,
      warnings: 1,
    })
  })

  it('marks partial results and retry/recovery counts from persisted action statuses', () => {
    const summary = summarizePayrollFinalizationResult(plan(), ledger(['COMPLETED', 'FAILED', 'IN_PROGRESS']))

    expect(summary.state).toBe('PARTIAL')
    expect(summary.actionsCompleted).toBe(1)
    expect(summary.actionsFailed).toBe(1)
    expect(summary.actionsRecovering).toBe(1)
    expect(summary.peopleProcessed).toBe(0)
  })

  it('does not report completion until every action has a completed readback state', () => {
    const summary = summarizePayrollFinalizationResult(plan(), ledger(['COMPLETED', 'COMPLETED', 'COMPLETED']))

    expect(summary.state).toBe('COMPLETED')
    expect(summary.peopleProcessed).toBe(1)
  })
})
