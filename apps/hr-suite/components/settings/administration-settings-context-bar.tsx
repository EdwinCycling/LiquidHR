import Link from 'next/link'
import { ArrowLeftRight, Building2 } from 'lucide-react'
import type { ActiveContext } from '@/lib/context/administration-context'
import { buildAdministrationSettingsSelectionHref } from '@/lib/settings/administration-selection'
import { getTranslator } from '@/lib/i18n/server'
import { Surface } from '@/components/ui/surface'

export async function AdministrationSettingsContextBar({
  context,
  returnTo,
}: {
  context: ActiveContext
  returnTo: string
}) {
  const translate = await getTranslator('settings')
  const administration = context.activeAdministration
  if (!administration) return null

  return (
    <Surface aria-labelledby="administration-settings-context" className="mb-7 border-primary/20 bg-primary/[0.06] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Building2 size={19} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary" id="administration-settings-context">
              {translate('administrationContext.label')}
            </p>
            <p className="mt-1 truncate text-base font-semibold text-foreground">{administration.name}</p>
            <p className="mt-1 text-xs text-foreground">
              {translate('administrationContext.code', { code: administration.code })}
              {administration.administrationNumber ? ` · ${translate('administrationContext.administrationNumber', { number: administration.administrationNumber })}` : ''}
              {` · ${translate('administrationContext.hrGroup', { group: context.activeHrGroup.name })}`}
            </p>
          </div>
        </div>
        <Link
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-primary/25 bg-surface px-3 py-2 text-sm font-medium text-primary transition-colors hover:border-primary/50 hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          href={buildAdministrationSettingsSelectionHref(returnTo)}
        >
          <ArrowLeftRight aria-hidden="true" size={16} />
          {translate('administrationContext.change')}
        </Link>
      </div>
      <p className="mt-3 border-t border-primary/10 pt-3 text-sm leading-6 text-foreground">
        {translate('administrationContext.description')}
      </p>
    </Surface>
  )
}
