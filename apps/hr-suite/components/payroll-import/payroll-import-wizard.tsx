'use client'

import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { ScrollableTabs } from '@/components/patterns/scrollable-tabs'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { RadioGroup } from '@/components/ui/radio-group'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'

type PublicAnalysis = {
  sourceType: 'LOONAANGIFTE_XML' | 'INTERNAL_REPRESENTATIVE'
  sourceHash?: string
  readiness?: PayrollImportReadinessView
  sourceContext?: {
    status: 'SUPPORTED_READ_ONLY' | 'SOURCE_GAP' | 'REJECTED'
    taxYear?: number
    schemaVersion?: string
    namespaceUri?: string
    payrollTaxNumber?: string
    reportingPeriods: Array<{ startsOn: string; endsOn: string }>
    xsdValidation?: 'VALIDATED'
    diagnostics: Array<{ code: string }>
  }
  rows: Array<{
    sourceRowNumber: number
    externalEmployeeNumber?: string
    initials?: string
    prefix?: string
    firstName?: string
    birthName?: string
    significantSurnamePart?: string
    birthDate?: string
    gender?: string
    nationality?: string
    nationalityCode?: number
    genderCode?: number
    address?: Record<string, string>
    incomeRelationships: Array<{
      payrollTaxNumber: string
      ikvNumber: number
      startsOn?: string
      endsOn?: string
      sourcePeriods?: Array<{ startsOn: string; incomeCode: string; employmentRelationCode?: number; caoCode?: number }>
    }>
    status: 'GREEN' | 'WARNING' | 'BLOCKING'
    match: { status: string; reason?: string; employeeId?: string }
    issues: Array<{ code: string; severity: string; field?: string }>
  }>
  summary: { total: number; green: number; warnings: number; blocking: number; incomeRelationships: number; ambiguousMatches: number }
}

type Labels = Record<string, string>
type ReadinessStatus = 'READY' | 'WARNING' | 'BLOCKED' | 'NOT_REQUIRED'
type PayrollImportReadinessView = {
  status: ReadinessStatus
  isReady: boolean
  payrollTaxNumber: string | null
  checks: ReadonlyArray<{ key: string; status: ReadinessStatus; code?: string }>
}
type FinalizeReport = { employeesImported: number; employmentsCreated: number; incomeRelationshipsImported: number; warnings: string[] }
type RecoverableImport = {
  batchId: string
  status: string
  createdAt: string
  rows: Array<{
    rowNumber: number
    firstName: string | null
    birthName: string | null
    missingEmployment: boolean
    pendingIncomeCount: number
  }>
}

type DecisionEmployeeChoice = 'REUSE_EMPLOYEE' | 'CREATE_EMPLOYEE' | 'UNRESOLVED'
type DecisionEmploymentChoice = 'REUSE_EMPLOYMENT' | 'CREATE_DRAFT_EMPLOYMENT' | 'UNDECIDED'
type DecisionIncomeChoice = 'CREATE' | 'LINK' | 'NO_CHANGE' | 'UNDECIDED'
type DecisionSourceFieldChoice = 'USE_SOURCE' | 'KEEP_CURRENT' | 'MANUAL_REVIEW'
export type PayrollImportDecisionRow = PublicAnalysis['rows'][number]

type PayrollImportDecisionDraft = {
  match: { action: DecisionEmployeeChoice; employeeId?: string; confirmed: boolean }
  incomeRelationships: Record<string, { action: DecisionIncomeChoice; confirmed: boolean }>
  employments: Record<string, { action: DecisionEmploymentChoice; employmentId?: string; confirmed: boolean }>
  sourceFields: Record<string, DecisionSourceFieldChoice>
}

export type PayrollImportDecisionWorkspaceProps = {
  labels: Labels
  readOnly: boolean
  rows: readonly PayrollImportDecisionRow[]
  section: 'matches' | 'employment' | 'fields' | 'conflicts' | 'preview'
}

function decisionLabel(labels: Labels, key: string): string {
  return labels[key] ?? labels.error ?? key
}

function interpolateDecisionLabel(labels: Labels, key: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [name, value]) => result.replaceAll(`{${name}}`, String(value)), decisionLabel(labels, key))
}

function incomeDecisionKey(income: PayrollImportDecisionRow['incomeRelationships'][number]): string {
  return `${income.payrollTaxNumber}:${income.ikvNumber}:${income.startsOn ?? ''}`
}

function sourceRefForIncome(row: PayrollImportDecisionRow, income: PayrollImportDecisionRow['incomeRelationships'][number], index: number): string {
  return `row-${row.sourceRowNumber}:income-${index}:${incomeDecisionKey(income)}`
}

function sourceFieldsForRow(row: PayrollImportDecisionRow): string[] {
  const available: Array<[string, boolean]> = [
    ['firstName', Boolean(row.firstName)],
    ['birthName', Boolean(row.birthName)],
    ['birthDate', Boolean(row.birthDate)],
    ['gender', Boolean(row.gender)],
    ['nationality', Boolean(row.nationality)],
    ['address', Boolean(row.address && Object.keys(row.address).length > 0)],
  ]
  return available.filter(([, present]) => present).map(([field]) => field)
}

function initialDecisionDraft(row: PayrollImportDecisionRow): PayrollImportDecisionDraft {
  const action: DecisionEmployeeChoice = row.match.status === 'EXACT'
    ? 'REUSE_EMPLOYEE'
    : row.match.status === 'PROPOSED'
      ? (row.match.employeeId ? 'REUSE_EMPLOYEE' : 'UNRESOLVED')
    : row.match.status === 'NEW' ? 'CREATE_EMPLOYEE' : 'UNRESOLVED'
  const conflictingFields = new Set(row.issues.map((issue) => issue.field).filter((field): field is string => Boolean(field)))
  return {
    match: { action, ...(row.match.employeeId ? { employeeId: row.match.employeeId } : {}), confirmed: false },
    incomeRelationships: Object.fromEntries(row.incomeRelationships.map((income, index) => [sourceRefForIncome(row, income, index), { action: 'UNDECIDED', confirmed: false }])) as PayrollImportDecisionDraft['incomeRelationships'],
    employments: Object.fromEntries(row.incomeRelationships.map((income, index) => [sourceRefForIncome(row, income, index), { action: 'UNDECIDED', confirmed: false }])) as PayrollImportDecisionDraft['employments'],
    sourceFields: Object.fromEntries(sourceFieldsForRow(row).map((field) => [field, conflictingFields.has(field) ? 'MANUAL_REVIEW' : 'USE_SOURCE'])) as Record<string, DecisionSourceFieldChoice>,
  }
}

