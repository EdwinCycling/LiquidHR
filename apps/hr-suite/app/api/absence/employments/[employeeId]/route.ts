import { NextResponse } from 'next/server'
import { AbsenceServiceError, listEmployeeAbsenceEmploymentOptions } from '@/lib/absence/service'
import { permissionErrorResponse } from '@/lib/auth/permissions'

export async function GET(_request: Request, { params }: { params: Promise<{ employeeId: string }> }): Promise<NextResponse> {
  try {
    const { employeeId } = await params
    const selection = await listEmployeeAbsenceEmploymentOptions(employeeId)
    return NextResponse.json({ options: selection.options, selectedEmploymentId: selection.employment?.id ?? null })
  } catch (error) {
    const denied = permissionErrorResponse(error)
    if (denied) return denied
    if (error instanceof AbsenceServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'ABSENCE_EMPLOYMENT_READ_FAILED' }, { status: 500 })
  }
}
