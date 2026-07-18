import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { EmployeeServiceError, setEmployeeArchived } from '@/lib/employees/employee-service'

interface RouteContext { params: Promise<{ employeeId: string }> }
const archiveSchema = z.object({ archived: z.boolean() }).strict()

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { employeeId } = await context.params
    const parsed = archiveSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'EMPLOYEE_ARCHIVE_INPUT_INVALID' }, { status: 400 })
    await setEmployeeArchived(employeeId, parsed.data.archived)
    return NextResponse.json({ data: { archived: parsed.data.archived } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof EmployeeServiceError) return NextResponse.json({ code: error.code }, { status: error.status })
    return NextResponse.json({ code: 'EMPLOYEE_ARCHIVE_FAILED' }, { status: 500 })
  }
}
