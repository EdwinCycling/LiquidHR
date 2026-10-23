'use client'

import Link from 'next/link'
import { ListTodo } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { CollectionPagination } from '@/components/patterns/collection-pagination'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { FilterBar } from '@/components/patterns/filter-bar'
import { PageHeader } from '@/components/patterns/page-header'
import { ScrollableTabs, tabLinkClasses } from '@/components/patterns/scrollable-tabs'
import { PageShell } from '@/components/layout/page-shell'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import type { Locale } from '@/lib/i18n/config'
import { processWorkDeadlineStatusLabel, type ProcessWorkDeadlineLabels } from '@/lib/process-automation/deadline-projection'
import type { StartableProcess } from '@/lib/process-automation/start-catalog-service'
import { getProcessWorkItemHref, withProcessWorkReturnContext, type ProcessWorkReturnContext } from '@/lib/process-automation/work-routing'
import type { ProcessWorkBusinessCategory, ProcessWorkBusinessType, ProcessWorkFilterOptions, ProcessWorkItem, ProcessWorkList, ProcessWorkSort, ProcessWorkTab, ProcessWorkTabCounts, ProcessWorkView } from '@/lib/process-automation/work-service'
import { ProcessStartCatalog } from './process-start-catalog'

const nativeProcessKeyPrefixes = ['internal-transfer', 'document-acknowledgement', 'leave-request'] as const
const nativeProcessTitles: Record<Locale, readonly string[]> = {
  nl: ['interne overplaatsing', 'documentkennisname', 'verlofaanvraag'],
  en: ['internal transfer', 'document acknowledgement', 'leave request'],
}

function filterNativeProcessStartCatalogEntries(
  processes: readonly StartableProcess[],
  locale: Locale,
  definitions: ProcessWorkFilterOptions['processes'],
): readonly StartableProcess[] {
  const nativeDefinitionIds = new Set(definitions
    .filter(({ key }) => {
      const normalizedKey = key.trim().toLocaleLowerCase()
      return nativeProcessKeyPrefixes.some((prefix) => new RegExp(`(?:^|-)${prefix}(?:-v\\d+)?$`).test(normalizedKey))
    })
    .map(({ id }) => id))

  return processes.filter((process) => {
    if (nativeDefinitionIds.has(process.processDefinitionId)) return false
    const title = process.title[locale]?.trim() || process.title[locale === 'nl' ? 'en' : 'nl']?.trim() || ''
    return !nativeProcessTitles[locale].includes(title.toLocaleLowerCase())
  })
}

export interface ProcessWorkspaceLabels extends ProcessWorkDeadlineLabels {
  workspaceTitle: string
  workspaceDescription: string
  myWork: string
  myRequests: string
  tabsTodo: string
  tabsClaimed: string
  tabsWaiting: string
  tabsCompleted: string
  tabsAll: string
  searchPlaceholder: string
  statusFilter: string
  processFilter: string
  administrationFilter: string
  applyFilters: string
  statusAll: string
  statusOpen: string
  statusClaimed: string
  statusBlocked: string
  statusCompleted: string
  statusCancelled: string
  statusExpired: string
  statusWaiting: string
  statusInProgress: string
  statusChangesRequested: string
  statusRejected: string
  businessTypeFilter: string
  businessCategoryFilter: string
  businessType: string
  businessCategory: string
  allBusinessTypes: string
  allBusinessCategories: string
  businessTypePMutation: string
  businessTypeLeave: string
  businessTypeActualWork: string
  businessTypeOther: string
  businessCategoryGeneral: string
  businessCategoryInternalTransfer: string
  businessCategoryDocumentAcknowledgement: string
  businessCategoryLeaveRequest: string
  businessCategoryActualWorkEntry: string
  sort: string
  sortNeedsAction: string
  sortDeadline: string
  columnsProcess: string
  subject: string
  step: string
  assignment: string
  status: string
  deadline: string
  actions: string
  assignmentMode: string
  assignmentSource: string
  assignmentDate: string
  assignmentRole: string
  assignmentAnyOne: string
  assignmentQueue: string
  assignmentDirect: string
  assignmentScope: string
  assignmentProcess: string
  unknown: string
  noItems: string
  noItemsDescription: string
  loading: string
  readError: string
  denied: string
  blocked: string
  overdue: string
  nearDue: string
  currentPage: string
  availableAt: string
  claimedBy: string
  unassigned: string
  open: string
  totalItems: string
  allProcesses: string
  allAdministrations: string
  resultsCount: string
  pageOf: string
  previous: string
  next: string
  startInternalTransfer: string
  startDocumentAcknowledgement: string
  startLeaveRequest: string
  nextResponsible: string
  responsibleYou: string
  responsibleManager: string
  responsibleHr: string
  newRequestTitle: string
  newRequestDescription: string
  processSteps: string
  processRoutes: string
  processResponsible: string
  processStartStep: string
  processStart: string
  processStarting: string
  processCatalogEmpty: string
  processCatalogLoadError: string
  processStartFailed: string
  processStartDenied: string
  processStartUnavailable: string
  processStartCalendarBlocked: string
  processCatalogEmptyWithNativeStarters: string
}

