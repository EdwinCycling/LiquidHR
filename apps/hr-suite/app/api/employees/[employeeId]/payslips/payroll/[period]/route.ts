import { renderEmployeePayrollPayslipPdf } from '@/lib/payroll/payroll-professional-service'
import { servePayrollPayslip } from '@/lib/payroll/payroll-payslip-response'

type RouteContext = { readonly params: Promise<{ readonly employeeId: string; readonly period: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { employeeId, period } = await context.params
  return await servePayrollPayslip(request, period, (year, month) =>
    renderEmployeePayrollPayslipPdf(employeeId, year, month))
}
