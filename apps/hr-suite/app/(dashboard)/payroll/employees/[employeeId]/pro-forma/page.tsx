import { redirect } from 'next/navigation'
import { PayrollProFormaView } from '@/components/payroll/payroll-pro-forma-view'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { authorizeHrAdminPayrollProFormaTarget } from '@/lib/payroll/payroll-pro-forma-authorization'

export default async function HrAdminEmployeeProFormaPage({
  params,
}: {
  readonly params: Promise<{ readonly employeeId: string }>
}) {
  const { employeeId } = await params
  try {
    await authorizeHrAdminPayrollProFormaTarget(employeeId)
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) redirect('/login')
    if (error instanceof AuthorizationError || error instanceof ContextAccessError) redirect('/geen-toegang')
    throw error
  }
  return <PayrollProFormaView endpoint={`/api/hr-admin/employees/${employeeId}/pro-forma`} />
}