function decisionStatusClass(status: PayrollImportDecisionRow['status']): string {
  if (status === 'GREEN') return 'bg-success-subtle text-success'
  if (status === 'WARNING') return 'bg-warning-subtle text-warning'
  return 'bg-destructive-subtle text-destructive'
}

function issueLabel(labels: Labels, code: string): string {
  return decisionLabel(labels, `issue_${code}`)
}

function decisionEmployeeChoiceLabel(labels: Labels, choice: DecisionEmployeeChoice): string {
  return decisionLabel(labels, `decisionEmployee_${choice}`)
}

function decisionEmploymentChoiceLabel(labels: Labels, choice: DecisionEmploymentChoice): string {
  return decisionLabel(labels, `decisionEmployment_${choice}`)
}

function decisionIncomeChoiceLabel(labels: Labels, choice: DecisionIncomeChoice): string {
  return decisionLabel(labels, `decisionIncome_${choice}`)
}

function decisionSourceFieldChoiceLabel(labels: Labels, choice: DecisionSourceFieldChoice): string {
  return decisionLabel(labels, `decisionSourceField_${choice}`)
}

function decisionRowLabel(row: PayrollImportDecisionRow, labels: Labels): string {
  const name = [row.firstName, row.birthName].filter(Boolean).join(' ')
  return `${labels.row} ${row.sourceRowNumber}${name ? ` · ${name}` : ''}`
}

function decisionFieldLabel(labels: Labels, field: string): string {
  return decisionLabel(labels, `decisionField_${field}`)
}

function decisionSourceRefLabel(labels: Labels, sourceRef: string): string {
  return `${labels.decisionSourceRef}: ${sourceRef}`
}

function decisionIssueFields(row: PayrollImportDecisionRow): string[] {
  return [...new Set(row.issues.map((issue) => issue.field).filter((field): field is string => Boolean(field)))]
}

function decisionDraftIsComplete(row: PayrollImportDecisionRow, draft: PayrollImportDecisionDraft): boolean {
  if (!draft.match.confirmed || draft.match.action === 'UNRESOLVED') return false
  if (row.match.status === 'EXACT' && (draft.match.action !== 'REUSE_EMPLOYEE' || !draft.match.employeeId || draft.match.employeeId !== row.match.employeeId)) return false
  if (row.incomeRelationships.some((income, index) => {
    const sourceRef = sourceRefForIncome(row, income, index)
    const incomeDecision = draft.incomeRelationships[sourceRef]
    const employmentDecision = draft.employments[sourceRef]
    return !incomeDecision || !incomeDecision.confirmed || incomeDecision.action === 'UNDECIDED'
      || !employmentDecision || !employmentDecision.confirmed || employmentDecision.action === 'UNDECIDED'
  })) return false
  return sourceFieldsForRow(row).every((field) => draft.sourceFields[field] && draft.sourceFields[field] !== 'MANUAL_REVIEW')
}

function decisionBlockerCount(row: PayrollImportDecisionRow, draft: PayrollImportDecisionDraft): number {
  let blockers = 0
  if (!draft.match.confirmed || draft.match.action === 'UNRESOLVED') blockers += 1
  if (row.match.status === 'EXACT' && (!draft.match.employeeId || draft.match.employeeId !== row.match.employeeId)) blockers += 1
  blockers += row.incomeRelationships.reduce((count, income, index) => {
    const sourceRef = sourceRefForIncome(row, income, index)
    const incomeDecision = draft.incomeRelationships[sourceRef]
    const employmentDecision = draft.employments[sourceRef]
    return count + (!incomeDecision || !incomeDecision.confirmed || incomeDecision.action === 'UNDECIDED' ? 1 : 0)
      + (!employmentDecision || !employmentDecision.confirmed || employmentDecision.action === 'UNDECIDED' ? 1 : 0)
  }, 0)
  blockers += sourceFieldsForRow(row).filter((field) => !draft.sourceFields[field] || draft.sourceFields[field] === 'MANUAL_REVIEW').length
  return blockers
}

