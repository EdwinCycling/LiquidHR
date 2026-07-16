import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { getNextEmployeeNumber } from '@/lib/employees/employee-service'
import { employeeErrorPayload } from '@/lib/employees/http-errors'

export async function POST(): Promise<NextResponse> {
  try {
    return NextResponse.json({ data: { employeeNumber: await getNextEmployeeNumber() } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    const payload = employeeErrorPayload(error)
    return NextResponse.json(payload.body, { status: payload.status })
  }
}
