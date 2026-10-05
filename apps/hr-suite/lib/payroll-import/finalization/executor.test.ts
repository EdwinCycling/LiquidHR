import { beforeEach, describe, expect, it, vi } from 'vitest'

const gateOverride = vi.hoisted(() => ({ enabled: false }))

vi.mock('./execution-gate', async () => {
  const actual = await vi.importActual<typeof import('./execution-gate')>('./execution-gate')
  return {
    ...actual,
    evaluateControl02FinalizationGate: (evidence: Parameters<typeof actual.evaluateControl02FinalizationGate>[0]) => (
      gateOverride.enabled
        ? { allowed: true as const, contractVersion: evidence.contractVersion ?? 'CONTROL02-CORE-PAYROLL-APPROVED-1' }
        : actual.evaluateControl02FinalizationGate(evidence)
    ),
  }
})

import { executePayrollFinalizationPlan } from './executor'
import type { FinalizationEvidence } from './execution-gate'
import type { PayrollFinalizationPlan } from './planner'

const evidence: FinalizationEvidence = {
  sourceType: 'LOONAANGIFTE_XML',
  sourceProvenanceVerified: true,
  officialSchemaValidated: true,
  sourceImmutable: true,
  scopeInvariantMigrationApplied: true,
  contractVersion: 'CONTROL02-CORE-PAYROLL-APPROVED-1',
  decisionsComplete: true,
  decisionsConfirmedByCurrentActor: true,
  decisionsMatchCurrentSource: true,
  decisionsMatchCurrentCoreState: true,
  currentAuthorizationVerified: true,
  currentAdministrationAndHrGroupVerified: true,
  currentCorePreconditionsVerified: true,
}

const plan: PayrollFinalizationPlan = {
  batchId: 'batch-1',
  tenantId: 'tenant-1',
  hrGroupId: 'group-1',
  administrationId: 'administration-1',
  sourceHash: 'c'.repeat(64),
  analysisHash: 'd'.repeat(64),
  coreStateHash: 'e'.repeat(64),
  planHash: 'a'.repeat(64),
  status: 'READY_FOR_REVIEW',
  canExecute: false,
  contractVersion: evidence.contractVersion,
  schemaVersion: 'Loonaangifte-2026-v2.0',
  blockers: [],
  people: [{
    sourcePersonRef: 'person-1',
    decisionHash: null,
    decisionVersion: null,
    confirmerUserId: null,
    status: 'READY_FOR_REVIEW',
    blockers: [],
    warnings: [],
    sourceIncomeRefs: ['income-1'],
    actions: [{
      actionId: 'payroll-finalize:action-1',
      idempotencyKey: 'b'.repeat(64),
      type: 'CREATE_INCOME_RELATIONSHIP',
      sourcePersonRef: 'person-1',
      sourceIncomeRef: 'income-1',
      sourceRefs: ['income-1'],
      targetEmployeeId: 'employee-1',
      targetEmploymentId: 'employment-1',
      preconditions: ['FULL_LHNR_AND_IKV_PRESERVED'],
    }],
  }],
}

function executablePlan(): PayrollFinalizationPlan {
  return { ...plan, status: 'READY_FOR_REVIEW', canExecute: true } as unknown as PayrollFinalizationPlan
}

function validReadback(planToVerify: PayrollFinalizationPlan) {
  return {
    executionId: 'execution-1',
    readbackHash: 'f'.repeat(64),
    sourceHash: planToVerify.sourceHash,
    analysisHash: planToVerify.analysisHash,
    coreStateHash: planToVerify.coreStateHash,
    readbackVerified: true as const,
  }
}

function validCurrentState(planToVerify: PayrollFinalizationPlan) {
  return {
    sourceHash: planToVerify.sourceHash,
    analysisHash: planToVerify.analysisHash,
    coreStateHash: planToVerify.coreStateHash,
    sourceImmutable: true as const,
    readbackVerified: true as const,
  }
}

