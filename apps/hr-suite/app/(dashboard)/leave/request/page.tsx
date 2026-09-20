import { redirect } from 'next/navigation'

import { LeaveRequestPage, type LeaveRequestPageLabels } from '@/components/leave/leave-request-page'
import { getRequestAuthorizationContext } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'

export default async function LeaveRequestPageRoute() {
  const requestContext = await getRequestAuthorizationContext()
  if (!requestContext.context.employeeId || !requestContext.context.permissions.includes('self:leave:request')) redirect('/geen-toegang')
  const [locale, t] = await Promise.all([getLocale(), getTranslator('leaveWorkflow')])
  const labels: LeaveRequestPageLabels = {
    eyebrow: t('eyebrow'),
    pageTitle: t('title'),
    pageDescription: t('description'),
    title: t('requestTitle'),
    description: t('requestDescription'),
    employment: t('employment'),
    employmentRequired: t('employmentRequired'),
    viaPriority: t('viaPriority'),
    withoutPriority: t('withoutPriority'),
    leaveType: t('leaveType'),
    noLeaveTypes: t('noLeaveTypes'),
    priorityRule: t('priorityRule'),
    noPriorityRules: t('noPriorityRules'),
    currentBalance: t('currentBalance'),
    projectedBalance: t('projectedBalance'),
    unlimited: t('unlimited'),
    timeMode: t('timeMode'),
    fullDay: t('fullDay'),
    morning: t('morning'),
    afternoon: t('afternoon'),
    specificHours: t('specificHours'),
    startDate: t('startDate'),
    endDate: t('endDate'),
    timeStart: t('timeStart'),
    timeEnd: t('timeEnd'),
    totalTime: t('totalTime'),
    confirm: t('confirm'),
    cancel: t('cancel'),
    close: t('close'),
    loading: t('loading'),
    success: t('success'),
    failed: t('failed'),
    noBalance: t('noBalance'),
    discardTitle: t('discardTitle'),
    discardDescription: t('discardDescription'),
    keepEditing: t('keepEditing'),
    discardChanges: t('discardChanges'),
  }
  return <LeaveRequestPage employeeId={requestContext.context.employeeId} labels={labels} locale={locale} />
}
