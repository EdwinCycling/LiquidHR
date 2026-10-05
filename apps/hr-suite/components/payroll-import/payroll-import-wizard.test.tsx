// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { decisionAnalysisFromResponse, DecisionWorkspace, type PayrollImportDecisionRow } from './payroll-import-wizard'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const labels: Record<string, string> = {
  decisionAuditDescription: 'Audit',
  decisionAuditTitle: 'Audit',
  decisionBlockers: 'Blockers',
  decisionComplete: 'Complete',
  decisionConfirm: 'Confirm',
  decisionConfirmed: 'Confirmed',
  decisionConflictFieldsNotice: 'Conflict fields',
  decisionConflictsDescription: 'Conflicts',
  decisionConflictsTitle: 'Conflicts',
  decisionEmployeeChoice: 'Employee match',
  decisionEmployee_REUSE_EMPLOYEE: 'Reuse employee',
  decisionEmployee_CREATE_EMPLOYEE: 'Create employee',
  decisionEmployee_UNRESOLVED: 'Unresolved',
  decisionEmploymentChoice: 'Employment',
  decisionEmploymentDescription: 'Employment choices',
  decisionEmploymentTitle: 'Employments',
  decisionEmployment_REUSE_EMPLOYMENT: 'Reuse employment',
  decisionEmployment_CREATE_DRAFT_EMPLOYMENT: 'Create draft employment',
  decisionEmployment_UNDECIDED: 'Undecided employment',
  decisionExactMatchLocked: 'Exact match locked',
  decisionFieldChoice: 'Field choice',
  decisionFieldsDescription: 'Fields',
  decisionFieldsTitle: 'Fields',
  decisionFinalizationDisabled: 'Finalization disabled',
  decisionIdempotencyDescription: 'Idempotency',
  decisionIncomeChoice: 'Income',
  decisionIncome_CREATE: 'Create income',
  decisionIncome_LINK: 'Link income',
  decisionIncome_NO_CHANGE: 'No change',
  decisionIncome_UNDECIDED: 'Undecided income',
  decisionIncomeCandidate: 'Server-returned income candidate',
  decisionIncomeCandidateUnavailable: 'No in-scope income candidate',
  decisionMatchesDescription: 'Matches',
  decisionMatchesTitle: 'Match decisions',
  decisionMatchStatus: 'Match status',
  decisionNeedsReview: 'Needs review',
  decisionPersistenceUnavailable: 'Save is unavailable',
  decisionPersistenceReady: 'Server is source of truth',
  decisionReadbackLoading: 'Loading saved decisions',
  decisionReadbackError: 'Could not load saved decisions',
  decisionUnsaved: 'Unsaved changes',
  decisionSave: 'Save and confirm',
  decisionReconfirm: 'Confirm again',
  decisionLastConfirmed: 'Last confirmed',
  decisionStatus_DRAFT: 'Draft',
  decisionStatus_SAVED: 'Saved',
  decisionStatus_STALE: 'Reconfirmation required',
  decisionStatus_CONFLICT: 'Conflict',
  decisionStatus_BLOCKED: 'Blocked',
  decisionStale: 'Stale',
  decisionConflict: 'Conflict',
  decisionBlocked: 'Blocked',
  decisionSelectedEmployee: 'Existing employee selected',
  decisionEmployeeCandidate: 'Server-returned employee candidate',
  decisionEmployeeCandidateUnavailable: 'No in-scope employee candidate',
  decisionCandidateSearch: 'Search authorized candidates',
  decisionDraftEmployee: 'Draft employee',
  decisionEmployeeNotSelected: 'No employee selected',
  decisionSelectedEmployment: 'Existing employment selected',
  decisionEmploymentCandidate: 'Server-returned employment candidate',
  decisionEmploymentCandidateUnavailable: 'No in-scope employment candidate',
  decisionDraftEmployment: 'Draft employment',
  decisionEmploymentNotSelected: 'No employment selected',
  decisionSaveBeforePlan: 'Save all decisions first',
  decisionRequestPlan: 'Prepare plan',
  decisionPlanLoading: 'Preparing plan',
  decisionPlanBlocked: 'Plan blocked',
  decisionPlanServerReady: 'Plan ready',
  decisionPlannedActions: 'Planned actions',
  decisionNoPlannedActions: 'No actions',
  decisionBlocker_DECISION_SHAPE_INVALID: 'Invalid decision',
  decisionBlocker_MATCH_CONFIRMATION_REQUIRED: 'Confirm match',
  decisionBlocker_EMPLOYEE_SELECTION_REQUIRED: 'Select employee',
  decisionBlocker_EXACT_MATCH_TARGET_CHANGED: 'Exact match changed',
  decisionBlocker_INCOME_RELATIONSHIP_DECISION_REQUIRED: 'Choose income',
  decisionBlocker_EMPLOYMENT_SELECTION_REQUIRED: 'Select employment',
  decisionBlocker_EMPLOYMENT_DECISION_CONFIRMATION_REQUIRED: 'Confirm employment',
  decisionBlocker_SOURCE_FIELD_DECISION_REQUIRED: 'Choose source field',
  decisionBlocker_SOURCE_FIELD_REVIEW_REQUIRED: 'Review source field',
  decisionBlocker_DECISION_SOURCE_STALE: 'Source stale',
  decisionBlocker_DECISION_CORE_STATE_STALE: 'Core state stale',
  decisionAction_UNKNOWN: 'Review action',
  decisionNoConflicts: 'No conflicts',
  decisionNoSourceFields: 'No fields',
  decisionPeople: 'People',
  decisionPlanBlockers: '{count} blocker(s)',
  decisionPlanDescription: 'Plan',
  decisionPlanReady: 'Plan ready',
  decisionPlanTitle: 'Plan',
  decisionReady: 'Ready',
  decisionReviewAcknowledgement: 'Reviewed',
  decisionSourceRef: 'Source reference',
  decisionSourceField_USE_SOURCE: 'Use source',
  decisionSourceField_KEEP_CURRENT: 'Keep current',
  decisionSourceField_MANUAL_REVIEW: 'Manual review',
  decisionField_firstName: 'First name',
  decisionField_birthName: 'Birth name',
  decisionField_birthDate: 'Birth date',
  decisionField_gender: 'Gender',
  decisionField_nationality: 'Nationality',
  decisionField_address: 'Address',
  decisionIkvCount: '{count} income relationship(s)',
  emptyValue: '—',
  error: 'Error',
  issue_FIRST_NAME_REQUIRED: 'First name required',
  match_EXACT: 'Exact',
  row: 'Row',
  status_GREEN: 'Green',
  xmlIkvNumber: 'IKV',
}