interface ProcessWorkspaceProps {
  readonly locale: Locale
  readonly timeZone: string
  readonly labels: ProcessWorkspaceLabels
  readonly data: ProcessWorkList | null
  readonly options: ProcessWorkFilterOptions
  readonly startableProcesses: readonly StartableProcess[]
  readonly processCatalogError?: boolean
  readonly returnContext?: ProcessWorkReturnContext
  readonly tabCounts: ProcessWorkTabCounts | null
  readonly view: ProcessWorkView
  readonly tab: ProcessWorkTab
  readonly page: number
  readonly pageSize: number
  readonly search: string
  readonly status: string
  readonly businessType: string
  readonly businessCategory: string
  readonly processDefinitionId: string
  readonly administrationId: string
  readonly sort: ProcessWorkSort
  readonly canStartInternalTransfer: boolean
  readonly canStartDocumentAcknowledgement: boolean
  readonly canStartLeaveRequest: boolean
  readonly errorCode?: string
}

const tabs: readonly ProcessWorkTab[] = ['TODO', 'CLAIMED', 'WAITING', 'COMPLETED', 'ALL']
const statusLabels: Record<string, keyof ProcessWorkspaceLabels> = {
  OPEN: 'statusOpen', WAITING: 'statusWaiting', IN_PROGRESS: 'statusInProgress', CHANGES_REQUESTED: 'statusChangesRequested', COMPLETED: 'statusCompleted', REJECTED: 'statusRejected', CANCELLED: 'statusCancelled', BLOCKED: 'statusBlocked', EXPIRED: 'statusExpired',
}

const businessTypeLabels: Record<ProcessWorkBusinessType, keyof ProcessWorkspaceLabels> = {
  P_MUTATION: 'businessTypePMutation',
  LEAVE: 'businessTypeLeave',
  ACTUAL_WORK: 'businessTypeActualWork',
  OTHER: 'businessTypeOther',
}

const businessCategoryLabels: Record<ProcessWorkBusinessCategory, keyof ProcessWorkspaceLabels> = {
  GENERAL: 'businessCategoryGeneral',
  INTERNAL_TRANSFER: 'businessCategoryInternalTransfer',
  DOCUMENT_ACKNOWLEDGEMENT: 'businessCategoryDocumentAcknowledgement',
  LEAVE_REQUEST: 'businessCategoryLeaveRequest',
  ACTUAL_WORK_ENTRY: 'businessCategoryActualWorkEntry',
}

function formatDate(value: string | null, locale: Locale, timeZone: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(date)
}

function deadlineTone(status: ProcessWorkItem['deadlineStatus']): BadgeTone {
  if (status === 'OVERDUE') return 'danger'
  if (status === 'NEAR_DUE') return 'warning'
  if (status === 'ON_TRACK') return 'success'
  return 'neutral'
}

function DeadlineSummary({ item, locale, timeZone, labels }: { item: ProcessWorkItem; locale: Locale; timeZone: string; labels: ProcessWorkspaceLabels }) {
  return <div className="grid justify-items-start gap-1.5">
    {item.deadlineAt ? <time className="text-sm font-medium" dateTime={item.deadlineAt}>{formatDate(item.deadlineAt, locale, timeZone)}</time> : null}
    <Badge tone={deadlineTone(item.deadlineStatus)}>{processWorkDeadlineStatusLabel(item.deadlineStatus, item.deadlineRemainingSeconds, labels)}</Badge>
  </div>
}

