import Link from 'next/link'
import { ProcessWorkWorkspace, type ProcessWorkspaceLabels } from '@/components/process-automation/process-workspace'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { getDocumentAcknowledgementStartData } from '@/lib/process-automation/document-acknowledgement-service'
import { getInternalTransferStartData } from '@/lib/process-automation/internal-transfer-start-service'
import { listProcessWork, listProcessWorkFilterOptions, type ProcessWorkSort, type ProcessWorkTab, ProcessWorkError } from '@/lib/process-automation/work-service'

interface WorkPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function tab(value: string): ProcessWorkTab {
  return ['TODO', 'CLAIMED', 'WAITING', 'COMPLETED', 'ALL'].includes(value) ? value as ProcessWorkTab : 'TODO'
}

function sort(value: string): ProcessWorkSort {
  return value === 'DEADLINE' ? 'DEADLINE' : 'NEEDS_ACTION'
}

export default async function WorkPage({ searchParams }: WorkPageProps) {
  const query = await searchParams
  const locale = await getLocale()
  const t = await getTranslator('processAutomation', locale)
  const currentTab = tab(first(query.tab))
  const currentSearch = first(query.search).slice(0, 120)
  const currentStatus = first(query.status).slice(0, 40)
  const currentProcessDefinitionId = first(query.processDefinitionId)
  const currentAdministrationId = first(query.administrationId)
  const currentSort = sort(first(query.sort))
  const labels: ProcessWorkspaceLabels = {
    workspaceTitle: t('workspaceTitle'),
    workspaceDescription: t('workspaceDescription'),
    tabsTodo: t('tabsTodo'),
    tabsClaimed: t('tabsClaimed'),
    tabsWaiting: t('tabsWaiting'),
    tabsCompleted: t('tabsCompleted'),
    tabsAll: t('tabsAll'),
    searchPlaceholder: t('searchPlaceholder'),
    statusFilter: t('statusFilter'),
    processFilter: t('processFilter'),
    administrationFilter: t('administrationFilter'),
    applyFilters: t('applyFilters'),
    statusAll: t('statusAll'),
    statusOpen: t('statusOpen'),
    statusClaimed: t('statusClaimed'),
    statusBlocked: t('statusBlocked'),
    statusCompleted: t('statusCompleted'),
    statusCancelled: t('statusCancelled'),
    statusExpired: t('statusExpired'),
    sort: t('sort'),
    sortNeedsAction: t('sortNeedsAction'),
    sortDeadline: t('sortDeadline'),
    columnsProcess: t('columnsProcess'),
    subject: t('subject'),
    step: t('step'),
    assignment: t('assignment'),
    status: t('status'),
    deadline: t('deadline'),
    actions: t('actions'),
    assignmentMode: t('assignmentMode'),
    assignmentSource: t('assignmentSource'),
    assignmentDate: t('assignmentDate'),
    assignmentRole: t('assignmentRole'),
    assignmentAnyOne: t('assignmentAnyOne'),
    assignmentQueue: t('assignmentQueue'),
    assignmentDirect: t('assignmentDirect'),
    assignmentScope: t('assignmentScope'),
    assignmentProcess: t('assignmentProcess'),
    unknown: t('unknown'),
    noItems: t('noItems'),
    loading: t('loading'),
    readError: t('readError'),
    denied: t('denied'),
    blocked: t('blocked'),
    overdue: t('overdue'),
    dueToday: t('dueToday'),
    availableAt: t('availableAt'),
    claimedBy: t('claimedBy'),
    unassigned: t('unassigned'),
    open: t('open'),
  }

  let data = null
  let errorCode: string | undefined
  try {
    data = await listProcessWork({
      tab: currentTab,
      search: currentSearch,
      status: currentStatus,
      processDefinitionId: currentProcessDefinitionId || undefined,
      administrationId: currentAdministrationId || undefined,
      language: locale,
      sort: currentSort,
    })
  } catch (error) {
    errorCode = error instanceof ProcessWorkError ? error.code : 'PROCESS_WORK_PROJECTION_FAILED'
  }

  const options = await listProcessWorkFilterOptions().catch(() => ({ processes: [], administrations: [] }))
  const canStartInternalTransfer = await getInternalTransferStartData().then(() => true).catch(() => false)
  const canStartDocumentAcknowledgement = await getDocumentAcknowledgementStartData().then(() => true).catch(() => false)
  return <>
    {canStartInternalTransfer || canStartDocumentAcknowledgement ? <div className="mx-auto flex w-full max-w-[92rem] flex-wrap justify-end gap-2 px-4 pt-6 sm:px-6 lg:px-10">
      {canStartDocumentAcknowledgement ? <Link className="button-secondary" href="/work/new/document-acknowledgement">{t('p10.startTitle')}</Link> : null}
      {canStartInternalTransfer ? <Link className="button-primary" href="/work/new/internal-transfer">{t('p9.startTitle')}</Link> : null}
    </div> : null}
    <ProcessWorkWorkspace locale={locale} labels={labels} data={data} options={options} tab={currentTab} search={currentSearch} status={currentStatus} processDefinitionId={currentProcessDefinitionId} administrationId={currentAdministrationId} sort={currentSort} errorCode={errorCode} />
  </>
}
