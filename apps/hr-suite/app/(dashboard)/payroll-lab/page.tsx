import Link from 'next/link'
import { Blocks, Calculator, ArrowUpRight, Scale, WalletCards } from 'lucide-react'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Surface } from '@/components/ui/surface'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { getTranslator } from '@/lib/i18n/server'
import { requireComponentLibraryAccess } from '@/lib/payroll/component-library-access'
import { isArrangementFoundationStorageReady } from '@/lib/payroll/arrangement-service'

type LegacyCalculationQuery = { run?: string | string[]; error?: string | string[]; case?: string | string[] }

// Reserve extension space without rendering empty modules.
const PAYROLL_LAB_WINDOWS = [
  { href: '/payroll-lab/calculations', title: 'payrollLabCalculations', icon: Calculator },
  { href: '/payroll-lab/salarisverwerking', title: 'payrollLabIndividualPayroll', icon: WalletCards },
  { href: '/payroll-components', title: 'payrollLabComponents', icon: Blocks },
] as const

export default async function PayrollLabOverview({ searchParams }: { searchParams?: Promise<LegacyCalculationQuery> }) {
  let unavailable = false
  let access: Awaited<ReturnType<typeof requireComponentLibraryAccess>> | null = null
  try {
    access = await requireComponentLibraryAccess()
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) redirect('/login')
    if (error instanceof AuthorizationError || error instanceof ContextAccessError) redirect('/geen-toegang')
    unavailable = true
  }
  const arrangementReady = access ? await isArrangementFoundationStorageReady(access) : false
  const t = await getTranslator('navigation')
  if (unavailable) return <PageShell className="space-y-6 py-6 sm:py-8" role="status"><PageHeader title={t('payrollLab')} description={t('payrollLabUnavailable')} /></PageShell>

  const query = await searchParams
  const legacy = new URLSearchParams()
  if (typeof query?.run === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.run)) legacy.set('run', query.run)
  if (typeof query?.error === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(query.error)) legacy.set('error', query.error)
  if (query?.case === 'CC-NL-2026-001' || query?.case === 'GC-NL-001') legacy.set('case', query.case)
  if (legacy.size) redirect(`/payroll-lab/calculations?${legacy.toString()}`)

  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('payrollLab')} description={t('payrollLabOverviewDescription')} />
    <div className="grid gap-4 lg:grid-cols-2">
      {[...PAYROLL_LAB_WINDOWS, ...(arrangementReady ? [{ href: '/payroll-lab/arrangements', title: 'payrollArrangements', icon: Scale }] : [])].map(window => {
        const Icon = window.icon
        return <Surface key={window.href}>
          <Link className="flex min-h-36 items-start gap-4 rounded-[var(--radius-surface)] p-5 transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={window.href}>
            <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] bg-accent text-primary"><Icon aria-hidden="true" size={22} /></span>
            <h2 className="min-w-0 flex-1 break-words pt-2 text-base font-semibold">{t(window.title)}</h2>
            <ArrowUpRight aria-hidden="true" className="mt-2 shrink-0 text-muted-foreground" size={18} />
          </Link>
        </Surface>
      })}
    </div>
  </PageShell>
}
