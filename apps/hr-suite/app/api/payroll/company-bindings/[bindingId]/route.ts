import { payrollErrorResponse, unbindPayrollCompany } from '@/lib/payroll/payroll-service'

export const runtime = 'nodejs'

export async function DELETE(_request: Request, context: { params: Promise<{ bindingId: string }> }): Promise<Response> {
  try {
    const { bindingId } = await context.params
    return Response.json({ data: await unbindPayrollCompany(bindingId) })
  } catch (error) {
    return payrollErrorResponse(error)
  }
}
