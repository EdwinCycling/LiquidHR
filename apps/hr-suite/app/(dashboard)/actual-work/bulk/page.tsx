import { redirect } from 'next/navigation'
import { ActualWorkBulkWorkspace } from '@/components/actual-work/actual-work-bulk-workspace'
import { AuthorizationError } from '@/lib/auth/permissions'
import { getActualWorkBulkProjection } from '@/lib/actual-work/actual-work-service'
import { getTranslator } from '@/lib/i18n/server'

type Props = {
  searchParams: Promise<{ month?: string; typeId?: string; view?: string; employee?: string; departmentId?: string }>
}

function monthOrCurrent(value: string | undefined): string {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : new Date().toISOString().slice(0, 7)
}

export default async function ActualWorkBulkPage({ searchParams }: Props) {
  const query = await searchParams
  const month = monthOrCurrent(query.month)
  const t = await getTranslator('employees')
  let projection: Awaited<ReturnType<typeof getActualWorkBulkProjection>>
  try {
    projection = await getActualWorkBulkProjection({
      month,
      typeId: query.typeId,
      entryGranularity: query.view === 'period' ? 'PERIOD' : 'DAY',
      employeeQuery: query.employee,
      departmentId: query.departmentId,
    })
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  return <ActualWorkBulkWorkspace key={[month, query.typeId ?? '', query.view ?? '', query.employee ?? '', query.departmentId ?? ''].join('|')} initialDepartmentId={query.departmentId ?? ''} initialEmployeeQuery={query.employee ?? ''} labels={{
      title: t('actualWorkBulkTitle'),
      description: t('actualWorkBulkDescription'),
      back: t('actualWorkBulkBack'),
      previousMonth: t('actualWorkPreviousMonth'),
      nextMonth: t('actualWorkNextMonth'),
      month: t('actualWorkBulkMonth'),
      type: t('actualWorkType'),
      selectType: t('actualWorkSelectType'),
      searchTypes: t('actualWorkSearchTypes'),
      family: t('actualWorkFamily'),
      familyWork: t('actualWorkFamilyWork'),
      familyAdditional: t('actualWorkFamilyAdditional'),
      familyOvertime: t('actualWorkFamilyOvertime'),
      familyTransparent: t('actualWorkFamilyTransparent'),
      view: t('actualWorkBulkView'),
      day: t('actualWorkDay'),
      period: t('actualWorkPeriod'),
      employee: t('actualWorkBulkEmployee'),
      employeePlaceholder: t('actualWorkBulkEmployeePlaceholder'),
      department: t('actualWorkBulkDepartment'),
      allDepartments: t('actualWorkBulkAllDepartments'),
      search: t('actualWorkBulkSearch'),
      grid: t('actualWorkBulkGrid'),
      noEmployees: t('actualWorkBulkNoEmployees'),
      noTypes: t('actualWorkNoTypes'),
      hoursPlaceholder: t('actualWorkBulkHoursPlaceholder'),
      decimal: t('actualWorkBulkDecimal'),
      time: t('actualWorkBulkTime'),
      periodStatus: t('actualWorkPeriodStatus'),
      open: t('actualWorkOpen'),
      closed: t('actualWorkClosed'),
      closedMessage: t('actualWorkBulkClosedMessage'),
      closedCorrection: t('actualWorkBulkClosedCorrection'),
      additionalUnavailable: t('actualWorkBulkAdditionalUnavailable'),
      note: t('actualWorkNote'),
      noteHelp: t('actualWorkBulkNoteHelp'),
      correctionReason: t('actualWorkCorrectionReason'),
      correctionReasonHelp: t('actualWorkBulkCorrectionReasonHelp'),
      limits: t('actualWorkBulkLimits'),
      limitDay: t('actualWorkBulkLimitDay'),
      limitWeek: t('actualWorkBulkLimitWeek'),
      limitMonth: t('actualWorkBulkLimitMonth'),
      save: t('actualWorkSave'),
      saving: t('actualWorkSaving'),
      saved: t('actualWorkBulkSaved'),
      failed: t('actualWorkBulkFailed'),
      invalidValue: t('actualWorkBulkInvalidValue'),
      noChanges: t('actualWorkBulkNoChanges'),
      changedCells: t('actualWorkBulkChangedCells'),
      periodFact: t('actualWorkBulkPeriodFact'),
      errorLimit: t('actualWorkBulkErrorLimit'),
      errorAdditional: t('actualWorkBulkErrorAdditional'),
      errorComment: t('actualWorkBulkErrorComment'),
      errorFuture: t('actualWorkBulkErrorFuture'),
      errorScope: t('actualWorkBulkErrorScope'),
      errorDate: t('actualWorkBulkErrorDate'),
      errorType: t('actualWorkBulkErrorType'),
    }} projection={projection} />
}
