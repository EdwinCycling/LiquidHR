import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { performWorkItemAction, processRuntimeErrorResponse } from '@/lib/process-automation/runtime-service'
import { scheduleWorkflowDrain } from '@/lib/process-automation/workflow-job-service'

interface Params {
  params: Promise<{ workItemId: string }>
}

const inputSchema = z.object({
  action: z.enum(['SUBMIT', 'APPROVE', 'REJECT', 'REQUEST_CHANGES', 'ACKNOWLEDGE', 'COMPLETE', 'CANCEL']),
  expectedVersion: z.number().int().positive(),
  stepExpectedVersion: z.number().int().positive().nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(200),
  correlationId: z.string().uuid().nullable().optional(),
}).strict()

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const parsed = inputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'PROCESS_RUNTIME_INPUT_INVALID' }, { status: 400 })
    const { workItemId } = await params
    const data = await performWorkItemAction({ workItemId, ...parsed.data })
    scheduleWorkflowDrain()
    return NextResponse.json({ data })
  } catch (error) {
    return permissionErrorResponse(error)
      ?? processRuntimeErrorResponse(error)
      ?? NextResponse.json({ code: 'PROCESS_RUNTIME_OPERATION_FAILED' }, { status: 500 })
  }
}
