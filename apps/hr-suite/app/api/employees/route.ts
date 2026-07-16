import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createEmployee } from '@/lib/employees/employee-service'
import { employeeErrorPayload } from '@/lib/employees/http-errors'
import { employeeCreateSchema } from '@/lib/employees/schemas'
import { listEmployeesOverview } from '@/lib/employment/employment-service'

function errorResponse(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  const payload = employeeErrorPayload(error)
  return NextResponse.json(payload.body, { status: payload.status })
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const search = new URL(request.url).searchParams.get('search')?.trim().toLocaleLowerCase('nl') ?? ''
    const employees = await listEmployeesOverview()
    const data = search
      ? employees.filter((employee) => `${employee.employeeNumber} ${employee.firstName} ${employee.birthName} ${employee.workEmail ?? ''}`.toLocaleLowerCase('nl').includes(search))
      : employees
    return NextResponse.json({ data })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = employeeCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'EMPLOYEE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await createEmployee(parsed.data) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