function tabLabel(tab: ProcessWorkTab, labels: ProcessWorkspaceLabels): string {
  return { TODO: labels.tabsTodo, CLAIMED: labels.tabsClaimed, WAITING: labels.tabsWaiting, COMPLETED: labels.tabsCompleted, ALL: labels.tabsAll }[tab]
}

function buildQuery(input: { view: ProcessWorkView; tab: ProcessWorkTab; search: string; status: string; businessType: string; businessCategory: string; processDefinitionId: string; administrationId: string; sort: ProcessWorkSort; returnContext?: ProcessWorkReturnContext; page?: number }): string {
  const params = new URLSearchParams()
  if (input.view !== 'WORK') params.set('view', input.view)
  if (input.tab !== 'TODO') params.set('tab', input.tab)
  if (input.search) params.set('search', input.search)
  if (input.status) params.set('status', input.status)
  if (input.businessType) params.set('businessType', input.businessType)
  if (input.businessCategory) params.set('businessCategory', input.businessCategory)
  if (input.processDefinitionId) params.set('processDefinitionId', input.processDefinitionId)
  if (input.administrationId) params.set('administrationId', input.administrationId)
  if (input.sort !== 'NEEDS_ACTION') params.set('sort', input.sort)
  if (input.returnContext) params.set('returnTo', input.returnContext)
  if (input.page && input.page > 1) params.set('page', String(input.page))
  const query = params.toString()
  return query ? `?${query}` : ''
}

function assignmentText(item: ProcessWorkItem, labels: ProcessWorkspaceLabels): string {
  return requesterRoleText(item, labels)
}

function requesterRoleText(item: ProcessWorkItem, labels: ProcessWorkspaceLabels): string {
  const participant = item.participantKey.toLowerCase().replaceAll('_', '-')
  const roleCode = (item.assignmentExplanation.roleCode ?? '').toUpperCase().replaceAll('-', '_')
  if (participant === 'employee' || participant === 'initiator') return labels.responsibleYou
  if (participant.includes('manager') || roleCode === 'DIRECT_MANAGER' || roleCode.endsWith('_MANAGER')) return labels.responsibleManager
  if (participant.includes('hr') || roleCode.includes('HR')) return labels.responsibleHr
  return labels.nextResponsible
}

function workItemHref(item: ProcessWorkItem, view: ProcessWorkView, returnContext?: ProcessWorkReturnContext): string {
  const href = getProcessWorkItemHref(item.businessType, item.workItemId)
  const requestHref = view === 'REQUESTS' && href.startsWith('/work/') ? `${href}?view=REQUESTS` : href
  return withProcessWorkReturnContext(requestHref, returnContext)
}

function effectiveStatus(item: ProcessWorkItem): string {
  return item.businessStatus
}

function workStatusLabel(status: string, labels: ProcessWorkspaceLabels): string {
  const key = statusLabels[status]
  return key ? labels[key] : labels.unknown
}

function businessContextText(item: ProcessWorkItem, labels: ProcessWorkspaceLabels): string {
  return item.businessCategory === 'GENERAL'
    ? labels[businessTypeLabels[item.businessType]]
    : labels[businessCategoryLabels[item.businessCategory]]
}

function statusTone(status: string, overdue: boolean): BadgeTone {
  if (overdue) return 'danger'
  if (status === 'COMPLETED') return 'success'
  if (status === 'CHANGES_REQUESTED' || status === 'REJECTED' || status === 'CANCELLED') return 'warning'
  if (status === 'IN_PROGRESS' || status === 'OPEN') return 'info'
  return 'neutral'
}

function StatusBadge({ item, labels, view }: { item: ProcessWorkItem; labels: ProcessWorkspaceLabels; view: ProcessWorkView }) {
  const currentStatus = effectiveStatus(item)
  const requesterStatus = currentStatus === 'COMPLETED' || item.instanceStatus === 'COMPLETED'
    ? labels.statusCompleted
    : currentStatus === 'REJECTED' || item.instanceStatus === 'REJECTED'
      ? labels.statusRejected
      : currentStatus === 'CHANGES_REQUESTED'
        ? labels.statusChangesRequested
        : currentStatus === 'WAITING'
          ? labels.statusWaiting
          : labels.statusInProgress
  return <Badge tone={statusTone(currentStatus, item.isOverdue)}>{item.isOverdue ? labels.overdue : view === 'REQUESTS' ? requesterStatus : workStatusLabel(currentStatus, labels)}</Badge>
}

