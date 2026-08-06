import Link from 'next/link'
import { ArrowLeft, Building2 } from 'lucide-react'
import { redirect } from 'next/navigation'
import { AdministrationSettingsPicker } from '@/components/settings/administration-settings-picker'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { ACTIVE_ADMINISTRATION_COOKIE, loadActiveContext } from '@/lib/context/server-context'
import {
  getPersistedAdministrationId,
  normalizeAdministrationSettingsReturnPath,
} from '@/lib/settings/administration-selection'
import { getTranslator } from '@/lib/i18n/server'
import { cookies } from 'next/headers'

export default async function AdministrationSettingsSelectionPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  try {
    await requirePermission('settings:read')
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const [{ returnTo }, context, translate] = await Promise.all([
    searchParams,
    loadActiveContext(),
    getTranslator('settings'),
  ])
  const cookieStore = await cookies()
  const lastSelectedAdministrationId = getPersistedAdministrationId(
    context,
    cookieStore.get(ACTIVE_ADMINISTRATION_COOKIE)?.value,
  )
  const safeReturnTo = normalizeAdministrationSettingsReturnPath(returnTo)

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-10">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80" href="/settings">
        <ArrowLeft aria-hidden="true" size={16} />
        {translate('administrationSelection.backToSettings')}
      </Link>
      <header className="mt-6 rounded-3xl border bg-surface p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Building2 size={23} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{translate('administrationSelection.eyebrow')}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{translate('administrationSelection.title')}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{translate('administrationSelection.description')}</p>
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-primary/15 bg-primary/[0.05] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{translate('administrationSelection.activeHrGroup')}</p>
          <p className="mt-1 font-semibold text-foreground">{context.activeHrGroup.name}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{translate('administrationSelection.instruction')}</p>
        </div>
      </header>

      <section className="mt-7" aria-labelledby="administration-selection-list">
        <h2 className="sr-only" id="administration-selection-list">{translate('administrationSelection.title')}</h2>
        {context.administrationsInActiveHrGroup.length > 0 ? (
          <AdministrationSettingsPicker
            administrations={context.administrationsInActiveHrGroup}
            labels={{
              choose: translate('administrationSelection.choose'),
              selected: translate('administrationSelection.selected'),
              lastSelected: translate('administrationSelection.lastSelected'),
              administrationNumber: translate('administrationSelection.administrationNumber'),
              code: translate('administrationSelection.code'),
              switching: translate('administrationSelection.switching'),
              switchFailed: translate('administrationSelection.switchFailed'),
            }}
            lastSelectedAdministrationId={lastSelectedAdministrationId}
            returnTo={safeReturnTo}
          />
        ) : (
          <div className="rounded-2xl border border-dashed bg-surface p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">{translate('administrationSelection.emptyTitle')}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{translate('administrationSelection.emptyDescription')}</p>
          </div>
        )}
      </section>
    </main>
  )
}
