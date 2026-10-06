import { describe, expect, it } from 'vitest'
import { confirmPayrollImportDecision, type PayrollImportDecisionSource, type PayrollImportPersonDecision } from './decision-contract'
import { buildPayrollFinalizationPlan, type PayrollFinalizationPlannerInput } from './planner'

const ids = {
  tenant: 'd941c7cf-63eb-4b98-b793-279534cc2bd3',
  group: 'e7130b53-166b-4bfb-97b1-829bcc646f08',
  administration: '8df1eaf8-35be-4cc0-b1a3-01dc7abf264a',
  employee: '00000000-0000-4000-8000-000000000001',
  employment: 'dd1a51be-434e-4a14-b458-ceb5b1e6ace2',
  incomeRelationship: 'd9f1316d-c9c3-411e-89b3-3e762b5d7342',
}

function inputForMany(count: number): PayrollFinalizationPlannerInput {
  const sourceHash = 'a'.repeat(64)
  const analysisHash = 'b'.repeat(64)
  const coreStateHash = 'c'.repeat(64)
  const people = Array.from({ length: count }, (_, index) => {
    const personId = `person-${index + 1}`
    const sourceRef = `${personId}:123456789L01:1:2026-01-01`
    const decisionSource: PayrollImportDecisionSource = {
      personId,
      matchStatus: 'EXACT',
      proposedEmployeeId: ids.employee,
      sourceFields: ['firstName'],
      conflictingFields: [],
      incomeRelationships: [{ sourceRef }],
    }
    const decision: PayrollImportPersonDecision = {
      match: { action: 'REUSE_EMPLOYEE', employeeId: ids.employee, confirmed: true },
      incomeRelationshipBySourceRef: { [sourceRef]: { action: 'CREATE', confirmed: true } },
      employmentByIncomeRelationship: { [sourceRef]: { action: 'REUSE_EMPLOYMENT', employmentId: ids.employment, confirmed: true } },
      sourceFieldDecisions: { firstName: 'KEEP_CURRENT' },
    }
    const confirmedDecision = confirmPayrollImportDecision({
      decision,
      decisionVersion: 1,
      confirmerUserId: '7c7e170a-60d2-4b8e-a9e8-a341c5d04b1d',
      confirmedAt: '2026-10-05T09:00:00.000Z',
      sourceHash,
      analysisHash,
      coreStateHash,
    })
    return {
      sourceRef: personId,
      decisionSource,
      confirmedDecision,
      incomeRelationships: [{ sourceRef, payrollTaxNumber: '123456789L01', ikvNumber: 1, startsOn: '2026-01-01', endsOn: '2026-01-31' }],
    }
  })

  return {
    batch: {
      batchId: 'f363f7fc-bb90-4dc7-ac7b-5128267e80d2',
      tenantId: ids.tenant,
      hrGroupId: ids.group,
      administrationId: ids.administration,
      sourceType: 'LOONAANGIFTE_XML',
      sourceHash,
      analysisHash,
      schemaVersion: 'Loonaangifte-2026-v2.0',
      officialSchemaValidated: true,
      sourceImmutable: true,
    },
    contractVersion: 'CONTROL02-CORE-PAYROLL-DRAFT-1',
    scopeInvariantMigrationApplied: false,
    currentUserId: '7c7e170a-60d2-4b8e-a9e8-a341c5d04b1d',
    currentCoreStateHash: coreStateHash,
    people,
    coreState: {
      employees: [{ id: ids.employee, tenantId: ids.tenant, hrGroupId: ids.group, administrationIds: [] }],
      employments: [{
        id: ids.employment,
        employeeId: ids.employee,
        tenantId: ids.tenant,
        hrGroupId: ids.group,
        administrationId: ids.administration,
        status: 'CONFIRMED',
        validFrom: '2025-01-01',
        validUntilExclusive: null,
      }],
      incomeRelationships: [],
    },
  }
}

