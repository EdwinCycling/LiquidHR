import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { documentAcknowledgementErrorResponse, startDocumentAcknowledgement } from '@/lib/process-automation/document-acknowledgement-service'
import { scheduleWorkflowDrain } from '@/lib/process-automation/workflow-job-service'

const inputSchema = z.object({
  processDefinitionId: z.string().uuid(),
  subjectEmployeeId: z.string().uuid(),
  documentId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(1).max(200),
  correlationId: z.string().uuid().nullable().optional(),
}).strict()

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = inputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'DOCUMENT_ACKNOWLEDGEMENT_INPUT_INVALID' }, { status: 400 })
    const data = await startDocumentAcknowledgement(parsed.data)
    scheduleWorkflowDrain()
    return NextResponse.json({ data })
  } catch (error) {
    return permissionErrorResponse(error)
      ?? documentAcknowledgementErrorResponse(error)
      ?? NextResponse.json({ code: 'DOCUMENT_ACKNOWLEDGEMENT_OPERATION_FAILED' }, { status: 500 })
  }
}
