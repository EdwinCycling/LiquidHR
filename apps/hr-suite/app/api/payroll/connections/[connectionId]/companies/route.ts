import { payrollErrorResponse, discoverNmbrsCompanies } from '@/lib/payroll/payroll-service'

export const runtime = 'nodejs'

export async function POST(_request: Request, context: { params: Promise<{ connectionId: string }> }): Promise<Response> {
  try {
    const { connectionId } = await context.params
    return Response.json({ data: await discoverNmbrsCompanies(connectionId) })
  } catch (error) {
    return payrollErrorResponse(error)
  }
}
