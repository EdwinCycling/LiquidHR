import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { PayslipServiceError, listEmployeePayslips } from '@/lib/documents/payslip-service'

interface Context { params: Promise<{ employeeId: string }> }

export async function GET(_request: Request, context: Context) {
  try { return NextResponse.json({ data: await listEmployeePayslips((await context.params).employeeId) }) }
  catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof PayslipServiceError) return NextResponse.json({ code: error.code }, { status: error.status }); throw error }
}
