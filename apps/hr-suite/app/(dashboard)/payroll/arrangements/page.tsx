import Link from 'next/link'
import { ArrowUpRight, Blocks, Scale } from 'lucide-react'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { PayrollProfessionalNavigation } from '@/components/payroll/payroll-professional-navigation'
import { Surface } from '@/components/ui/surface'
import { getTranslator } from '@/lib/i18n/server'
import { requireComponentLibraryAccess } from '@/lib/payroll/component-library-access'

export default async function PayrollArrangementsPage() {
  const [access, t] = await Promise.all([requireComponentLibraryAccess(false), getTranslator('payrollProfessional')])
  const nav = { overview: t('overview'), runs: t('runs'), corrections: t('corrections'), compare: t('compare'), arrangements: t('arrangements'), settings: t('settings') }
  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('arrangements')} description={t('arrangementsDescription', { administration: access.administration.displayName })} />
    <PayrollProfessionalNavigation active="arrangements" labels={nav} />
    <div className="grid gap-4 md:grid-cols-2">
      <Surface><Link href="/payroll-lab/arrangements" className="flex min-h-32 items-center gap-4 rounded-[var(--radius-surface)] p-5 hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-focus"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Scale aria-hidden="true" /></span><span className="min-w-0 flex-1"><strong className="block">{t('arrangementCatalog')}</strong><span className="mt-1 block text-sm text-muted-foreground">{t('arrangementCatalogDescription')}</span></span><ArrowUpRight aria-hidden="true" size={17} /></Link></Surface>
      <Surface><Link href="/payroll-components" className="flex min-h-32 items-center gap-4 rounded-[var(--radius-surface)] p-5 hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-focus"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Blocks aria-hidden="true" /></span><span className="min-w-0 flex-1"><strong className="block">{t('componentCatalog')}</strong><span className="mt-1 block text-sm text-muted-foreground">{t('componentCatalogDescription')}</span></span><ArrowUpRight aria-hidden="true" size={17} /></Link></Surface>
    </div>
  </PageShell>
}
