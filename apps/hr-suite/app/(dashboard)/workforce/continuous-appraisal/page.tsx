import { redirect } from 'next/navigation'
import { ContinuousAppraisalWorkspace } from '@/components/continuous-appraisal/continuous-appraisal-workspace'
import type { ContinuousAppraisalFilter, ContinuousAppraisalInitialFilters } from '@/components/continuous-appraisal/continuous-appraisal-workspace'
import { requireAuthContext } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { listContinuousAppraisalEmployeeOptions, listContinuousAppraisalWorkspace } from '@/lib/continuous-appraisal/service'

type PageProps = { searchParams: Promise<{ employeeId?: string; search?: string; type?: string; status?: string; owner?: string; from?: string; to?: string; sort?: string }> }

export default async function WorkforceContinuousAppraisalPage({ searchParams }: PageProps) {
  const mode = await resolveMode()
  const [options, params, t, locale] = await Promise.all([
    listContinuousAppraisalEmployeeOptions(),
    searchParams,
    getTranslator('continuousAppraisal'),
    getLocale(),
  ])
  const selectedEmployee = options.find((option) => option.id === params.employeeId)?.id ?? options[0]?.id
  if (!selectedEmployee) {
    return <div className="mx-auto w-full max-w-5xl px-5 py-10"><p className="rounded-2xl border border-dashed bg-surface p-8 text-center text-sm text-muted-foreground">{t('noEmployee')}</p></div>
  }
  const workspace = await listContinuousAppraisalWorkspace(selectedEmployee)
  return <ContinuousAppraisalWorkspace initialFilters={continuousAppraisalFilters(params)} locale={locale} mode={mode} initial={workspace} employeeOptions={options} labels={continuousAppraisalLabels(t)} />
}

function continuousAppraisalFilters(params: Awaited<PageProps['searchParams']>): ContinuousAppraisalInitialFilters {
  const types: ContinuousAppraisalFilter[] = ['ALL', 'NOTE', 'ACTION', 'AGREEMENT', 'FEEDBACK', 'GOAL', 'MEETING_SUMMARY']
  const statuses: ContinuousAppraisalInitialFilters['itemStatus'][] = ['ALL', 'PLANNED', 'OPEN', 'WAITING', 'ACTIVE', 'DONE', 'CANCELLED', 'ARCHIVED']
  return {
    search: params.search ?? '',
    itemType: types.includes(params.type as ContinuousAppraisalFilter) ? params.type as ContinuousAppraisalFilter : 'ALL',
    itemStatus: statuses.includes(params.status as ContinuousAppraisalInitialFilters['itemStatus']) ? params.status as ContinuousAppraisalInitialFilters['itemStatus'] : 'ALL',
    owner: params.owner ?? 'ALL',
    fromDate: params.from ?? '',
    toDate: params.to ?? '',
    oldestFirst: params.sort === 'oldest',
  }
}

async function resolveMode(): Promise<'manager' | 'hr'> {
  const context = await requireAuthContext()
  if (context.permissions.includes('continuous-appraisal:manage')) return 'hr'
  if (context.permissions.includes('continuous-appraisal:read')) return 'manager'
  redirect('/geen-toegang')
}

function continuousAppraisalLabels(t: Awaited<ReturnType<typeof import('@/lib/i18n/server').getTranslator>>) {
  return {
    title: t('title'), subtitle: t('managerSubtitle'), employee: t('employee'), search: t('search'), all: t('all'), notes: t('notes'), actions: t('actions'), agreements: t('agreements'), feedback: t('feedback'), goals: t('goals'), meetings: t('meetings'), newest: t('newest'), oldest: t('oldest'), newEntry: t('newEntry'), addNote: t('addNote'), addAction: t('addAction'), addAgreement: t('addAgreement'), addFeedback: t('addFeedback'), addGoal: t('addGoal'), addMeeting: t('addMeeting'), note: t('note'), action: t('action'), agreement: t('agreement'), goal: t('goal'), development: t('development'), meeting: t('meeting'), entryType: t('entryType'), titleLabel: t('titleLabel'), bodyLabel: t('bodyLabel'), dateLabel: t('dateLabel'), dueDate: t('dueDate'), nextMeeting: t('nextMeeting'), owner: t('owner'), status: t('status'), priority: t('priority'), goalKind: t('goalKind'), open: t('open'), waiting: t('waiting'), active: t('active'), done: t('done'), cancelled: t('cancelled'), planned: t('planned'), archived: t('archived'), low: t('low'), medium: t('medium'), high: t('high'), save: t('save'), cancel: t('cancel'), close: t('close'), edit: t('edit'), comments: t('comments'), addComment: t('addComment'), commentPlaceholder: t('commentPlaceholder'), commentLimit: t('commentLimit'), noItems: t('noItems'), noItemsDescription: t('noItemsDescription'), noResults: t('noResults'), noResultsDescription: t('noResultsDescription'), pastItem: t('pastItem'), futureItem: t('futureItem'), createdBy: t('createdBy'), irrelevant: t('irrelevant'), saveFailed: t('saveFailed'), saved: t('saved'), selectEmployee: t('selectEmployee'), managerSubtitle: t('managerSubtitle'), workforceLink: t('workforceLink'), systemEvent: t('systemEvent'), itemCount: t('itemCount'), addDescription: t('addDescription'), editDescription: t('editDescription'), noEmployee: t('noEmployee'), showComments: t('showComments'), hideComments: t('hideComments'), dateFormatHint: t('dateFormatHint'), attachments: t('attachments'), addAttachment: t('addAttachment'), attachmentTypes: t('attachmentTypes'), attachmentUploadFailed: t('attachmentUploadFailed'), filters: t('filters'), filterByType: t('filterByType'), filterByStatus: t('filterByStatus'), filterByOwner: t('filterByOwner'), fromDate: t('fromDate'), toDate: t('toDate'), clearFilters: t('clearFilters'), moreActions: t('moreActions'), quickAdd: t('quickAdd'), canWrite: t('canWrite'), readOnly: t('readOnly'), readOnlyDescription: t('readOnlyDescription'), activeFollowUp: t('activeFollowUp'), upcomingItems: t('upcomingItems'), noActiveFollowUp: t('noActiveFollowUp'), employeeNumber: t('employeeNumber'), jobTitle: t('jobTitle'), discardTitle: t('discardTitle'), discardDescription: t('discardDescription'), discardConfirm: t('discardConfirm'), discardCancel: t('discardCancel'), attachmentUnavailable: t('attachmentUnavailable'), leftTabs: t('leftTabs'), rightTabs: t('rightTabs'),
  }
}
