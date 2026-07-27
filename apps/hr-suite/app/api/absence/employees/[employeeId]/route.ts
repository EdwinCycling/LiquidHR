import { NextResponse } from 'next/server'
import { listEmployeeAbsence } from '@/lib/absence/service'
import { permissionErrorResponse } from '@/lib/auth/permissions'

export async function GET(_request: Request, { params }: { params: Promise<{ employeeId: string }> }): Promise<NextResponse> {
  try {
    const { employeeId } = await params
    return NextResponse.json({ cases: await listEmployeeAbsence(employeeId) })
  } catch (error) {
    const denied = permissionErrorResponse(error)
    if (denied) return denied
    return NextResponse.json({ error: 'ABSENCE_READ_FAILED' }, { status: 500 })
  }
}
