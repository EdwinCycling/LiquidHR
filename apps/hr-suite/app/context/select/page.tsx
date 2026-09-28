import { redirect } from 'next/navigation'
import { ContextSelectionForm } from '@/components/context/context-selection-form'
import { loadAccessibleContextOptions } from '@/lib/context/server-context'
import { getTranslator } from '@/lib/i18n/server'

export default async function ContextSelectionPage() {
  const [{ tenants }, translate] = await Promise.all([
    loadAccessibleContextOptions(),
    getTranslator('context'),
  ])
  if (tenants.length === 0) redirect('/geen-toegang')

  return <main className="min-h-dvh bg-background px-4 py-12 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-xl">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">LiquidHR</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">{translate('title')}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{translate('description')}</p>
      <div className="mt-8"><ContextSelectionForm tenants={tenants.map((tenant) => ({ id: tenant.id, name: tenant.name, slug: tenant.slug, hrGroups: tenant.hrGroups.map((group) => ({ id: group.id, name: group.name, code: group.code })) }))} labels={{ tenantLabel: translate('tenantLabel'), tenantPlaceholder: translate('tenantPlaceholder'), hrGroupLabel: translate('hrGroupLabel'), hrGroupPlaceholder: translate('hrGroupPlaceholder'), continue: translate('continue'), invalid: translate('invalid'), failed: translate('failed') }} /></div>
    </div>
  </main>
}
