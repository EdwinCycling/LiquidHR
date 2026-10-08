import { describe, expect, it } from 'vitest'
import { confirmPayrollImportDecision, type PayrollImportPersonDecision } from './decision-contract'

import {
  assertBoundedPayrollImportResponse,
  canResumeFinalizationRecovery,
  assertPayrollImportPlanHasActions,
  boundedPayrollImportBsnFingerprints,
  canReadPayrollImportEmployeeCandidates,
  employeeAddressIdsForScope,
  employeeInPayrollImportAdministrationScope,
  getPayrollImportDecisionStatus,
  isExpectedPayrollImportDecisionVersion,
  groupBoundedPayrollImportBsnMatches,
  publicEmployeeCandidates,
  payrollImportBsnMatcherArguments,
  resolveScopedEmploymentId,
  payrollImportDecisionPutSchema,
  payrollImportPlanPostSchema,
  selectedEmployeeIdForDecisionSnapshot,
  scopedPayrollImportEmployeeId,
  type PayrollImportDecisionPutInput,
} from './decision-api'
import type { PersistedDecision } from './ledger-repository'

const userId = '10000000-0000-4000-8000-000000000001'

function persistedDecision(
  decision: PayrollImportPersonDecision = {
    match: { action: 'CREATE_EMPLOYEE', confirmed: true },
    incomeRelationshipBySourceRef: {},
    employmentByIncomeRelationship: {},
    sourceFieldDecisions: {},
  },
): PersistedDecision {
  const confirmed = confirmPayrollImportDecision({
    decision,
    decisionVersion: 1,
    confirmerUserId: userId,
    confirmedAt: '2026-10-05T10:00:00.000Z',
    sourceHash: 'a'.repeat(64),
    analysisHash: 'b'.repeat(64),
    coreStateHash: 'c'.repeat(64),
  })
  return {
    id: '20000000-0000-4000-8000-000000000001',
    scope: {
      tenantId: '30000000-0000-4000-8000-000000000001',
      hrGroupId: '40000000-0000-4000-8000-000000000001',
      administrationId: '50000000-0000-4000-8000-000000000001',
      batchId: '60000000-0000-4000-8000-000000000001',
      importPersonId: '70000000-0000-4000-8000-000000000001',
    },
    ...confirmed,
    contractVersion: null,
    schemaVersion: null,
  }
}

describe('CONTROL02 finalization recovery gate', () => {
  const base = {
    planStatus: 'FAILED',
    actionStatuses: ['COMPLETED', 'FAILED'],
    gateAllowed: true,
    currentCoreStateMatches: false,
    completedProofsVerified: true,
  }

  it('allows resuming a failed partial plan only when completed actions have verified readback', () => {
    expect(canResumeFinalizationRecovery(base)).toBe(true)
    expect(canResumeFinalizationRecovery({ ...base, completedProofsVerified: false })).toBe(false)
  })

  it('fails closed on plan blockers, a blocked action, or no pending action', () => {
    expect(canResumeFinalizationRecovery({ ...base, gateAllowed: false })).toBe(false)
    expect(canResumeFinalizationRecovery({ ...base, actionStatuses: ['COMPLETED', 'BLOCKED'] })).toBe(false)
    expect(canResumeFinalizationRecovery({ ...base, actionStatuses: ['COMPLETED'] })).toBe(false)
  })

  it('does not resume a plan after its Core state changed without completion proof', () => {
    expect(canResumeFinalizationRecovery({ ...base, completedProofsVerified: false })).toBe(false)
    expect(canResumeFinalizationRecovery({ ...base, currentCoreStateMatches: true, completedProofsVerified: false })).toBe(true)
  })
})

describe('payroll import decision API contracts', () => {
  it('rejects caller-owned actor, scope, hash, and timestamp fields', () => {
    const valid: PayrollImportDecisionPutInput = {
      decision: persistedDecision().decision,
      expectedDecisionVersion: 0,
    }
    expect(payrollImportDecisionPutSchema.safeParse({
      ...valid,
      actorUserId: userId,
      tenantId: persistedDecision().scope.tenantId,
      sourceHash: 'a'.repeat(64),
      confirmedAt: persistedDecision().confirmedAt,
    }).success).toBe(false)
    expect(payrollImportDecisionPutSchema.safeParse({ decision: valid.decision }).success).toBe(false)
  })

  it('accepts only an empty plan request', () => {
    expect(payrollImportPlanPostSchema.safeParse({}).success).toBe(true)
    expect(payrollImportPlanPostSchema.safeParse({ actions: [], actorUserId: userId }).success).toBe(false)
  })
})

