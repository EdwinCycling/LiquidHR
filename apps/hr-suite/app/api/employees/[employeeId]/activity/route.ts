import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createEmployeeActivity } from '@/lib/employees/employee-activity-service'
import { employeeActivityMessageSchema } from '@/lib/employees/employee-activity-schemas'

interface Context { params: Promise<{ employeeId: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const { employeeId } = await context.params
    const body: unknown = await request.json().catch(() => null)
    const message = typeof body === 'object' && body !== null && !Array.isArray(body) && 'message' in body ? body.message : null
    const parsed = employeeActivityMessageSchema.safeParse(message)
    if (!parsed.success) return NextResponse.json({ error: 'EMPLOYEE_ACTIVITY_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createEmployeeActivity(employeeId, parsed.data) } }, { status: 201 })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    const code = error instanceof Error && error.message.startsWith('EMPLOYEE_ACTIVITY_') ? error.message : 'EMPLOYEE_ACTIVITY_WRITE_FAILED'
    return NextResponse.json({ error: code }, { status: code.endsWith('INPUT_INVALID') ? 400 : 500 })
  }
}
