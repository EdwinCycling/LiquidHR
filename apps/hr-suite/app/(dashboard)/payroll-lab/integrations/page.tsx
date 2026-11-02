import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Surface } from '@/components/ui/surface'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { ModuleError } from '@/lib/modules/module-service'
import { getTranslator } from '@/lib/i18n/server'
import { getPayrollWorkspaceData, PayrollServiceError } from '@/lib/payroll/payroll-service'
import type { Translator } from '@/lib/i18n/translator'

async function loadPayrollIntegrationPage(): Promise<Translator> {
  try {
    const [, translator] = await Promise.all([getPayrollWorkspaceData(), getTranslator('payroll')])
    return translator
  } catch (error) {
    if (error instanceof AuthenticationError) redirect('/login')
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    if (error instanceof ModuleError && error.status === 404) notFound()
    if (error instanceof PayrollServiceError && error.status === 404) notFound()
    throw error
  }
}

export default async function PayrollIntegrationsPage() {
  const t = await loadPayrollIntegrationPage()

  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('title')} description={t('description')} />
    <Surface className="space-y-3 p-5 sm:p-6">
      <h2 className="text-base font-semibold">{t('externalIntegrationDisabledTitle')}</h2>
      <p className="text-sm text-muted-foreground">{t('externalIntegrationDisabledDescription')}</p>
      <p className="text-sm text-muted-foreground">{t('externalIntegrationRevocationNotice')}</p>
      <Link className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] text-sm font-medium text-accent-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-focus" href="/payroll">
        {t('returnToPayroll')}
      </Link>
    </Surface>
  </PageShell>
}
