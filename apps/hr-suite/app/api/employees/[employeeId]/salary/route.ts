import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { getEmployeeSalarySummary } from '@/lib/employment/employment-service'

interface Context { params: Promise<{ employeeId: string }> }

export async function GET(_request: Request, context: Context) {
  try {
    const { employeeId } = await context.params
    return NextResponse.json({ data: await getEmployeeSalarySummary(employeeId) })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    return NextResponse.json({ error: 'EMPLOYEE_SALARY_READ_FAILED' }, { status: 500 })
  }
}
