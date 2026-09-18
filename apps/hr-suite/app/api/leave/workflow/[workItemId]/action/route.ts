import { NextResponse } from 'next/server'
import { z } from 'zod'

import { leaveErrorResponse } from '@/lib/leave/leave-service'
import { performLeaveWorkflowAction } from '@/lib/leave/workflow-service'

interface Params {
  readonly params: Promise<{ workItemId: string }>
}

const inputSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_CHANGES', 'ACKNOWLEDGE', 'CANCEL']),
  expectedVersion: z.number().int().positive(),
  stepExpectedVersion: z.number().int().positive().nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(160),
  correlationId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().max(4000).nullable().optional(),
}).strict()

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const parsed = inputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'LEAVE_WORKFLOW_INPUT_INVALID' }, { status: 400 })
    const { workItemId } = await params
    const data = await performLeaveWorkflowAction({ workItemId, ...parsed.data })
    return NextResponse.json({ data })
  } catch (error) {
    return leaveErrorResponse(error)
  }
}