describe('CONTROL02 finalization executor', () => {
  beforeEach(() => {
    gateOverride.enabled = false
  })

  it('never invokes a writer while XML activation is disabled', async () => {
    const writeAction = vi.fn(async () => undefined)
    const verifyAction = vi.fn(async () => validReadback(plan))
    const readCurrentState = vi.fn(async () => validCurrentState(plan))

    const result = await executePayrollFinalizationPlan({ plan, evidence, writeAction, verifyAction, readCurrentState })

    expect(result.status).toBe('BLOCKED')
    expect(result.blockers).toContain('FINALIZATION_FEATURE_DISABLED')
    expect(result.blockers).toContain('PLAN_NOT_EXECUTABLE')
    expect(writeAction).not.toHaveBeenCalled()
    expect(verifyAction).not.toHaveBeenCalled()
    expect(readCurrentState).not.toHaveBeenCalled()
    expect(result.executedActionIds).toEqual([])
  })

  it('fails closed for an internal source and never broadens the XML executor', async () => {
    const writeAction = vi.fn(async () => undefined)
    const result = await executePayrollFinalizationPlan({
      plan,
      evidence: { ...evidence, sourceType: 'INTERNAL_REPRESENTATIVE' },
      writeAction,
    })

    expect(result.status).toBe('BLOCKED')
    expect(result.blockers).toContain('XML_SOURCE_REQUIRED')
    expect(writeAction).not.toHaveBeenCalled()
  })

  it('rejects forged action references and duplicate idempotency keys before any write', async () => {
    const writeAction = vi.fn(async () => undefined)
    const forgedPlan: PayrollFinalizationPlan = {
      ...plan,
      people: [{
        ...plan.people[0]!,
        actions: [{ ...plan.people[0]!.actions[0]!, sourcePersonRef: 'other-person' }],
      }],
    }

    const result = await executePayrollFinalizationPlan({ plan: forgedPlan, evidence, writeAction })

    expect(result.status).toBe('BLOCKED')
    expect(result.blockers).toContain('PLAN_REFERENCES_INVALID')
    expect(writeAction).not.toHaveBeenCalled()
  })

  it('requires a readback verifier before invoking a writer when gates are open', async () => {
    gateOverride.enabled = true
    const writeAction = vi.fn(async () => undefined)
    const executable = executablePlan()
    const readCurrentState = vi.fn(async () => validCurrentState(executable))

    const result = await executePayrollFinalizationPlan({
      plan: executable,
      evidence,
      writeAction,
      readCurrentState,
    })

    expect(result.status).toBe('BLOCKED')
    expect(result.blockers).toContain('ACTION_READBACK_VERIFIER_UNAVAILABLE')
    expect(writeAction).not.toHaveBeenCalled()
    expect(result.completionProofs).toEqual([])
  })

  it('requires a current source and Core state preflight before invoking a writer', async () => {
    gateOverride.enabled = true
    const executable = executablePlan()
    const writeAction = vi.fn(async () => undefined)
    const verifyAction = vi.fn(async () => validReadback(executable))

    const result = await executePayrollFinalizationPlan({
      plan: executable,
      evidence,
      writeAction,
      verifyAction,
    })

    expect(result.status).toBe('BLOCKED')
    expect(result.blockers).toContain('CURRENT_STATE_PREFLIGHT_UNAVAILABLE')
    expect(writeAction).not.toHaveBeenCalled()
    expect(verifyAction).not.toHaveBeenCalled()
    expect(result.currentStateProof).toBeNull()
  })

  it.each([
    {
      label: 'returns a stale source hash',
      errorCode: 'PAYROLL_FINALIZATION_CURRENT_STATE_PROOF_STATE_STALE',
      proof: (executable: PayrollFinalizationPlan) => ({
        ...validCurrentState(executable),
        sourceHash: 'f'.repeat(64),
      }),
    },
    {
      label: 'does not confirm immutable readback',
      errorCode: 'PAYROLL_FINALIZATION_CURRENT_STATE_PROOF_INVALID',
      proof: (executable: PayrollFinalizationPlan) => ({
        ...validCurrentState(executable),
        readbackVerified: false,
      }),
    },
  ])('never invokes a writer when current state preflight $label', async ({ errorCode, proof }) => {
    gateOverride.enabled = true
    const executable = executablePlan()
    const writeAction = vi.fn(async () => undefined)
    const verifyAction = vi.fn(async () => validReadback(executable))
    const readCurrentState = vi.fn(async () => proof(executable))

    const result = await executePayrollFinalizationPlan({
      plan: executable,
      evidence,
      writeAction,
      verifyAction,
      readCurrentState,
    })

    expect(result.status).toBe('BLOCKED')
    expect(result.blockers).toContain(errorCode)
    expect(writeAction).not.toHaveBeenCalled()
    expect(verifyAction).not.toHaveBeenCalled()
    expect(result.currentStateProof).toBeNull()
  })

  it('reports COMPLETED only after every action has a valid state-bound readback proof', async () => {
    gateOverride.enabled = true
    const executable = executablePlan()
    const writeAction = vi.fn(async () => undefined)
    const verifyAction = vi.fn(async () => validReadback(executable))
    const readCurrentState = vi.fn(async () => validCurrentState(executable))

    const result = await executePayrollFinalizationPlan({
      plan: executable,
      evidence,
      writeAction,
      verifyAction,
      readCurrentState,
    })

    expect(result).toMatchObject({
      status: 'COMPLETED',
      blockers: [],
      executedActionIds: ['payroll-finalize:action-1'],
      completionProofs: [{ actionId: 'payroll-finalize:action-1', completionProof: validReadback(executable) }],
    })
    expect(writeAction).toHaveBeenCalledTimes(1)
    expect(verifyAction).toHaveBeenCalledTimes(1)
    expect(readCurrentState).toHaveBeenCalledTimes(1)
  })

  it.each([
    {
      label: 'throws during readback',
      errorCode: 'ACTION_READBACK_FAILED',
      throwError: true,
    },
    {
      label: 'returns readbackVerified false',
      errorCode: 'PAYROLL_FINALIZATION_COMPLETION_PROOF_INVALID',
      readback: { ...validReadback(executablePlan()), readbackVerified: false },
    },
    {
      label: 'omits a required hash',
      errorCode: 'CORE_STATE_HASH_INVALID',
      readback: { ...validReadback(executablePlan()), coreStateHash: undefined },
    },
    {
      label: 'returns a stale source hash',
      errorCode: 'PAYROLL_FINALIZATION_COMPLETION_PROOF_STATE_STALE',
      readback: { ...validReadback(executablePlan()), sourceHash: 'e'.repeat(64) },
    },
  ])('never completes when the verifier $label', async ({ errorCode, throwError, readback }) => {
    gateOverride.enabled = true
    const executable = executablePlan()
    const writeAction = vi.fn(async () => undefined)
    const readCurrentState = vi.fn(async () => validCurrentState(executable))
    const verifyAction = vi.fn(async () => {
      if (throwError) throw new Error('readback unavailable')
      return readback
    })

    const result = await executePayrollFinalizationPlan({
      plan: executable,
      evidence,
      writeAction,
      verifyAction,
      readCurrentState,
    })

    expect(result.status).toBe('BLOCKED')
    expect(result.blockers).toContain(errorCode)
    expect(result.status).not.toBe('COMPLETED')
    expect(result.completionProofs).toEqual([])
    expect(writeAction).toHaveBeenCalledTimes(1)
    expect(verifyAction).toHaveBeenCalledTimes(1)
  })
})
