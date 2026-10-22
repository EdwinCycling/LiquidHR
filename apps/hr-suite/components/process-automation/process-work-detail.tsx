'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Locale } from '@/lib/i18n/config'
import type { FormProjection } from '@/lib/process-automation/form-runtime'
import type { ProcessAutomationOperations, ProcessOutputProjection } from '@/lib/process-automation/output-service'
import { processOutputSummaryText } from '@/lib/process-automation/process-output-summary'
import type { ProcessWorkAssignmentOption, ProcessWorkDetail, ProcessWorkExperience } from '@/lib/process-automation/work-service'
import { Button, buttonClasses } from '../ui/button'
import { DropdownSelect } from '../ui/dropdown-select'
import { Textarea } from '../ui/textarea'
import { ConfirmDialog } from '../patterns/confirm-dialog'
import { FormField } from '../patterns/form-field'
import { FormRuntimeRenderer, type FormRuntimeServerFieldError } from './form-runtime-renderer'
import { InternalTransferCommitPanel } from './internal-transfer-commit-panel'

export interface ProcessWorkDetailLabels {
  readonly process: string
  readonly subject: string
  readonly step: string
  readonly status: string
  readonly assignment: string
  readonly assignmentMode: string
  readonly assignmentSource: string
  readonly assignmentDate: string
  readonly assignmentRole: string
  readonly progress: string
  readonly timeline: string
  readonly form: string
  readonly output: string
  readonly deadline: string
  readonly overdue: string
  readonly availableAt: string
  readonly claimedBy: string
  readonly unassigned: string
  readonly claim: string
  readonly release: string
  readonly reassign: string
  readonly reResolve: string
  readonly reassignEmployee: string
  readonly reassignSubmit: string
  readonly assignmentOptionsEmpty: string
  readonly backToWork: string
  readonly action: string
  readonly success: string
  readonly stale: string
  readonly denied: string
  readonly blocked: string
  readonly errorClaimRace: string
  readonly errorStale: string
  readonly errorDenied: string
  readonly errorBlocked: string
  readonly errorGeneric: string
  readonly unknown: string
  readonly download: string
  readonly downloadUnavailable: string
  readonly outputPending: string
  readonly outputAvailable: string
  readonly outputFailed: string
  readonly operations: string
  readonly lastAttempt: string
  readonly recovery: string
  readonly retry: string
  readonly actionSubmit: string
  readonly actionApprove: string
  readonly actionReject: string
  readonly actionRequestChanges: string
  readonly actionAcknowledge: string
  readonly actionComplete: string
  readonly actionCancel: string
  readonly formCurrentValue: string
  readonly formNewValue: string
  readonly formSaving: string
  readonly formSaved: string
  readonly formSaveError: string
  readonly formStale: string
  readonly formSave: string
  readonly formErrorSummary: string
  readonly formRequired: string
  readonly formInvalid: string
  readonly formReadOnly: string
  readonly formNoValue: string
  readonly formBooleanTrue: string
  readonly formBooleanFalse: string
  readonly formReferenceSearch: string
  readonly formReferenceLoading: string
  readonly formReferenceNoOptions: string
  readonly formScrollHint: string
  readonly documentDownload: string
  readonly documentChecksum: string
  readonly documentAcknowledgementRequired: string
  readonly requesterAudience: string
  readonly requesterSaveExplanation: string
  readonly requesterDraftSave: string
  readonly requesterFinalSubmit: string
  readonly requesterActionNeeded: string
  readonly requesterWaitingForRole: string
  readonly requesterResponsible: string
  readonly requesterYou: string
  readonly requesterManager: string
  readonly requesterHr: string
  readonly requesterInProgress: string
  readonly requesterCompleted: string
  readonly requesterRejected: string
  readonly requesterChangesRequested: string
  readonly requesterTakeAction: string
  readonly statusOpen: string
  readonly statusClaimed: string
  readonly statusBlocked: string
  readonly statusCompleted: string
  readonly statusCancelled: string
  readonly statusExpired: string
  readonly statusWaiting: string
  readonly statusInProgress: string
  readonly statusChangesRequested: string
  readonly statusRejected: string
  readonly statusUnknown: string
  readonly assignmentReason: string
  readonly assignmentReasonManager: string
  readonly assignmentReasonHr: string
  readonly assignmentReasonEmployee: string
  readonly assignmentReasonGeneral: string
  readonly progressStepCompleted: string
  readonly progressStepCurrent: string
  readonly progressStepUpcoming: string
  readonly progressStepEnded: string
  readonly workActionNeeded: string
  readonly workWaitingForRole: string
  readonly nextPossibleResults: string
  readonly conditionalResult: string
  readonly changeRequests: string
  readonly historyStarted: string
  readonly historyStepActivated: string
  readonly historyAction: string
  readonly historyCompleted: string
  readonly historyRejected: string
  readonly historyCancelled: string
  readonly historyResubmitted: string
  readonly historyEmpty: string
  readonly technicalDetails: string
  readonly hrActionContext: string
  readonly confirmAction: string
  readonly requestChangesReason: string
  readonly requestChangesReasonRequired: string
  readonly requestChangesSubmit: string
  readonly internalTransferPreview: string
  readonly internalTransferPreviewDescription: string
  readonly internalTransferCurrent: string
  readonly internalTransferProposed: string
  readonly internalTransferDepartment: string
  readonly internalTransferJob: string
  readonly internalTransferManager: string
  readonly internalTransferBlockers: string
  readonly internalTransferWarnings: string
  readonly internalTransferPreviewSuccess: string
  readonly internalTransferPreviewWarning: string
  readonly internalTransferPreviewBlocking: string
  readonly internalTransferCommit: string
  readonly internalTransferCommitConfirm: string
  readonly internalTransferCommitting: string
  readonly internalTransferCommitFailed: string
  readonly internalTransferChanged: string
  readonly internalTransferNoSalary: string
  readonly internalTransferLoading: string
  readonly internalTransferFailed: string
}

