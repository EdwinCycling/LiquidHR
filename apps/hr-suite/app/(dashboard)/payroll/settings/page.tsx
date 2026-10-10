import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { PayrollProfessionalNavigation } from '@/components/payroll/payroll-professional-navigation'
import { Surface } from '@/components/ui/surface'
import { getTranslator } from '@/lib/i18n/server'
import { requireComponentLibraryAccess } from '@/lib/payroll/component-library-access'

export default async function PayrollSettingsPage() {
  const [access, t] = await Promise.all([requireComponentLibraryAccess(false), getTranslator('payrollProfessional')])
  const nav = { overview: t('overview'), runs: t('runs'), corrections: t('corrections'), compare: t('compare'), arrangements: t('arrangements'), settings: t('settings') }
  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('settings')} description={t('settingsDescription')} />
    <PayrollProfessionalNavigation active="settings" labels={nav} />
    <Surface className="space-y-4 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">{t('activePayrollAdministration')}</h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-sm text-muted-foreground">{t('administration')}</dt><dd className="mt-1 font-medium">{access.administration.displayName}</dd></div>
        <div><dt className="text-sm text-muted-foreground">{t('capability')}</dt><dd className="mt-1 font-medium">{access.administration.capabilityEnabled ? t('enabled') : t('disabled')}</dd></div>
        <div><dt className="text-sm text-muted-foreground">{t('status')}</dt><dd className="mt-1 font-medium">{access.administration.status}</dd></div>
        <div><dt className="text-sm text-muted-foreground">{t('writeAccess')}</dt><dd className="mt-1 font-medium">{access.canCopy ? t('available') : t('readOnly')}</dd></div>
      </dl>
      <p className="text-sm text-muted-foreground">{t('settingsScopeNotice')}</p>
    </Surface>
  </PageShell>
}
