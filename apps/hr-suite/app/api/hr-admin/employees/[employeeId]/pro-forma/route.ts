import { authorizeHrAdminPayrollProFormaTarget } from '@/lib/payroll/payroll-pro-forma-authorization'
import { postPayrollProFormaTarget } from '@/lib/payroll/payroll-pro-forma-http'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  context: { readonly params: Promise<{ readonly employeeId: string }> },
): Promise<Response> {
  const { employeeId } = await context.params
  return await postPayrollProFormaTarget(request, employeeId, authorizeHrAdminPayrollProFormaTarget)
}
