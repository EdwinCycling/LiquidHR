import { ProcessWorkDetailView, type ProcessWorkDetailLabels } from '@/components/process-automation/process-work-detail'
import { getProcessFormProjection } from '@/lib/process-automation/form-runtime-service'
import { getProcessAutomationOperations, getProcessOutputProjection } from '@/lib/process-automation/output-service'
import { getProcessWorkItemDetail } from '@/lib/process-automation/work-service'
import { getLocale, getTranslator } from '@/lib/i18n/server'

interface WorkDetailPageProps {
  readonly params: Promise<{ workItemId: string }>
}

export default async function WorkDetailPage({ params }: WorkDetailPageProps) {
  const { workItemId } = await params
  const locale = await getLocale()
  const t = await getTranslator('processAutomation', locale)
  const detail = await getProcessWorkItemDetail(workItemId, locale)
  const [form, outputs, operations] = await Promise.all([
    getProcessFormProjection(workItemId, locale).catch(() => null),
    getProcessOutputProjection(detail.processInstanceId, locale).catch(() => null),
    getProcessAutomationOperations(detail.processInstanceId).catch(() => null),
  ])
  const labels: ProcessWorkDetailLabels = {
    process: t('columnsProcess'),
    subject: t('subject'),
    step: t('step'),
    status: t('status'),
    assignment: t('assignment'),
    assignmentMode: t('assignmentMode'),
    assignmentSource: t('assignmentSource'),
    assignmentDate: t('assignmentDate'),
    assignmentRole: t('assignmentRole'),
    progress: t('progress'),
    timeline: t('timeline'),
    form: t('form'),
    output: t('output'),
    deadline: t('deadline'),
    overdue: t('overdue'),
    availableAt: t('availableAt'),
    claimedBy: t('claimedBy'),
    unassigned: t('unassigned'),
    claim: t('claim'),
    release: t('release'),
    reassign: t('reassign'),
    action: t('action'),
    success: t('success'),
    stale: t('stale'),
    denied: t('denied'),
    blocked: t('blocked'),
    errorClaimRace: t('errorClaimRace'),
    errorStale: t('errorStale'),
    errorDenied: t('errorDenied'),
    errorBlocked: t('errorBlocked'),
    errorGeneric: t('errorGeneric'),
    unknown: t('unknown'),
    download: t('download'),
    downloadUnavailable: t('downloadUnavailable'),
    outputPending: t('outputPending'),
    outputAvailable: t('outputAvailable'),
    outputFailed: t('outputFailed'),
    operations: t('operations'),
    lastAttempt: t('lastAttempt'),
    recovery: t('recovery'),
    retry: t('retry'),
    actionSubmit: t('actionSubmit'),
    actionApprove: t('actionApprove'),
    actionReject: t('actionReject'),
    actionRequestChanges: t('actionRequestChanges'),
    actionAcknowledge: t('actionAcknowledge'),
    actionComplete: t('actionComplete'),
    actionCancel: t('actionCancel'),
    formCurrentValue: t('currentValue'),
    formNewValue: t('newValue'),
    formSaving: t('saving'),
    formSaved: t('saved'),
    formSaveError: t('saveError'),
    formStale: t('stale'),
    formSave: t('save'),
    formErrorSummary: t('errorSummary'),
    formRequired: t('required'),
    formInvalid: t('invalid'),
    formReadOnly: t('readOnly'),
    formNoValue: t('noValue'),
    formBooleanTrue: t('booleanTrue'),
    formBooleanFalse: t('booleanFalse'),
  }
  return <ProcessWorkDetailView detail={detail} form={form} outputs={outputs} operations={operations} locale={locale} labels={labels} />
}
