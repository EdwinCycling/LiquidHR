import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { getEmployeeNumberUsage } from '@/lib/employees/employee-service'

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ data: await getEmployeeNumberUsage() })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    return NextResponse.json({ error: 'EMPLOYEE_NUMBER_USAGE_FAILED' }, { status: 500 })
  }
}
