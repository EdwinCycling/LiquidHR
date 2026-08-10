import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { acknowledgeDocumentWorkItem, documentAcknowledgementErrorResponse } from '@/lib/process-automation/document-acknowledgement-service'
import { scheduleWorkflowDrain } from '@/lib/process-automation/workflow-job-service'

interface Params { readonly params: Promise<{ workItemId: string }> }

const inputSchema = z.object({
  expectedVersion: z.number().int().positive(),
  stepExpectedVersion: z.number().int().positive().nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(200),
  correlationId: z.string().uuid().nullable().optional(),
}).strict()

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const parsed = inputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'DOCUMENT_ACKNOWLEDGEMENT_INPUT_INVALID' }, { status: 400 })
    const { workItemId } = await params
    const data = await acknowledgeDocumentWorkItem({ workItemId, ...parsed.data })
    scheduleWorkflowDrain()
    return NextResponse.json({ data })
  } catch (error) {
    return permissionErrorResponse(error)
      ?? documentAcknowledgementErrorResponse(error)
      ?? NextResponse.json({ code: 'DOCUMENT_ACKNOWLEDGEMENT_OPERATION_FAILED' }, { status: 500 })
  }
}
