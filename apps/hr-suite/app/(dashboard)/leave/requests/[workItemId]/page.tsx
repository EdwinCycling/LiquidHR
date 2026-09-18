import { redirect } from 'next/navigation'

import { LeaveWorkflowDetail } from '@/components/leave/leave-workflow-detail'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { getLeaveWorkflowDetail } from '@/lib/leave/workflow-service'

interface Props {
  readonly params: Promise<{ workItemId: string }>
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

export default async function LeaveWorkflowDetailPage({ params, searchParams }: Props) {
  const { workItemId } = await params
  const query = await searchParams
  const [locale, t] = await Promise.all([getLocale(), getTranslator('leaveWorkflow')])
  const detail = await getLeaveWorkflowDetail(workItemId, locale)
  if (detail.businessType !== 'LEAVE') redirect(`/work/${workItemId}`)
  const labels = {
    eyebrow: t('eyebrow'),
    pageTitle: t('requestTitle'),
    back: t('back'),
    status: t('status'),
    pending: t('pending'),
    changesRequested: t('changesRequested'),
    approved: t('approved'),
    rejected: t('rejected'),
    cancelled: t('cancelled'),
    inProgress: t('inProgress'),
    open: t('open'),
    requestDetails: t('requestDetails'),
    requestMode: t('requestMode'),
    priority: t('priority'),
    direct: t('direct'),
    startDate: t('startDate'),
    endDate: t('endDate'),
    timeMode: t('timeMode'),
    fullDay: t('fullDay'),
    morning: t('morning'),
    afternoon: t('afternoon'),
    specificHours: t('specificHours'),
    requestedMinutes: t('requestedMinutes'),
    hoursUnit: t('hoursUnit'),
    workItem: t('workItem'),
    assignment: t('assignment'),
    manager: t('manager'),
    currentStep: t('currentStep'),
    actions: t('actions'),
    approve: t('approve'),
    reject: t('reject'),
    requestChanges: t('requestChanges'),
    resubmit: t('resubmit'),
    acknowledge: t('acknowledge'),
    cancelRequest: t('cancelRequest'),
    requestChangesReason: t('requestChangesReason'),
    requestChangesReasonRequired: t('requestChangesReasonRequired'),
    requestChangesSubmit: t('requestChangesSubmit'),
    confirmDestructive: t('confirmDestructive'),
    actionSuccess: t('actionSuccess'),
    actionFailed: t('actionFailed'),
    stale: t('stale'),
    denied: t('denied'),
    timeline: t('timeline'),
    completed: t('completed'),
    waiting: t('waiting'),
    noRequest: t('noRequest'),
  }
  const backHref = first(query.view) === 'WORK' ? '/work' : '/work?view=REQUESTS'
  return <LeaveWorkflowDetail backHref={backHref} detail={detail} labels={labels} locale={locale} />
}
