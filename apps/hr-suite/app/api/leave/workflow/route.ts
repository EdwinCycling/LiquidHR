import { NextResponse } from 'next/server'

import { leaveErrorResponse } from '@/lib/leave/leave-service'
import { startLeaveRequestWorkflow } from '@/lib/leave/workflow-service'
import { leaveRequestConfirmSchema } from '@/lib/leave/schemas'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = leaveRequestConfirmSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'LEAVE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await startLeaveRequestWorkflow(parsed.data) }, { status: 201 })
  } catch (error) {
    return leaveErrorResponse(error)
  }
}
