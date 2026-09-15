import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { closeActualWorkPeriod, listActualWorkPeriods } from '@/lib/actual-work/actual-work-service'

export async function GET() {
  try {
    return NextResponse.json({ data: await listActualWorkPeriods() })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ACTUAL_WORK_PERIODS_FAILED' }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    return NextResponse.json({ data: await closeActualWorkPeriod(await request.json()) })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ACTUAL_WORK_PERIOD_CLOSE_FAILED' }, { status: 400 })
  }
}
