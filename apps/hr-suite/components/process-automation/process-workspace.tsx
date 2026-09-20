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
import { getProcessWorkItemHref } from '@/lib/process-automation/work-routing'
import type { ProcessWorkBusinessCategory, ProcessWorkBusinessType, ProcessWorkFilterOptions, ProcessWorkItem, ProcessWorkList, ProcessWorkSort, ProcessWorkTab, ProcessWorkTabCounts, ProcessWorkView } from '@/lib/process-automation/work-service'

export interface ProcessWorkspaceLabels {
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
  dueToday: string
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
}

interface ProcessWorkspaceProps {
  readonly locale: Locale
  readonly labels: ProcessWorkspaceLabels
  readonly data: ProcessWorkList | null
  readonly options: ProcessWorkFilterOptions
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
  OPEN: 'statusOpen', WAITING: 'statusWaiting', IN_PROGRESS: 'statusInProgress', CHANGES_REQUESTED: 'statusChangesRequested', COMPLETED: 'statusCompleted', REJECTED: 'statusRejected', CANCELLED: 'statusCancelled',
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

function formatDate(value: string | null, locale: Locale): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

function tabLabel(tab: ProcessWorkTab, labels: ProcessWorkspaceLabels): string {
  return { TODO: labels.tabsTodo, CLAIMED: labels.tabsClaimed, WAITING: labels.tabsWaiting, COMPLETED: labels.tabsCompleted, ALL: labels.tabsAll }[tab]
}

function buildQuery(input: { view: ProcessWorkView; tab: ProcessWorkTab; search: string; status: string; businessType: string; businessCategory: string; processDefinitionId: string; administrationId: string; sort: ProcessWorkSort; page?: number }): string {
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
  if (input.page && input.page > 1) params.set('page', String(input.page))
  const query = params.toString()
  return query ? `?${query}` : ''
}

function assignmentText(item: ProcessWorkItem, labels: ProcessWorkspaceLabels): string {
  const sources: Record<string, string> = { QUEUE: labels.assignmentQueue, DIRECT: labels.assignmentDirect, SCOPE: labels.assignmentScope, PROCESS: labels.assignmentProcess }
  const modes: Record<string, string> = { ANY_ONE: labels.assignmentAnyOne }
  const source = item.assignmentExplanation.source ?? item.receivedVia
  const mode = item.assignmentExplanation.assignmentMode ?? item.assignmentMode
  return `${modes[mode] ?? mode} · ${sources[source] ?? (source || labels.unknown)}`
}

function effectiveStatus(item: ProcessWorkItem): string {
  return item.businessStatus
}

function workStatusLabel(status: string, labels: ProcessWorkspaceLabels): string {
  const key = statusLabels[status]
  return key ? labels[key] : status.replaceAll('_', ' ')
}

function statusTone(status: string, overdue: boolean): BadgeTone {
  if (overdue) return 'danger'
  if (status === 'COMPLETED') return 'success'
  if (status === 'CHANGES_REQUESTED' || status === 'REJECTED' || status === 'CANCELLED') return 'warning'
  if (status === 'IN_PROGRESS' || status === 'OPEN') return 'info'
  return 'neutral'
}

function StatusBadge({ item, labels }: { item: ProcessWorkItem; labels: ProcessWorkspaceLabels }) {
  const currentStatus = effectiveStatus(item)
  return <Badge tone={statusTone(currentStatus, item.isOverdue)}>{item.isOverdue ? labels.overdue : workStatusLabel(currentStatus, labels)}</Badge>
}

function WorkItemCard({ item, locale, labels }: { item: ProcessWorkItem; locale: Locale; labels: ProcessWorkspaceLabels }) {
  return (
    <Surface className="p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{labels.businessType}: {labels[businessTypeLabels[item.businessType]]}</p><h2 className="mt-1 truncate text-base font-semibold text-foreground">{item.processTitle}</h2></div>
        <StatusBadge item={item} labels={labels} />
      </div>
      <dl className="mt-4 grid gap-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">{labels.subject}</dt><dd className="font-medium">{item.subjectName ?? labels.unknown}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{labels.step}</dt><dd>{item.stepTitle}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{labels.assignment}</dt><dd>{assignmentText(item, labels)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{labels.deadline}</dt><dd className={item.isOverdue ? 'font-semibold text-destructive' : undefined}>{formatDate(item.deadlineAt, locale)}</dd></div>
      </dl>
      <Link className={`${buttonClasses({ size: 'sm' })} mt-5`} href={getProcessWorkItemHref(item.businessType, item.workItemId)}>{labels.open}</Link>
    </Surface>
  )
}

export function ProcessWorkWorkspace({ locale, labels, data, options, tabCounts, view, tab, page, pageSize, search, status, businessType, businessCategory, processDefinitionId, administrationId, sort, canStartLeaveRequest, canStartInternalTransfer, canStartDocumentAcknowledgement, errorCode }: ProcessWorkspaceProps) {
  const router = useRouter()
  const errorMessage = errorCode === 'FORBIDDEN' ? labels.denied : labels.readError
  const today = new Date().toISOString().slice(0, 10)
  const overdueCount = data?.items.filter((item) => item.isOverdue).length ?? 0
  const dueTodayCount = data?.items.filter((item) => item.deadlineAt?.slice(0, 10) === today && !item.isOverdue).length ?? 0
  const totalPages = data ? Math.ceil(data.total / pageSize) : 0
  const resultFrom = data && data.total > 0 ? (page - 1) * pageSize + 1 : 0
  const resultTo = data ? Math.min(page * pageSize, data.total) : 0
  const queryState = { view, tab, search, status, businessType, businessCategory, processDefinitionId, administrationId, sort }

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
            <tbody className="divide-y divide-border">{data.items.map((item) => <tr className="transition-colors hover:bg-muted/30" key={item.workItemId}><td className="px-4 py-4"><Link className="font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href={getProcessWorkItemHref(item.businessType, item.workItemId)}>{item.processTitle}</Link><p className="mt-1 text-xs text-muted-foreground">{labels[businessTypeLabels[item.businessType]]} · {item.processKey}</p></td><td className="px-4 py-4">{item.subjectName ?? labels.unknown}</td><td className="px-4 py-4">{item.stepTitle}</td><td className="px-4 py-4 text-xs">{assignmentText(item, labels)}</td><td className="px-4 py-4"><StatusBadge item={item} labels={labels} /></td><td className={`px-4 py-4 ${item.isOverdue ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>{formatDate(item.deadlineAt, locale)}</td><td className="px-4 py-4 text-right"><Link className={buttonClasses({ size: 'sm', variant: 'ghost', className: 'text-primary' })} href={getProcessWorkItemHref(item.businessType, item.workItemId)}>{labels.open}</Link></td></tr>)}</tbody>
          </DataTableShell>
        </div>
        <div className="mt-6 grid gap-4 md:hidden">{data.items.map((item) => <WorkItemCard key={item.workItemId} item={item} locale={locale} labels={labels} />)}</div>
        <CollectionPagination className="mt-6" resultRange={labels.resultsCount.replace('{from}', String(resultFrom)).replace('{to}', String(resultTo)).replace('{count}', String(data.total))} pageSize={totalPages > 1 ? labels.pageOf.replace('{page}', String(page)).replace('{pages}', String(totalPages)) : undefined} pagination={totalPages > 1 ? { ariaLabel: labels.workspaceTitle, currentPage: page, totalPages, onPageChange: (nextPage) => router.push(`/work${buildQuery({ ...queryState, page: nextPage })}`), previousLabel: labels.previous, nextLabel: labels.next } : undefined} />
      </> : null}
      {data && data.items.length > 0 ? <div aria-live="polite" className="sr-only">{overdueCount ? `${overdueCount} ${labels.overdue}` : ''}{dueTodayCount ? ` ${dueTodayCount} ${labels.dueToday}` : ''}</div> : null}
    </PageShell>
  )
}
