import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { EmploymentServiceError, getEmploymentCreationOptions } from '@/lib/employment/employment-service'

interface RouteContext {
  params: Promise<{ employeeId: string }>
}

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { employeeId } = await context.params
    const administrationId = new URL(request.url).searchParams.get('administrationId') ?? undefined
    return NextResponse.json({ data: await getEmploymentCreationOptions(employeeId, administrationId) })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof EmploymentServiceError) {
      return NextResponse.json({ code: error.code }, { status: error.status })
    }
    return NextResponse.json({ code: 'EMPLOYMENT_OPTIONS_FAILED' }, { status: 500 })
  }
}
