import { NextResponse } from 'next/server'
import { leaveErrorResponse } from '@/lib/leave/leave-service'
import { getLeaveYearOverview } from '@/lib/leave/overview-service'
import { leaveOverviewQuerySchema } from '@/lib/leave/schemas'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const parsed = leaveOverviewQuerySchema.safeParse({
      employmentId: url.searchParams.get('employmentId') ?? undefined,
      year: url.searchParams.get('year') ?? undefined,
    })
    if (!parsed.success) return NextResponse.json({ error: 'LEAVE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await getLeaveYearOverview(parsed.data) })
  } catch (error) {
    return leaveErrorResponse(error)
  }
}
