import { redirect } from 'next/navigation'
import { PayrollProFormaView } from '@/components/payroll/payroll-pro-forma-view'
import { AuthenticationError, AuthorizationError, requireAuthContext, requirePermission } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'

export default async function MySalaryProFormaPage() {
  try {
    const context = await requireAuthContext()
    if (!context.employeeId) throw new AuthorizationError('Persoonlijke salarisgegevens zijn niet beschikbaar.')
    await requirePermission('salary:read', context.employeeId)
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) redirect('/login')
    if (error instanceof AuthorizationError || error instanceof ContextAccessError) redirect('/geen-toegang')
    throw error
  }
  return <PayrollProFormaView endpoint="/api/my-salary/pro-forma" />
}
