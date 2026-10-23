import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { PayrollProfessionalNavigation } from '@/components/payroll/payroll-professional-navigation'
import { getTranslator } from '@/lib/i18n/server'

export default async function PayrollRunsLoading() {
  const t = await getTranslator('payrollProfessional')
  const nav = {
    overview: t('overview'),
    runs: t('runs'),
    corrections: t('corrections'),
    compare: t('compare'),
    arrangements: t('arrangements'),
    settings: t('settings'),
  }

  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('runs')} description={t('runsDescription')} />
    <PayrollProfessionalNavigation active="runs" labels={nav} />
    <section aria-busy="true" aria-label={t('runWorkspaceLoading')} className="space-y-4">
      <p aria-live="polite" className="text-sm text-muted-foreground" role="status">{t('runWorkspaceLoading')}</p>
      <div aria-hidden="true" className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => <div className="h-36 animate-pulse rounded-[var(--radius-surface)] border border-border-subtle bg-surface-subtle" key={index} />)}
      </div>
    </section>
  </PageShell>
}
