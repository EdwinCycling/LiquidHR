import { notFound } from 'next/navigation'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Surface } from '@/components/ui/surface'
import { PayrollProfessionalNavigation } from '@/components/payroll/payroll-professional-navigation'
import { PayrollManualComparison, PayrollRunSummaryList } from '@/components/payroll/payroll-professional-view'
import { getTranslator } from '@/lib/i18n/server'
import { getPayrollProfessionalRun, listPayrollProfessionalRuns } from '@/lib/payroll/payroll-professional-service'

type SearchParams = { readonly run?: string | string[] }

export default async function PayrollComparisonPage({ searchParams }: { readonly searchParams: Promise<SearchParams> }) {
  const [query, runs, t] = await Promise.all([searchParams, listPayrollProfessionalRuns(), getTranslator('payrollProfessional')])
  const runId = typeof query.run === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.run) ? query.run : null
  const selected = runId ? await getPayrollProfessionalRun(runId) : null
  if (runId && !selected) notFound()
  const nav = { overview: t('overview'), runs: t('runs'), corrections: t('corrections'), compare: t('compare'), arrangements: t('arrangements'), settings: t('settings') }
  const labels = Object.fromEntries([
    'component','liquidHr','external','difference','exact','cent','larger','manualComparisonHint',
    'contractual_salary','additional_cash_amount','additional_hours_pay','gross_salary','employee_pension','taxable_wage','employee_insurance_wage','zvw_wage','wage_tax','net_salary','employer_insurance','employer_pension','holiday_allowance_reserve','holiday_reserve','year_end_reserve','total_employer_cost','cumulative_gross','cumulative_holiday_reserve','cumulative_year_end_reserve',
  ].map((key) => [key, t(key)]))
  const summaryLabels = Object.fromEntries(['empty','period','employee','status','runId','action','openDetail','runHashesHint','run_SUCCEEDED','run_FAILED','run_RUNNING','run_PENDING'].map((key) => [key, t(key)]))
  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('compare')} description={t('compareDescription')} />
    <PayrollProfessionalNavigation active="compare" labels={nav} />
    {selected ? <Surface className="space-y-4 p-4 sm:p-6"><h2 className="text-lg font-semibold">{t('runId')}: {selected.run.id}</h2><p className="text-sm text-muted-foreground">{t('externalComparisonReadOnly')}</p><PayrollManualComparison artifacts={selected} labels={labels} /></Surface>
      : <section className="space-y-3"><h2 className="text-lg font-semibold">{t('selectRun')}</h2><PayrollRunSummaryList runs={runs} labels={summaryLabels} /></section>}
  </PageShell>
}
