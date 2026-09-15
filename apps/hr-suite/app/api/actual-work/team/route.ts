import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { getActualWorkTeamProjection } from '@/lib/actual-work/actual-work-service'

export async function GET(request: Request) {
  try {
    const month = new URL(request.url).searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
    return NextResponse.json({ data: await getActualWorkTeamProjection(month) })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ACTUAL_WORK_TEAM_FAILED' }, { status: 400 })
  }
}
