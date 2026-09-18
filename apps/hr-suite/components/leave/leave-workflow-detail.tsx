'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { PageHeader } from '@/components/patterns/page-header'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormField } from '@/components/patterns/form-field'
import { PageShell } from '@/components/layout/page-shell'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { Textarea } from '@/components/ui/textarea'
import type { Locale } from '@/lib/i18n/config'
import type { ProcessWorkDetail } from '@/lib/process-automation/work-service'

interface Labels {
  readonly eyebrow: string
  readonly pageTitle: string
  readonly back: string
  readonly status: string
  readonly pending: string
  readonly changesRequested: string
  readonly approved: string
  readonly rejected: string
  readonly cancelled: string
  readonly inProgress: string
  readonly open: string
  readonly requestDetails: string
  readonly requestMode: string
  readonly priority: string
  readonly direct: string
  readonly startDate: string
  readonly endDate: string
  readonly timeMode: string
  readonly fullDay: string
  readonly morning: string
  readonly afternoon: string
  readonly specificHours: string
  readonly requestedMinutes: string
  readonly hoursUnit: string
  readonly workItem: string
  readonly assignment: string
  readonly manager: string
  readonly currentStep: string
  readonly actions: string
  readonly approve: string
  readonly reject: string
  readonly requestChanges: string
  readonly resubmit: string
  readonly acknowledge: string
  readonly cancelRequest: string
  readonly requestChangesReason: string
  readonly requestChangesReasonRequired: string
  readonly requestChangesSubmit: string
  readonly confirmDestructive: string
  readonly actionSuccess: string
  readonly actionFailed: string
  readonly stale: string
  readonly denied: string
  readonly timeline: string
  readonly completed: string
  readonly waiting: string
  readonly noRequest: string
}

interface Props {
  readonly detail: ProcessWorkDetail
  readonly locale: Locale
  readonly labels: Labels
  readonly backHref: string
}

function statusLabel(status: string, labels: Labels): string {
  return {
    PENDING: labels.pending,
    WAITING: labels.pending,
    CHANGES_REQUESTED: labels.changesRequested,
    APPROVED: labels.approved,
    COMPLETED: labels.approved,
    REJECTED: labels.rejected,
    CANCELLED: labels.cancelled,
    IN_PROGRESS: labels.inProgress,
    OPEN: labels.open,
  }[status] ?? status
}

function statusTone(status: string): BadgeTone {
  if (status === 'APPROVED' || status === 'COMPLETED') return 'success'
  if (status === 'REJECTED' || status === 'CANCELLED') return 'warning'
  if (status === 'CHANGES_REQUESTED') return 'info'
  return 'neutral'
}

