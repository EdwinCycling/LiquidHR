import Link from 'next/link'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Surface } from '@/components/ui/surface'
import { PayrollProfessionalNavigation } from '@/components/payroll/payroll-professional-navigation'
import { getTranslator } from '@/lib/i18n/server'
import { listPayrollProfessionalRuns } from '@/lib/payroll/payroll-professional-service'

export default async function PayrollCorrectionsPage() {
  const [runs, t] = await Promise.all([listPayrollProfessionalRuns(), getTranslator('payrollProfessional')])
  const nav = { overview: t('overview'), runs: t('runs'), corrections: t('corrections'), compare: t('compare'), arrangements: t('arrangements'), settings: t('settings') }
  const groups = new Map<string, typeof runs[number][]>()
  for (const run of runs) {
    const key = `${run.sourceSnapshot.source_employee_id}:${run.payrollPeriod.period_year}-${run.payrollPeriod.period_month}`
    groups.set(key, [...(groups.get(key) ?? []), run])
  }
  const corrections = [...groups.entries()].filter(([, rows]) => rows.length > 1).flatMap(([key, rows]) => {
    const sourceHashes = new Set(rows.map((row) => row.sourceSnapshot.source_hash))
    return sourceHashes.size > 1 ? [{ key, rows }] : []
  })
  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('corrections')} description={t('correctionsDescription')} />
    <PayrollProfessionalNavigation active="corrections" labels={nav} />
    {corrections.length === 0 ? <p className="rounded-xl border border-dashed border-border-subtle p-6 text-sm text-muted-foreground">{t('noCorrections')}</p> : <div className="space-y-4">{corrections.map(({ key, rows }) => <Surface key={key} className="space-y-3 p-4 sm:p-5">
      <h2 className="font-semibold">{t('employee')} · {rows[0].sourceSnapshot.source_employee_id.slice(-8)} · {rows[0].payrollPeriod.period_year}-{String(rows[0].payrollPeriod.period_month).padStart(2, '0')}</h2>
      <ul className="divide-y divide-border-subtle">{rows.map((row) => <li key={row.run.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><span>{t(`run_${row.run.status}`)} · {t('sourceHash')} <code className="break-all">{row.sourceSnapshot.source_hash}</code></span><Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/payroll/runs/${encodeURIComponent(row.run.id)}`}>{t('openDetail')}</Link></li>)}</ul>
    </Surface>)}</div>}
  </PageShell>
}
