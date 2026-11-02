import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowUpRight, ClipboardCheck, GitCompareArrows, ReceiptText, Settings2, WalletCards } from 'lucide-react'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Surface } from '@/components/ui/surface'
import { PayrollProfessionalNavigation } from '@/components/payroll/payroll-professional-navigation'
import { PayrollRunSummaryList } from '@/components/payroll/payroll-professional-view'
import { createPayrollLabels, PayrollWorkspace } from '@/components/payroll/payroll-workspace'
import { AuthorizationError } from '@/lib/auth/permissions'
import { ModuleError } from '@/lib/modules/module-service'
import { PayrollLabUnavailableError } from '@/lib/payroll/access'
import { getPayrollWorkspaceData } from '@/lib/payroll/payroll-service'
import type { PayrollWorkspaceData } from '@/lib/payroll/payroll-service'
import { getTranslator } from '@/lib/i18n/server'
import { listPayrollProfessionalRuns } from '@/lib/payroll/payroll-professional-service'

const cards = [
  { href: '/payroll/runs', key: 'runs', icon: WalletCards },
  { href: '/payroll/corrections', key: 'corrections', icon: ClipboardCheck },
  { href: '/payroll/compare', key: 'compare', icon: GitCompareArrows },
  { href: '/payroll/arrangements', key: 'arrangements', icon: ReceiptText },
  { href: '/payroll/settings', key: 'settings', icon: Settings2 },
] as const

type WorkspaceLoad = { data: PayrollWorkspaceData | null; moduleInactive: boolean }

async function loadP1Workspace(): Promise<WorkspaceLoad> {
  try {
    return { data: await getPayrollWorkspaceData(), moduleInactive: false }
  } catch (error) {
    if (error instanceof AuthorizationError) return { data: null, moduleInactive: false }
    if (error instanceof ModuleError && error.status === 404) return { data: null, moduleInactive: true }
    throw error
  }
}

async function loadProfessionalRuns(): Promise<Awaited<ReturnType<typeof listPayrollProfessionalRuns>> | null> {
  try {
    return await listPayrollProfessionalRuns()
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof PayrollLabUnavailableError) return null
    throw error
  }
}

export default async function PayrollOverviewPage() {
  const [workspace, runs, payrollLabels, professionalLabels] = await Promise.all([
    loadP1Workspace(),
    loadProfessionalRuns(),
    getTranslator('payroll'),
    getTranslator('payrollProfessional'),
  ])
  if (!workspace.data && !runs) {
    if (workspace.moduleInactive) notFound()
    redirect('/geen-toegang')
  }
  const nav = {
    overview: professionalLabels('overview'),
    runs: professionalLabels('runs'),
    corrections: professionalLabels('corrections'),
    compare: professionalLabels('compare'),
    arrangements: professionalLabels('arrangements'),
    settings: professionalLabels('settings'),
  }
  return <>
    {workspace.data ? <PayrollWorkspace active="overview" data={workspace.data} labels={createPayrollLabels(payrollLabels)} /> : null}
    {runs ? <PageShell className="space-y-6 py-6 sm:py-8">
      {!workspace.data ? <PageHeader title={professionalLabels('title')} description={professionalLabels('overviewDescription')} /> : null}
      <PayrollProfessionalNavigation active="overview" labels={nav} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ href, key, icon: Icon }) => <Surface key={key}>
          <Link href={href} className="flex min-h-28 items-center gap-4 rounded-[var(--radius-surface)] p-5 hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-focus">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Icon aria-hidden="true" size={21} /></span>
            <span className="min-w-0 flex-1 font-semibold">{professionalLabels(key)}</span><ArrowUpRight aria-hidden="true" size={17} className="shrink-0 text-muted-foreground" />
          </Link>
        </Surface>)}
      </div>
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">{professionalLabels('recentRuns')}</h2><p className="mt-1 text-sm text-muted-foreground">{professionalLabels('persistedOnly')}</p></div><Link href="/payroll/runs" className="text-sm font-medium text-primary underline-offset-4 hover:underline">{professionalLabels('allRuns')} →</Link></div>
        <PayrollRunSummaryList runs={runs.slice(0, 8)} labels={Object.fromEntries(['empty','period','employee','status','action','openDetail','run_SUCCEEDED','run_FAILED','run_RUNNING','run_PENDING'].map((key) => [key, professionalLabels(key)]))} />
      </section>
    </PageShell> : null}
  </>
}