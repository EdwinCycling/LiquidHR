import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { getPayrollWorkspaceData, PayrollServiceError } from '@/lib/payroll/payroll-service'

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ data: await getPayrollWorkspaceData() })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof PayrollServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'PAYROLL_OPERATION_FAILED' }, { status: 500 })
  }
}
