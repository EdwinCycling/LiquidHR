import { NextResponse } from 'next/server'
import { getLeaveRequestPreview } from '@/lib/leave/request-service'
import { leaveErrorResponse } from '@/lib/leave/leave-service'
import { leaveRequestPreviewQuerySchema } from '@/lib/leave/schemas'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const parsed = leaveRequestPreviewQuerySchema.safeParse({
      employeeId: url.searchParams.get('employeeId') ?? undefined,
      employmentId: url.searchParams.get('employmentId') ?? undefined,
      startDate: url.searchParams.get('startDate') ?? undefined,
      endDate: url.searchParams.get('endDate') ?? undefined,
      mode: url.searchParams.get('mode') ?? undefined,
    })
    if (!parsed.success) return NextResponse.json({ error: 'LEAVE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await getLeaveRequestPreview(parsed.data) })
  } catch (error) {
    return leaveErrorResponse(error)
  }
}
