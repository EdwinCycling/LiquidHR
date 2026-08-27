import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { getProcessWorkItemAssignmentOptions, processWorkErrorResponse } from '@/lib/process-automation/work-service'

const paramsSchema = z.object({ workItemId: z.string().uuid() }).strict()

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workItemId: string }> },
): Promise<NextResponse> {
  try {
    const parsedParams = paramsSchema.safeParse(await params)
    if (!parsedParams.success) return NextResponse.json({ code: 'INVALID_WORK_ITEM_ID' }, { status: 400 })
    const data = await getProcessWorkItemAssignmentOptions(parsedParams.data.workItemId)
    return NextResponse.json({ data })
  } catch (error) {
    return processWorkErrorResponse(error)
      ?? permissionErrorResponse(error)
      ?? NextResponse.json({ code: 'PROCESS_WORK_ASSIGNMENT_OPTIONS_READ_FAILED' }, { status: 500 })
  }
}