describe('payroll import decision readback status', () => {
  it('marks each changed freshness hash stale', () => {
    const decision = persistedDecision()
    const current = {
      sourceHash: decision.sourceHash,
      analysisHash: decision.analysisHash,
      coreStateHash: decision.coreStateHash,
    }
    expect(getPayrollImportDecisionStatus(decision, current, userId)).toEqual({ status: 'SAVED', blockers: [] })
    expect(getPayrollImportDecisionStatus(decision, { ...current, sourceHash: 'e'.repeat(64) }, userId).blockers)
      .toContain('DECISION_SOURCE_STALE')
    expect(getPayrollImportDecisionStatus(decision, { ...current, analysisHash: 'e'.repeat(64) }, userId).blockers)
      .toContain('DECISION_ANALYSIS_STALE')
    expect(getPayrollImportDecisionStatus(decision, { ...current, coreStateHash: 'e'.repeat(64) }, userId).blockers)
      .toContain('DECISION_CORE_STATE_STALE')
  })

  it('marks a confirmation by another user stale without reattributing it', () => {
    const decision = persistedDecision()
    const result = getPayrollImportDecisionStatus(decision, decision, '10000000-0000-4000-8000-000000000002')
    expect(result.status).toBe('STALE')
    expect(result.blockers).toContain('DECISION_ACTOR_MISMATCH')
  })

  it('uses a current actor decision for manual candidate readback only while fresh', () => {
    const decision = persistedDecision({
      match: {
        action: 'REUSE_EMPLOYEE',
        employeeId: '80000000-0000-4000-8000-000000000001',
        confirmed: true,
      },
      incomeRelationshipBySourceRef: {},
      employmentByIncomeRelationship: {},
      sourceFieldDecisions: {},
    })
    const source = {
      personId: decision.scope.importPersonId,
      matchStatus: 'MANUAL_REVIEW' as const,
      sourceFields: [],
      conflictingFields: [],
      incomeRelationships: [],
    }
    const current = {
      sourceHash: decision.sourceHash,
      analysisHash: decision.analysisHash,
      coreStateHash: decision.coreStateHash,
    }
    expect(selectedEmployeeIdForDecisionSnapshot(decision, source, current, userId))
      .toBe('80000000-0000-4000-8000-000000000001')
    expect(selectedEmployeeIdForDecisionSnapshot(decision, source, { ...current, coreStateHash: 'e'.repeat(64) }, userId))
      .toBeNull()
  })
  it('allows an explicit stale reconfirmation only at the latest optimistic version', () => {
    const decision = persistedDecision()
    expect(isExpectedPayrollImportDecisionVersion(decision, decision.decisionVersion)).toBe(true)
    expect(isExpectedPayrollImportDecisionVersion(decision, decision.decisionVersion - 1)).toBe(false)
    expect(isExpectedPayrollImportDecisionVersion(undefined, 0)).toBe(true)
  })
})

describe('payroll import plan persistence boundary', () => {
  it('fails closed before ledger persistence for an empty batch or actionless plan', () => {
    expect(() => assertPayrollImportPlanHasActions({ people: [] })).toThrowError(
      expect.objectContaining({ code: 'PAYROLL_IMPORT_PLAN_EMPTY', status: 422 }),
    )
    expect(() => assertPayrollImportPlanHasActions({ people: [{
      sourcePersonRef: 'row-1',
      decisionHash: null,
      decisionVersion: null,
      confirmerUserId: null,
      status: 'BLOCKED',
      actions: [],
      warnings: [],
      blockers: ['XML_FINALIZATION_DISABLED'],
      sourceIncomeRefs: [],
    }] })).toThrowError(
      expect.objectContaining({ code: 'PAYROLL_IMPORT_PLAN_EMPTY', status: 422 }),
    )
  })
})

