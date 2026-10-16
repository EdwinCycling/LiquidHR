import { redirect } from 'next/navigation'
import { ContextSelectionForm } from '@/components/context/context-selection-form'
import { AuthShell } from '@/components/auth/auth-shell'
import { loadAccessibleContextOptions } from '@/lib/context/server-context'
import { getTranslator } from '@/lib/i18n/server'

export default async function ContextSelectionPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ tenants }, translate, common, query] = await Promise.all([
    loadAccessibleContextOptions(),
    getTranslator('context'),
    getTranslator('common'),
    searchParams,
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
        initialError={query.error === 'invalid' ? translate('invalid') : query.error === 'failed' ? translate('failed') : undefined}
        labels={{
          contextLabel: translate('contextLabel'),
          contextPlaceholder: translate('contextPlaceholder'),
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
