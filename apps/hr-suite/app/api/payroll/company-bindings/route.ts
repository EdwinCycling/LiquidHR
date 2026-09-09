import { payrollErrorResponse, bindPayrollCompany } from '@/lib/payroll/payroll-service'

export const runtime = 'nodejs'

function recordBody(value: unknown): { providerCompanyId: unknown; administrationId: unknown } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { providerCompanyId: undefined, administrationId: undefined }
  const record = value as Record<string, unknown>
  return { providerCompanyId: record.providerCompanyId, administrationId: record.administrationId }
}

export async function POST(request: Request): Promise<Response> {
  try {
    return Response.json({ data: await bindPayrollCompany(recordBody(await request.json().catch(() => null))) })
  } catch (error) {
    return payrollErrorResponse(error)
  }
}