interface ProcessWorkDetailProps {
  readonly detail: ProcessWorkDetail
  readonly experience: ProcessWorkExperience | null
  readonly form: FormProjection | null
  readonly outputs: ProcessOutputProjection | null
  readonly operations: ProcessAutomationOperations | null
  readonly locale: Locale
  readonly labels: ProcessWorkDetailLabels
  readonly assignmentOptions: ReadonlyArray<ProcessWorkAssignmentOption>
  readonly backHref: string
  readonly isRequesterPresentation?: boolean
}

function date(value: string | null, locale: Locale): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(parsed)
}

function actionLabel(action: string, labels: ProcessWorkDetailLabels): string {
  return ({
    SUBMIT: labels.actionSubmit,
    APPROVE: labels.actionApprove,
    REJECT: labels.actionReject,
    REQUEST_CHANGES: labels.actionRequestChanges,
    ACKNOWLEDGE: labels.actionAcknowledge,
    COMPLETE: labels.actionComplete,
    CANCEL: labels.actionCancel,
  } as Record<string, string>)[action] ?? labels.unknown
}

function errorLabel(code: string, labels: ProcessWorkDetailLabels): string {
  if (code === 'ALREADY_CLAIMED') return labels.errorClaimRace
  if (code === 'STALE_ASSIGNMENT' || code === 'STALE_STATE') return labels.errorStale
  if (code === 'FORBIDDEN' || code === 'FORBIDDEN_ACTION') return labels.errorDenied
  if (code === 'WORK_ITEM_NOT_BLOCKED') return labels.errorBlocked
  if (code === 'DOCUMENT_ACKNOWLEDGEMENT_CONFIRMATION_REQUIRED') return labels.documentAcknowledgementRequired
  return labels.errorGeneric
}

function outputStatusLabel(status: string, labels: ProcessWorkDetailLabels): string {
  if (status === 'AVAILABLE') return labels.outputAvailable
  if (status === 'FAILED') return labels.outputFailed
  return labels.outputPending
}

function processStatusLabel(status: string, labels: ProcessWorkDetailLabels): string {
  return ({
    OPEN: labels.statusOpen,
    CLAIMED: labels.statusClaimed,
    BLOCKED: labels.statusBlocked,
    COMPLETED: labels.statusCompleted,
    CANCELLED: labels.statusCancelled,
    EXPIRED: labels.statusExpired,
    WAITING: labels.statusWaiting,
    IN_PROGRESS: labels.statusInProgress,
    CHANGES_REQUESTED: labels.statusChangesRequested,
    REJECTED: labels.statusRejected,
  } as Record<string, string>)[status] ?? labels.statusUnknown
}

