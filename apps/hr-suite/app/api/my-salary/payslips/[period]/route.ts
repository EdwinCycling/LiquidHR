import { renderMySalaryPayslipPdf } from '@/lib/payroll/payroll-professional-service'
import { servePayrollPayslip } from '@/lib/payroll/payroll-payslip-response'

type RouteContext = { readonly params: Promise<{ readonly period: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { period } = await context.params
  return await servePayrollPayslip(request, period, (year, month) => renderMySalaryPayslipPdf(year, month))
}