export function DecisionWorkspace({ labels, readOnly, rows, section }: PayrollImportDecisionWorkspaceProps) {
  const [drafts, setDrafts] = useState<Record<number, PayrollImportDecisionDraft>>(() => Object.fromEntries(rows.map((row) => [row.sourceRowNumber, initialDecisionDraft(row)])) as Record<number, PayrollImportDecisionDraft>)
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false)

  function updateDraft(row: PayrollImportDecisionRow, update: (draft: PayrollImportDecisionDraft) => PayrollImportDecisionDraft): void {
    setDrafts((current) => {
      const existing = current[row.sourceRowNumber] ?? initialDecisionDraft(row)
      return { ...current, [row.sourceRowNumber]: update(existing) }
    })
  }

  function setMatch(row: PayrollImportDecisionRow, action: DecisionEmployeeChoice): void {
    updateDraft(row, (draft) => ({
      ...draft,
      match: {
        action,
        ...(action === 'REUSE_EMPLOYEE' && row.match.employeeId ? { employeeId: row.match.employeeId } : {}),
        confirmed: action !== 'UNRESOLVED',
      },
    }))
  }

  function setIncome(row: PayrollImportDecisionRow, sourceRef: string, action: DecisionIncomeChoice): void {
    updateDraft(row, (draft) => ({
      ...draft,
      incomeRelationships: { ...draft.incomeRelationships, [sourceRef]: { action, confirmed: action !== 'UNDECIDED' } },
    }))
  }

  function setEmployment(row: PayrollImportDecisionRow, sourceRef: string, action: DecisionEmploymentChoice): void {
    updateDraft(row, (draft) => ({
      ...draft,
      employments: { ...draft.employments, [sourceRef]: { action, confirmed: action !== 'UNDECIDED' } },
    }))
  }

  function setField(row: PayrollImportDecisionRow, field: string, action: DecisionSourceFieldChoice): void {
    updateDraft(row, (draft) => ({ ...draft, sourceFields: { ...draft.sourceFields, [field]: action } }))
  }

  const resolvedRows = rows.filter((row) => drafts[row.sourceRowNumber])
  const completeRows = resolvedRows.filter((row) => decisionDraftIsComplete(row, drafts[row.sourceRowNumber]))
  const blockerCount = resolvedRows.reduce((count, row) => count + decisionBlockerCount(row, drafts[row.sourceRowNumber]), 0)
  const allDecisionsComplete = resolvedRows.length > 0 && completeRows.length === resolvedRows.length && reviewAcknowledged

  const sectionTitle = section === 'matches'
    ? labels.decisionMatchesTitle
    : section === 'employment'
      ? labels.decisionEmploymentTitle
      : section === 'fields'
        ? labels.decisionFieldsTitle
        : section === 'conflicts'
          ? labels.decisionConflictsTitle
          : labels.decisionPlanTitle
  const sectionDescription = section === 'matches'
    ? labels.decisionMatchesDescription
    : section === 'employment'
      ? labels.decisionEmploymentDescription
      : section === 'fields'
        ? labels.decisionFieldsDescription
        : section === 'conflicts'
          ? labels.decisionConflictsDescription
          : labels.decisionPlanDescription

  function renderMatchCard(row: PayrollImportDecisionRow): ReactNode {
    const draft = drafts[row.sourceRowNumber] ?? initialDecisionDraft(row)
    const exact = row.match.status === 'EXACT'
    const manualMatch = row.match.status === 'MANUAL_REVIEW'
    return <Surface className="space-y-4 p-4" key={row.sourceRowNumber} variant="subtle">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{decisionRowLabel(row, labels)}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{labels.decisionMatchStatus}: {labels[`match_${row.match.status}`] ?? row.match.status}{row.match.reason ? ` · ${row.match.reason}` : ''}</p>
        </div>
        <span className={`shrink-0 rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-semibold ${decisionStatusClass(row.status)}`}>{labels[`status_${row.status}`] ?? row.status}</span>
      </div>
      <RadioGroup
        aria-label={labels.decisionEmployeeChoice}
        disabled={readOnly}
        legend={labels.decisionEmployeeChoice}
        name={`employee-match-${row.sourceRowNumber}`}
        onValueChange={(value) => setMatch(row, value as DecisionEmployeeChoice)}
        options={[
          { disabled: (!row.match.employeeId && !exact) || row.match.status === 'NEW' || manualMatch, label: decisionEmployeeChoiceLabel(labels, 'REUSE_EMPLOYEE'), value: 'REUSE_EMPLOYEE' },
          { disabled: exact || manualMatch, label: decisionEmployeeChoiceLabel(labels, 'CREATE_EMPLOYEE'), value: 'CREATE_EMPLOYEE' },
          { disabled: exact, label: decisionEmployeeChoiceLabel(labels, 'UNRESOLVED'), value: 'UNRESOLVED' },
        ]}
        value={draft.match.action}
      />
      <Checkbox
        aria-label={`${labels.decisionConfirm} ${decisionRowLabel(row, labels)}`}
        checked={draft.match.confirmed}
        disabled={readOnly || draft.match.action === 'UNRESOLVED'}
        label={labels.decisionConfirm}
        onChange={(event) => updateDraft(row, (current) => ({ ...current, match: { ...current.match, confirmed: event.target.checked } }))}
      />
      {exact ? <p className="rounded-[var(--radius-control)] bg-info-surface p-3 text-xs text-foreground" role="status">{labels.decisionExactMatchLocked}</p> : null}
    </Surface>
  }

  function renderEmploymentCard(row: PayrollImportDecisionRow): ReactNode {
    const draft = drafts[row.sourceRowNumber] ?? initialDecisionDraft(row)
    return <Surface className="space-y-4 p-4" key={row.sourceRowNumber} variant="subtle">
      <div><h3 className="text-sm font-semibold">{decisionRowLabel(row, labels)}</h3><p className="mt-1 text-xs text-muted-foreground">{interpolateDecisionLabel(labels, 'decisionIkvCount', { count: row.incomeRelationships.length })}</p></div>
      <div className="space-y-4">
        {row.incomeRelationships.map((income, index) => {
          const sourceRef = sourceRefForIncome(row, income, index)
          const incomeDecision = draft.incomeRelationships[sourceRef] ?? { action: 'UNDECIDED' as const, confirmed: false }
          const employmentDecision = draft.employments[sourceRef] ?? { action: 'UNDECIDED' as const, confirmed: false }
          return <div className="space-y-4 rounded-[var(--radius-control)] border border-border bg-surface p-4" key={sourceRef}>
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold">{labels.xmlIkvNumber} {income.ikvNumber} · {income.payrollTaxNumber}</p><p className="mt-1 text-xs text-muted-foreground">{income.startsOn ?? labels.emptyValue}{income.endsOn ? ` – ${income.endsOn}` : ''}</p></div><span className="rounded-[var(--radius-control)] bg-surface-subtle px-2 py-1 text-xs text-muted-foreground">{decisionSourceRefLabel(labels, sourceRef)}</span></div>
            <RadioGroup
              aria-label={`${labels.decisionIncomeChoice} ${income.ikvNumber}`}
              disabled={readOnly}
              legend={labels.decisionIncomeChoice}
              name={`income-decision-${sourceRef}`}
              onValueChange={(value) => setIncome(row, sourceRef, value as DecisionIncomeChoice)}
              options={[
                { label: decisionIncomeChoiceLabel(labels, 'CREATE'), value: 'CREATE' },
                { disabled: true, label: decisionIncomeChoiceLabel(labels, 'LINK'), value: 'LINK' },
                { label: decisionIncomeChoiceLabel(labels, 'NO_CHANGE'), value: 'NO_CHANGE' },
                { label: decisionIncomeChoiceLabel(labels, 'UNDECIDED'), value: 'UNDECIDED' },
              ]}
              value={incomeDecision.action}
            />
            <RadioGroup
              aria-label={`${labels.decisionEmploymentChoice} ${income.ikvNumber}`}
              disabled={readOnly}
              legend={labels.decisionEmploymentChoice}
              name={`employment-decision-${sourceRef}`}
              onValueChange={(value) => setEmployment(row, sourceRef, value as DecisionEmploymentChoice)}
              options={[
                { disabled: true, label: decisionEmploymentChoiceLabel(labels, 'REUSE_EMPLOYMENT'), value: 'REUSE_EMPLOYMENT' },
                { label: decisionEmploymentChoiceLabel(labels, 'CREATE_DRAFT_EMPLOYMENT'), value: 'CREATE_DRAFT_EMPLOYMENT' },
                { label: decisionEmploymentChoiceLabel(labels, 'UNDECIDED'), value: 'UNDECIDED' },
              ]}
              value={employmentDecision.action}
            />
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><span>{incomeDecision.confirmed ? labels.decisionConfirmed : labels.decisionNeedsReview}</span><span>{employmentDecision.confirmed ? labels.decisionConfirmed : labels.decisionNeedsReview}</span></div>
          </div>
        })}
      </div>
    </Surface>
  }

  function renderFieldCard(row: PayrollImportDecisionRow): ReactNode {
    const draft = drafts[row.sourceRowNumber] ?? initialDecisionDraft(row)
    const fields = sourceFieldsForRow(row)
    return <Surface className="space-y-4 p-4" key={row.sourceRowNumber} variant="subtle">
      <div><h3 className="text-sm font-semibold">{decisionRowLabel(row, labels)}</h3><p className="mt-1 text-xs text-muted-foreground">{labels.decisionFieldsDescription}</p></div>
      {fields.length ? fields.map((field) => <RadioGroup
        aria-label={`${labels.decisionFieldChoice} ${decisionFieldLabel(labels, field)}`}
        className="border-t border-border pt-3 first:border-0 first:pt-0"
        disabled={readOnly}
        key={field}
        legend={decisionFieldLabel(labels, field)}
        name={`source-field-${row.sourceRowNumber}-${field}`}
        onValueChange={(value) => setField(row, field, value as DecisionSourceFieldChoice)}
        options={[
          { label: decisionSourceFieldChoiceLabel(labels, 'USE_SOURCE'), value: 'USE_SOURCE' },
          { label: decisionSourceFieldChoiceLabel(labels, 'KEEP_CURRENT'), value: 'KEEP_CURRENT' },
          { label: decisionSourceFieldChoiceLabel(labels, 'MANUAL_REVIEW'), value: 'MANUAL_REVIEW' },
        ]}
        value={draft.sourceFields[field]}
      />) : <p className="text-sm text-muted-foreground">{labels.decisionNoSourceFields}</p>}
    </Surface>
  }

  function renderConflictCard(row: PayrollImportDecisionRow): ReactNode {
    const fields = decisionIssueFields(row)
    return <Surface className="space-y-3 p-4" key={row.sourceRowNumber} variant="subtle">
      <h3 className="text-sm font-semibold">{decisionRowLabel(row, labels)}</h3>
      {row.issues.length ? <ul className="space-y-2">{row.issues.map((issue, index) => <li className="flex flex-wrap items-start gap-2 text-sm" key={`${issue.code}-${index}`}><span className={`rounded-[var(--radius-control)] px-2 py-1 text-xs font-semibold ${issue.severity === 'BLOCKING' ? 'bg-destructive-subtle text-destructive' : 'bg-warning-subtle text-warning'}`}>{issue.severity}</span><span>{issueLabel(labels, issue.code)}{issue.field ? ` · ${decisionFieldLabel(labels, issue.field)}` : ''}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">{labels.decisionNoConflicts}</p>}
      {fields.length ? <p className="rounded-[var(--radius-control)] bg-warning-subtle p-3 text-xs text-warning">{labels.decisionConflictFieldsNotice}</p> : null}
    </Surface>
  }

  function renderPlan(): ReactNode {
    return <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-control)] bg-surface-subtle p-3"><p className="text-xs text-muted-foreground">{labels.decisionPeople}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{rows.length}</p></div>
        <div className="rounded-[var(--radius-control)] bg-surface-subtle p-3"><p className="text-xs text-muted-foreground">{labels.decisionComplete}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{completeRows.length}</p></div>
        <div className="rounded-[var(--radius-control)] bg-surface-subtle p-3"><p className="text-xs text-muted-foreground">{labels.decisionBlockers}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{blockerCount}</p></div>
      </div>
      <div className={`rounded-[var(--radius-control)] p-4 ${allDecisionsComplete ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}`} role="status"><p className="text-sm font-semibold">{allDecisionsComplete ? labels.decisionReady : labels.decisionNeedsReview}</p><p className="mt-1 text-sm">{allDecisionsComplete ? labels.decisionPlanReady : interpolateDecisionLabel(labels, 'decisionPlanBlockers', { count: blockerCount })}</p></div>
      <Checkbox checked={reviewAcknowledged} disabled={readOnly} label={labels.decisionReviewAcknowledgement} onChange={(event) => setReviewAcknowledged(event.target.checked)} />
      <div className="space-y-2 rounded-[var(--radius-control)] border border-border p-4"><p className="text-sm font-semibold">{labels.decisionAuditTitle}</p><p className="text-sm text-muted-foreground">{labels.decisionAuditDescription}</p><p className="text-sm text-muted-foreground">{labels.decisionIdempotencyDescription}</p></div>
      <p className="rounded-[var(--radius-control)] border border-border bg-surface-subtle p-4 text-sm text-muted-foreground" role="status">{labels.decisionFinalizationDisabled}</p>
    </div>
  }

  const sectionRows = section === 'conflicts' ? resolvedRows.filter((row) => row.issues.length > 0) : resolvedRows
  return <section aria-labelledby="payroll-decision-workspace" className="space-y-4 border-t border-border pt-5">
    <div><h2 className="text-lg font-semibold" id="payroll-decision-workspace">{sectionTitle}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{sectionDescription}</p></div>
    <p className="rounded-[var(--radius-control)] border border-warning/30 bg-warning-subtle p-4 text-sm text-warning" role="status">{labels.decisionNotPersisted}</p>
    {section === 'preview' ? renderPlan() : sectionRows.length ? <div className="space-y-3">{sectionRows.map((row) => section === 'matches' ? renderMatchCard(row) : section === 'employment' ? renderEmploymentCard(row) : section === 'fields' ? renderFieldCard(row) : renderConflictCard(row))}</div> : <p className="rounded-[var(--radius-control)] bg-surface-subtle p-4 text-sm text-muted-foreground">{labels.decisionNoConflicts}</p>}
  </section>
}

