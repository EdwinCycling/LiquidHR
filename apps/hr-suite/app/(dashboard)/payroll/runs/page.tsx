import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { PayrollProfessionalNavigation } from '@/components/payroll/payroll-professional-navigation'
import { PayrollRunSummaryList } from '@/components/payroll/payroll-professional-view'
import { getTranslator } from '@/lib/i18n/server'
import { listPayrollProfessionalRuns } from '@/lib/payroll/payroll-professional-service'

export default async function PayrollRunsPage() {
  const [runs, t] = await Promise.all([listPayrollProfessionalRuns(), getTranslator('payrollProfessional')])
  const nav = { overview: t('overview'), runs: t('runs'), corrections: t('corrections'), compare: t('compare'), arrangements: t('arrangements'), settings: t('settings') }
  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('runs')} description={t('runsDescription')} />
    <PayrollProfessionalNavigation active="runs" labels={nav} />
    <PayrollRunSummaryList runs={runs} labels={Object.fromEntries(['empty','period','employee','status','runId','action','openDetail','runHashesHint','run_SUCCEEDED','run_FAILED','run_RUNNING','run_PENDING'].map((key) => [key, t(key)]))} />
  </PageShell>
}
