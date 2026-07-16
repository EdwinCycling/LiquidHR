import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createEmployeeRelation } from '@/lib/employees/employee-service'
import { employeeErrorPayload } from '@/lib/employees/http-errors'
import { relationSchema } from '@/lib/employees/schemas'

interface RouteContext { params: Promise<{ employeeId: string }> }

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { employeeId } = await context.params
    const parsed = relationSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'RELATION_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createEmployeeRelation(employeeId, parsed.data) } }, { status: 201 })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    const payload = employeeErrorPayload(error)
    return NextResponse.json(payload.body, { status: payload.status })
  }
}