const stepKeys = ['stepExplanation', 'stepPreflight', 'stepFile', 'stepAnalyze', 'stepEmployer', 'stepPeople', 'stepSelect', 'stepPerson', 'stepConflicts', 'stepPreview', 'stepFinal', 'stepReport'] as const

function readinessTone(status: ReadinessStatus): string {
  if (status === 'READY') return 'bg-success-subtle text-success'
  if (status === 'WARNING') return 'bg-warning-subtle text-warning'
  if (status === 'BLOCKED') return 'bg-destructive-subtle text-destructive'
  return 'bg-surface-subtle text-muted-foreground'
}

function readinessLabel(status: ReadinessStatus, labels: Labels): string {
  if (status === 'READY') return labels.readinessReady
  if (status === 'WARNING') return labels.readinessWarning
  if (status === 'BLOCKED') return labels.readinessBlocked
  return labels.readinessNotRequired
}

function readinessCheckStatusLabel(status: ReadinessStatus, labels: Labels): string {
  if (status === 'READY') return labels.readinessCheckStatusReady
  if (status === 'WARNING') return labels.readinessCheckStatusWarning
  if (status === 'BLOCKED') return labels.readinessCheckStatusBlocked
  return labels.readinessCheckStatusNotRequired
}

export function PayrollImportWizard({ administrationId, labels, initialReadiness, initialReadinessError, initialRecoverableImports, initialRecoveryError }: {
  administrationId: string | null
  labels: Labels
  initialReadiness: PayrollImportReadinessView | null
  initialReadinessError: boolean
  initialRecoverableImports: RecoverableImport[]
  initialRecoveryError: boolean
}) {
  const [step, setStep] = useState(0)
  const [sourceType, setSourceType] = useState<'LOONAANGIFTE_XML' | 'INTERNAL_REPRESENTATIVE'>('INTERNAL_REPRESENTATIVE')
  const [file, setFile] = useState<File | null>(null)
  const [taxYear, setTaxYear] = useState('2026')
  const [periodStart, setPeriodStart] = useState('2026-01-01')
  const [periodEnd, setPeriodEnd] = useState('2026-12-31')
  const [analysis, setAnalysis] = useState<PublicAnalysis | null>(null)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [report, setReport] = useState<FinalizeReport | null>(null)
  const [recoverableImports, setRecoverableImports] = useState(initialRecoverableImports)
  const [recoveryError] = useState(initialRecoveryError)
  const [recoverySelectionBatchId, setRecoverySelectionBatchId] = useState<string | null>(null)
  const [isRecovery, setIsRecovery] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canContinue = Boolean(administrationId && file)
  const selected = useMemo(() => new Set(selectedRows), [selectedRows])
  const isXmlPreview = !isRecovery && analysis?.sourceType === 'LOONAANGIFTE_XML'
  const decisionSection: PayrollImportDecisionWorkspaceProps['section'] = step <= 4
    ? 'matches'
    : step === 5
      ? 'employment'
      : step === 6
        ? 'fields'
        : step === 7
          ? 'conflicts'
          : 'preview'

  function setFileFromEvent(event: ChangeEvent<HTMLInputElement>): void {
    setFile(event.target.files?.[0] ?? null)
    setError(null)
  }

  async function analyze(): Promise<void> {
    if (!file || !administrationId) {
      setError(labels.error)
      return
    }
    setPending(true)
    setError(null)
    const form = new FormData()
    form.set('file', file)
    form.set('sourceType', sourceType)
    form.set('taxYear', taxYear)
    form.set('periodStart', periodStart)
    form.set('periodEnd', periodEnd)
    form.set('administrationId', administrationId)
    try {
      const response = await fetch('/api/payroll/import/analyze', { method: 'POST', body: form })
      const payload = await response.json() as { data?: PublicAnalysis; error?: string }
      if (!response.ok || !payload.data) {
        setError(payload.error === 'REAL_XML_PENDING' ? labels.xmlFinalizationPending : payload.error === 'CONVERGENCE_REQUIRED' ? labels.convergenceRequired : labels.error)
        return
      }
      setAnalysis(payload.data)
      setSelectedRows(payload.data.sourceType === 'LOONAANGIFTE_XML' ? [] : payload.data.rows.filter((row) => row.status !== 'BLOCKING' && row.match.status !== 'MANUAL_REVIEW').map((row) => row.sourceRowNumber))
      setStep(payload.data.sourceType === 'LOONAANGIFTE_XML' ? 9 : 4)
    } catch {
      setError(labels.error)
    } finally {
      setPending(false)
    }
  }

  async function stage(): Promise<void> {
    if (analysis?.sourceType === 'LOONAANGIFTE_XML') {
      setError(labels.xmlReadOnlyError)
      return
    }
    if (!file || !administrationId) return
    setPending(true)
    setError(null)
    const form = new FormData()
    form.set('file', file)
    form.set('sourceType', sourceType)
    form.set('taxYear', taxYear)
    form.set('periodStart', periodStart)
    form.set('periodEnd', periodEnd)
    form.set('administrationId', administrationId)
    try {
      const response = await fetch('/api/payroll/import/stage', { method: 'POST', body: form })
      const payload = await response.json() as { data?: { batchId: string; analysis: PublicAnalysis }; error?: string }
      if (!response.ok || !payload.data) {
        setError(payload.error === 'CONVERGENCE_REQUIRED' ? labels.convergenceRequired : labels.error)
        return
      }
      setIsRecovery(false)
      setBatchId(payload.data.batchId)
      setAnalysis(payload.data.analysis)
      setStep(10)
    } catch {
      setError(labels.error)
    } finally {
      setPending(false)
    }
  }

  async function finalize(): Promise<void> {
    if (analysis?.sourceType === 'LOONAANGIFTE_XML') {
      setError(labels.xmlReadOnlyError)
      return
    }
    if (!batchId || !administrationId) return
    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/payroll/import/finalize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ batchId, administrationId, selectedRowNumbers: selectedRows }) })
      const payload = await response.json() as { data?: FinalizeReport; error?: string }
      if (!response.ok || !payload.data) {
        setError(payload.error === 'CONVERGENCE_REQUIRED' ? labels.convergenceRequired : labels.error)
        return
      }
      setReport(payload.data)
      setStep(11)
      if (isRecovery && administrationId) {
        setRecoverableImports((current) => current.flatMap((batch) => {
          if (batch.batchId !== batchId) return [batch]
          const rows = batch.rows.filter((row) => !selectedRows.includes(row.rowNumber))
          return rows.length > 0 ? [{ ...batch, rows }] : []
        }))
      }
    } catch {
      setError(labels.error)
    } finally {
      setPending(false)
    }
  }

  function toggleRow(rowNumber: number): void {
    setSelectedRows((current) => current.includes(rowNumber) ? current.filter((value) => value !== rowNumber) : [...current, rowNumber])
  }

  function toggleRecoveryRow(batchId: string, rowNumber: number): void {
    if (recoverySelectionBatchId !== batchId) {
      setRecoverySelectionBatchId(batchId)
      setSelectedRows([rowNumber])
      return
    }
    toggleRow(rowNumber)
  }

  function beginRecovery(batch: RecoverableImport): void {
    if (recoverySelectionBatchId !== batch.batchId || selectedRows.length === 0) return
    setAnalysis(null)
    setBatchId(batch.batchId)
    setIsRecovery(true)
    setReport(null)
    setError(null)
    setStep(10)
  }

  return <div className="space-y-6">
    <Surface className="p-3"><ScrollableTabs ariaLabel={labels.title} leftLabel={labels.previousSteps} rightLabel={labels.nextSteps}><ol aria-label={labels.title} className="m-0 flex min-w-max list-none gap-2 p-0">{stepKeys.map((key, index) => <li aria-current={index === step ? 'step' : undefined} className={`rounded-[var(--radius-control)] px-3 py-2 text-xs font-medium ${index === step ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`} key={key}>{index + 1}. {labels[key]}</li>)}</ol></ScrollableTabs></Surface>
    <Surface className="p-5 sm:p-7">
      {step === 0 ? <div className="space-y-5"><p className="text-sm leading-6 text-muted-foreground">{labels.description}</p>{initialReadiness ? <section aria-labelledby="payroll-readiness-heading" className="space-y-4 rounded-[var(--radius-control)] border border-border p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-base font-semibold" id="payroll-readiness-heading">{labels.readinessTitle}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.readinessDescription}</p></div><span aria-label={`${labels.readinessStatus}: ${readinessLabel(initialReadiness.status, labels)}`} className={`shrink-0 rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-semibold ${readinessTone(initialReadiness.status)}`} role="status">{readinessLabel(initialReadiness.status, labels)}</span></div><div className="grid gap-2 sm:grid-cols-2">{initialReadiness.checks.map((check) => <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] bg-surface-subtle px-3 py-2 text-sm" key={check.key}><span className="min-w-0">{labels[`readinessCheck_${check.key}`] ?? labels.readinessUnknownCheck}</span><span className={`shrink-0 rounded-[var(--radius-control)] px-2 py-1 text-xs font-medium ${readinessTone(check.status)}`}>{readinessCheckStatusLabel(check.status, labels)}</span></div>)}</div>{initialReadiness.payrollTaxNumber ? <p className="text-sm text-muted-foreground">{labels.readinessPayrollTaxNumber}: <span className="font-medium text-foreground">{initialReadiness.payrollTaxNumber}</span></p> : null}</section> : initialReadinessError ? <p className="rounded-[var(--radius-control)] bg-destructive-subtle p-3 text-sm text-destructive" role="alert">{labels.readinessReadError}</p> : null}<p className="rounded-[var(--radius-control)] bg-surface-subtle p-4 text-sm text-muted-foreground">{labels.previewNoWrites}</p>{recoveryError ? <p className="rounded-[var(--radius-control)] bg-destructive-subtle p-3 text-sm text-destructive" role="alert">{labels.recoverReadError}</p> : null}{recoverableImports.length > 0 ? <section aria-labelledby="payroll-recovery-heading" className="space-y-3 border-t border-border pt-5"><div><h2 className="text-base font-semibold" id="payroll-recovery-heading">{labels.recoverTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.recoverDescription}</p></div>{recoverableImports.map((batch) => <div className="space-y-3 rounded-[var(--radius-control)] border border-border p-4" key={batch.batchId}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{labels.recoverBatch} · {new Date(batch.createdAt).toLocaleString()}</p><p className="text-xs text-muted-foreground">{batch.status}</p></div><div className="space-y-2">{batch.rows.map((row) => <label className="flex items-start gap-3 rounded-[var(--radius-control)] bg-surface-subtle p-3 text-sm" key={row.rowNumber}><input checked={recoverySelectionBatchId === batch.batchId && selected.has(row.rowNumber)} onChange={() => toggleRecoveryRow(batch.batchId, row.rowNumber)} type="checkbox" /><span><span className="font-medium">{row.rowNumber} · {row.firstName ?? labels.emptyValue} {row.birthName ?? ''}</span><span className="mt-1 block text-xs text-muted-foreground">{row.missingEmployment ? labels.recoverMissingEmployment : ''}{row.missingEmployment && row.pendingIncomeCount > 0 ? ' · ' : ''}{row.pendingIncomeCount > 0 ? labels.recoverPendingIncome.replace('{count}', String(row.pendingIncomeCount)) : ''}</span></span></label>)}</div><Button disabled={recoverySelectionBatchId !== batch.batchId || selectedRows.length === 0} onClick={() => beginRecovery(batch)} type="button">{labels.recoverResume}</Button></div>)}</section> : null}<Button onClick={() => setStep(1)} type="button">{labels.next}</Button></div> : null}
      {step === 1 ? <div className="space-y-4"><p className="text-sm text-muted-foreground">{administrationId ? labels.stepPreflight : labels.noActiveAdministration}</p><Button disabled={!administrationId} onClick={() => setStep(2)} type="button">{labels.next}</Button></div> : null}
      {step === 2 ? <div className="space-y-5"><label className="block text-sm font-medium">{labels.sourceType}<DropdownSelect className="mt-2" onChange={(event) => setSourceType(event.target.value as typeof sourceType)} searchable value={sourceType}><option value="INTERNAL_REPRESENTATIVE">{labels.internalRepresentative}</option><option value="LOONAANGIFTE_XML">{labels.loonaangifteXml}</option></DropdownSelect></label><label className="block text-sm font-medium">{labels.file}<TextInput className="mt-2" onChange={setFileFromEvent} type="file" /></label><p className="text-sm leading-6 text-muted-foreground">{labels.fixtureHint}</p><Button disabled={!file} onClick={() => setStep(3)} type="button">{labels.next}</Button></div> : null}
      {step === 3 ? <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-3"><label className="block text-sm font-medium">{labels.taxYear}<TextInput className="mt-2" inputMode="numeric" onChange={(event) => setTaxYear(event.target.value)} value={taxYear} /></label><label className="block text-sm font-medium">{labels.periodStart}<TextInput className="mt-2" onChange={(event) => setPeriodStart(event.target.value)} type="date" value={periodStart} /></label><label className="block text-sm font-medium">{labels.periodEnd}<TextInput className="mt-2" onChange={(event) => setPeriodEnd(event.target.value)} type="date" value={periodEnd} /></label></div><Button disabled={!canContinue} loading={pending} onClick={analyze} type="button">{pending ? labels.analyzing : labels.analyze}</Button></div> : null}
      {step >= 4 && step <= 9 && analysis ? <div className="space-y-5">
        <h2 className="text-xl font-semibold">{labels.analysisTitle}</h2>
        {isXmlPreview ? <div className="rounded-[var(--radius-control)] border border-border bg-surface-subtle p-4" role="status"><p className="text-sm font-semibold">{labels.xmlPreviewTitle}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.xmlPreviewDescription}</p></div> : <p className="text-sm text-muted-foreground">{labels.previewNoWrites}</p>}
        {isXmlPreview && analysis.sourceContext ? <section aria-labelledby="xml-source-details" className="space-y-3 rounded-[var(--radius-control)] border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold" id="xml-source-details">{labels.xmlSourceDetails}</h3><span className="rounded-[var(--radius-control)] bg-surface-subtle px-2.5 py-1 text-xs font-medium">{labels[`xmlParseStatus_${analysis.sourceContext.status}`] ?? labels.xmlParseStatusUnknown}</span></div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {analysis.sourceContext.taxYear ? <div><dt className="text-xs text-muted-foreground">{labels.taxYear}</dt><dd className="mt-1 font-medium">{analysis.sourceContext.taxYear}</dd></div> : null}
            {analysis.sourceContext.schemaVersion ? <div><dt className="text-xs text-muted-foreground">{labels.xmlSchemaVersion}</dt><dd className="mt-1 font-medium">{analysis.sourceContext.schemaVersion}</dd></div> : null}
            {analysis.sourceContext.payrollTaxNumber ? <div><dt className="text-xs text-muted-foreground">{labels.xmlPayrollTaxNumber}</dt><dd className="mt-1 font-medium">{analysis.sourceContext.payrollTaxNumber}</dd></div> : null}
            <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs text-muted-foreground">{labels.xmlReportingPeriods}</dt><dd className="mt-1">{analysis.sourceContext.reportingPeriods.length ? analysis.sourceContext.reportingPeriods.map((period, index) => <span className="mr-3 inline-block" key={`${period.startsOn}-${index}`}>{period.startsOn} – {period.endsOn}</span>) : labels.xmlNoReportingPeriods}</dd></div>
          </dl>
          {analysis.sourceContext.xsdValidation === 'VALIDATED' ? <p className="rounded-[var(--radius-control)] bg-success-surface p-3 text-sm text-success" role="status">{labels.xmlXsdValidated}</p> : null}
          {analysis.sourceContext.diagnostics.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">{analysis.sourceContext.diagnostics.map(({ code }, index) => <li key={`${code}-${index}`}>{labels[`xmlDiagnostic_${code}`] ?? labels.xmlDiagnosticUnknown}</li>)}</ul> : null}
        </section> : null}
        {isXmlPreview && analysis.readiness ? <section aria-labelledby="xml-readiness-heading" className="space-y-3 rounded-[var(--radius-control)] border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold" id="xml-readiness-heading">{labels.readinessTitle}</p><span aria-label={`${labels.readinessStatus}: ${readinessLabel(analysis.readiness.status, labels)}`} className={`shrink-0 rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-semibold ${readinessTone(analysis.readiness.status)}`} role="status">{readinessLabel(analysis.readiness.status, labels)}</span></div>
          <div className="grid gap-2 sm:grid-cols-2">{analysis.readiness.checks.map((check, index) => <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] bg-surface-subtle px-3 py-2 text-sm" key={`${check.key}-${index}`}><span className="min-w-0">{labels[`readinessCheck_${check.key}`] ?? labels.readinessUnknownCheck}{check.code ? <span className="mt-1 block text-xs text-muted-foreground">{labels[`readinessCode_${check.code}`] ?? labels.readinessCodeUnknown}</span> : null}</span><span className={`shrink-0 rounded-[var(--radius-control)] px-2 py-1 text-xs font-medium ${readinessTone(check.status)}`}>{readinessCheckStatusLabel(check.status, labels)}</span></div>)}</div>
          {analysis.readiness.payrollTaxNumber ? <p className="text-sm text-muted-foreground">{labels.xmlPayrollTaxNumber}: <span className="font-medium text-foreground">{analysis.readiness.payrollTaxNumber}</span></p> : null}
        </section> : null}
        <div className="grid gap-3 sm:grid-cols-4">{([[labels.total, analysis.summary.total], [labels.green, analysis.summary.green], [labels.warnings, analysis.summary.warnings], [labels.blocking, analysis.summary.blocking]] as const).map(([label, value]) => <div className="rounded-[var(--radius-control)] bg-surface-subtle p-3" key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>)}</div>
        {isXmlPreview ? <section aria-labelledby="xml-identity-source-heading" className="space-y-2 rounded-[var(--radius-control)] border border-border p-4">
          <h3 className="text-sm font-semibold" id="xml-identity-source-heading">{labels.xmlIdentitySourceFields}</h3>
          <ul className="space-y-2 text-sm">{analysis.rows.map((row) => <li className="flex flex-wrap gap-x-3 gap-y-1" key={row.sourceRowNumber}><span className="font-medium">{labels.row} {row.sourceRowNumber}</span>{row.significantSurnamePart ? <span className="text-muted-foreground">{labels.xmlSignificantSurnamePart}: {row.significantSurnamePart}</span> : null}{row.nationalityCode !== undefined ? <span className="text-muted-foreground">{labels.xmlNationalityCode}: {row.nationalityCode}</span> : null}{row.genderCode !== undefined ? <span className="text-muted-foreground">{labels.xmlGenderCode}: {row.genderCode}</span> : null}</li>)}</ul>
        </section> : null}
        <div className="overflow-x-auto"><table className={`w-full text-left text-sm ${isXmlPreview ? 'min-w-[880px]' : 'min-w-[720px]'}`}><thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground"><tr>{isXmlPreview ? null : <th className="px-2 py-3">{labels.select}</th>}<th className="px-2 py-3">{labels.row}</th>{isXmlPreview ? <th className="px-2 py-3">{labels.xmlIncomeRelationships}</th> : null}<th className="px-2 py-3">{labels.status}</th><th className="px-2 py-3">{labels.match}</th><th className="px-2 py-3">{labels.issues}</th></tr></thead><tbody className="divide-y divide-border">{analysis.rows.map((row) => <tr key={row.sourceRowNumber}>{isXmlPreview ? null : <td className="px-2 py-3"><input aria-label={`${labels.select} ${row.sourceRowNumber}`} checked={selected.has(row.sourceRowNumber)} disabled={row.status === 'BLOCKING' || row.match.status === 'MANUAL_REVIEW'} onChange={() => toggleRow(row.sourceRowNumber)} type="checkbox" /></td>}<td className="px-2 py-3">{row.sourceRowNumber} · {row.firstName ?? row.initials ?? labels.emptyValue} {row.birthName ?? ''}</td>{isXmlPreview ? <td className="px-2 py-3"><ul className="space-y-2">{row.incomeRelationships.map((income, index) => <li className="space-y-1" key={`${row.sourceRowNumber}-${index}`}><p className="font-medium">{labels.xmlPayrollTaxNumber}: {income.payrollTaxNumber} · {labels.xmlIkvNumber}: {income.ikvNumber}</p><p className="text-xs text-muted-foreground">{labels.xmlStartsOn}: {income.startsOn ?? labels.emptyValue}{income.endsOn ? ` · ${labels.xmlEndsOn}: ${income.endsOn}` : ''}</p>{income.sourcePeriods?.map((period, periodIndex) => <p className="text-xs text-muted-foreground" key={`${period.startsOn}-${periodIndex}`}>{labels.xmlIncomePeriod}: {period.startsOn} · {labels.xmlIncomeCode}: {period.incomeCode}</p>)}</li>)}</ul></td> : null}<td className="px-2 py-3">{labels[`status_${row.status}`] ?? row.status}</td><td className="px-2 py-3">{labels[`match_${row.match.status}`] ?? row.match.status}</td><td className="px-2 py-3">{row.issues.map((item) => labels[`issue_${item.code}`] ?? labels.unknownWarning).join(', ') || labels.emptyValue}</td></tr>)}</tbody></table></div>
        {!isXmlPreview ? <DecisionWorkspace key={analysis.sourceHash ?? analysis.rows.map((row) => `${row.sourceRowNumber}:${row.match.status}:${row.incomeRelationships.length}`).join('|')} labels={labels} readOnly={false} rows={analysis.rows} section={decisionSection} /> : null}
        <div className="flex flex-wrap items-center gap-3"><Button variant="secondary" onClick={() => setStep(Math.max(0, step - 1))} type="button">{labels.back}</Button>{step === 9 && isXmlPreview ? <p className="min-w-0 flex-1 text-sm text-muted-foreground" role="status">{labels.xmlReadOnlyNotice}</p> : <Button loading={pending} onClick={() => step === 9 ? stage() : setStep(step + 1)} type="button">{step === 9 ? labels.confirmPreview : labels.next}</Button>}</div>
      </div> : null}
      {step === 10 && (analysis || isRecovery) ? isXmlPreview ? <div className="space-y-5"><p className="rounded-[var(--radius-control)] border border-border bg-surface-subtle p-4 text-sm text-muted-foreground" role="status">{labels.xmlReadOnlyNotice}</p><Button variant="secondary" onClick={() => setStep(9)} type="button">{labels.back}</Button></div> : <div className="space-y-5">{isRecovery ? <><p className="rounded-[var(--radius-control)] bg-warning-subtle p-4 text-sm text-warning">{labels.recoverFinalizationNotice.replace('{count}', String(selectedRows.length))}</p><p className="text-sm text-muted-foreground">{labels.previewNoWrites}</p></> : <><p className="rounded-[var(--radius-control)] bg-success-subtle p-4 text-sm text-success">{labels.staged}</p><p className="text-sm text-muted-foreground">{labels.previewNoWrites}</p></>}<Button loading={pending} onClick={finalize} type="button">{pending ? labels.finalizing : labels.finalize}</Button></div> : null}
      {step === 11 && report ? <div className="space-y-5"><h2 className="text-xl font-semibold">{labels.reportTitle}</h2><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-[var(--radius-control)] bg-surface-subtle p-3"><p className="text-xs text-muted-foreground">{labels.employeesImported}</p><p className="mt-1 text-2xl font-semibold">{report.employeesImported}</p></div><div className="rounded-[var(--radius-control)] bg-surface-subtle p-3"><p className="text-xs text-muted-foreground">{labels.employmentsCreated}</p><p className="mt-1 text-2xl font-semibold">{report.employmentsCreated}</p></div><div className="rounded-[var(--radius-control)] bg-surface-subtle p-3"><p className="text-xs text-muted-foreground">{labels.incomeRelationshipsImported}</p><p className="mt-1 text-2xl font-semibold">{report.incomeRelationshipsImported}</p></div></div><h3 className="font-semibold">{labels.warningsTitle}</h3>{report.warnings.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noWarnings}</p> : <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{report.warnings.map((warning) => { const match = /^ROW_(\d+)_(.+)$/.exec(warning); const template = labels[`warning_${match?.[2] ?? warning}`] ?? labels.unknownWarning; return <li key={warning}>{template.replace('{row}', match?.[1] ?? '')}</li> })}</ul>}</div> : null}
      {error ? <p className="mt-5 rounded-[var(--radius-control)] bg-destructive-subtle px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
    </Surface>
  </div>
}
