import { ProcessWorkDetailView } from '@/components/process-automation/process-work-detail'
import { getProcessFormProjection } from '@/lib/process-automation/form-runtime-service'
import { createProcessWorkDetailLabels } from '@/lib/process-automation/process-work-detail-labels'
import { getProcessWorkItemAssignmentOptions, getProcessWorkItemDetail } from '@/lib/process-automation/work-service'
import { getLocale, getTranslator } from '@/lib/i18n/server'

interface ProcessRuntimePageProps {
  params: Promise<{ workItemId: string }>
}

export default async function ProcessRuntimePage({ params }: ProcessRuntimePageProps) {
  const { workItemId } = await params
  const locale = await getLocale()
  const t = await getTranslator('processAutomation', locale)
  const detail = await getProcessWorkItemDetail(workItemId, locale)
  const [form, assignmentOptions] = await Promise.all([
    getProcessFormProjection(workItemId, locale),
    detail.canReassign ? getProcessWorkItemAssignmentOptions(workItemId).catch(() => []) : Promise.resolve([]),
  ])
  return <ProcessWorkDetailView assignmentOptions={assignmentOptions} backHref="/work" detail={detail} form={form} locale={locale} labels={createProcessWorkDetailLabels(t)} operations={null} outputs={null} />
}
