import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createPayslipDownload, PayslipServiceError } from '@/lib/documents/payslip-service'

interface Context { params: Promise<{ employeeId: string; payslipId: string }> }

export async function GET(_request: Request, context: Context) {
  try { const params = await context.params; return NextResponse.redirect(await createPayslipDownload(params.employeeId, params.payslipId)) }
  catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof PayslipServiceError) return NextResponse.json({ code: error.code }, { status: error.status }); throw error }
}
