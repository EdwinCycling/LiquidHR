'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Locale } from '@/lib/i18n/config'
import type { FormProjection } from '@/lib/process-automation/form-runtime'
import type { ProcessAutomationOperations, ProcessOutputProjection } from '@/lib/process-automation/output-service'
import type { ProcessWorkAssignmentOption, ProcessWorkDetail } from '@/lib/process-automation/work-service'
import { Button, buttonClasses } from '../ui/button'
import { DropdownSelect } from '../ui/dropdown-select'
import { FormRuntimeRenderer } from './form-runtime-renderer'
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
  readonly form: FormProjection | null
  readonly outputs: ProcessOutputProjection | null
  readonly operations: ProcessAutomationOperations | null
  readonly locale: Locale
  readonly labels: ProcessWorkDetailLabels
  readonly assignmentOptions: ReadonlyArray<ProcessWorkAssignmentOption>
  readonly backHref: string
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
  } as Record<string, string>)[action] ?? action
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

export function ProcessWorkDetailView({ detail, form, outputs, operations, locale, labels, assignmentOptions, backHref }: ProcessWorkDetailProps) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [requestChangesOpen, setRequestChangesOpen] = useState(false)
  const [requestChangesReason, setRequestChangesReason] = useState('')
  const [reassignOpen, setReassignOpen] = useState(false)
  const [selectedAssigneeId, setSelectedAssigneeId] = useState(detail.assigneeEmployeeId ?? assignmentOptions[0]?.id ?? '')

  async function post(path: string, body: Record<string, unknown>, actionKey: string): Promise<void> {
    setBusy(actionKey)
    setFeedback(null)
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const bodyValue: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const code = typeof bodyValue === 'object' && bodyValue !== null && 'code' in bodyValue && typeof bodyValue.code === 'string' ? bodyValue.code : 'PROCESS_WORK_ITEM_OPERATION_FAILED'
        setFeedback(errorLabel(code, labels))
        return
      }
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
  const documentField = form?.sections.flatMap((section) => section.fields).find((field) => field.type === 'DOCUMENT_REFERENCE')
  const documentValue = documentField?.currentValue ?? documentField?.newValue
  const documentId = typeof documentValue === 'string' ? documentValue : typeof documentValue === 'object' && documentValue !== null && !Array.isArray(documentValue) && typeof documentValue.id === 'string' ? documentValue.id : null
  const documentLabel = typeof documentValue === 'object' && documentValue !== null && !Array.isArray(documentValue) && typeof documentValue.label === 'string' ? documentValue.label : documentId

  function runAction(action: string): void {
    if (action === 'REQUEST_CHANGES') {
      setRequestChangesOpen(true)
      setFeedback(null)
      return
    }
    if ((action === 'REJECT' || action === 'CANCEL') && !window.confirm(labels.confirmAction)) return
    const path = isDocumentAcknowledgement && action === 'ACKNOWLEDGE' ? `/api/process-work-items/${detail.workItemId}/document-acknowledgement` : `/api/process-work-items/${detail.workItemId}/action`
    const body = isDocumentAcknowledgement && action === 'ACKNOWLEDGE'
      ? { ...expected, stepExpectedVersion: detail.stepExpectedVersion, idempotencyKey: globalThis.crypto.randomUUID(), correlationId: detail.correlationId }
      : { action, ...expected, stepExpectedVersion: detail.stepExpectedVersion, idempotencyKey: globalThis.crypto.randomUUID(), correlationId: detail.correlationId }
    void post(path, body, action)
  }

  async function submitRequestChanges(): Promise<void> {
    const reason = requestChangesReason.trim()
    if (!reason) {
      setFeedback(labels.requestChangesReasonRequired)
      return
    }
    setRequestChangesOpen(false)
    setRequestChangesReason('')
    await post(`/api/process-work-items/${detail.workItemId}/request-changes`, { ...expected, stepExpectedVersion: detail.stepExpectedVersion, idempotencyKey: globalThis.crypto.randomUUID(), correlationId: detail.correlationId, reason }, 'request-changes')
  }

  async function submitReassign(): Promise<void> {
    if (!selectedAssigneeId) return
    setReassignOpen(false)
    await post(`/api/process-work-items/${detail.workItemId}/reassign`, { ...expected, employeeId: selectedAssigneeId }, 'reassign')
  }

  return (
    <section className="mx-auto w-full max-w-[92rem] px-4 py-8 sm:px-6 lg:px-10">
      <Link className={buttonClasses({ size: 'sm', variant: 'ghost', className: 'mb-4 -ml-3' })} href={backHref}>{labels.backToWork}</Link>
      <header className="rounded-[var(--radius-surface)] border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">{detail.processKey}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{detail.processTitle}</h1>{detail.processDescription ? <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{detail.processDescription}</p> : null}</div>
          <div className="flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-muted px-3 py-1.5 font-semibold text-muted-foreground">{detail.status}</span>{detail.isOverdue ? <span className="rounded-full bg-destructive/10 px-3 py-1.5 font-semibold text-destructive">{labels.overdue}</span> : null}</div>
        </div>
        <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs text-muted-foreground">{labels.subject}</dt><dd className="mt-1 font-semibold">{detail.subjectName ?? labels.unknown}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{labels.step}</dt><dd className="mt-1 font-semibold">{detail.stepTitle}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{labels.deadline}</dt><dd className={`mt-1 font-semibold ${detail.isOverdue ? 'text-destructive' : ''}`}>{date(detail.deadlineAt, locale)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{labels.availableAt}</dt><dd className="mt-1 font-semibold">{date(detail.availableAt, locale)}</dd></div>
        </dl>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-[var(--radius-surface)] border border-border bg-muted/30 p-4" aria-label={labels.action}>
        {detail.canClaim ? <Button disabled={busy !== null} loading={busy === 'claim'} onClick={() => { void post(`/api/process-work-items/${detail.workItemId}/claim`, expected, 'claim') }} type="button">{labels.claim}</Button> : null}
        {detail.canRelease ? <Button disabled={busy !== null} loading={busy === 'release'} onClick={() => { void post(`/api/process-work-items/${detail.workItemId}/release`, expected, 'release') }} type="button" variant="secondary">{labels.release}</Button> : null}
        {detail.canReassign && assignmentOptions.length > 0 ? <Button disabled={busy !== null} onClick={() => setReassignOpen((current) => !current)} type="button" variant="secondary">{labels.reassign}</Button> : null}
        {detail.status === 'BLOCKED' && detail.canReassign ? <Button disabled={busy !== null} loading={busy === 're-resolve'} onClick={() => { void post(`/api/process-work-items/${detail.workItemId}/re-resolve`, expected, 're-resolve') }} type="button" variant="secondary">{labels.reResolve}</Button> : null}
        {actionButtons.map(({ action, label }) => <Button disabled={busy !== null} key={action} loading={busy === action} onClick={() => runAction(action)} type="button" variant="secondary">{label}</Button>)}
        {reassignOpen ? <div className="basis-full grid gap-3 rounded-[var(--radius-surface)] border border-border bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto]"><label className="grid min-w-0 gap-2 text-sm font-semibold" htmlFor="reassign-employee">{labels.reassignEmployee}<DropdownSelect aria-label={labels.reassignEmployee} id="reassign-employee" onChange={(event) => setSelectedAssigneeId(event.target.value)} searchable searchPlaceholder={labels.reassignEmployee} value={selectedAssigneeId}><option disabled value="">{labels.assignmentOptionsEmpty}</option>{assignmentOptions.map((option) => <option key={`${option.id}-${option.resolutionDate}`} value={option.id}>{option.name} · {option.employeeNumber}</option>)}</DropdownSelect></label><div className="flex items-end gap-2"><Button disabled={busy !== null || !selectedAssigneeId} loading={busy === 'reassign'} onClick={() => { void submitReassign() }} type="button">{labels.reassignSubmit}</Button><Button disabled={busy !== null} onClick={() => setReassignOpen(false)} type="button" variant="ghost">{labels.actionCancel}</Button></div></div> : null}
        {detail.canReassign && assignmentOptions.length === 0 ? <p className="basis-full text-sm text-muted-foreground">{labels.assignmentOptionsEmpty}</p> : null}
        {requestChangesOpen ? <div className="basis-full rounded-[var(--radius-surface)] border border-border bg-surface p-4"><label className="grid gap-2 text-sm font-semibold" htmlFor="request-changes-reason">{labels.requestChangesReason}<textarea className="form-field min-h-24 font-normal" id="request-changes-reason" onChange={(event) => setRequestChangesReason(event.target.value)} value={requestChangesReason} /></label><div className="mt-3 flex flex-wrap justify-end gap-2"><Button disabled={busy !== null} onClick={() => { setRequestChangesOpen(false); setRequestChangesReason('') }} type="button" variant="ghost">{labels.actionCancel}</Button><Button disabled={busy !== null} loading={busy === 'request-changes'} onClick={() => { void submitRequestChanges() }} type="button" variant="secondary">{labels.requestChangesSubmit}</Button></div></div> : null}
        {feedback ? <p aria-live="polite" className="basis-full text-sm font-medium text-muted-foreground">{feedback}</p> : null}
      </div>
      {detail.status === 'BLOCKED' ? <p className="mt-3 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm text-warning" role="status">{labels.blocked}</p> : null}
      {isInternalTransferValidation && detail.canAct ? <div className="mt-6"><InternalTransferCommitPanel correlationId={detail.correlationId} expectedVersion={detail.expectedVersion} labels={{ preview: labels.internalTransferPreview, previewDescription: labels.internalTransferPreviewDescription, current: labels.internalTransferCurrent, proposed: labels.internalTransferProposed, department: labels.internalTransferDepartment, job: labels.internalTransferJob, manager: labels.internalTransferManager, blockers: labels.internalTransferBlockers, warnings: labels.internalTransferWarnings, previewSuccess: labels.internalTransferPreviewSuccess, previewWarning: labels.internalTransferPreviewWarning, previewBlocking: labels.internalTransferPreviewBlocking, commit: labels.internalTransferCommit, commitConfirm: labels.internalTransferCommitConfirm, committing: labels.internalTransferCommitting, commitFailed: labels.internalTransferCommitFailed, changed: labels.internalTransferChanged, noSalary: labels.internalTransferNoSalary, loading: labels.internalTransferLoading, failed: labels.internalTransferFailed, cancel: labels.actionCancel, noValue: labels.formNoValue }} stepExpectedVersion={detail.stepExpectedVersion} workItemId={detail.workItemId} /></div> : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-6">
          <section className="rounded-[var(--radius-surface)] border border-border bg-surface p-5"><h2 className="text-xl font-semibold">{labels.assignment}</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">{labels.assignmentMode}</dt><dd className="mt-1 font-medium">{detail.assignmentExplanation.assignmentMode ?? detail.assignmentMode}</dd></div><div><dt className="text-muted-foreground">{labels.assignmentSource}</dt><dd className="mt-1 font-medium">{detail.assignmentExplanation.source ?? labels.unknown}</dd></div><div><dt className="text-muted-foreground">{labels.assignmentDate}</dt><dd className="mt-1 font-medium">{detail.assignmentExplanation.resolutionDate ?? labels.unknown}</dd></div><div><dt className="text-muted-foreground">{labels.assignmentRole}</dt><dd className="mt-1 font-medium">{detail.assignmentExplanation.roleCode ?? detail.participantKey}</dd></div></dl><p className="mt-4 text-sm text-muted-foreground">{detail.assigneeEmployeeId ? `${labels.reassignEmployee}: ${detail.assigneeEmployeeId}` : labels.unassigned}</p>{detail.claimedByUserId ? <p className="mt-1 text-sm text-muted-foreground">{labels.claimedBy}: {detail.claimedByUserId}</p> : null}</section>
          {form ? <section aria-label={labels.form} className="rounded-2xl border border-border bg-surface"><FormRuntimeRenderer initialProjection={form} locale={locale} labels={{ currentValue: labels.formCurrentValue, newValue: labels.formNewValue, saving: labels.formSaving, saved: labels.formSaved, saveError: labels.formSaveError, stale: labels.formStale, save: labels.formSave, errorSummary: labels.formErrorSummary, required: labels.formRequired, invalid: labels.formInvalid, readOnly: labels.formReadOnly, noValue: labels.formNoValue, booleanTrue: labels.formBooleanTrue, booleanFalse: labels.formBooleanFalse, referenceSearch: labels.formReferenceSearch, referenceLoading: labels.formReferenceLoading, referenceNoOptions: labels.formReferenceNoOptions, scrollHint: labels.formScrollHint }} /></section> : null}
          {isDocumentAcknowledgement && documentId ? <section className="rounded-2xl border border-border bg-surface p-5" aria-labelledby="document-acknowledgement-document"><h2 className="text-xl font-semibold" id="document-acknowledgement-document">{labels.documentDownload}</h2><p className="mt-2 text-sm font-medium">{documentLabel ?? labels.formNoValue}</p><p className="mt-2 break-all text-xs text-muted-foreground">{labels.documentChecksum}: {typeof documentValue === 'object' && documentValue !== null && !Array.isArray(documentValue) && typeof documentValue.checksumSha256 === 'string' ? documentValue.checksumSha256 : labels.formNoValue}</p><Link className="button-secondary mt-4 inline-flex" href={`/api/process-work-items/${detail.workItemId}/document`}>{labels.documentDownload}</Link></section> : null}
          {outputs ? <section className="rounded-2xl border border-border bg-surface p-5"><h2 className="text-xl font-semibold">{labels.output}</h2><div className="mt-4 grid gap-4">{outputs.outputs.length === 0 ? <p className="text-sm text-muted-foreground">{labels.downloadUnavailable}</p> : outputs.outputs.map((output) => <article className="rounded-xl border border-border p-4" key={output.id}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{output.title}</h3><p className="mt-1 text-xs text-muted-foreground">{outputStatusLabel(output.status, labels)}</p></div>{output.documentId && output.status === 'AVAILABLE' ? <Link className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-primary" href={`/api/process-instances/${detail.processInstanceId}/outputs/${output.id}/download`}>{labels.download}</Link> : null}</div>{output.htmlSummary && output.status === 'AVAILABLE' ? <div className="prose prose-sm mt-4 max-w-none border-t border-border pt-4" dangerouslySetInnerHTML={{ __html: output.htmlSummary }} /> : null}</article>)}</div></section> : null}
        </div>
        <aside className="grid content-start gap-6">
          <section className="rounded-2xl border border-border bg-surface p-5"><h2 className="text-xl font-semibold">{labels.progress}</h2><ol className="mt-4 grid gap-3">{detail.steps.map((step) => <li className="flex items-start gap-3 text-sm" key={step.id}><span aria-hidden="true" className={`mt-1 size-2.5 shrink-0 rounded-full ${step.status === 'COMPLETED' ? 'bg-success' : step.stepKey === detail.currentStepKey ? 'bg-primary' : 'bg-border'}`} /><span><span className="font-medium">{step.stepKey}</span><span className="block text-xs text-muted-foreground">{step.status} · {date(step.deadlineAt, locale)}</span></span></li>)}</ol></section>
          <section className="rounded-2xl border border-border bg-surface p-5"><h2 className="text-xl font-semibold">{labels.timeline}</h2><ol className="mt-4 grid gap-3">{detail.timeline.map((event) => <li className="border-l-2 border-border pl-3 text-sm" key={event.id}><p className="font-medium">{event.eventType}</p><p className="mt-1 text-xs text-muted-foreground">{date(event.createdAt, locale)}</p></li>)}</ol></section>
          {operations ? <section className="rounded-2xl border border-border bg-surface p-5"><h2 className="text-xl font-semibold">{labels.operations}</h2><div className="mt-4 grid gap-3">{operations.jobs.map((job) => <div className="rounded-xl bg-muted/40 p-3 text-xs" key={job.id}><div className="flex justify-between gap-2"><span className="font-semibold">{job.jobType}</span><span>{job.status}</span></div><p className="mt-1 text-muted-foreground">{job.attempts}/{job.maxAttempts} · {labels.lastAttempt}: {date(job.lastAttemptAt, locale)}</p>{job.lastErrorCode ? <p className="mt-1 text-destructive">{job.lastErrorCode}</p> : null}{job.canRecover ? <button className="mt-2 rounded-lg border border-border px-2 py-1 font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { void post(`/api/process-automation/jobs/${job.id}/requeue`, {}, `retry-${job.id}`) }} type="button">{labels.retry}</button> : null}</div>)}</div></section> : null}
        </aside>
      </div>
    </section>
  )
}