describe('pure CONTROL02 Finalization Planner', () => {
  it('produces a deterministic preview for one employee with multiple IKVs and explicit Employment choices', () => {
    const input = inputForMany(1)
    const row = input.people[0]!
    const secondSourceRef = `${row.sourceRef}:123456789L02:2:2026-01-01`
    row.decisionSource.incomeRelationships = [...row.decisionSource.incomeRelationships, { sourceRef: secondSourceRef }]
    row.incomeRelationships = [...row.incomeRelationships, { sourceRef: secondSourceRef, payrollTaxNumber: '123456789L02', ikvNumber: 2, startsOn: '2026-01-01', endsOn: '2026-01-31' }]
    const confirmedDecision = row.confirmedDecision
    if (!confirmedDecision) throw new Error('fixture decision missing')
    row.confirmedDecision = confirmPayrollImportDecision({
      decision: {
        ...confirmedDecision.decision,
        incomeRelationshipBySourceRef: {
          ...confirmedDecision.decision.incomeRelationshipBySourceRef,
          [secondSourceRef]: { action: 'CREATE', confirmed: true },
        },
        employmentByIncomeRelationship: {
          ...confirmedDecision.decision.employmentByIncomeRelationship,
          [secondSourceRef]: { action: 'CREATE_DRAFT_EMPLOYMENT', confirmed: true },
        },
      },
      decisionVersion: 1,
      confirmerUserId: '7c7e170a-60d2-4b8e-a9e8-a341c5d04b1d',
      confirmedAt: '2026-10-05T09:00:00.000Z',
      sourceHash: input.batch.sourceHash,
      analysisHash: input.batch.analysisHash,
      coreStateHash: input.currentCoreStateHash,
    })

    const first = buildPayrollFinalizationPlan(input)
    const second = buildPayrollFinalizationPlan(input)
    expect(first.planHash).toBe(second.planHash)
    expect(first.canExecute).toBe(false)
    expect(first.blockers).toContain('XML_FINALIZATION_DISABLED')
    expect(first.people[0]?.actions.map(({ type }) => type)).toEqual([
      'REUSE_EMPLOYEE',
      'ADD_ADMINISTRATION_ASSIGNMENT',
      'REUSE_EMPLOYMENT',
      'CREATE_DRAFT_EMPLOYMENT',
      'CREATE_INCOME_RELATIONSHIP',
      'CREATE_INCOME_RELATIONSHIP',
    ])
    const actions = first.people[0]?.actions ?? []
    expect(actions[1]?.dependsOnActionIds).toEqual([actions[0]?.actionId])
    expect(actions[2]?.dependsOnActionIds).toEqual(expect.arrayContaining([actions[0]?.actionId, actions[1]?.actionId]))
    expect(actions[4]?.dependsOnActionIds).toEqual(expect.arrayContaining([actions[0]?.actionId, actions[1]?.actionId, actions[2]?.actionId]))
    expect(actions[5]?.dependsOnActionIds).toEqual(expect.arrayContaining([actions[0]?.actionId, actions[1]?.actionId, actions[3]?.actionId]))
    expect(new Set(first.people[0]?.actions.map(({ idempotencyKey }) => idempotencyKey)).size)
      .toBe(first.people[0]?.actions.length)
  })

  it('blocks employee and Employment identifiers outside the current HR-group and administration scope', () => {
    const input = inputForMany(1)
    input.coreState.employees = [{ id: ids.employee, tenantId: ids.tenant, hrGroupId: 'e3f00d8f-f319-4ecb-b589-f72f5dfb2177', administrationIds: [] }]

    const plan = buildPayrollFinalizationPlan(input)
    expect(plan.people[0]?.blockers).toContain('EMPLOYEE_SCOPE_MISMATCH')
    expect(plan.people[0]?.actions.map(({ type }) => type)).toEqual(['BLOCKED'])
  })

  it('uses an exclusive Employment upper bound while preserving the inclusive source end date', () => {
    const covered = inputForMany(1)
    covered.coreState.employments[0]!.validUntilExclusive = '2026-02-01'
    const coveredPlan = buildPayrollFinalizationPlan(covered)
    expect(coveredPlan.people[0]?.blockers).not.toContain('EMPLOYMENT_PERIOD_MISMATCH')
    expect(coveredPlan.people[0]?.actions.map(({ type }) => type)).toContain('REUSE_EMPLOYMENT')

    const notCovered = inputForMany(1)
    notCovered.coreState.employments[0]!.validUntilExclusive = '2026-01-31'
    const notCoveredPlan = buildPayrollFinalizationPlan(notCovered)
    expect(notCoveredPlan.people[0]?.blockers).toContain('EMPLOYMENT_PERIOD_MISMATCH')
  })

  it('blocks stale decisions and unresolved or ambiguous matches instead of guessing', () => {
    const input = inputForMany(1)
    input.currentCoreStateHash = 'd'.repeat(64)
    const stalePlan = buildPayrollFinalizationPlan(input)
    expect(stalePlan.people[0]?.blockers).toContain('DECISION_CORE_STATE_STALE')

    const ambiguous = inputForMany(1)
    ambiguous.people[0]!.decisionSource.matchStatus = 'MANUAL_REVIEW'
    ambiguous.people[0]!.decisionSource.proposedEmployeeId = null
    const ambiguousDecision = ambiguous.people[0]!.confirmedDecision
    if (!ambiguousDecision) throw new Error('fixture decision missing')
    ambiguous.people[0]!.confirmedDecision = confirmPayrollImportDecision({
      ...ambiguousDecision,
      decision: { ...ambiguousDecision.decision, match: { action: 'UNRESOLVED', confirmed: false } },
    })
    const ambiguousPlan = buildPayrollFinalizationPlan(ambiguous)
    expect(ambiguousPlan.people[0]?.blockers).toContain('MATCH_CONFIRMATION_REQUIRED')
  })

  it('plans hundreds of people from supplied snapshots without any external reads or writes', () => {
    const input = inputForMany(500)
    const plan = buildPayrollFinalizationPlan(input)
    expect(plan.people).toHaveLength(500)
    expect(plan.people.flatMap(({ actions }) => actions)).toHaveLength(2_000)
    expect(plan.canExecute).toBe(false)
  })

  it('keeps newly created Employee and draft Employment references stable without inventing Core ids', () => {
    const input = inputForMany(1)
    const row = input.people[0]!
    const confirmedDecision = row.confirmedDecision
    if (!confirmedDecision) throw new Error('fixture decision missing')
    row.decisionSource.matchStatus = 'NEW'
    row.decisionSource.proposedEmployeeId = null
    row.confirmedDecision = confirmPayrollImportDecision({
      decision: {
        ...confirmedDecision.decision,
        match: { action: 'CREATE_EMPLOYEE', confirmed: true },
        sourceFieldDecisions: { firstName: 'USE_SOURCE' },
        employmentByIncomeRelationship: {
          [row.incomeRelationships[0]!.sourceRef]: { action: 'CREATE_DRAFT_EMPLOYMENT', confirmed: true },
        },
      },
      decisionVersion: 2,
      confirmerUserId: input.currentUserId,
      confirmedAt: '2026-10-05T09:01:00.000Z',
      sourceHash: input.batch.sourceHash,
      analysisHash: input.batch.analysisHash,
      coreStateHash: input.currentCoreStateHash,
    })
    input.coreState.employees = []
    input.coreState.employments = []

    const person = buildPayrollFinalizationPlan(input).people[0]!
    expect(person.blockers).toEqual([])
    expect(person.actions.map(({ type }) => type)).toEqual([
      'CREATE_EMPLOYEE',
      'CREATE_DRAFT_EMPLOYMENT',
      'CREATE_INCOME_RELATIONSHIP',
    ])
    expect(person.actions[0]?.targetEmployeeRef).toMatch(/^new-employee:/)
    expect(person.actions[1]?.targetEmployeeRef).toBe(person.actions[0]?.targetEmployeeRef)
    expect(person.actions[1]?.targetEmploymentRef).toMatch(/^draft-employment:/)
    expect(person.actions[2]?.targetEmploymentRef).toBe(person.actions[1]?.targetEmploymentRef)
    expect(person.actions[2]?.targetEmployeeId).toBeUndefined()
    expect(person.actions[1]?.dependsOnActionIds).toEqual([person.actions[0]?.actionId])
    expect(person.actions[2]?.dependsOnActionIds).toEqual(expect.arrayContaining([person.actions[0]?.actionId, person.actions[1]?.actionId]))
  })

  it('rejects a forged confirmation and a source-to-staging reference mismatch', () => {
    const forged = inputForMany(1)
    const confirmedDecision = forged.people[0]!.confirmedDecision
    if (!confirmedDecision) throw new Error('fixture decision missing')
    forged.people[0]!.confirmedDecision = {
      ...confirmedDecision,
      decision: {
        ...confirmedDecision.decision,
        sourceFieldDecisions: { firstName: 'USE_SOURCE' },
      },
    }
    const forgedPlan = buildPayrollFinalizationPlan(forged)
    expect(forgedPlan.people[0]?.blockers).toContain('DECISION_CONFIRMATION_INVALID')

    const mismatched = inputForMany(1)
    mismatched.people[0]!.decisionSource.incomeRelationships = [{ sourceRef: 'different-source-ref' }]
    const mismatchedPlan = buildPayrollFinalizationPlan(mismatched)
    expect(mismatchedPlan.people[0]?.blockers).toContain('SOURCE_INCOME_REFERENCE_MISMATCH')
  })
})
