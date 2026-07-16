import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createEmployeeBankAccount } from '@/lib/employees/employee-service'
import { employeeErrorPayload } from '@/lib/employees/http-errors'
import { bankAccountSchema } from '@/lib/employees/schemas'

interface RouteContext { params: Promise<{ employeeId: string }> }

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { employeeId } = await context.params
    const parsed = bankAccountSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'BANK_ACCOUNT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createEmployeeBankAccount(employeeId, parsed.data) } }, { status: 201 })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    const payload = employeeErrorPayload(error)
    return NextResponse.json(payload.body, { status: payload.status })
  }
}
