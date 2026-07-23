import { NextResponse } from 'next/server'
import { confirmLeaveRequest } from '@/lib/leave/request-service'
import { leaveErrorResponse } from '@/lib/leave/leave-service'
import { leaveRequestConfirmSchema } from '@/lib/leave/schemas'

export async function POST(request: Request) {
  try {
    const parsed = leaveRequestConfirmSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'LEAVE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await confirmLeaveRequest(parsed.data) }, { status: 201 })
  } catch (error) {
    return leaveErrorResponse(error)
  }
}
