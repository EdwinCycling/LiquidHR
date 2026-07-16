import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { revealEmployeeBsn, setEmployeeBsn } from '@/lib/employees/employee-service'
import { employeeErrorPayload } from '@/lib/employees/http-errors'
import { employeeBsnSchema } from '@/lib/employees/schemas'

interface RouteContext { params: Promise<{ employeeId: string }> }

export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { employeeId } = await context.params
    return NextResponse.json({ data: { bsn: await revealEmployeeBsn(employeeId) } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    const payload = employeeErrorPayload(error)
    return NextResponse.json(payload.body, { status: payload.status })
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const parsed = employeeBsnSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'BSN_INVALID' }, { status: 400 })
    const { employeeId } = await context.params
    await setEmployeeBsn(employeeId, parsed.data.bsn)
    return NextResponse.json({ data: { updated: true } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    const payload = employeeErrorPayload(error)
    return NextResponse.json(payload.body, { status: payload.status })
  }
}
