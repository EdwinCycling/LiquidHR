import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getRequestAuthorizationContext, permissionErrorResponse } from '@/lib/auth/permissions'
import { getProcessInstanceProjection, processRuntimeErrorResponse, startProcess } from '@/lib/process-automation/runtime-service'
import { getProcessWorkItemDetail } from '@/lib/process-automation/work-service'
import { scheduleWorkflowDrain } from '@/lib/process-automation/workflow-job-service'
import { getLocale } from '@/lib/i18n/server'
import { databaseUuid } from '@/lib/validation/database-uuid'

const legacyInputSchema = z.object({
  processDefinitionId: databaseUuid,
  subjectEmployeeId: databaseUuid,
  employmentId: databaseUuid.nullable().optional(),
  businessEffectiveDate: z.string().date().nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(200),
  correlationId: databaseUuid.nullable().optional(),
}).strict()

const selfStartInputSchema = z.object({
  processDefinitionId: databaseUuid,
  idempotencyKey: z.string().trim().min(1).max(200),
}).strict()

const requestsHref = '/work?view=REQUESTS'

async function activeWorkItemHref(processInstanceId: string): Promise<string> {
  try {
    const projection = await getProcessInstanceProjection(processInstanceId)
    if (!projection.currentStepKey) return requestsHref
    const activeWorkItems = projection.workItems.filter((item) => item.stepKey === projection.currentStepKey && (item.status === 'OPEN' || item.status === 'CLAIMED'))
    if (activeWorkItems.length !== 1) return requestsHref
    const locale = await getLocale()
    const detail = await getProcessWorkItemDetail(activeWorkItems[0].id, locale)
    return detail.canAct ? `/work/${activeWorkItems[0].id}` : requestsHref
  } catch {
    return requestsHref
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json()
    const selfStart = selfStartInputSchema.safeParse(body)
    if (selfStart.success) {
      const requestContext = await getRequestAuthorizationContext()
      const { context } = requestContext
      if (!context.employeeId) return NextResponse.json({ code: 'ACTOR_EMPLOYEE_NOT_FOUND' }, { status: 403 })
      const data = await startProcess({
        processDefinitionId: selfStart.data.processDefinitionId,
        subjectEmployeeId: context.employeeId,
        idempotencyKey: selfStart.data.idempotencyKey,
      })
      scheduleWorkflowDrain()
      return NextResponse.json({ data, nextHref: await activeWorkItemHref(data.processInstanceId) })
    }

    const legacyStart = legacyInputSchema.safeParse(body)
    if (!legacyStart.success) return NextResponse.json({ code: 'PROCESS_RUNTIME_INPUT_INVALID' }, { status: 400 })
    const data = await startProcess(legacyStart.data)
    scheduleWorkflowDrain()
    return NextResponse.json({ data })
  } catch (error) {
    return permissionErrorResponse(error)
      ?? processRuntimeErrorResponse(error)
      ?? NextResponse.json({ code: 'PROCESS_RUNTIME_OPERATION_FAILED' }, { status: 500 })
  }
}
