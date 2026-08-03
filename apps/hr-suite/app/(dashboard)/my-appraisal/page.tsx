import { redirect } from 'next/navigation'
import { ContinuousAppraisalWorkspace } from '@/components/continuous-appraisal/continuous-appraisal-workspace'
import { requireAuthContext } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listContinuousAppraisalWorkspace } from '@/lib/continuous-appraisal/service'
import { createClient } from '@/lib/supabase/server'

export default async function MyAppraisalPage() {
  const context = await requireAuthContext(await createClient())
  if (!context.employeeId) redirect('/geen-toegang')
  const [workspace, t] = await Promise.all([
    listContinuousAppraisalWorkspace(context.employeeId),
    getTranslator('continuousAppraisal'),
  ])
  return <ContinuousAppraisalWorkspace mode="self" initial={workspace} labels={continuousAppraisalLabels(t)} />
}

function continuousAppraisalLabels(t: Awaited<ReturnType<typeof getTranslator>>) {
  return {
    entryType: t('entryType'), attachments: t('attachments'), addAttachment: t('addAttachment'), attachmentTypes: t('attachmentTypes'), attachmentUploadFailed: t('attachmentUploadFailed'),
    title: t('title'), subtitle: t('selfSubtitle'), employee: t('employee'), search: t('search'), all: t('all'), notes: t('notes'), actions: t('actions'), agreements: t('agreements'), feedback: t('feedback'), goals: t('goals'), meetings: t('meetings'), newest: t('newest'), oldest: t('oldest'), newEntry: t('newEntry'), addNote: t('addNote'), addAction: t('addAction'), addAgreement: t('addAgreement'), addFeedback: t('addFeedback'), addGoal: t('addGoal'), addMeeting: t('addMeeting'), note: t('note'), action: t('action'), agreement: t('agreement'), goal: t('goal'), development: t('development'), meeting: t('meeting'), titleLabel: t('titleLabel'), bodyLabel: t('bodyLabel'), dateLabel: t('dateLabel'), dueDate: t('dueDate'), nextMeeting: t('nextMeeting'), owner: t('owner'), status: t('status'), priority: t('priority'), goalKind: t('goalKind'), open: t('open'), waiting: t('waiting'), active: t('active'), done: t('done'), cancelled: t('cancelled'), planned: t('planned'), low: t('low'), medium: t('medium'), high: t('high'), save: t('save'), cancel: t('cancel'), close: t('close'), edit: t('edit'), comments: t('comments'), addComment: t('addComment'), commentPlaceholder: t('commentPlaceholder'), commentLimit: t('commentLimit'), noItems: t('noItems'), noItemsDescription: t('noItemsDescription'), pastItem: t('pastItem'), futureItem: t('futureItem'), createdBy: t('createdBy'), irrelevant: t('irrelevant'), saveFailed: t('saveFailed'), saved: t('saved'), managerOnly: t('managerOnly'), selectEmployee: t('selectEmployee'), managerSubtitle: t('managerSubtitle'), workforceLink: t('workforceLink'), systemEvent: t('systemEvent'), itemCount: t('itemCount'), addDescription: t('addDescription'), editDescription: t('editDescription'), noEmployee: t('noEmployee'), showComments: t('showComments'), hideComments: t('hideComments'), dateFormatHint: t('dateFormatHint'),
  }
}
