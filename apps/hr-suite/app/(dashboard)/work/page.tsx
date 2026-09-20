import { ProcessWorkWorkspace, type ProcessWorkspaceLabels } from '@/components/process-automation/process-workspace'
import { getRequestAuthorizationContext } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { getDocumentAcknowledgementStartData } from '@/lib/process-automation/document-acknowledgement-service'
import { getInternalTransferStartData } from '@/lib/process-automation/internal-transfer-start-service'
import { listProcessWork, listProcessWorkFilterOptions, listProcessWorkTabCounts, type ProcessWorkBusinessCategory, type ProcessWorkBusinessType, type ProcessWorkSort, type ProcessWorkTab, type ProcessWorkView, ProcessWorkError } from '@/lib/process-automation/work-service'

interface WorkPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function tab(value: string): ProcessWorkTab {
  return ['TODO', 'CLAIMED', 'WAITING', 'COMPLETED', 'ALL'].includes(value) ? value as ProcessWorkTab : 'TODO'
}

function view(value: string): ProcessWorkView {
  return value === 'REQUESTS' ? 'REQUESTS' : 'WORK'
}

function businessType(value: string): ProcessWorkBusinessType | undefined {
  return ['P_MUTATION', 'LEAVE', 'ACTUAL_WORK', 'OTHER'].includes(value) ? value as ProcessWorkBusinessType : undefined
}

function businessCategory(value: string): ProcessWorkBusinessCategory | undefined {
  return ['GENERAL', 'INTERNAL_TRANSFER', 'DOCUMENT_ACKNOWLEDGEMENT', 'LEAVE_REQUEST', 'ACTUAL_WORK_ENTRY'].includes(value) ? value as ProcessWorkBusinessCategory : undefined
}

function sort(value: string): ProcessWorkSort {
  return value === 'DEADLINE' ? 'DEADLINE' : 'NEEDS_ACTION'
}

function page(value: string): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 10000) : 1
}

const WORK_PAGE_SIZE = 25

export default async function WorkPage({ searchParams }: WorkPageProps) {
  const query = await searchParams
  const requestContext = await getRequestAuthorizationContext()
  const locale = await getLocale()
  const t = await getTranslator('processAutomation', locale)
  const currentTab = tab(first(query.tab))
  const currentView = view(first(query.view))
  const currentSearch = first(query.search).slice(0, 120)
  const currentStatus = first(query.status).slice(0, 40)
  const currentProcessDefinitionId = first(query.processDefinitionId)
  const currentAdministrationId = first(query.administrationId)
  const currentSort = sort(first(query.sort))
  const currentBusinessType = businessType(first(query.businessType))
  const currentBusinessCategory = businessCategory(first(query.businessCategory))
  const currentPage = page(first(query.page))
  const workDependencies = { supabase: requestContext.supabase, context: requestContext.context }
  const labels: ProcessWorkspaceLabels = {
    workspaceTitle: t('workspaceTitle'),
    workspaceDescription: t('workspaceDescription'),
    myWork: t('myWork'),
    myRequests: t('myRequests'),
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
    statusWaiting: t('statusWaiting'),
    statusInProgress: t('statusInProgress'),
    statusChangesRequested: t('statusChangesRequested'),
    statusRejected: t('statusRejected'),
    businessTypeFilter: t('businessTypeFilter'),
    businessCategoryFilter: t('businessCategoryFilter'),
    businessType: t('businessType'),
    businessCategory: t('businessCategory'),
    allBusinessTypes: t('allBusinessTypes'),
    allBusinessCategories: t('allBusinessCategories'),
    businessTypePMutation: t('businessTypePMutation'),
    businessTypeLeave: t('businessTypeLeave'),
    businessTypeActualWork: t('businessTypeActualWork'),
    businessTypeOther: t('businessTypeOther'),
    businessCategoryGeneral: t('businessCategoryGeneral'),
    businessCategoryInternalTransfer: t('businessCategoryInternalTransfer'),
    businessCategoryDocumentAcknowledgement: t('businessCategoryDocumentAcknowledgement'),
    businessCategoryLeaveRequest: t('businessCategoryLeaveRequest'),
    businessCategoryActualWorkEntry: t('businessCategoryActualWorkEntry'),
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
    totalItems: t('totalItems'),
    noItemsDescription: t('noItemsDescription'),
    allProcesses: t('allProcesses'),
    allAdministrations: t('allAdministrations'),
    resultsCount: t('resultsCount'),
    pageOf: t('pageOf'),
    previous: t('previous'),
    next: t('next'),
    startInternalTransfer: t('p9.startTitle'),
    startDocumentAcknowledgement: t('p10.startTitle'),
    startLeaveRequest: t('startLeaveRequest'),
  }

  let data = null
  let tabCounts = null
  let errorCode: string | undefined
  try {
    const input = {
      search: currentSearch,
      status: currentStatus,
      view: currentView,
      businessType: currentBusinessType,
      businessCategory: currentBusinessCategory,
      processDefinitionId: currentProcessDefinitionId || undefined,
      administrationId: currentAdministrationId || undefined,
      language: locale,
      sort: currentSort,
    } as const
    ;[data, tabCounts] = await Promise.all([
      listProcessWork({ ...input, tab: currentTab, limit: WORK_PAGE_SIZE, offset: (currentPage - 1) * WORK_PAGE_SIZE }, workDependencies),
      currentView === 'WORK' ? listProcessWorkTabCounts(input, workDependencies) : Promise.resolve(null),
    ])
  } catch (error) {
    errorCode = error instanceof ProcessWorkError ? error.code : 'PROCESS_WORK_PROJECTION_FAILED'
  }

  const options = await listProcessWorkFilterOptions(workDependencies, locale).catch(() => ({ processes: [], administrations: [] }))
  const canStartInternalTransfer = await getInternalTransferStartData().then(() => true).catch(() => false)
  const canStartDocumentAcknowledgement = await getDocumentAcknowledgementStartData().then(() => true).catch(() => false)
  const canStartLeaveRequest = Boolean(requestContext.context.employeeId && requestContext.context.permissions.includes('self:leave:request'))
  return <ProcessWorkWorkspace locale={locale} labels={labels} data={data} options={options} tabCounts={tabCounts} view={currentView} tab={currentTab} page={currentPage} pageSize={WORK_PAGE_SIZE} search={currentSearch} status={currentStatus} businessType={currentBusinessType ?? ''} businessCategory={currentBusinessCategory ?? ''} processDefinitionId={currentProcessDefinitionId} administrationId={currentAdministrationId} sort={currentSort} canStartLeaveRequest={canStartLeaveRequest} canStartInternalTransfer={canStartInternalTransfer} canStartDocumentAcknowledgement={canStartDocumentAcknowledgement} errorCode={errorCode} />
}
