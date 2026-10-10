import Link from 'next/link'
import { ArrowUpRight, ClipboardCheck, GitCompareArrows, ReceiptText, Settings2, WalletCards } from 'lucide-react'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Surface } from '@/components/ui/surface'
import { PayrollProfessionalNavigation } from '@/components/payroll/payroll-professional-navigation'
import { PayrollRunSummaryList } from '@/components/payroll/payroll-professional-view'
import { getTranslator } from '@/lib/i18n/server'
import { listPayrollProfessionalRuns } from '@/lib/payroll/payroll-professional-service'

const cards = [
  { href: '/payroll/runs', key: 'runs', icon: WalletCards },
  { href: '/payroll/corrections', key: 'corrections', icon: ClipboardCheck },
  { href: '/payroll/compare', key: 'compare', icon: GitCompareArrows },
  { href: '/payroll/arrangements', key: 'arrangements', icon: ReceiptText },
  { href: '/payroll/settings', key: 'settings', icon: Settings2 },
] as const

export default async function PayrollOverviewPage() {
  const [runs, t] = await Promise.all([listPayrollProfessionalRuns(), getTranslator('payrollProfessional')])
  const nav = {
    overview: t('overview'), runs: t('runs'), corrections: t('corrections'), compare: t('compare'), arrangements: t('arrangements'), settings: t('settings'),
  }
  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('title')} description={t('overviewDescription')} />
    <PayrollProfessionalNavigation active="overview" labels={nav} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(({ href, key, icon: Icon }) => <Surface key={key}>
        <Link href={href} className="flex min-h-28 items-center gap-4 rounded-[var(--radius-surface)] p-5 hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-focus">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Icon aria-hidden="true" size={21} /></span>
          <span className="min-w-0 flex-1 font-semibold">{t(key)}</span><ArrowUpRight aria-hidden="true" size={17} className="shrink-0 text-muted-foreground" />
        </Link>
      </Surface>)}
    </div>
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">{t('recentRuns')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('persistedOnly')}</p></div><Link href="/payroll/runs" className="text-sm font-medium text-primary underline-offset-4 hover:underline">{t('allRuns')} →</Link></div>
      <PayrollRunSummaryList runs={runs.slice(0, 8)} labels={Object.fromEntries(['empty','period','employee','status','runId','action','openDetail','runHashesHint','run_SUCCEEDED','run_FAILED','run_RUNNING','run_PENDING'].map((key) => [key, t(key)]))} />
    </section>
  </PageShell>
}