const row: PayrollImportDecisionRow = {
  sourceRowNumber: 4,
  firstName: 'Synthetic',
  birthName: 'Example',
  birthDate: '1990-01-01',
  incomeRelationships: [{ ikvNumber: 1, payrollTaxNumber: '123456789L01', startsOn: '2026-01-01' }],
  status: 'GREEN',
  match: { employeeId: 'employee-1', status: 'EXACT' },
  employeeCandidates: [{ id: 'employee-1', employeeNumber: 'E-001', displayName: 'Synthetic Example', administrationIds: ['admin-1'] }],
  issues: [],
}

const persistedDecision = {
  match: { action: 'REUSE_EMPLOYEE', employeeId: 'employee-1', confirmed: true },
  incomeRelationshipBySourceRef: { 'row-4:income-0:123456789L01:1:2026-01-01': { action: 'CREATE', confirmed: true } },
  employmentByIncomeRelationship: { 'row-4:income-0:123456789L01:1:2026-01-01': { action: 'CREATE_DRAFT_EMPLOYMENT', confirmed: true } },
  sourceFieldDecisions: { firstName: 'USE_SOURCE', birthName: 'USE_SOURCE', birthDate: 'USE_SOURCE' },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CONTROL02 decision workspace', () => {
  it('reconstructs authorized staged rows for a refresh without client supplied analysis', () => {
    const analysis = decisionAnalysisFromResponse({
      data: {
        sourceType: 'INTERNAL_REPRESENTATIVE',
        sourceHash: 'a'.repeat(64),
        taxYear: 2026,
        people: [{
          personId: 'person-1',
          sourceRowNumber: 4,
          firstName: 'Synthetic',
          birthName: 'Example',
          status: 'GREEN',
          matchStatus: 'PROPOSED',
          proposedEmployeeId: 'employee-1',
          employeeCandidates: [{ id: 'candidate-1', employeeNumber: 'E-001', displayName: 'Ada Example', administrationIds: ['admin-1'] }],
          sourceFields: ['firstName'],
          issues: [],
          incomeRelationships: [{ sourceRef: 'income-1', payrollTaxNumber: '123456789L01', ikvNumber: 1, startsOn: '2026-01-01', endsOn: null }],
        }],
      },
    })

    expect(analysis?.rows).toHaveLength(1)
    expect(analysis?.rows[0]?.match).toEqual({ status: 'PROPOSED', employeeId: 'employee-1' })
    expect(analysis?.rows[0]?.employeeCandidates?.[0]?.displayName).toBe('Ada Example')
    expect(analysis?.rows[0]?.incomeRelationships[0]?.ikvNumber).toBe(1)
  })

  it('offers only server-returned manual-review employees with an HR label', () => {
    const markup = renderToStaticMarkup(<DecisionWorkspace labels={labels} readOnly={false} rows={[{
      ...row,
      match: { status: 'MANUAL_REVIEW' },
      employeeCandidates: [{ id: 'candidate-1', employeeNumber: 'E-001', displayName: 'Ada Example', administrationIds: ['admin-1'] }],
    }]} section="matches" />)

    expect(markup).toContain('Ada Example · E-001')
    expect(markup).not.toContain('No in-scope employee candidate')
  })

  it('does not synthesize a selectable candidate from an out-of-scope proposed employee id', () => {
    const markup = renderToStaticMarkup(<DecisionWorkspace labels={labels} readOnly={false} rows={[{
      ...row,
      match: { status: 'PROPOSED', employeeId: 'employee-other-admin' },
      employeeCandidates: [],
    }]} section="matches" />)

    expect(markup).toContain('No in-scope employee candidate')
    expect(markup).not.toContain('employee-other-admin')
    expect(markup).not.toContain('value="employee-other-admin"')
  })

  it('renders the explicit match flow and locks exact targets', () => {
    const markup = renderToStaticMarkup(<DecisionWorkspace labels={labels} readOnly={false} rows={[row]} section="matches" />)

    expect(markup).toContain('Match decisions')
    expect(markup).toContain('Reuse employee')
    expect(markup).toContain('Server-returned employee candidate')
    expect(markup).toContain('Synthetic Example · E-001')
    expect(markup).toContain('Exact match locked')
    expect(markup).toContain('Confirm')
    expect(markup).toContain('Save is unavailable')
  })

  it('keeps the plan review-only and exposes the finalization gate', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<DecisionWorkspace labels={labels} readOnly={false} rows={[row]} section="preview" />))

    expect(host.textContent).toContain('Finalization disabled')
    const review = host.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(review.checked).toBe(false)
    act(() => review.click())
    expect(review.checked).toBe(true)
    act(() => root.unmount())
  })

  it('renders every source IKV as a separate employment decision', () => {
    const markup = renderToStaticMarkup(
      <DecisionWorkspace
        labels={labels}
        readOnly={false}
        rows={[{ ...row, incomeRelationships: [...row.incomeRelationships, { ikvNumber: 2, payrollTaxNumber: '123456789L01', startsOn: '2026-02-01' }] }]}
        section="employment"
      />,
    )

    expect(markup).toContain('IKV 1')
    expect(markup).toContain('IKV 2')
    expect(markup).toContain('Create draft employment')
    expect(markup).toContain('No in-scope income candidate')
    expect(markup).toContain('No in-scope employment candidate')
  })

  it('reads saved decisions after refresh and saves an explicitly changed draft', async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { decisions: [{ personId: 'person-1', sourceRowNumber: 4, status: 'CONFIRMED', confirmedAt: '2026-10-05T10:00:00.000Z', decision: persistedDecision }] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { personId: 'person-1', sourceRowNumber: 4, status: 'CONFIRMED', confirmedAt: '2026-10-05T10:05:00.000Z', decision: persistedDecision } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const rows = [row]
    await act(async () => root.render(<DecisionWorkspace batchId="batch-1" labels={labels} readOnly={false} rows={rows} section="matches" />))
    expect(host.textContent).toContain('Saved')
    expect(host.textContent).toContain('Last confirmed')

    const confirm = host.querySelector('input[type="checkbox"]') as HTMLInputElement
    await act(async () => confirm.click())
    expect(host.textContent).toContain('Unsaved changes')
    await act(async () => root.render(<DecisionWorkspace batchId="batch-1" labels={labels} readOnly={false} rows={rows} section="preview" />))
    const saveButton = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Save and confirm')) as HTMLButtonElement
    await act(async () => saveButton.click())
    expect(fetchMock).toHaveBeenLastCalledWith('/api/payroll/import/batches/batch-1/decisions/person-1', expect.objectContaining({ method: 'PUT' }))
    expect(host.textContent).toContain('Saved')
    await act(async () => root.unmount())
  })

  it('shows stale decisions as requiring an explicit reconfirmation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { decisions: [{ personId: 'person-1', sourceRowNumber: 4, status: 'STALE', decision: persistedDecision, blockers: ['DECISION_SOURCE_STALE'] }] } }), { status: 200 })))
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<DecisionWorkspace batchId="batch-1" labels={labels} readOnly={false} rows={[row]} section="matches" />))
    expect(host.textContent).toContain('Reconfirmation required')
    expect(host.textContent).toContain('Source stale')
    await act(async () => root.unmount())
  })

  it('shows server blockers without exposing technical state details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { decisions: [{ personId: 'person-1', sourceRowNumber: 4, status: 'BLOCKED', decision: null, blockers: ['MATCH_CONFIRMATION_REQUIRED'] }] } }), { status: 200 })))
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<DecisionWorkspace batchId="batch-1" labels={labels} readOnly={false} rows={[row]} section="preview" />))
    expect(host.textContent).toContain('Blocked')
    expect(host.textContent).toContain('Confirm match')
    expect(host.textContent).not.toContain('sourceHash')
    await act(async () => root.unmount())
  })
})