function historyEventLabel(event: ProcessWorkExperience['history'][number], index: number, history: ProcessWorkExperience['history'], labels: ProcessWorkDetailLabels): string {
  if (event.action) {
    if (event.action === 'SUBMIT' && history.slice(0, index).some((earlier) => earlier.action === 'REQUEST_CHANGES')) return labels.historyResubmitted
    return actionLabel(event.action, labels)
  }
  if (event.eventType === 'PROCESS_STARTED') return labels.historyStarted
  if (event.eventType === 'PROCESS_STEP_ACTIVATED') return event.stepTitle ? `${labels.historyStepActivated}: ${event.stepTitle}` : labels.historyStepActivated
  if (event.eventType === 'PROCESS_TERMINAL') {
    if (event.terminalOutcome === 'COMPLETED') return labels.historyCompleted
    if (event.terminalOutcome === 'REJECTED') return labels.historyRejected
    if (event.terminalOutcome === 'CANCELLED') return labels.historyCancelled
  }
  return labels.historyAction
}

function roleForPresentation(detail: ProcessWorkDetail, labels: ProcessWorkDetailLabels): string {
  const participant = detail.participantKey.toLowerCase().replaceAll('_', '-')
  const roleCode = (detail.assignmentExplanation.roleCode ?? '').toUpperCase().replaceAll('-', '_')
  if (participant === 'employee' || participant === 'initiator') return labels.requesterYou
  if (participant.includes('manager') || roleCode === 'DIRECT_MANAGER' || roleCode.endsWith('_MANAGER')) return labels.requesterManager
  if (participant.includes('hr') || roleCode.includes('HR')) return labels.requesterHr
  return labels.requesterResponsible
}

function assignmentReasonText(detail: ProcessWorkDetail, labels: ProcessWorkDetailLabels): string {
  const role = roleForPresentation(detail, labels)
  if (role === labels.requesterManager) return labels.assignmentReasonManager
  if (role === labels.requesterHr) return labels.assignmentReasonHr
  if (role === labels.requesterYou) return labels.assignmentReasonEmployee
  return labels.assignmentReasonGeneral.replace('{role}', role)
}

