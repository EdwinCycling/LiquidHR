'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Activity, Clock3, RefreshCw, RotateCcw } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { CollectionToolbar } from '@/components/patterns/collection-toolbar'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { FilterBar } from '@/components/patterns/filter-bar'
import { Pagination } from '@/components/ui/pagination'
import type { Locale } from '@/lib/i18n/config'
import type { ProcessOperationsInbox, ProcessOperationsQuery } from '@/lib/process-automation/operations-service'

export type ProcessOperationsLabels = {
  readonly title: string
  readonly description: string
  readonly openStudio: string
  readonly refresh: string
  readonly scopeTotal: string
  readonly blockedProcesses: string
  readonly overdueTasks: string
  readonly failedAutomations: string
  readonly retryingAutomations: string
  readonly search: string
  readonly filter: string
  readonly applyFilters: string
  readonly filterAll: string
  readonly filterBlocked: string
  readonly filterOverdue: string
  readonly filterRetry: string
  readonly filterFailed: string
  readonly listTitle: string
  readonly process: string
  readonly step: string
  readonly status: string
  readonly responsible: string
  readonly unassigned: string
  readonly deadline: string
  readonly problem: string
  readonly occurredAt: string
  readonly lastAttempt: string
  readonly nextRetry: string
  readonly noRetry: string
  readonly noDeadline: string
  readonly reminderJob: string
  readonly documentJob: string
  readonly openProcess: string
  readonly diagnostics: string
  readonly errorCode: string
  readonly failureReasonRecipientMissing: string
  readonly failureReasonEscalationMissing: string
  readonly failureReasonContextMissing: string
  readonly failureReasonExpired: string
  readonly failureReasonTemporary: string
  readonly failureReasonReminder: string
  readonly failureReasonDocument: string
  readonly problemBlocked: string
  readonly problemOverdue: string
  readonly problemRetry: string
  readonly problemFailed: string
  readonly statusOpen: string
  readonly statusClaimed: string
  readonly statusBlocked: string
  readonly statusRetry: string
  readonly statusDeadLetter: string
  readonly statusRunning: string
  readonly statusWaiting: string
  readonly statusCompleted: string
  readonly statusCancelled: string
  readonly statusUnknown: string
  readonly retry: string
  readonly retrying: string
  readonly retryTitle: string
  readonly retryDescription: string
  readonly retryConfirm: string
  readonly cancel: string
  readonly retrySuccess: string
  readonly retryFailed: string
  readonly loading: string
  readonly loadError: string
  readonly denied: string
  readonly stale: string
  readonly emptyTitle: string
  readonly emptyDescription: string
  readonly noResults: string
  readonly pageSummary: string
  readonly previousPage: string
  readonly nextPage: string
  readonly initialFilter: ProcessOperationsQuery['filter']
  readonly initialSearch: string
  readonly initialPage: number
  readonly locale: Locale
}

type OperationsApiResponse = { readonly data?: ProcessOperationsInbox; readonly code?: string }
type OperationsLoadOutcome = {
  readonly requestKey: string
  readonly status: 'success' | 'denied' | 'error' | 'stale'
}

function statusLabel(status: string, labels: ProcessOperationsLabels): string {
  const statusLabels: Record<string, string> = {
    OPEN: labels.statusOpen,
    CLAIMED: labels.statusClaimed,
    BLOCKED: labels.statusBlocked,
    RETRY: labels.statusRetry,
    DEAD_LETTER: labels.statusDeadLetter,
    RUNNING: labels.statusRunning,
    WAITING: labels.statusWaiting,
    COMPLETED: labels.statusCompleted,
    CANCELLED: labels.statusCancelled,
    FAILED: labels.statusDeadLetter,
  }
  return statusLabels[status] ?? labels.statusUnknown
}

function problemLabel(problemKey: string, labels: ProcessOperationsLabels): string {
  if (problemKey === 'BLOCKED_PROCESS') return labels.problemBlocked
  if (problemKey === 'OVERDUE_WORK_ITEM') return labels.problemOverdue
  if (problemKey === 'AUTOMATION_RETRY') return labels.problemRetry
  return labels.problemFailed
}

function problemTone(problemKey: string): BadgeTone {
  if (problemKey === 'AUTOMATION_FAILED' || problemKey === 'OVERDUE_WORK_ITEM') return 'danger'
  if (problemKey === 'BLOCKED_PROCESS') return 'warning'
  return 'info'
}

