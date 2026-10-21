import { getMySalaryPayslipPdfArtifact } from '@/lib/payroll/payroll-professional-service'
import { servePayrollPayslip } from '@/lib/payroll/payroll-payslip-response'

type RouteContext = { readonly params: Promise<{ readonly period: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { period } = await context.params
  return await servePayrollPayslip(request, period, async (year, month) => {
    const artifact = await getMySalaryPayslipPdfArtifact(year, month)
    if (!artifact || artifact.content_type !== 'application/pdf') return null
    return {
      artifact_bytes: artifact.artifact_bytes,
      content_type: 'application/pdf',
      id: artifact.id,
      artifact_hash: artifact.artifact_hash,
    }
  })
}
