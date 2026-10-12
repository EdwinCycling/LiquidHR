import { redirect } from 'next/navigation'
import { ContextSelectionForm } from '@/components/context/context-selection-form'
import { AuthShell } from '@/components/auth/auth-shell'
import { loadAccessibleContextOptions } from '@/lib/context/server-context'
import { getTranslator } from '@/lib/i18n/server'

export default async function ContextSelectionPage() {
  const [{ tenants }, translate, common] = await Promise.all([
    loadAccessibleContextOptions(),
    getTranslator('context'),
    getTranslator('common'),
  ])
  if (tenants.length === 0) redirect('/geen-toegang')

  return (
    <AuthShell
      brand={common('appName')}
      visualBody={translate('visualBody')}
      visualPoints={[
        translate('visualPointAccess'),
        translate('visualPointContext'),
        translate('visualPointPermissions'),
      ]}
      visualTitle={translate('visualTitle')}
    >
      <div className="mb-6 px-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-foreground">{translate('eyebrow')}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">{translate('title')}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{translate('description')}</p>
      </div>

      <ContextSelectionForm
        labels={{
          tenantLabel: translate('tenantLabel'),
          tenantPlaceholder: translate('tenantPlaceholder'),
          hrGroupLabel: translate('hrGroupLabel'),
          hrGroupPlaceholder: translate('hrGroupPlaceholder'),
          formTitle: translate('formTitle'),
          formDescription: translate('formDescription'),
          contextNote: translate('contextNote'),
          continue: translate('continue'),
          invalid: translate('invalid'),
          failed: translate('failed'),
        }}
        tenants={tenants.map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          hrGroups: tenant.hrGroups.map((group) => ({
            id: group.id,
            name: group.name,
            code: group.code,
          })),
        }))}
      />
    </AuthShell>
  )
}
