import type { AdministrationContextOption, AdministrationSwitcherMode } from '@/lib/context/administration-context'

interface AdministrationSwitcherProps {
  activeAdministrationId: string | null
  administrations: AdministrationContextOption[]
  mode: AdministrationSwitcherMode
  labels: {
    administration: string
    confirm: string
    switching: string
    switchFailed: string
  }
}

export function AdministrationSwitcher({ activeAdministrationId, administrations, mode, labels }: AdministrationSwitcherProps) {
  if (mode === 'HIDDEN' || administrations.length === 0) return null

  const activeAdministration = administrations.find((administration) => administration.id === activeAdministrationId) ?? administrations[0]
  if (!activeAdministration) return null

  return <form action="/api/context/administration" className="space-y-2 rounded-lg bg-sidebar-accent/70 p-2" method="post">
    <label className="sr-only" htmlFor="administration-switcher">{labels.administration}</label>
    <select
      className="min-h-10 w-full rounded-[var(--radius-control)] border border-white/15 bg-sidebar px-3 py-2 text-sm text-sidebar-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-foreground/50"
      defaultValue={activeAdministration.id}
      id="administration-switcher"
      name="administrationId"
    >
      {administrations.map((administration) => <option key={administration.id} value={administration.id}>{administration.name}</option>)}
    </select>
    <button className="min-h-10 w-full rounded-[var(--radius-control)] border border-white/15 bg-sidebar px-3 py-2 text-sm font-medium text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-focus" type="submit">{labels.confirm}</button>
  </form>
}
