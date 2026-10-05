import { redirect } from 'next/navigation'
import { ContextSelectionForm } from '@/components/context/context-selection-form'
import { PageShell } from '@/components/layout/page-shell'
import { loadAccessibleContextOptions } from '@/lib/context/server-context'
import { getTranslator } from '@/lib/i18n/server'

export default async function ContextSelectionPage() {
  const [{ tenants }, translate] = await Promise.all([
    loadAccessibleContextOptions(),
    getTranslator('context'),
  ])
  if (tenants.length === 0) redirect('/geen-toegang')

  return <main className="min-h-dvh bg-background">
    <PageShell className="flex min-h-dvh flex-col justify-center py-8 sm:py-12" width="reading">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-10 place-items-center rounded-lg border border-primary/20 bg-accent text-sm font-semibold tracking-tight text-accent-foreground">LH</span>
          <span className="text-base font-semibold tracking-tight text-foreground">LiquidHR</span>
        </div>
        <p className="eyebrow text-right">{translate('eyebrow')}</p>
      </header>

      <section aria-labelledby="context-selection-title">
        <h1 className="max-w-xl text-3xl font-semibold leading-tight tracking-[-0.04em] text-foreground sm:text-4xl" id="context-selection-title">{translate('title')}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{translate('description')}</p>
        <ContextSelectionForm tenants={tenants.map((tenant) => ({ id: tenant.id, name: tenant.name, slug: tenant.slug, hrGroups: tenant.hrGroups.map((group) => ({ id: group.id, name: group.name, code: group.code })) }))} labels={{ eyebrow: translate('formEyebrow'), formTitle: translate('formTitle'), formDescription: translate('formDescription'), tenantLabel: translate('tenantLabel'), tenantDescription: translate('tenantDescription'), tenantPlaceholder: translate('tenantPlaceholder'), hrGroupLabel: translate('hrGroupLabel'), hrGroupDescription: translate('hrGroupDescription'), hrGroupPlaceholder: translate('hrGroupPlaceholder'), sessionHint: translate('sessionHint'), continue: translate('continue'), saving: translate('saving'), invalid: translate('invalid'), failed: translate('failed') }} />
      </section>
    </PageShell>
  </main>
}
