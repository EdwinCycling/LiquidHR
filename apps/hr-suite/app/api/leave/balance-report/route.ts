import { NextResponse } from 'next/server'
import { getLeaveBalanceReport, leaveErrorResponse } from '@/lib/leave/leave-service'
import { balanceReportQuerySchema } from '@/lib/leave/schemas'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const parsed = balanceReportQuerySchema.safeParse({
      employmentId: url.searchParams.get('employmentId') ?? undefined,
      asOfDate: url.searchParams.get('asOfDate') ?? undefined,
    })
    if (!parsed.success) return NextResponse.json({ error: 'LEAVE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await getLeaveBalanceReport(parsed.data) })
  } catch (error) {
    return leaveErrorResponse(error)
  }
}
