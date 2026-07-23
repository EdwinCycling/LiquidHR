import { NextResponse } from 'next/server'
import { leaveErrorResponse } from '@/lib/leave/leave-service'
import { listLeaveYearControls, mutateLeaveLedger } from '@/lib/leave/ledger-service'
import { leaveLedgerMutationSchema } from '@/lib/leave/schemas'

export async function GET() {
  try {
    return NextResponse.json({ data: await listLeaveYearControls() })
  } catch (error) {
    return leaveErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const parsed = leaveLedgerMutationSchema.safeParse(await request.json() as unknown)
    if (!parsed.success) return NextResponse.json({ error: 'LEAVE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await mutateLeaveLedger(parsed.data) }, { status: 201 })
  } catch (error) {
    return leaveErrorResponse(error)
  }
}
