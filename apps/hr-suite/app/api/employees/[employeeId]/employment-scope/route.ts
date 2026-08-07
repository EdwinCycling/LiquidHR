import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { EmploymentServiceError, ensureEmployeeAdministrationAssignment } from '@/lib/employment/employment-service'

interface RouteContext {
  params: Promise<{ employeeId: string }>
}

export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { employeeId } = await context.params
    await ensureEmployeeAdministrationAssignment(employeeId, new Date().toISOString().slice(0, 10))
    return NextResponse.json({ data: { ready: true } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof EmploymentServiceError) {
      return NextResponse.json({ code: error.code }, { status: error.status })
    }
    return NextResponse.json({ code: 'EMPLOYMENT_SCOPE_FAILED' }, { status: 500 })
  }
}
