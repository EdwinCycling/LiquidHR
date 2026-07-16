import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { archiveEmployee, updateEmployee } from '@/lib/employees/employee-service'
import { employeeErrorPayload } from '@/lib/employees/http-errors'
import { employeeUpdateSchema } from '@/lib/employees/schemas'
import { getEmployeeEmploymentDetail } from '@/lib/employment/employment-service'

interface RouteContext { params: Promise<{ employeeId: string }> }
const archiveSchema = z.object({ updatedAt: z.iso.datetime() }).strict()

function errorResponse(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  const payload = employeeErrorPayload(error)
  return NextResponse.json(payload.body, { status: payload.status })
}

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { employeeId } = await context.params
    return NextResponse.json({ data: await getEmployeeEmploymentDetail(employeeId) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { employeeId } = await context.params
    const parsed = employeeUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'EMPLOYEE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await updateEmployee(employeeId, parsed.data) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { employeeId } = await context.params
    const parsed = archiveSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'EMPLOYEE_INPUT_INVALID' }, { status: 400 })
    await archiveEmployee(employeeId, parsed.data.updatedAt)
    return NextResponse.json({ data: { archived: true } })
  } catch (error) {
    return errorResponse(error)
  }
}
