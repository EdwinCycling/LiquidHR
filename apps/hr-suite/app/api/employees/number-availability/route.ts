import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { checkEmployeeNumberAvailability } from '@/lib/employees/employee-service'

const querySchema = z.string().trim().min(1).max(40)

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const employeeNumber = querySchema.safeParse(new URL(request.url).searchParams.get('employeeNumber') ?? '')
    if (!employeeNumber.success) return NextResponse.json({ error: 'EMPLOYEE_NUMBER_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { available: await checkEmployeeNumberAvailability(employeeNumber.data) } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    return NextResponse.json({ error: 'EMPLOYEE_NUMBER_AVAILABILITY_FAILED' }, { status: 500 })
  }
}