function failureReason(item: ProcessOperationsInbox['items'][number], labels: ProcessOperationsLabels): string {
  if (item.lastErrorCode === 'PROCESS_REMINDER_RECIPIENT_MISSING') return labels.failureReasonRecipientMissing
  if (item.lastErrorCode === 'PROCESS_ESCALATION_RECIPIENT_MISSING') return labels.failureReasonEscalationMissing
  if (item.lastErrorCode === 'PROCESS_REMINDER_CONTEXT_MISSING') return labels.failureReasonContextMissing
  if (item.lastErrorCode === 'PROCESS_REMINDER_EXPIRED') return labels.failureReasonExpired
  if (item.lastErrorCode === 'PROCESS_REMINDER_TEMPORARY') return labels.failureReasonTemporary
  if (item.jobType === 'PROCESS_DOCUMENT_OUTPUT') return labels.failureReasonDocument
  if (item.jobType === 'PROCESS_REMINDER') return labels.failureReasonReminder
  return labels.problemFailed
}

function formatDate(value: string | null, locale: Locale): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function withQuery(search: string, filter: ProcessOperationsQuery['filter'], page: number): string {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  params.set('filter', filter)
  params.set('page', String(page))
  return `/settings/process-automation/operations?${params.toString()}`
}

export function ProcessOperationsWorkspace({ labels }: { readonly labels: ProcessOperationsLabels }) {
  const router = useRouter()
  const [inbox, setInbox] = useState<ProcessOperationsInbox | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)
  const [loadOutcome, setLoadOutcome] = useState<OperationsLoadOutcome | null>(null)
  const [selectedJob, setSelectedJob] = useState<ProcessOperationsInbox['items'][number] | null>(null)
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<{ readonly text: string; readonly error: boolean } | null>(null)
  const hasLoadedData = useRef(false)
  const params = new URLSearchParams()
  if (labels.initialSearch) params.set('search', labels.initialSearch)
  params.set('filter', labels.initialFilter)
  params.set('page', String(labels.initialPage))
  const requestUrl = `/api/process-automation/operations?${params.toString()}`
  const requestKey = `${requestUrl}#${reloadVersion}`
  const busy = loadOutcome?.requestKey !== requestKey
  const denied = !busy && loadOutcome?.status === 'denied'
  const loadError = !busy && loadOutcome?.status === 'error'
  const stale = (busy && inbox !== null) || (!busy && loadOutcome?.status === 'stale')

  useEffect(() => {
    const controller = new AbortController()

    void fetch(requestUrl, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const payload = await response.json() as OperationsApiResponse
        if (response.status === 401 || response.status === 403) {
          hasLoadedData.current = false
          setInbox(null)
          setLoadOutcome({ requestKey, status: 'denied' })
          return
        }
        if (!response.ok || !payload.data) throw new Error('PROCESS_OPERATIONS_READ_FAILED')
        hasLoadedData.current = true
        setInbox(payload.data)
        setLoadOutcome({ requestKey, status: 'success' })
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setLoadOutcome({ requestKey, status: hasLoadedData.current ? 'stale' : 'error' })
      })

    return () => controller.abort()
  }, [requestKey, requestUrl])

  async function confirmRetry(): Promise<void> {
    if (!selectedJob?.jobId) return
    setRetryingJobId(selectedJob.jobId)
    setActionMessage(null)
    try {
      const response = await fetch(`/api/process-automation/jobs/${selectedJob.jobId}/requeue`, { method: 'POST', headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error('WORKFLOW_JOB_RECOVERY_FAILED')
      setSelectedJob(null)
      setActionMessage({ text: labels.retrySuccess, error: false })
      setReloadVersion((value) => value + 1)
    } catch {
      setActionMessage({ text: labels.retryFailed, error: true })
    } finally {
      setRetryingJobId(null)
    }
  }

  const summary = inbox?.summary
  const summaryCards = [
    { label: labels.blockedProcesses, value: summary?.blockedProcesses ?? 0 },
    { label: labels.overdueTasks, value: summary?.overdueTasks ?? 0 },
    { label: labels.failedAutomations, value: summary?.failedAutomations ?? 0 },
    { label: labels.retryingAutomations, value: summary?.retryingAutomations ?? 0 },
  ]

  return (
    <div className="space-y-6">
      <section aria-label={labels.scopeTotal} className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">{labels.scopeTotal}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <Surface className="p-4" key={card.label}>
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{inbox ? card.value : busy ? '…' : '—'}</p>
            </Surface>
          ))}
        </div>
      </section>

      <CollectionToolbar
        search={(
          <FilterBar
            actions={(
              <div className="flex flex-wrap items-center gap-2">
                <Button form="process-operations-filter" type="submit" variant="primary">{labels.applyFilters}</Button>
                <Button loading={busy && Boolean(inbox)} onClick={() => setReloadVersion((value) => value + 1)} type="button" variant="secondary">
                  <RefreshCw aria-hidden="true" />
                  {labels.refresh}
                </Button>
              </div>
            )}
          >
            <form action="/settings/process-automation/operations" className="contents" id="process-operations-filter" method="get">
              <label className="grid min-w-0 flex-1 gap-1 text-sm font-medium text-foreground sm:min-w-64">
                {labels.search}
                <TextInput autoComplete="off" defaultValue={labels.initialSearch} name="search" />
              </label>
              <label className="grid min-w-0 flex-1 gap-1 text-sm font-medium text-foreground sm:min-w-52">
                {labels.filter}
                <DropdownSelect defaultValue={labels.initialFilter} name="filter">
                  <option value="ALL">{labels.filterAll}</option>
                  <option value="BLOCKED">{labels.filterBlocked}</option>
                  <option value="OVERDUE">{labels.filterOverdue}</option>
                  <option value="RETRY">{labels.filterRetry}</option>
                  <option value="FAILED">{labels.filterFailed}</option>
                </DropdownSelect>
              </label>
              <input name="page" type="hidden" value="1" />
            </form>
          </FilterBar>
        )}
      />

      {actionMessage ? <p className="text-sm text-foreground" role={actionMessage.error ? 'alert' : 'status'}>{actionMessage.text}</p> : null}
      {stale ? <p className="text-sm text-warning" role="status">{labels.stale}</p> : null}
      {denied ? <EmptyState description={labels.denied} icon={<Activity />} title={labels.denied} /> : null}
      {loadError ? <EmptyState description={labels.loadError} icon={<Activity />} title={labels.loadError} /> : null}
      {busy && !inbox && !denied && !loadError ? (
        <DataTableShell state="loading" stateContent={<p>{labels.loading}</p>}>{null}</DataTableShell>
      ) : null}
      {!busy && !denied && !loadError && inbox && inbox.total === 0 ? (
        <EmptyState description={labels.emptyDescription} icon={<Activity />} title={labels.emptyTitle} />
      ) : null}
      {!busy && !denied && !loadError && inbox && inbox.total > 0 && inbox.items.length === 0 ? (
        <EmptyState description={labels.noResults} title={labels.noResults} />
      ) : null}
      {inbox && inbox.items.length > 0 ? (
        <section aria-labelledby="process-operations-list-title" className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground" id="process-operations-list-title">{labels.listTitle}</h2>
          <DataTableShell caption={labels.listTitle}>
            <thead className="border-b border-border-subtle bg-surface-subtle text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3" scope="col">{labels.process}</th>
                <th className="px-4 py-3" scope="col">{labels.problem}</th>
                <th className="px-4 py-3" scope="col">{labels.responsible} / {labels.deadline}</th>
                <th className="px-4 py-3" scope="col">{labels.occurredAt}</th>
                <th className="px-4 py-3" scope="col">{labels.openProcess}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {inbox.items.map((item) => (
                <tr className="align-top" key={`${item.problemKey}-${item.sourceId}`}>
                  <td className="min-w-48 px-4 py-4">
                    <p className="font-medium text-foreground">{item.processTitle}</p>
                    {item.stepTitle ? <p className="mt-1 text-sm text-muted-foreground">{item.stepTitle}</p> : null}
                  </td>
                  <td className="min-w-60 px-4 py-4">
                    <Badge tone={problemTone(item.problemKey)}>{statusLabel(item.status, labels)}</Badge>
                    <p className="mt-2 text-sm text-foreground">{problemLabel(item.problemKey, labels)}</p>
                    {item.jobType ? <p className="mt-1 text-sm text-muted-foreground">{item.jobType === 'PROCESS_REMINDER' ? labels.reminderJob : labels.documentJob}</p> : null}
                    {item.jobId ? <p className="mt-1 text-sm text-muted-foreground">{failureReason(item, labels)}</p> : null}
                    {item.lastErrorCode ? (
                      <details className="mt-2 text-sm text-muted-foreground">
                        <summary className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">{labels.diagnostics}</summary>
                        <dl className="mt-2">
                          <dt>{labels.errorCode}</dt>
                          <dd><code className="break-all">{item.lastErrorCode}</code></dd>
                        </dl>
                      </details>
                    ) : null}
                  </td>
                  <td className="min-w-52 px-4 py-4 text-sm">
                    <p className="text-foreground">{item.responsibleLabel ?? labels.unassigned}</p>
                    <p className="mt-2 text-muted-foreground">{labels.deadline}: {item.deadlineAt ? formatDate(item.deadlineAt, labels.locale) : labels.noDeadline}</p>
                  </td>
                  <td className="min-w-56 px-4 py-4 text-sm">
                    <p className="text-foreground">{formatDate(item.occurredAt, labels.locale)}</p>
                    {item.jobId ? <p className="mt-1 text-muted-foreground">{labels.lastAttempt}: {formatDate(item.lastAttemptAt, labels.locale)}</p> : null}
                    {item.nextRetryAt ? (
                      <p className="mt-1 flex items-center gap-1 text-muted-foreground"><Clock3 aria-hidden="true" className="size-3.5" />{labels.nextRetry}: {formatDate(item.nextRetryAt, labels.locale)}</p>
                    ) : item.problemKey === 'AUTOMATION_RETRY' || item.problemKey === 'AUTOMATION_FAILED' ? (
                      <p className="mt-1 text-muted-foreground">{labels.noRetry}</p>
                    ) : null}
                  </td>
                  <td className="min-w-48 px-4 py-4">
                    <div className="flex flex-col items-start gap-2">
                      {item.workItemId ? (
                        <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={`/work/${item.workItemId}`}>
                          {labels.openProcess}
                        </Link>
                      ) : (
                        <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/settings/process-automation">
                          {labels.openStudio}
                        </Link>
                      )}
                      {item.canRecover && item.jobId ? (
                        <Button onClick={() => setSelectedJob(item)} size="sm" type="button" variant="secondary">
                          <RotateCcw aria-hidden="true" />
                          {labels.retry}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTableShell>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {labels.pageSummary
                .replace('{page}', String(inbox.page))
                .replace('{totalPages}', String(inbox.totalPages))
                .replace('{total}', String(inbox.total))}
            </p>
            <Pagination
              ariaLabel={labels.listTitle}
              currentPage={inbox.page}
              nextLabel={labels.nextPage}
              onPageChange={(page) => router.push(withQuery(labels.initialSearch, labels.initialFilter, page))}
              previousLabel={labels.previousPage}
              totalPages={inbox.totalPages}
            />
          </div>
        </section>
      ) : null}

      <Dialog
        closeLabel={labels.cancel}
        description={labels.retryDescription}
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={() => setSelectedJob(null)} type="button" variant="secondary">{labels.cancel}</Button>
            <Button loading={retryingJobId !== null} onClick={() => void confirmRetry()} type="button">
              <RotateCcw aria-hidden="true" />
              {retryingJobId ? labels.retrying : labels.retryConfirm}
            </Button>
          </div>
        )}
        onOpenChange={(open) => { if (!open && !retryingJobId) setSelectedJob(null) }}
        open={selectedJob !== null}
        title={labels.retryTitle}
      >
        {selectedJob ? (
          <dl className="grid gap-3 text-sm">
            <div><dt className="font-medium text-foreground">{labels.process}</dt><dd className="mt-1 text-muted-foreground">{selectedJob.processTitle}</dd></div>
            {selectedJob.stepTitle ? <div><dt className="font-medium text-foreground">{labels.step}</dt><dd className="mt-1 text-muted-foreground">{selectedJob.stepTitle}</dd></div> : null}
            <div><dt className="font-medium text-foreground">{labels.status}</dt><dd className="mt-1 text-muted-foreground">{statusLabel(selectedJob.status, labels)}</dd></div>
          </dl>
        ) : null}
      </Dialog>
    </div>
  )
}
