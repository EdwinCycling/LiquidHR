import { NextResponse } from 'next/server'
import { getLeaveAccrualPreview } from '@/lib/leave/accrual-service'
import { leaveAccrualRunSchema } from '@/lib/leave/schemas'
import { leaveErrorResponse } from '@/lib/leave/leave-service'

export async function POST(request: Request) {
  try {
    const parsed = leaveAccrualRunSchema.safeParse(await request.json() as unknown)
    if (!parsed.success) return NextResponse.json({ error: 'LEAVE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await getLeaveAccrualPreview(parsed.data) })
  } catch (error) {
    return leaveErrorResponse(error)
  }
}
