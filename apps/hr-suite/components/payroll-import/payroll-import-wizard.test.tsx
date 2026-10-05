// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DecisionWorkspace, type PayrollImportDecisionRow } from './payroll-import-wizard'

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
  decisionMatchesDescription: 'Matches',
  decisionMatchesTitle: 'Match decisions',
  decisionMatchStatus: 'Match status',
  decisionNeedsReview: 'Needs review',
  decisionNotPersisted: 'Choices are temporary and are not saved',
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
  issues: [],
}

describe('CONTROL02 decision workspace', () => {
  it('renders the explicit match flow and locks exact targets', () => {
    const markup = renderToStaticMarkup(<DecisionWorkspace labels={labels} readOnly={false} rows={[row]} section="matches" />)

    expect(markup).toContain('Match decisions')
    expect(markup).toContain('Reuse employee')
    expect(markup).toContain('Exact match locked')
    expect(markup).toContain('Confirm')
    expect(markup).toContain('Choices are temporary and are not saved')
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
  })
})
