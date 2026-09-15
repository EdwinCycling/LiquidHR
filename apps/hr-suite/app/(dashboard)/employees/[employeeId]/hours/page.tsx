import { notFound, redirect } from 'next/navigation'
import { ActualWorkEmployeeWorkspace } from '@/components/actual-work/actual-work-employee-workspace'
import { AuthorizationError } from '@/lib/auth/permissions'
import { getActualWorkEmployeeProjection, ActualWorkServiceError } from '@/lib/actual-work/actual-work-service'
import { getLocale, getTranslator } from '@/lib/i18n/server'

type Props = {
  params: Promise<{ employeeId: string }>
  searchParams: Promise<{ employmentId?: string; month?: string }>
}

function monthOrCurrent(value: string | undefined): string {
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value
  return new Date().toISOString().slice(0, 7)
}

export default async function EmployeeActualWorkPage({ params, searchParams }: Props) {
  const [{ employeeId }, query] = await Promise.all([params, searchParams])
  const month = monthOrCurrent(query.month)
  let projection: Awaited<ReturnType<typeof getActualWorkEmployeeProjection>>
  try {
    projection = await getActualWorkEmployeeProjection({ employeeId, employmentId: query.employmentId, month })
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    if (error instanceof ActualWorkServiceError && error.status === 404) notFound()
    throw error
  }
  const [locale, t] = await Promise.all([getLocale(), getTranslator('employees')])
  void locale
  return <ActualWorkEmployeeWorkspace employeeId={employeeId} labels={{
    title: t('actualWorkTitle'),
    description: t('actualWorkDescription'),
    back: t('actualWorkBack'),
    month: t('actualWorkMonth'),
    previousMonth: t('actualWorkPreviousMonth'),
    nextMonth: t('actualWorkNextMonth'),
    schedule: t('actualWorkSchedule'),
    partTime: t('actualWorkPartTime'),
    week: t('actualWorkWeek'),
    periodStatus: t('actualWorkPeriodStatus'),
    open: t('actualWorkOpen'),
    closed: t('actualWorkClosed'),
    entries: t('actualWorkEntries'),
    noEntries: t('actualWorkNoEntries'),
    type: t('actualWorkType'),
    family: t('actualWorkFamily'),
    date: t('actualWorkDate'),
    hours: t('actualWorkHours'),
    note: t('actualWorkNote'),
    reason: t('actualWorkReason'),
    save: t('actualWorkSave'),
    saving: t('actualWorkSaving'),
    saved: t('actualWorkSaved'),
    failed: t('actualWorkFailed'),
    newEntry: t('actualWorkNewEntry'),
    edit: t('actualWorkEdit'),
    correction: t('actualWorkCorrection'),
    correctionReason: t('actualWorkCorrectionReason'),
    granularity: t('actualWorkGranularity'),
    day: t('actualWorkDay'),
    period: t('actualWorkPeriod'),
    closedMessage: t('actualWorkClosedMessage'),
    revisionHistory: t('actualWorkRevisionHistory'),
    original: t('actualWorkOriginal'),
    current: t('actualWorkCurrent'),
    delta: t('actualWorkDelta'),
    actor: t('actualWorkActor'),
    noTypes: t('actualWorkNoTypes'),
    selectType: t('actualWorkSelectType'),
    searchTypes: t('actualWorkSearchTypes'),
    scheduleNotFound: t('actualWorkScheduleNotFound'),
    familyWork: t('actualWorkFamilyWork'),
    familyAdditional: t('actualWorkFamilyAdditional'),
    familyOvertime: t('actualWorkFamilyOvertime'),
    familyTransparent: t('actualWorkFamilyTransparent'),
  }} month={month} projection={projection} />
}