describe('payroll import candidate scope and bounded lookups', () => {
  it('does not disclose a manual candidate outside the active administration', () => {
    const person = {
      match_status: 'MANUAL_REVIEW',
      bsn_fingerprint: null,
      external_employee_number: 'EMP-1',
      birth_name: 'Jansen',
      birth_date: '1990-01-01',
      matched_employee_id: null,
    } as const
    const rows = [
      { id: 'employee-in-scope', employee_number: 'EMP-1', first_name: 'Anna', birth_name: 'Jansen', birth_date: '1990-01-01' },
      { id: 'employee-out-of-scope', employee_number: 'EMP-1', first_name: 'Anna', birth_name: 'Jansen', birth_date: '1990-01-01' },
    ] as const
    const candidates = publicEmployeeCandidates(person, rows, new Map([
      ['employee-in-scope', ['administration-1']],
    ]), new Map())
    expect(candidates.map((candidate) => candidate.id)).toEqual(['employee-in-scope'])
    expect(candidates[0]).toMatchObject({ employeeNumber: 'EMP-1', displayName: 'Anna Jansen' })
  })

  it('caps the manual candidate payload before returning an oversized selector', () => {
    const person = {
      match_status: 'MANUAL_REVIEW',
      bsn_fingerprint: null,
      external_employee_number: 'EMP-1',
      birth_name: 'Jansen',
      birth_date: '1990-01-01',
      matched_employee_id: null,
    } as const
    const rows = Array.from({ length: 26 }, (_, index) => ({
      id: `employee-${index}`,
      employee_number: 'EMP-1',
      first_name: 'Anna',
      birth_name: 'Jansen',
      birth_date: '1990-01-01',
    }))
    const assignments = new Map(rows.map((row) => [row.id, ['administration-1'] as readonly string[]]))
    expect(() => publicEmployeeCandidates(person, rows, assignments, new Map())).toThrowError(
      expect.objectContaining({ code: 'PAYROLL_IMPORT_EMPLOYEE_CANDIDATES_TRUNCATED', status: 409 }),
    )
  })

  it('only enables secure candidate lookup for an already write-authorized actor', () => {
    expect(canReadPayrollImportEmployeeCandidates(['payroll-import:read'])).toBe(false)
    expect(canReadPayrollImportEmployeeCandidates(['payroll-import:read', 'payroll-import:write'])).toBe(true)
  })

  it('binds the batch matcher request to the active administration context', () => {
    expect(payrollImportBsnMatcherArguments('tenant-1', 'group-1', 'admin-1', ['a'.repeat(64)]))
      .toEqual({
        requested_tenant_id: 'tenant-1',
        requested_hr_group_id: 'group-1',
        requested_administration_id: 'admin-1',
        requested_bsn_fingerprints: ['a'.repeat(64)],
      })
  })

  it('keeps address lookup ids inside the HR group and active administration intersection', () => {
    expect(employeeAddressIdsForScope(
      ['employee-in-group', 'employee-other-admin'],
      [
        { employee_id: 'employee-in-group', administration_id: 'administration-1' },
        { employee_id: 'employee-other-admin', administration_id: 'administration-2' },
        { employee_id: 'employee-outside-group', administration_id: 'administration-1' },
      ],
      'administration-1',
    )).toEqual(['employee-in-group'])
  })

  it('accepts an Employment link only when its target is the scoped employee and administration', () => {
    const income = { id: 'income-1', employeeId: 'employee-1', startsOn: '2026-01-01', endsOn: '2026-12-31' }
    const link = {
      income_relationship_id: 'income-1',
      employment_id: 'employment-1',
      employee_id: 'employee-1',
      valid_from: '2026-01-01',
      valid_until: null,
    }
    const scope = { tenantId: 'tenant-1', hrGroupId: 'group-1', administrationId: 'administration-1' }
    const valid = new Map([['employment-1', {
      id: 'employment-1',
      employee_id: 'employee-1',
      tenant_id: 'tenant-1',
      hr_group_id: 'group-1',
      administration_id: 'administration-1',
    }]])
    expect(resolveScopedEmploymentId(income, [link], valid, scope)).toBe('employment-1')

    const crossGroup = new Map([['employment-1', { ...valid.get('employment-1')!, hr_group_id: 'group-2' }]])
    const crossAdministration = new Map([['employment-1', { ...valid.get('employment-1')!, administration_id: 'administration-2' }]])
    const crossEmployee = new Map([['employment-1', { ...valid.get('employment-1')!, employee_id: 'employee-2' }]])
    expect(resolveScopedEmploymentId(income, [link], crossGroup, scope)).toBeNull()
    expect(resolveScopedEmploymentId(income, [link], crossAdministration, scope)).toBeNull()
    expect(resolveScopedEmploymentId(income, [link], crossEmployee, scope)).toBeNull()
  })

  it('bounds snapshot and plan payloads for 1, 50 and 500 people', () => {
    for (const size of [1, 50, 500]) {
      const response = { people: Array.from({ length: size }, (_, index) => ({ personId: 'person-' + index, blockers: [] })) }
      expect(assertBoundedPayrollImportResponse(response)).toBe(response)
    }
    expect(() => assertBoundedPayrollImportResponse({ data: 'x'.repeat(2 * 1024 * 1024) })).toThrowError(
      expect.objectContaining({ code: 'PAYROLL_IMPORT_RESPONSE_TOO_LARGE', status: 413 }),
    )
  })

  it('keeps an Employee target bound to the active administration on the server', () => {
    expect(employeeInPayrollImportAdministrationScope({ administrationIds: ['administration-1'] }, 'administration-1')).toBe(true)
    expect(employeeInPayrollImportAdministrationScope({ administrationIds: ['administration-2'] }, 'administration-1')).toBe(false)
  })

  it('omits proposed employees outside the active administration from snapshot targets', () => {
    const employees = [
      { id: 'employee-current-admin', administrationIds: ['administration-current'] },
      { id: 'employee-other-admin', administrationIds: ['administration-other'] },
    ] as const

    expect(scopedPayrollImportEmployeeId('employee-current-admin', employees, 'administration-current'))
      .toBe('employee-current-admin')
    expect(scopedPayrollImportEmployeeId('employee-other-admin', employees, 'administration-current'))
      .toBeNull()
  })

  it('deduplicates bounded BSN batch requests for 1, 50 and 500 manual rows', () => {
    const person = (index: number) => ({
      match_status: 'MANUAL_REVIEW' as const,
      bsn_fingerprint: index.toString(16).padStart(64, '0'),
    })
    expect(boundedPayrollImportBsnFingerprints([person(1)])).toHaveLength(1)
    expect(boundedPayrollImportBsnFingerprints(Array.from({ length: 50 }, (_, index) => person(index)))).toHaveLength(50)
    expect(boundedPayrollImportBsnFingerprints(Array.from({ length: 500 }, (_, index) => person(index)))).toHaveLength(500)
    expect(boundedPayrollImportBsnFingerprints([person(1), person(1)])).toHaveLength(1)
    expect(() => boundedPayrollImportBsnFingerprints(Array.from({ length: 501 }, (_, index) => person(index)))).toThrowError(
      expect.objectContaining({ code: 'PAYROLL_IMPORT_EMPLOYEE_CANDIDATES_TRUNCATED', status: 409 }),
    )
  })

  it('keeps one batch response bounded for 1, 50 and 500 requested fingerprints', () => {
    for (const size of [1, 50, 500]) {
      const fingerprints = Array.from({ length: size }, (_, index) => index.toString(16).padStart(64, '0'))
      const grouped = groupBoundedPayrollImportBsnMatches(fingerprints, fingerprints.map((fingerprint, index) => ({
        requested_bsn_fingerprint: fingerprint,
        employee_id: `employee-${index}`,
      })))
      expect(grouped.size).toBe(size)
      expect([...grouped.values()].flat()).toHaveLength(size)
    }
    const fingerprint = 'a'.repeat(64)
    expect(() => groupBoundedPayrollImportBsnMatches(
      [fingerprint],
      Array.from({ length: 6 }, (_, index) => ({ requested_bsn_fingerprint: fingerprint, employee_id: `employee-${index}` })),
    )).toThrowError(expect.objectContaining({ code: 'PAYROLL_IMPORT_EMPLOYEE_CANDIDATES_TRUNCATED', status: 409 }))
  })
})