export function ProcessWorkDetailView({ detail, experience, form, outputs, operations, locale, labels, assignmentOptions, backHref, isRequesterPresentation = false }: ProcessWorkDetailProps) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [serverFieldError, setServerFieldError] = useState<FormRuntimeServerFieldError | null>(null)
  const [requestChangesOpen, setRequestChangesOpen] = useState(false)
  const [requestChangesReason, setRequestChangesReason] = useState('')
  const [requestChangesInvalid, setRequestChangesInvalid] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [selectedAssigneeId, setSelectedAssigneeId] = useState(detail.assigneeEmployeeId ?? assignmentOptions[0]?.id ?? '')
  const [confirmAction, setConfirmAction] = useState<string | null>(null)

  async function post(path: string, body: Record<string, unknown>, actionKey: string): Promise<void> {
    setBusy(actionKey)
    setFeedback(null)
    setServerFieldError(null)
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const bodyValue: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const code = typeof bodyValue === 'object' && bodyValue !== null && 'code' in bodyValue && typeof bodyValue.code === 'string' ? bodyValue.code : 'PROCESS_WORK_ITEM_OPERATION_FAILED'
        const fieldKey = typeof bodyValue === 'object' && bodyValue !== null && 'fieldKey' in bodyValue && typeof bodyValue.fieldKey === 'string' ? bodyValue.fieldKey : null
        if ((code === 'REQUIRED_FORM_FIELD' || code === 'INVALID_FORM_VALUE') && fieldKey) {
          setServerFieldError((current) => ({ fieldKey, code, sequence: (current?.sequence ?? 0) + 1 }))
        } else {
          setFeedback(errorLabel(code, labels))
        }
        return
      }
      setServerFieldError(null)
      setFeedback(labels.success)
      router.refresh()
    } catch {
      setFeedback(labels.errorGeneric)
    } finally {
      setBusy(null)
    }
  }

  const expected = { expectedVersion: detail.expectedVersion }
  const isInternalTransferValidation = detail.processKey.startsWith('internal-transfer') && detail.stepKey === 'hr-validation'
  const isDocumentAcknowledgement = detail.processKey.startsWith('document-acknowledgement') && detail.stepKey === 'acknowledge'
  const actionButtons = detail.canAct && detail.status !== 'BLOCKED' && detail.status !== 'COMPLETED' && detail.status !== 'CANCELLED' ? detail.allowedActions.filter((action) => !(isInternalTransferValidation && action === 'APPROVE')).map((action) => ({ action, label: actionLabel(action, labels) })) : []
  const primaryAction = actionButtons.find(({ action }) => action === 'APPROVE')?.action
    ?? actionButtons.find(({ action }) => action === 'SUBMIT')?.action
    ?? actionButtons.find(({ action }) => action === 'COMPLETE')?.action
    ?? actionButtons[0]?.action
  const history = experience?.history ?? detail.timeline.map((event) => ({ ...event, action: null, stepTitle: null, terminalOutcome: null }))
  const documentField = form?.sections.flatMap((section) => section.fields).find((field) => field.type === 'DOCUMENT_REFERENCE')
  const documentValue = documentField?.currentValue ?? documentField?.newValue
  const documentId = typeof documentValue === 'string' ? documentValue : typeof documentValue === 'object' && documentValue !== null && !Array.isArray(documentValue) && typeof documentValue.id === 'string' ? documentValue.id : null
  const documentLabel = typeof documentValue === 'object' && documentValue !== null && !Array.isArray(documentValue) && typeof documentValue.label === 'string' ? documentValue.label : documentId
  const requesterRole = (() => {
    const participant = detail.participantKey.toLowerCase().replaceAll('_', '-')
    const roleCode = (detail.assignmentExplanation.roleCode ?? '').toUpperCase().replaceAll('-', '_')
    if (participant === 'employee' || participant === 'initiator') return labels.requesterYou
    if (participant.includes('manager') || roleCode === 'DIRECT_MANAGER' || roleCode.endsWith('_MANAGER')) return labels.requesterManager
    if (participant.includes('hr') || roleCode.includes('HR')) return labels.requesterHr
    return labels.requesterResponsible
  })()
  const requesterStatus = detail.instanceStatus === 'COMPLETED'
    ? labels.requesterCompleted
    : detail.instanceStatus === 'REJECTED' || detail.businessStatus === 'REJECTED'
      ? labels.requesterRejected
      : detail.instanceStatus === 'CANCELLED' || detail.businessStatus === 'CANCELLED' || detail.status === 'CANCELLED'
        ? labels.statusCancelled
        : detail.status === 'EXPIRED' || detail.businessStatus === 'EXPIRED'
          ? labels.statusExpired
          : detail.status === 'BLOCKED' || detail.businessStatus === 'BLOCKED'
            ? labels.statusBlocked
            : detail.businessStatus === 'CHANGES_REQUESTED'
              ? labels.requesterChangesRequested
              : labels.requesterInProgress
  const requesterNextMessage = detail.canAct
    ? labels.requesterActionNeeded
    : labels.requesterWaitingForRole.replace('{role}', requesterRole)

  function executeAction(action: string): void {
    const path = isDocumentAcknowledgement && action === 'ACKNOWLEDGE' ? `/api/process-work-items/${detail.workItemId}/document-acknowledgement` : `/api/process-work-items/${detail.workItemId}/action`
    const body = isDocumentAcknowledgement && action === 'ACKNOWLEDGE'
      ? { ...expected, stepExpectedVersion: detail.stepExpectedVersion, idempotencyKey: globalThis.crypto.randomUUID(), correlationId: detail.correlationId }
      : { action, ...expected, stepExpectedVersion: detail.stepExpectedVersion, idempotencyKey: globalThis.crypto.randomUUID(), correlationId: detail.correlationId }
    void post(path, body, action)
  }

  function runAction(action: string): void {
    if (action === 'REQUEST_CHANGES') {
      setRequestChangesOpen(true)
      setRequestChangesInvalid(false)
      setFeedback(null)
      return
    }
    if (action === 'REJECT' || action === 'CANCEL') {
      setConfirmAction(action)
      return
    }
    executeAction(action)
  }

  async function submitRequestChanges(): Promise<void> {
    const reason = requestChangesReason.trim()
    if (!reason) {
      setRequestChangesInvalid(true)
      return
    }
    setRequestChangesOpen(false)
    setRequestChangesReason('')
    setRequestChangesInvalid(false)
    await post(`/api/process-work-items/${detail.workItemId}/request-changes`, { ...expected, stepExpectedVersion: detail.stepExpectedVersion, idempotencyKey: globalThis.crypto.randomUUID(), correlationId: detail.correlationId, reason }, 'request-changes')
  }

  async function submitReassign(): Promise<void> {
    if (!selectedAssigneeId) return
    setReassignOpen(false)
    await post(`/api/process-work-items/${detail.workItemId}/reassign`, { ...expected, employeeId: selectedAssigneeId }, 'reassign')
  }

  return (
    <>
    <section className="mx-auto w-full max-w-[92rem] px-4 py-8 sm:px-6 lg:px-10">
      <Link className={buttonClasses({ size: 'sm', variant: 'ghost', className: 'mb-4 -ml-3' })} href={backHref}>{labels.backToWork}</Link>
      <header className="rounded-[var(--radius-surface)] border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div><h1 className="text-3xl font-semibold tracking-tight text-foreground">{detail.processTitle}</h1>{detail.processDescription ? <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{detail.processDescription}</p> : null}</div>
          <div className="flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-muted px-3 py-1.5 font-semibold text-muted-foreground">{isRequesterPresentation ? requesterStatus : processStatusLabel(detail.businessStatus, labels)}</span>{detail.isOverdue ? <span className="rounded-full bg-destructive/10 px-3 py-1.5 font-semibold text-destructive">{labels.overdue}</span> : null}</div>
        </div>
        <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs text-muted-foreground">{labels.subject}</dt><dd className="mt-1 font-semibold">{detail.subjectName ?? labels.unknown}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{labels.step}</dt><dd className="mt-1 font-semibold">{detail.stepTitle}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{labels.deadline}</dt><dd className={`mt-1 font-semibold ${detail.isOverdue ? 'text-destructive' : ''}`}>{date(detail.deadlineAt, locale)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{labels.availableAt}</dt><dd className="mt-1 font-semibold">{date(detail.availableAt, locale)}</dd></div>
        </dl>
      </header>

      {isRequesterPresentation ? <div className="mt-4 rounded-[var(--radius-surface)] border border-border bg-muted/30 p-4 text-sm" role="status"><p className="font-semibold">{requesterNextMessage}</p><p className="mt-1 text-muted-foreground">{labels.step}: {detail.stepTitle}</p></div> : null}
      {!isRequesterPresentation ? <div className="mt-4 rounded-[var(--radius-surface)] border border-border bg-muted/30 p-4 text-sm" role="status"><p className="font-semibold">{actionButtons.length ? labels.workActionNeeded.replace('{role}', roleForPresentation(detail, labels)) : labels.workWaitingForRole.replace('{role}', roleForPresentation(detail, labels))}</p>{detail.businessType === 'P_MUTATION' && detail.participantKey.toLowerCase().includes('hr') ? <p className="mt-1 text-muted-foreground">{labels.hrActionContext}</p> : null}</div> : null}

      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-[var(--radius-surface)] border border-border bg-muted/30 p-4" aria-label={labels.action}>
        {!requestChangesOpen ? <>
          {detail.canClaim ? <Button disabled={busy !== null} loading={busy === 'claim'} onClick={() => { void post(`/api/process-work-items/${detail.workItemId}/claim`, expected, 'claim') }} type="button" variant={primaryAction ? 'secondary' : 'primary'}>{isRequesterPresentation ? labels.requesterTakeAction : labels.claim}</Button> : null}
          {detail.canRelease ? <Button disabled={busy !== null} loading={busy === 'release'} onClick={() => { void post(`/api/process-work-items/${detail.workItemId}/release`, expected, 'release') }} type="button" variant="secondary">{labels.release}</Button> : null}
          {detail.canReassign && assignmentOptions.length > 0 ? <Button disabled={busy !== null} onClick={() => setReassignOpen((current) => !current)} type="button" variant="secondary">{labels.reassign}</Button> : null}
          {detail.status === 'BLOCKED' && detail.canReassign ? <Button disabled={busy !== null} loading={busy === 're-resolve'} onClick={() => { void post(`/api/process-work-items/${detail.workItemId}/re-resolve`, expected, 're-resolve') }} type="button" variant="secondary">{labels.reResolve}</Button> : null}
          {actionButtons.map(({ action, label }) => <Button disabled={busy !== null} key={action} loading={busy === action} onClick={() => runAction(action)} type="button" variant={action === 'REJECT' ? 'danger' : action === primaryAction || (isRequesterPresentation && action === 'SUBMIT') ? 'primary' : 'secondary'}>{isRequesterPresentation && action === 'SUBMIT' ? labels.requesterFinalSubmit : label}</Button>)}
          {reassignOpen ? <div className="basis-full grid gap-3 rounded-[var(--radius-surface)] border border-border bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto]"><label className="grid min-w-0 gap-2 text-sm font-semibold" htmlFor="reassign-employee">{labels.reassignEmployee}<DropdownSelect aria-label={labels.reassignEmployee} id="reassign-employee" onChange={(event) => setSelectedAssigneeId(event.target.value)} searchable searchPlaceholder={labels.reassignEmployee} value={selectedAssigneeId}><option disabled value="">{labels.assignmentOptionsEmpty}</option>{assignmentOptions.map((option) => <option key={`${option.id}-${option.resolutionDate}`} value={option.id}>{option.name} · {option.employeeNumber}</option>)}</DropdownSelect></label><div className="flex items-end gap-2"><Button disabled={busy !== null || !selectedAssigneeId} loading={busy === 'reassign'} onClick={() => { void submitReassign() }} type="button">{labels.reassignSubmit}</Button><Button disabled={busy !== null} onClick={() => setReassignOpen(false)} type="button" variant="ghost">{labels.actionCancel}</Button></div></div> : null}
          {detail.canReassign && assignmentOptions.length === 0 ? <p className="basis-full text-sm text-muted-foreground">{labels.assignmentOptionsEmpty}</p> : null}
        </> : <div className="basis-full rounded-[var(--radius-surface)] border border-border bg-surface p-4"><FormField control={<Textarea className="min-h-24" id="request-changes-reason" onChange={(event) => { setRequestChangesReason(event.target.value); setRequestChangesInvalid(false) }} required value={requestChangesReason} />} error={requestChangesInvalid ? labels.requestChangesReasonRequired : undefined} label={labels.requestChangesReason} required /><div className="mt-3 flex flex-wrap justify-end gap-2"><Button disabled={busy !== null} onClick={() => { setRequestChangesOpen(false); setRequestChangesReason(''); setRequestChangesInvalid(false) }} type="button" variant="ghost">{labels.actionCancel}</Button><Button disabled={busy !== null} loading={busy === 'request-changes'} onClick={() => { void submitRequestChanges() }} type="button">{labels.requestChangesSubmit}</Button></div></div>}
        {feedback ? <p aria-live="polite" className="basis-full text-sm font-medium text-muted-foreground">{feedback}</p> : null}
      </div>
      {detail.status === 'BLOCKED' ? <p className="mt-3 rounded-[var(--radius-control)] border border-warning/30 bg-warning/5 p-3 text-sm text-warning" role="status">{labels.blocked}</p> : null}
      {isInternalTransferValidation && detail.canAct ? <div className="mt-6"><InternalTransferCommitPanel correlationId={detail.correlationId} expectedVersion={detail.expectedVersion} labels={{ preview: labels.internalTransferPreview, previewDescription: labels.internalTransferPreviewDescription, current: labels.internalTransferCurrent, proposed: labels.internalTransferProposed, department: labels.internalTransferDepartment, job: labels.internalTransferJob, manager: labels.internalTransferManager, blockers: labels.internalTransferBlockers, warnings: labels.internalTransferWarnings, previewSuccess: labels.internalTransferPreviewSuccess, previewWarning: labels.internalTransferPreviewWarning, previewBlocking: labels.internalTransferPreviewBlocking, commit: labels.internalTransferCommit, commitConfirm: labels.internalTransferCommitConfirm, committing: labels.internalTransferCommitting, commitFailed: labels.internalTransferCommitFailed, changed: labels.internalTransferChanged, noSalary: labels.internalTransferNoSalary, loading: labels.internalTransferLoading, failed: labels.internalTransferFailed, cancel: labels.actionCancel, noValue: labels.formNoValue }} stepExpectedVersion={detail.stepExpectedVersion} workItemId={detail.workItemId} /></div> : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-6">
          <section className="rounded-[var(--radius-surface)] border border-border bg-surface p-5"><h2 className="text-xl font-semibold">{isRequesterPresentation ? labels.assignmentRole : labels.assignmentReason}</h2><p className="mt-2 text-sm font-medium">{isRequesterPresentation ? detail.canAct ? labels.requesterYou : requesterRole : assignmentReasonText(detail, labels)}</p></section>
          {form ? <FormRuntimeRenderer embedded initialProjection={form} serverFieldError={serverFieldError} locale={locale} participantLabel={isRequesterPresentation ? labels.requesterAudience : roleForPresentation(detail, labels)} saveExplanation={isRequesterPresentation ? labels.requesterSaveExplanation : undefined} labels={{ currentValue: labels.formCurrentValue, newValue: labels.formNewValue, saving: labels.formSaving, saved: labels.formSaved, saveError: labels.formSaveError, stale: labels.formStale, save: isRequesterPresentation ? labels.requesterDraftSave : labels.formSave, errorSummary: labels.formErrorSummary, required: labels.formRequired, invalid: labels.formInvalid, readOnly: labels.formReadOnly, noValue: labels.formNoValue, booleanTrue: labels.formBooleanTrue, booleanFalse: labels.formBooleanFalse, referenceSearch: labels.formReferenceSearch, referenceLoading: labels.formReferenceLoading, referenceNoOptions: labels.formReferenceNoOptions, scrollHint: labels.formScrollHint }} /> : null}
          {experience?.changeRequests.length ? <section className="rounded-[var(--radius-surface)] border border-border bg-surface p-5"><h2 className="text-xl font-semibold">{labels.changeRequests}</h2><ul className="mt-4 grid gap-4">{experience.changeRequests.map((request) => <li className="border-l-2 border-warning pl-3 text-sm" key={request.id}><p className="whitespace-pre-wrap break-words leading-6">{request.body}</p><p className="mt-2 text-xs text-muted-foreground">{date(request.createdAt, locale)}</p></li>)}</ul></section> : null}
          {isDocumentAcknowledgement && documentId ? <section className="rounded-[var(--radius-surface)] border border-border bg-surface p-5" aria-labelledby="document-acknowledgement-document"><h2 className="text-xl font-semibold" id="document-acknowledgement-document">{labels.documentDownload}</h2><p className="mt-2 text-sm font-medium">{documentLabel ?? labels.formNoValue}</p><p className="mt-2 break-all text-xs text-muted-foreground">{labels.documentChecksum}: {typeof documentValue === 'object' && documentValue !== null && !Array.isArray(documentValue) && typeof documentValue.checksumSha256 === 'string' ? documentValue.checksumSha256 : labels.formNoValue}</p><Link className={buttonClasses({ className: 'mt-4 inline-flex', size: 'sm', variant: 'secondary' })} href={`/api/process-work-items/${detail.workItemId}/document`}>{labels.documentDownload}</Link></section> : null}
          {outputs ? <section className="rounded-[var(--radius-surface)] border border-border bg-surface p-5"><h2 className="text-xl font-semibold">{labels.output}</h2><div className="mt-4 divide-y divide-border">{outputs.outputs.length === 0 ? <p className="text-sm text-muted-foreground">{labels.downloadUnavailable}</p> : outputs.outputs.map((output) => <article className="py-4 first:pt-0 last:pb-0" key={output.id}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{output.title}</h3><p className="mt-1 text-xs text-muted-foreground">{outputStatusLabel(output.status, labels)}</p></div>{output.documentId && output.status === 'AVAILABLE' ? <Link className="rounded-[var(--radius-control)] bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-primary" href={`/api/process-instances/${detail.processInstanceId}/outputs/${output.id}/download`}>{labels.download}</Link> : null}</div>{output.htmlSummary && output.status === 'AVAILABLE' ? <p className="mt-4 whitespace-pre-line border-t border-border pt-4 text-sm leading-6">{processOutputSummaryText(output.htmlSummary)}</p> : null}</article>)}</div></section> : null}
        </div>
        <aside className="grid content-start gap-6">
          <section className="rounded-[var(--radius-surface)] border border-border bg-surface p-5"><h2 className="text-xl font-semibold">{labels.progress}</h2><ol className="mt-4 grid gap-3">{detail.steps.map((step) => { const title = experience?.steps.find((entry) => entry.stepKey === step.stepKey)?.title ?? (step.stepKey === detail.stepKey ? detail.stepTitle : labels.unknown); const isCurrent = step.stepKey === detail.currentStepKey; const isComplete = step.status === 'COMPLETED'; const isEnded = step.status === 'REJECTED' || step.status === 'CANCELLED' || step.status === 'BLOCKED'; const stepState = isComplete ? labels.progressStepCompleted : isEnded ? labels.progressStepEnded : isCurrent ? labels.progressStepCurrent : labels.progressStepUpcoming; return <li className="flex items-start gap-3 text-sm" key={step.id}><span aria-hidden="true" className={`mt-1 size-2.5 shrink-0 rounded-full ${isComplete ? 'bg-success' : isCurrent ? 'bg-primary' : isEnded ? 'bg-warning' : 'bg-border'}`} /><span><span className="font-medium">{title}</span><span className="block text-xs text-muted-foreground">{stepState}{step.deadlineAt ? ` · ${date(step.deadlineAt, locale)}` : ''}</span></span></li> })}</ol></section>
          {experience?.nextRoutes.length ? <section className="rounded-[var(--radius-surface)] border border-border bg-surface p-5"><h2 className="text-xl font-semibold">{labels.nextPossibleResults}</h2><ul className="mt-4 grid gap-3">{experience.nextRoutes.map((route, index) => <li className="text-sm" key={`${route.action}-${route.toStepTitle ?? route.terminalOutcome ?? index}`}><span className="font-medium">{route.label}</span><span className="block text-muted-foreground">{route.terminalOutcome ? processStatusLabel(route.terminalOutcome, labels) : route.toStepTitle ?? labels.statusUnknown}{route.isConditional ? ` · ${labels.conditionalResult}` : ''}</span></li>)}</ul></section> : null}
          <section className="rounded-[var(--radius-surface)] border border-border bg-surface p-5"><h2 className="text-xl font-semibold">{labels.timeline}</h2>{history.length ? <ol className="mt-4 grid gap-3">{history.map((event, index) => <li className="border-l-2 border-border pl-3 text-sm" key={event.id}><p className="font-medium">{historyEventLabel(event, index, history, labels)}</p>{event.eventType === 'PROCESS_WORK_ITEM_ACTIONED' && event.stepTitle ? <p className="mt-1 text-muted-foreground">{event.stepTitle}</p> : null}<p className="mt-1 text-xs text-muted-foreground">{date(event.createdAt, locale)}</p></li>)}</ol> : <p className="mt-4 text-sm text-muted-foreground">{labels.historyEmpty}</p>}</section>
          {operations ? <details className="rounded-[var(--radius-surface)] border border-border bg-surface p-5"><summary className="cursor-pointer text-sm font-semibold focus-visible:outline-2 focus-visible:outline-focus">{labels.technicalDetails}</summary><h2 className="mt-4 text-base font-semibold">{labels.operations}</h2><div className="mt-4 grid gap-3">{operations.jobs.map((job) => <div className="rounded-[var(--radius-control)] bg-muted/40 p-3 text-xs" key={job.id}><div className="flex justify-between gap-2"><span className="font-semibold">{job.jobType}</span><span>{job.status}</span></div><p className="mt-1 text-muted-foreground">{job.attempts}/{job.maxAttempts} · {labels.lastAttempt}: {date(job.lastAttemptAt, locale)}</p>{job.lastErrorCode ? <p className="mt-1 text-destructive">{job.lastErrorCode}</p> : null}{job.canRecover ? <Button className="mt-2" onClick={() => { void post(`/api/process-automation/jobs/${job.id}/requeue`, {}, `retry-${job.id}`) }} size="sm" type="button" variant="secondary">{labels.retry}</Button> : null}</div>)}</div></details> : null}
        </aside>
      </div>
    </section>
    <ConfirmDialog cancelLabel={labels.actionCancel} confirmLabel={labels.action} description={labels.confirmAction} destructive onConfirm={() => { const action = confirmAction; setConfirmAction(null); if (action) executeAction(action) }} onOpenChange={(open) => { if (!open) setConfirmAction(null) }} open={confirmAction !== null} pending={busy !== null} title={labels.confirmAction} />
    </>
  )
}
