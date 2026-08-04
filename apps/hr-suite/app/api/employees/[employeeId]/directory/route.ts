import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { EmployeeDirectoryError, getEmployeeDirectoryDetail } from '@/lib/employee-directory/service'

export async function GET(_request: Request, context: { params: Promise<{ employeeId: string }> }): Promise<NextResponse> {
  try {
    return NextResponse.json(await getEmployeeDirectoryDetail((await context.params).employeeId))
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof EmployeeDirectoryError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'EMPLOYEE_DIRECTORY_DETAIL_FAILED' }, { status: 500 })
  }
}
