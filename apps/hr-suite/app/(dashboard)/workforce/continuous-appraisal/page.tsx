import { redirect } from 'next/navigation'
import { ContinuousAppraisalWorkspace } from '@/components/continuous-appraisal/continuous-appraisal-workspace'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listContinuousAppraisalEmployeeOptions, listContinuousAppraisalWorkspace } from '@/lib/continuous-appraisal/service'

type PageProps = { searchParams: Promise<{ employeeId?: string }> }

export default async function WorkforceContinuousAppraisalPage({ searchParams }: PageProps) {
  const mode = await resolveMode()
  const [options, params, t] = await Promise.all([
    listContinuousAppraisalEmployeeOptions(),
    searchParams,
    getTranslator('continuousAppraisal'),
  ])
  const selectedEmployee = options.find((option) => option.id === params.employeeId)?.id ?? options[0]?.id
  if (!selectedEmployee) {
    return <div className="mx-auto w-full max-w-5xl px-5 py-10"><p className="rounded-2xl border border-dashed bg-surface p-8 text-center text-sm text-muted-foreground">{t('noEmployee')}</p></div>
  }
  const workspace = await listContinuousAppraisalWorkspace(selectedEmployee)
  return <ContinuousAppraisalWorkspace mode={mode} initial={workspace} employeeOptions={options} labels={continuousAppraisalLabels(t)} />
}

async function resolveMode(): Promise<'manager' | 'hr'> {
  try {
    await requirePermission('continuous-appraisal:manage')
    return 'hr'
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error
  }
  try {
    await requirePermission('continuous-appraisal:read')
    return 'manager'
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
}

function continuousAppraisalLabels(t: Awaited<ReturnType<typeof import('@/lib/i18n/server').getTranslator>>) {
  return {
    entryType: t('entryType'), attachments: t('attachments'), addAttachment: t('addAttachment'), attachmentTypes: t('attachmentTypes'), attachmentUploadFailed: t('attachmentUploadFailed'),
    title: t('title'), subtitle: t('managerSubtitle'), employee: t('employee'), search: t('search'), all: t('all'), notes: t('notes'), actions: t('actions'), agreements: t('agreements'), feedback: t('feedback'), goals: t('goals'), meetings: t('meetings'), newest: t('newest'), oldest: t('oldest'), newEntry: t('newEntry'), addNote: t('addNote'), addAction: t('addAction'), addAgreement: t('addAgreement'), addFeedback: t('addFeedback'), addGoal: t('addGoal'), addMeeting: t('addMeeting'), note: t('note'), action: t('action'), agreement: t('agreement'), goal: t('goal'), development: t('development'), meeting: t('meeting'), titleLabel: t('titleLabel'), bodyLabel: t('bodyLabel'), dateLabel: t('dateLabel'), dueDate: t('dueDate'), nextMeeting: t('nextMeeting'), owner: t('owner'), status: t('status'), priority: t('priority'), goalKind: t('goalKind'), open: t('open'), waiting: t('waiting'), active: t('active'), done: t('done'), cancelled: t('cancelled'), planned: t('planned'), low: t('low'), medium: t('medium'), high: t('high'), save: t('save'), cancel: t('cancel'), close: t('close'), edit: t('edit'), comments: t('comments'), addComment: t('addComment'), commentPlaceholder: t('commentPlaceholder'), commentLimit: t('commentLimit'), noItems: t('noItems'), noItemsDescription: t('noItemsDescription'), pastItem: t('pastItem'), futureItem: t('futureItem'), createdBy: t('createdBy'), irrelevant: t('irrelevant'), saveFailed: t('saveFailed'), saved: t('saved'), managerOnly: t('managerOnly'), selectEmployee: t('selectEmployee'), managerSubtitle: t('managerSubtitle'), workforceLink: t('workforceLink'), systemEvent: t('systemEvent'), itemCount: t('itemCount'), addDescription: t('addDescription'), editDescription: t('editDescription'), noEmployee: t('noEmployee'), showComments: t('showComments'), hideComments: t('hideComments'), dateFormatHint: t('dateFormatHint'),
  }
}
