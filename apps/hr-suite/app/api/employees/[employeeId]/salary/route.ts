import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { getEmployeeSalarySummary } from '@/lib/employment/employment-service'

interface Context { params: Promise<{ employeeId: string }> }

export async function GET(request: Request, context: Context) {
  try {
    const { employeeId } = await context.params
    const employmentId = new URL(request.url).searchParams.get('employmentId') ?? undefined
    return NextResponse.json({ data: await getEmployeeSalarySummary(employeeId, employmentId) })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    return NextResponse.json({ error: 'EMPLOYEE_SALARY_READ_FAILED' }, { status: 500 })
  }
}
