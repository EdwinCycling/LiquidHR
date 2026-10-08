import { describe, expect, it } from 'vitest'
import { confirmPayrollImportDecision } from './decision-contract'
import {
  assertFinalizationCompletionProof,
  assertConfirmedDecisionForPersistence,
  assertFinalizationUuid,
  eventFingerprint,
  FinalizationLedgerContractError,
  transitionFinalizationLedgerState,
} from './ledger-contract'

const actor = '7c7e170a-60d2-4b8e-a9e8-a341c5d04b1d'
const sourceHash = 'a'.repeat(64)
const analysisHash = 'b'.repeat(64)
const coreStateHash = 'c'.repeat(64)

function state(overrides: Partial<Parameters<typeof transitionFinalizationLedgerState>[0]> = {}) {
  return {
    status: 'PENDING' as const,
    attemptCount: 0,
    leaseUntil: null,
    completedAt: null,
    lastErrorCode: null,
    checkpoint: {},
    ...overrides,
  }
}

describe('CONTROL02 finalization ledger contract', () => {
  it('accepts RFC 9562 UUID version 8 tenant identifiers and rejects invalid variants', () => {
    const tenantId = 'aaaaaaaa-bbbb-8ccc-9ddd-eeeeeeeeeeee'

    expect(assertFinalizationUuid(tenantId, 'tenant_id')).toBe(tenantId)
    expect(() => assertFinalizationUuid('aaaaaaaa-bbbb-9ccc-9ddd-eeeeeeeeeeee', 'tenant_id'))
      .toThrow('TENANT_ID_INVALID')
    expect(() => assertFinalizationUuid('aaaaaaaa-bbbb-8ccc-7ddd-eeeeeeeeeeee', 'tenant_id'))
      .toThrow('TENANT_ID_INVALID')
  })

  it('supports planned, leased, checkpointed and completed transitions', () => {
    const planned = transitionFinalizationLedgerState(state(), {
      eventType: 'PLANNED',
      attemptNumber: 0,
      now: '2026-10-05T10:00:00.000Z',
      checkpoint: {},
    })
    expect(planned).toMatchObject({ status: 'PENDING', attemptCount: 0, leaseUntil: null })

    const claimed = transitionFinalizationLedgerState(state(), {
      eventType: 'CLAIMED',
      attemptNumber: 1,
      now: '2026-10-05T10:00:00.000Z',
      leaseUntil: '2026-10-05T10:05:00.000Z',
      checkpoint: { phase: 'employee' },
    })
    expect(claimed).toMatchObject({ status: 'IN_PROGRESS', attemptCount: 1, leaseUntil: '2026-10-05T10:05:00.000Z' })

    const checkpointed = transitionFinalizationLedgerState({ ...state(), ...claimed }, {
      eventType: 'CHECKPOINT',
      attemptNumber: 1,
      now: '2026-10-05T10:01:00.000Z',
      leaseUntil: '2026-10-05T10:06:00.000Z',
      checkpoint: { phase: 'ikv' },
    })
    expect(checkpointed).toMatchObject({ status: 'IN_PROGRESS', attemptCount: 1, leaseUntil: '2026-10-05T10:06:00.000Z' })

    const completed = transitionFinalizationLedgerState({ ...state(), ...checkpointed }, {
      eventType: 'COMPLETED',
      attemptNumber: 1,
      now: '2026-10-05T10:02:00.000Z',
      checkpoint: {
        phase: 'done',
        completionProof: {
          executionId: 'execution-1',
          readbackHash: 'd'.repeat(64),
          sourceHash,
          analysisHash,
          coreStateHash,
          readbackVerified: true,
        },
      },
    })
    expect(completed).toMatchObject({ status: 'COMPLETED', attemptCount: 1, leaseUntil: null, completedAt: '2026-10-05T10:02:00.000Z' })
  })

  it('requeues expired work and rejects unsafe or stale transitions', () => {
    const expired = state({ status: 'IN_PROGRESS' as const, attemptCount: 2, leaseUntil: '2026-10-05T09:59:00.000Z' })
    const recovered = transitionFinalizationLedgerState(expired, {
      eventType: 'RECOVERED',
      attemptNumber: 2,
      now: '2026-10-05T10:00:00.000Z',
      checkpoint: { phase: 'employee' },
    })
    expect(recovered).toMatchObject({ status: 'PENDING', attemptCount: 2, leaseUntil: null, lastErrorCode: 'LEASE_EXPIRED' })

    expect(() => transitionFinalizationLedgerState(state(), {
      eventType: 'COMPLETED',
      attemptNumber: 0,
      now: '2026-10-05T10:00:00.000Z',
      checkpoint: {},
    })).toThrowError(FinalizationLedgerContractError)
    expect(() => transitionFinalizationLedgerState(state(), {
      eventType: 'CLAIMED',
      attemptNumber: 1,
      now: '2026-10-05T10:00:00.000Z',
      leaseUntil: '2026-10-05T09:59:00.000Z',
      checkpoint: {},
    })).toThrow('PAYROLL_FINALIZATION_LEASE_INVALID')
    expect(() => transitionFinalizationLedgerState({ ...state(), status: 'IN_PROGRESS', attemptCount: 1, leaseUntil: '2026-10-05T10:05:00.000Z' }, {
      eventType: 'COMPLETED',
      attemptNumber: 1,
      now: '2026-10-05T10:01:00.000Z',
      checkpoint: {},
    })).toThrow('PAYROLL_FINALIZATION_COMPLETION_PROOF_INVALID')
  })

  it('binds persisted decisions to the current actor and all three state hashes', () => {
    const decision = confirmPayrollImportDecision({
      decision: {
        match: { action: 'REUSE_EMPLOYEE', employeeId: '00000000-0000-4000-8000-000000000001', confirmed: true },
        incomeRelationshipBySourceRef: { income: { action: 'NO_CHANGE', confirmed: true } },
        employmentByIncomeRelationship: { income: { action: 'REUSE_EMPLOYMENT', employmentId: '00000000-0000-4000-8000-000000000002', confirmed: true } },
        sourceFieldDecisions: { firstName: 'KEEP_CURRENT' },
      },
      decisionVersion: 1,
      confirmerUserId: actor,
      confirmedAt: '2026-10-05T10:00:00.000Z',
      sourceHash,
      analysisHash,
      coreStateHash,
    })
    expect(assertConfirmedDecisionForPersistence(decision, {
      actorUserId: actor,
      sourceHash,
      analysisHash,
      coreStateHash,
      contractVersion: null,
      schemaVersion: 'Loonaangifte-2026-v2.0',
    }).decisionHash).toBe(decision.decisionHash)
    expect(() => assertConfirmedDecisionForPersistence(decision, {
      actorUserId: actor,
      sourceHash,
      analysisHash,
      coreStateHash: 'd'.repeat(64),
      contractVersion: null,
      schemaVersion: 'Loonaangifte-2026-v2.0',
    })).toThrow('PAYROLL_FINALIZATION_DECISION_STATE_STALE')
  })

  it('uses a canonical SHA-256 key for event replay', () => {
    const first = eventFingerprint({ actionId: 'payroll-finalize:one', eventType: 'CLAIMED', attemptNumber: 1, planHash: sourceHash })
    const second = eventFingerprint({ actionId: 'payroll-finalize:one', eventType: 'CLAIMED', attemptNumber: 1, planHash: sourceHash })
    const different = eventFingerprint({ actionId: 'payroll-finalize:one', eventType: 'CLAIMED', attemptNumber: 2, planHash: sourceHash })
    expect(first).toBe(second)
    expect(first).not.toBe(different)
    expect(first).toMatch(/^control02-[0-9a-f]{64}-claimed$/)
  })

  it('requires verified readback evidence bound to all current state hashes', () => {
    const checkpoint = {
      completionProof: {
        executionId: 'execution-1',
        readbackHash: 'd'.repeat(64),
        sourceHash,
        analysisHash,
        coreStateHash,
        readbackVerified: true,
      },
    }
    expect(assertFinalizationCompletionProof(checkpoint, { sourceHash, analysisHash, coreStateHash })).toMatchObject({
      executionId: 'execution-1',
      readbackVerified: true,
    })
    expect(() => assertFinalizationCompletionProof(checkpoint, {
      sourceHash,
      analysisHash,
      coreStateHash: 'e'.repeat(64),
    })).toThrow('PAYROLL_FINALIZATION_COMPLETION_PROOF_STATE_STALE')
  })
})
