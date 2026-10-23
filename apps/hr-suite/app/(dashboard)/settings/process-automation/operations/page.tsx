import Link from 'next/link'
import { Activity } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { ProcessOperationsWorkspace, type ProcessOperationsLabels } from '@/components/process-automation/process-operations-workspace'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { processOperationsFilterSchema } from '@/lib/process-automation/operations-service'

export const dynamic = 'force-dynamic'

export default async function ProcessOperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; filter?: string; page?: string }>
}) {
  const [{ search, filter, page }, locale, messages] = await Promise.all([
    searchParams,
    getLocale(),
    getTranslator('processAutomation'),
  ])
  const section = (key: string) => `operationsWorkspace.${key}`
  const parsedFilter = processOperationsFilterSchema.safeParse(filter)
  const filterValue = parsedFilter.success ? parsedFilter.data : 'ALL'
  const pageValue = Number(page ?? '1')
  const initialPage = Number.isSafeInteger(pageValue) && pageValue > 0 ? Math.min(pageValue, 100_000) : 1
  const labels: ProcessOperationsLabels = {
    title: messages(section('title')),
    description: messages(section('description')),
    openStudio: messages(section('openStudio')),
    refresh: messages(section('refresh')),
    scopeTotal: messages(section('scopeTotal')),
    blockedProcesses: messages(section('blockedProcesses')),
    overdueTasks: messages(section('overdueTasks')),
    failedAutomations: messages(section('failedAutomations')),
    retryingAutomations: messages(section('retryingAutomations')),
    search: messages(section('search')),
    filter: messages(section('filter')),
    applyFilters: messages(section('applyFilters')),
    filterAll: messages(section('filterAll')),
    filterBlocked: messages(section('filterBlocked')),
    filterOverdue: messages(section('filterOverdue')),
    filterRetry: messages(section('filterRetry')),
    filterFailed: messages(section('filterFailed')),
    listTitle: messages(section('listTitle')),
    process: messages(section('process')),
    step: messages(section('step')),
    status: messages(section('status')),
    responsible: messages(section('responsible')),
    unassigned: messages(section('unassigned')),
    deadline: messages(section('deadline')),
    problem: messages(section('problem')),
    occurredAt: messages(section('occurredAt')),
    lastAttempt: messages(section('lastAttempt')),
    nextRetry: messages(section('nextRetry')),
    noRetry: messages(section('noRetry')),
    noDeadline: messages(section('noDeadline')),
    reminderJob: messages(section('reminderJob')),
    documentJob: messages(section('documentJob')),
    openProcess: messages(section('openProcess')),
    diagnostics: messages(section('diagnostics')),
    errorCode: messages(section('errorCode')),
    failureReasonRecipientMissing: messages(section('failureReasonRecipientMissing')),
    failureReasonEscalationMissing: messages(section('failureReasonEscalationMissing')),
    failureReasonContextMissing: messages(section('failureReasonContextMissing')),
    failureReasonExpired: messages(section('failureReasonExpired')),
    failureReasonTemporary: messages(section('failureReasonTemporary')),
    failureReasonReminder: messages(section('failureReasonReminder')),
    failureReasonDocument: messages(section('failureReasonDocument')),
    problemBlocked: messages(section('problemBlocked')),
    problemOverdue: messages(section('problemOverdue')),
    problemRetry: messages(section('problemRetry')),
    problemFailed: messages(section('problemFailed')),
    statusOpen: messages(section('statusOpen')),
    statusClaimed: messages(section('statusClaimed')),
    statusBlocked: messages(section('statusBlocked')),
    statusRetry: messages(section('statusRetry')),
    statusDeadLetter: messages(section('statusDeadLetter')),
    statusRunning: messages(section('statusRunning')),
    statusWaiting: messages(section('statusWaiting')),
    statusCompleted: messages(section('statusCompleted')),
    statusCancelled: messages(section('statusCancelled')),
    statusUnknown: messages(section('statusUnknown')),
    retry: messages(section('retry')),
    retrying: messages(section('retrying')),
    retryTitle: messages(section('retryTitle')),
    retryDescription: messages(section('retryDescription')),
    retryConfirm: messages(section('retryConfirm')),
    cancel: messages(section('cancel')),
    retrySuccess: messages(section('retrySuccess')),
    retryFailed: messages(section('retryFailed')),
    loading: messages(section('loading')),
    loadError: messages(section('loadError')),
    denied: messages(section('denied')),
    stale: messages(section('stale')),
    emptyTitle: messages(section('emptyTitle')),
    emptyDescription: messages(section('emptyDescription')),
    noResults: messages(section('noResults')),
    pageSummary: messages(section('pageSummary')),
    previousPage: messages(section('previousPage')),
    nextPage: messages(section('nextPage')),
    initialFilter: filterValue,
    initialSearch: search ?? '',
    initialPage,
    locale,
  }

  return (
    <PageShell className="space-y-6 py-8" width="wide">
      <PageHeader
        actions={(
          <Link className={buttonClasses({ variant: 'secondary' })} href="/settings/process-automation">
            <Activity aria-hidden="true" />
            {labels.openStudio}
          </Link>
        )}
        description={labels.description}
        title={labels.title}
      />
      <ProcessOperationsWorkspace labels={labels} />
    </PageShell>
  )
}
