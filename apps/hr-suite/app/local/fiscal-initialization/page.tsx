import { requireLocalFiscalOperator } from '@/lib/employment/local-fiscal-operator'
import { getPayrollFiscalAdministrationSettings } from '@/lib/employment/employment-payroll-tax-profile-service'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { buttonClasses } from '@/components/ui/button'
import { getTranslator } from '@/lib/i18n/server'
export default async function LocalFiscalInitializationPage() {
  await requireLocalFiscalOperator()
  const roster=await getPayrollFiscalAdministrationSettings()
  const t = await getTranslator('auth')
  return <PageShell className="space-y-6 py-6">
    <PageHeader title={t('localFiscalTitle')} description={roster.administration.name} />
    <p>{t('localFiscalDescription')}</p>
    <p>{t('localFiscalValues')}</p>
    <p>{t('localFiscalCount', { count: roster.rows.length })}</p>
    <form action="/api/local/fiscal-initialization" method="post">
      <input type="hidden" name="administrationId" value={roster.administration.id} />
      <button className={buttonClasses({variant:'primary',size:'md'})} type="submit">{t('localFiscalApply')}</button>
    </form>
    <a href="/dashboard/start">{t('localReturnToApp')}</a>
  </PageShell>
}