function WorkItemCard({ item, locale, timeZone, labels, view, returnContext }: { item: ProcessWorkItem; locale: Locale; timeZone: string; labels: ProcessWorkspaceLabels; view: ProcessWorkView; returnContext?: ProcessWorkReturnContext }) {
  return (
    <Surface className="p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">{view === 'REQUESTS' ? null : <p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{labels.businessType}: {labels[businessTypeLabels[item.businessType]]}</p>}<h2 className="mt-1 truncate text-base font-semibold text-foreground">{item.processTitle}</h2></div>
        <StatusBadge item={item} labels={labels} view={view} />
      </div>
      <dl className="mt-4 grid gap-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">{labels.subject}</dt><dd className="font-medium">{item.subjectName ?? labels.unknown}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{labels.step}</dt><dd>{item.stepTitle}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{view === 'REQUESTS' ? labels.assignmentRole : labels.assignment}</dt><dd>{view === 'REQUESTS' ? requesterRoleText(item, labels) : assignmentText(item, labels)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{labels.deadline}</dt><dd className="mt-1"><DeadlineSummary item={item} locale={locale} timeZone={timeZone} labels={labels} /></dd></div>
      </dl>
      <Link className={`${buttonClasses({ size: 'sm' })} mt-5`} href={workItemHref(item, view, returnContext)}>{labels.open}</Link>
    </Surface>
  )
}

export function ProcessWorkWorkspace({ locale, timeZone, labels, data, options, startableProcesses, processCatalogError, returnContext, tabCounts, view, tab, page, pageSize, search, status, businessType, businessCategory, processDefinitionId, administrationId, sort, canStartLeaveRequest, canStartInternalTransfer, canStartDocumentAcknowledgement, errorCode }: ProcessWorkspaceProps) {
  const router = useRouter()
  const errorMessage = errorCode === 'FORBIDDEN' ? labels.denied : labels.readError
  const overdueCount = data?.items.filter((item) => item.deadlineStatus === 'OVERDUE').length ?? 0
  const nearDueCount = data?.items.filter((item) => item.deadlineStatus === 'NEAR_DUE').length ?? 0
  const totalPages = data ? Math.ceil(data.total / pageSize) : 0
  const resultFrom = data && data.total > 0 ? (page - 1) * pageSize + 1 : 0
  const resultTo = data ? Math.min(page * pageSize, data.total) : 0
  const queryState = { view, tab, search, status, businessType, businessCategory, processDefinitionId, administrationId, sort, returnContext }
  const genericStartCatalogProcesses = filterNativeProcessStartCatalogEntries(startableProcesses, locale, options.processes)

  return (
    <PageShell className="py-8" width="wide">
      <PageHeader
        title={labels.workspaceTitle}
        description={labels.workspaceDescription}
        actions={<><Badge tone="info">{data?.total ?? 0} {labels.totalItems}</Badge>{canStartLeaveRequest ? <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/leave/request">{labels.startLeaveRequest}</Link> : null}{canStartInternalTransfer ? <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/work/new/internal-transfer">{labels.startInternalTransfer}</Link> : null}{canStartDocumentAcknowledgement ? <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/work/new/document-acknowledgement">{labels.startDocumentAcknowledgement}</Link> : null}</>}
      />

      <div className="mt-6 flex flex-wrap gap-2" aria-label={labels.workspaceTitle}>
        <Link className={tabLinkClasses({ active: view === 'WORK' })} href={`/work${buildQuery({ ...queryState, view: 'WORK', tab: 'TODO', page: 1 })}`}>{labels.myWork}</Link>
        <Link className={tabLinkClasses({ active: view === 'REQUESTS' })} href={`/work${buildQuery({ ...queryState, view: 'REQUESTS', tab: 'ALL', page: 1 })}`}>{labels.myRequests}</Link>
      </div>

      {view === 'REQUESTS' ? <ProcessStartCatalog locale={locale} labels={{ title: labels.newRequestTitle, description: labels.newRequestDescription, steps: labels.processSteps, routes: labels.processRoutes, responsible: labels.processResponsible, startStep: labels.processStartStep, start: labels.processStart, starting: labels.processStarting, empty: canStartLeaveRequest || canStartInternalTransfer || canStartDocumentAcknowledgement ? labels.processCatalogEmptyWithNativeStarters : labels.processCatalogEmpty, loadError: labels.processCatalogLoadError, startFailed: labels.processStartFailed, startDenied: labels.processStartDenied, startUnavailable: labels.processStartUnavailable, calendarBlocked: labels.processStartCalendarBlocked }} processes={genericStartCatalogProcesses} loadError={processCatalogError} returnContext={returnContext} /> : null}

      {view === 'WORK' ? <ScrollableTabs ariaLabel={labels.workspaceTitle} className="mt-4" contentProps={{ role: 'tablist' }} leftLabel={labels.previous} rightLabel={labels.next}>
        {tabs.map((candidate) => <Link key={candidate} aria-current={candidate === tab ? 'page' : undefined} className={tabLinkClasses({ active: candidate === tab })} href={`/work${buildQuery({ ...queryState, tab: candidate })}`}>{tabLabel(candidate, labels)}{tabCounts ? <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">{tabCounts[candidate]}</span> : null}</Link>)}
      </ScrollableTabs> : null}

      <FilterBar className="mt-6">
        <form action="/work" className="contents" method="get">
          <label className="basis-full min-w-0 flex-1 sm:basis-0"><span className="sr-only">{labels.searchPlaceholder}</span><TextInput defaultValue={search} name="search" placeholder={labels.searchPlaceholder} type="search" /></label>
          <label className="basis-full min-w-0 flex-1 text-xs font-semibold text-muted-foreground sm:basis-0"><span className="mb-1 block">{labels.statusFilter}</span><DropdownSelect aria-label={labels.statusFilter} defaultValue={status} name="status" placeholder={labels.statusAll} searchable searchPlaceholder={labels.searchPlaceholder}><option value="">{labels.statusAll}</option>{['OPEN', 'WAITING', 'IN_PROGRESS', 'CHANGES_REQUESTED', 'COMPLETED', 'REJECTED', 'CANCELLED'].map((value) => <option key={value} value={value}>{workStatusLabel(value, labels)}</option>)}</DropdownSelect></label>
          <label className="basis-full min-w-0 flex-1 text-xs font-semibold text-muted-foreground sm:basis-0"><span className="mb-1 block">{labels.businessTypeFilter}</span><DropdownSelect aria-label={labels.businessTypeFilter} defaultValue={businessType} name="businessType" placeholder={labels.allBusinessTypes} searchable searchPlaceholder={labels.searchPlaceholder}><option value="">{labels.allBusinessTypes}</option>{(Object.keys(businessTypeLabels) as ProcessWorkBusinessType[]).map((value) => <option key={value} value={value}>{labels[businessTypeLabels[value]]}</option>)}</DropdownSelect></label>
          <label className="basis-full min-w-0 flex-1 text-xs font-semibold text-muted-foreground sm:basis-0"><span className="mb-1 block">{labels.businessCategoryFilter}</span><DropdownSelect aria-label={labels.businessCategoryFilter} defaultValue={businessCategory} name="businessCategory" placeholder={labels.allBusinessCategories} searchable searchPlaceholder={labels.searchPlaceholder}><option value="">{labels.allBusinessCategories}</option>{(Object.keys(businessCategoryLabels) as ProcessWorkBusinessCategory[]).map((value) => <option key={value} value={value}>{labels[businessCategoryLabels[value]]}</option>)}</DropdownSelect></label>
          <label className="basis-full min-w-0 flex-1 text-xs font-semibold text-muted-foreground sm:basis-0"><span className="mb-1 block">{labels.processFilter}</span><DropdownSelect aria-label={labels.processFilter} defaultValue={processDefinitionId} name="processDefinitionId" placeholder={labels.allProcesses} searchable searchPlaceholder={labels.searchPlaceholder}><option value="">{labels.allProcesses}</option>{options.processes.map((process) => <option key={process.id} value={process.id}>{process.title}</option>)}</DropdownSelect></label>
          <label className="basis-full min-w-0 flex-1 text-xs font-semibold text-muted-foreground sm:basis-0"><span className="mb-1 block">{labels.administrationFilter}</span><DropdownSelect aria-label={labels.administrationFilter} defaultValue={administrationId} name="administrationId" placeholder={labels.allAdministrations} searchable searchPlaceholder={labels.searchPlaceholder}><option value="">{labels.allAdministrations}</option>{options.administrations.map((administration) => <option key={administration.id} value={administration.id}>{administration.name}</option>)}</DropdownSelect></label>
          <label className="basis-full min-w-0 flex-1 text-xs font-semibold text-muted-foreground sm:basis-0"><span className="mb-1 block">{labels.sort}</span><DropdownSelect aria-label={labels.sort} defaultValue={sort} name="sort" placeholder={labels.sortNeedsAction}><option value="NEEDS_ACTION">{labels.sortNeedsAction}</option><option value="DEADLINE">{labels.sortDeadline}</option></DropdownSelect></label>
          <input name="view" type="hidden" value={view} /><input name="tab" type="hidden" value={tab} /><input name="page" type="hidden" value="1" />
          {returnContext ? <input name="returnTo" type="hidden" value={returnContext} /> : null}
          <Button size="sm" type="submit">{labels.applyFilters}</Button>
        </form>
      </FilterBar>

      {errorCode ? <Surface className="mt-6 border-destructive/30 bg-destructive-surface p-4 text-sm text-destructive" role="alert">{errorMessage}</Surface> : null}
      {!errorCode && !data ? <Surface className="mt-6 p-5 text-sm text-muted-foreground" role="status">{labels.loading}</Surface> : null}
      {!errorCode && data?.items.length === 0 ? <div className="mt-6"><EmptyState description={labels.noItemsDescription} icon={<ListTodo />} title={labels.noItems} /></div> : null}
      {!errorCode && data && data.items.length > 0 ? <>
        <div className="mt-6 hidden md:block">
          <DataTableShell caption={labels.workspaceTitle}>
            <thead className="bg-surface-subtle text-xs uppercase tracking-[.1em] text-muted-foreground"><tr>{[labels.columnsProcess, labels.subject, labels.step, labels.assignment, labels.status, labels.deadline, labels.actions].map((heading, index) => <th className="px-4 py-3 font-semibold" key={`${heading}-${index}`}>{index === 6 ? <span className="sr-only">{heading}</span> : heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">{data.items.map((item) => <tr className="transition-colors hover:bg-muted/30" key={item.workItemId}><td className="px-4 py-4"><Link className="font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href={workItemHref(item, view, returnContext)}>{item.processTitle}</Link>{view === 'REQUESTS' ? null : <p className="mt-1 text-xs text-muted-foreground">{businessContextText(item, labels)}</p>}</td><td className="px-4 py-4">{item.subjectName ?? labels.unknown}</td><td className="px-4 py-4">{item.stepTitle}</td><td className="px-4 py-4 text-xs">{requesterRoleText(item, labels)}</td><td className="px-4 py-4"><StatusBadge item={item} labels={labels} view={view} /></td><td className="px-4 py-4"><DeadlineSummary item={item} locale={locale} timeZone={timeZone} labels={labels} /></td><td className="px-4 py-4 text-right"><Link className={buttonClasses({ size: 'sm', variant: 'ghost', className: 'text-primary' })} href={workItemHref(item, view, returnContext)}>{labels.open}</Link></td></tr>)}</tbody>
          </DataTableShell>
        </div>
        <div className="mt-6 grid gap-4 md:hidden">{data.items.map((item) => <WorkItemCard key={item.workItemId} item={item} locale={locale} timeZone={timeZone} labels={labels} view={view} returnContext={returnContext} />)}</div>
        <CollectionPagination className="mt-6" resultRange={labels.resultsCount.replace('{from}', String(resultFrom)).replace('{to}', String(resultTo)).replace('{count}', String(data.total))} pageSize={totalPages > 1 ? labels.pageOf.replace('{page}', String(page)).replace('{pages}', String(totalPages)) : undefined} pagination={totalPages > 1 ? { ariaLabel: labels.workspaceTitle, currentPage: page, totalPages, onPageChange: (nextPage) => router.push(`/work${buildQuery({ ...queryState, page: nextPage })}`), previousLabel: labels.previous, nextLabel: labels.next } : undefined} />
      </> : null}
      {data && data.items.length > 0 && (overdueCount > 0 || nearDueCount > 0) ? <div aria-live="polite" className="sr-only">{labels.currentPage}: {overdueCount ? `${overdueCount} ${labels.overdue}` : ''}{nearDueCount ? ` ${nearDueCount} ${labels.nearDue}` : ''}</div> : null}
    </PageShell>
  )
}