function formatDate(value: string, locale: Locale): string {
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

function formatTime(value: string | null): string {
  return value ? value.slice(0, 5) : '—'
}

function actionLabel(action: string, labels: Labels): string {
  return {
    APPROVE: labels.approve,
    REJECT: labels.reject,
    REQUEST_CHANGES: labels.requestChanges,
    ACKNOWLEDGE: labels.acknowledge,
    CANCEL: labels.cancelRequest,
  }[action] ?? action
}

function timeModeLabel(timeMode: string, labels: Labels): string {
  return {
    FULL_DAY: labels.fullDay,
    MORNING: labels.morning,
    AFTERNOON: labels.afternoon,
    SPECIFIC_HOURS: labels.specificHours,
  }[timeMode] ?? timeMode
}

function errorMessage(code: string, labels: Labels): string {
  if (code === 'FORBIDDEN' || code === 'FORBIDDEN_ACTION') return labels.denied
  if (code === 'STALE_STATE' || code === 'IDEMPOTENCY_KEY_REUSED') return labels.stale
  return labels.actionFailed
}

export function LeaveWorkflowDetail({ detail, locale, labels, backHref }: Props) {
  const router = useRouter()
  const request = detail.leaveRequest
  const [busy, setBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [requestChangesOpen, setRequestChangesOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)

  if (!request) return <PageShell className="py-8" width="wide"><Surface className="p-6 text-sm text-destructive">{labels.noRequest}</Surface></PageShell>

  async function execute(action: string): Promise<void> {
    setBusy(action)
    setFeedback(null)
    try {
      const response = await fetch(`/api/leave/workflow/${detail.workItemId}/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action,
          expectedVersion: detail.expectedVersion,
          stepExpectedVersion: detail.stepExpectedVersion,
          idempotencyKey: globalThis.crypto.randomUUID(),
          correlationId: detail.correlationId,
          reason: action === 'REQUEST_CHANGES' ? reason.trim() : null,
        }),
      })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const code = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string' ? body.error : 'LEAVE_WORKFLOW_OPERATION_FAILED'
        setFeedback(errorMessage(code, labels))
        return
      }
      setReason('')
      setRequestChangesOpen(false)
      setFeedback(labels.actionSuccess)
      router.refresh()
    } catch {
      setFeedback(labels.actionFailed)
    } finally {
      setBusy(null)
    }
  }

  function run(action: string): void {
    if (action === 'REQUEST_CHANGES') {
      setRequestChangesOpen(true)
      setFeedback(null)
      return
    }
    if (action === 'REJECT' || action === 'CANCEL') {
      setConfirmAction(action)
      return
    }
    void execute(action)
  }

  async function submitChanges(): Promise<void> {
    if (!reason.trim()) {
      setFeedback(labels.requestChangesReasonRequired)
      return
    }
    await execute('REQUEST_CHANGES')
  }

  const availableActions = detail.canAct && detail.status !== 'COMPLETED' && detail.status !== 'CANCELLED'
    ? detail.allowedActions.filter((action) => ['APPROVE', 'REJECT', 'REQUEST_CHANGES', 'ACKNOWLEDGE', 'CANCEL'].includes(action))
    : []
  const displayStatus = detail.businessStatus

  return (
    <>
      <PageShell className="py-8" width="wide">
        <Link className={buttonClasses({ size: 'sm', variant: 'ghost', className: 'mb-4 -ml-3' })} href={backHref}>{labels.back}</Link>
        <PageHeader
          description={detail.processDescription ?? undefined}
          title={(
            <div>
              <span className="eyebrow mb-1 block">{labels.eyebrow}</span>
              <span>{detail.processTitle}</span>
            </div>
          )}
          actions={<Badge tone={statusTone(displayStatus)}>{statusLabel(displayStatus, labels)}</Badge>}
        />

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid gap-6">
            <Surface className="p-5">
              <h2 className="text-xl font-semibold">{labels.requestDetails}</h2>
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">{labels.startDate}</dt><dd className="mt-1 font-semibold">{formatDate(request.startDate, locale)}</dd></div>
                <div><dt className="text-muted-foreground">{labels.endDate}</dt><dd className="mt-1 font-semibold">{formatDate(request.endDate, locale)}</dd></div>
                <div><dt className="text-muted-foreground">{labels.requestMode}</dt><dd className="mt-1 font-semibold">{request.requestMode === 'PRIORITY' ? labels.priority : labels.direct}</dd></div>
                <div><dt className="text-muted-foreground">{labels.timeMode}</dt><dd className="mt-1 font-semibold">{timeModeLabel(request.timeMode, labels)}{request.timeMode === 'SPECIFIC_HOURS' ? ` · ${formatTime(request.specificStart)}–${formatTime(request.specificEnd)}` : ''}</dd></div>
                <div><dt className="text-muted-foreground">{labels.requestedMinutes}</dt><dd className="mt-1 font-semibold">{(request.requestedMinutes / 60).toLocaleString(locale === 'nl' ? 'nl-NL' : 'en-GB', { maximumFractionDigits: 2 })} {labels.hoursUnit}</dd></div>
                <div><dt className="text-muted-foreground">{request.requestMode === 'PRIORITY' ? labels.priority : labels.direct}</dt><dd className="mt-1 font-semibold">{request.priorityRuleName ?? request.leaveTypeName ?? '—'}</dd></div>
              </dl>
            </Surface>

            <Surface className="p-5">
              <h2 className="text-xl font-semibold">{labels.actions}</h2>
              {availableActions.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{availableActions.map((action) => <Button disabled={busy !== null} key={action} loading={busy === action} onClick={() => run(action)} type="button" variant={action === 'APPROVE' ? 'primary' : 'secondary'}>{actionLabel(action, labels)}</Button>)}</div> : <p className="mt-3 text-sm text-muted-foreground">{statusLabel(displayStatus, labels)}</p>}
              {requestChangesOpen ? <div className="mt-4 grid gap-3 border-t border-border pt-4"><FormField control={<Textarea aria-label={labels.requestChangesReason} onChange={(event) => setReason(event.currentTarget.value)} value={reason} />} label={labels.requestChangesReason} /><div className="flex flex-wrap justify-end gap-2"><Button disabled={busy !== null} onClick={() => { setRequestChangesOpen(false); setReason('') }} type="button" variant="ghost">{labels.cancelRequest}</Button><Button disabled={busy !== null} loading={busy === 'REQUEST_CHANGES'} onClick={() => { void submitChanges() }} type="button" variant="secondary">{labels.requestChangesSubmit}</Button></div></div> : null}
              {feedback ? <p aria-live="polite" className="mt-4 text-sm font-medium text-muted-foreground" role="status">{feedback}</p> : null}
            </Surface>
          </div>

          <aside className="grid content-start gap-6">
            <Surface className="p-5"><h2 className="text-xl font-semibold">{labels.workItem}</h2><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-muted-foreground">{labels.currentStep}</dt><dd className="mt-1 font-semibold">{detail.stepTitle}</dd></div><div><dt className="text-muted-foreground">{labels.assignment}</dt><dd className="mt-1 font-semibold">{detail.assignmentExplanation.roleCode ?? detail.participantKey}</dd></div><div><dt className="text-muted-foreground">{labels.manager}</dt><dd className="mt-1 font-semibold">{detail.assignmentExplanation.roleCode ?? '—'}</dd></div></dl></Surface>
            <Surface className="p-5"><h2 className="text-xl font-semibold">{labels.timeline}</h2><ol className="mt-4 grid gap-3">{detail.timeline.map((event) => <li className="border-l-2 border-border pl-3 text-sm" key={event.id}><p className="font-medium">{event.eventType}</p><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.createdAt))}</p></li>)}</ol></Surface>
          </aside>
        </div>
      </PageShell>
      <ConfirmDialog cancelLabel={labels.cancelRequest} confirmLabel={labels.actions} description={labels.confirmDestructive} destructive onConfirm={() => { const action = confirmAction; setConfirmAction(null); if (action) void execute(action) }} onOpenChange={(open) => { if (!open) setConfirmAction(null) }} open={confirmAction !== null} pending={busy !== null} title={labels.confirmDestructive} />
    </>
  )
}
