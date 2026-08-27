import { ProcessWorkDetailView } from '@/components/process-automation/process-work-detail'
import { getProcessFormProjection } from '@/lib/process-automation/form-runtime-service'
import { getProcessAutomationOperations, getProcessOutputProjection } from '@/lib/process-automation/output-service'
import { createProcessWorkDetailLabels } from '@/lib/process-automation/process-work-detail-labels'
import { getProcessWorkItemAssignmentOptions, getProcessWorkItemDetail } from '@/lib/process-automation/work-service'
import { getLocale, getTranslator } from '@/lib/i18n/server'

interface WorkDetailPageProps {
  readonly params: Promise<{ workItemId: string }>
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function workBackHref(query: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams()
  for (const key of ['tab', 'search', 'status', 'processDefinitionId', 'administrationId', 'sort']) {
    const value = first(query[key])
    if (value) params.set(key, value)
  }
  const encoded = params.toString()
  return encoded ? `/work?${encoded}` : '/work'
}

export default async function WorkDetailPage({ params, searchParams }: WorkDetailPageProps) {
  const { workItemId } = await params
  const query = await searchParams
  const locale = await getLocale()
  const t = await getTranslator('processAutomation', locale)
  const detail = await getProcessWorkItemDetail(workItemId, locale)
  const [form, outputs, operations, assignmentOptions] = await Promise.all([
    getProcessFormProjection(workItemId, locale).catch(() => null),
    getProcessOutputProjection(detail.processInstanceId, locale).catch(() => null),
    getProcessAutomationOperations(detail.processInstanceId).catch(() => null),
    detail.canReassign ? getProcessWorkItemAssignmentOptions(workItemId).catch(() => []) : Promise.resolve([]),
  ])
  return <ProcessWorkDetailView assignmentOptions={assignmentOptions} backHref={workBackHref(query)} detail={detail} form={form} outputs={outputs} operations={operations} locale={locale} labels={createProcessWorkDetailLabels(t)} />
}
