import { describe, expect, it } from 'vitest'
import {
  confirmPayrollImportDecision,
  isPayrollImportDecisionAuthentic,
  isPayrollImportDecisionFresh,
  validatePayrollImportDecision,
  type PayrollImportDecisionSource,
} from './decision-contract'

const source: PayrollImportDecisionSource = {
  personId: 'person-1',
  matchStatus: 'PROPOSED',
  proposedEmployeeId: '00000000-0000-4000-8000-000000000001',
  sourceFields: ['firstName', 'birthName', 'address.city'],
  conflictingFields: ['address.city'],
  incomeRelationships: [
    { sourceRef: 'lh123L01:1:2026-01-01' },
    { sourceRef: 'lh123L02:2:2026-01-01' },
  ],
}

const completeDecision = {
  match: { action: 'REUSE_EMPLOYEE', employeeId: '00000000-0000-4000-8000-000000000001', confirmed: true },
  incomeRelationshipBySourceRef: {
    'lh123L01:1:2026-01-01': { action: 'CREATE', confirmed: true },
    'lh123L02:2:2026-01-01': { action: 'LINK', incomeRelationshipId: 'd9f1316d-c9c3-411e-89b3-3e762b5d7342', confirmed: true },
  },
  employmentByIncomeRelationship: {
    'lh123L01:1:2026-01-01': { action: 'REUSE_EMPLOYMENT', employmentId: 'dd1a51be-434e-4a14-b458-ceb5b1e6ace2', confirmed: true },
    'lh123L02:2:2026-01-01': { action: 'CREATE_DRAFT_EMPLOYMENT', confirmed: true },
  },
  sourceFieldDecisions: {
    firstName: 'USE_SOURCE',
    birthName: 'KEEP_CURRENT',
    'address.city': 'KEEP_CURRENT',
  },
}

describe('CONTROL02 server-authoritative decision contract', () => {
  it('requires confirmation for non-exact matches and explicit Employment choice for every IKV', () => {
    expect(validatePayrollImportDecision({
      ...completeDecision,
      match: { ...completeDecision.match, confirmed: false },
    }, source).valid).toBe(false)

    expect(validatePayrollImportDecision({
      ...completeDecision,
      incomeRelationshipBySourceRef: {
        'lh123L01:1:2026-01-01': completeDecision.incomeRelationshipBySourceRef['lh123L01:1:2026-01-01'],
      },
      employmentByIncomeRelationship: {
        [source.incomeRelationships[0]!.sourceRef]: completeDecision.employmentByIncomeRelationship['lh123L01:1:2026-01-01'],
      },
    }, source).valid).toBe(false)
  })

  it('requires each conflicted source field to receive an explicit non-overwrite decision', () => {
    const result = validatePayrollImportDecision({
      ...completeDecision,
      sourceFieldDecisions: { firstName: 'USE_SOURCE', birthName: 'KEEP_CURRENT' },
    }, source)

    expect(result.valid).toBe(false)
    expect(result.blockers).toContain('SOURCE_FIELD_DECISION_REQUIRED')
  })

  it('does not permit replacing an exact match with an unconfirmed employee', () => {
    const exactSource = { ...source, matchStatus: 'EXACT' as const, proposedEmployeeId: 'employee-1' }
    const result = validatePayrollImportDecision({
      ...completeDecision,
      match: { action: 'REUSE_EMPLOYEE', employeeId: '00000000-0000-4000-8000-000000000002', confirmed: true },
    }, exactSource)

    expect(result.valid).toBe(false)
    expect(result.blockers).toContain('EXACT_MATCH_TARGET_CHANGED')
  })

  it('creates immutable confirmation metadata on the server and detects stale source or Core state', () => {
    const validated = validatePayrollImportDecision(completeDecision, source)
    expect(validated.valid).toBe(true)
    if (!validated.valid) return

    const record = confirmPayrollImportDecision({
      decision: validated.decision,
      decisionVersion: 1,
      confirmerUserId: '7c7e170a-60d2-4b8e-a9e8-a341c5d04b1d',
      confirmedAt: '2026-10-05T09:00:00.000Z',
      sourceHash: 'a'.repeat(64),
      analysisHash: 'b'.repeat(64),
      coreStateHash: 'c'.repeat(64),
    })

    expect(record.decisionHash).toMatch(/^[a-f0-9]{64}$/)
    expect(isPayrollImportDecisionFresh(record, {
      sourceHash: 'a'.repeat(64),
      analysisHash: 'b'.repeat(64),
      coreStateHash: 'c'.repeat(64),
    })).toBe(true)
    expect(isPayrollImportDecisionFresh(record, {
      sourceHash: 'd'.repeat(64),
      analysisHash: 'b'.repeat(64),
      coreStateHash: 'c'.repeat(64),
    })).toBe(false)
    expect(isPayrollImportDecisionFresh(record, {
      sourceHash: 'a'.repeat(64),
      analysisHash: 'b'.repeat(64),
      coreStateHash: 'd'.repeat(64),
    })).toBe(false)
    expect(isPayrollImportDecisionAuthentic(record)).toBe(true)
    expect(isPayrollImportDecisionAuthentic({
      ...record,
      decision: {
        ...record.decision,
        sourceFieldDecisions: { ...record.decision.sourceFieldDecisions, firstName: 'KEEP_CURRENT' },
      },
    })).toBe(false)
  })

  it('rejects malformed hashes and non-positive decision versions', () => {
    const validated = validatePayrollImportDecision(completeDecision, source)
    expect(validated.valid).toBe(true)
    if (!validated.valid) return

    expect(() => confirmPayrollImportDecision({
      decision: validated.decision,
      decisionVersion: 0,
      confirmerUserId: '7c7e170a-60d2-4b8e-a9e8-a341c5d04b1d',
      confirmedAt: '2026-10-05T09:00:00.000Z',
      sourceHash: 'bad',
      analysisHash: 'b'.repeat(64),
      coreStateHash: 'c'.repeat(64),
    })).toThrow()
  })
})
