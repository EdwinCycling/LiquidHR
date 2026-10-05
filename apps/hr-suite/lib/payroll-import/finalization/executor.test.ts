import { describe, expect, it, vi } from 'vitest'
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

describe('CONTROL02 finalization executor', () => {
  it('never invokes a writer while XML activation is disabled', async () => {
    const writeAction = vi.fn(async () => undefined)

    const result = await executePayrollFinalizationPlan({ plan, evidence, writeAction })

    expect(result.status).toBe('BLOCKED')
    expect(result.blockers).toContain('FINALIZATION_FEATURE_DISABLED')
    expect(result.blockers).toContain('PLAN_NOT_EXECUTABLE')
    expect(writeAction).not.toHaveBeenCalled()
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
})
