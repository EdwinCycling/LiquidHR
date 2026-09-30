import { redirect } from 'next/navigation'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { getTranslator } from '@/lib/i18n/server'
import { PayrollLabUnavailableError, resolvePayrollLabAdministration } from '@/lib/payroll/access'

export default async function PayrollLabPage() {
  let context
  try {
    context = await requirePermission('salary:read')
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) redirect('/login')
    if (error instanceof AuthorizationError || error instanceof ContextAccessError) redirect('/geen-toegang')
    throw error
  }

  let administration
  try {
    administration = await resolvePayrollLabAdministration(context)
  } catch (error) {
    if (!(error instanceof PayrollLabUnavailableError)) throw error
    const t = await getTranslator('navigation')
    return (
      <section className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:px-10" role="status">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('payrollLab')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('payrollLabUnavailable')}</p>
      </section>
    )
  }
  if (!administration) redirect('/geen-toegang')

  const t = await getTranslator('navigation')
  return (
    <section className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:px-10">
      <header className="border-b pb-5">
        <p className="text-sm font-medium text-muted-foreground">{t('payrollLabConnected')}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{t('payrollLab')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('payrollLabDescription')}</p>
      </header>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">{t('payrollLabAdministration')}</dt>
          <dd className="mt-1 font-medium text-foreground">{administration.displayName}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t('payrollLabStatus')}</dt>
          <dd className="mt-1 font-medium text-foreground">{t('payrollLabActive')}</dd>
        </div>
      </dl>
    </section>
  )
}
