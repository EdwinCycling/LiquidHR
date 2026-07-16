'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type {
  AdministrationContextOption,
  AdministrationSwitcherMode,
} from '@/lib/context/administration-context'

interface AdministrationSwitcherProps {
  activeAdministrationId: string | null
  administrations: AdministrationContextOption[]
  mode: AdministrationSwitcherMode
  tenantName: string
  labels: {
    administration: string
    switching: string
    switchFailed: string
  }
}

export function AdministrationSwitcher({
  activeAdministrationId,
  administrations,
  mode,
  tenantName,
  labels,
}: AdministrationSwitcherProps) {
  const router = useRouter()
  const [isSwitching, setIsSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (mode === 'HIDDEN') return null

  const activeAdministration = administrations.find(
    (administration) => administration.id === activeAdministrationId,
  ) ?? administrations[0]

  if (!activeAdministration) return null

  if (mode === 'LABEL') {
    return (
      <div className="rounded-lg bg-sidebar-accent/70 px-3 py-2">
        <p className="truncate text-[0.65rem] uppercase tracking-[0.16em] text-sidebar-foreground/60">
          {tenantName}
        </p>
        <p className="mt-1 truncate text-sm font-medium">{activeAdministration.name}</p>
      </div>
    )
  }

  async function switchAdministration(administrationId: string) {
    setIsSwitching(true)
    setError(null)

    try {
      const response = await fetch('/api/context/administration', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ administrationId }),
      })
      const result: unknown = await response.json()

      if (!response.ok) {
        const message =
          typeof result === 'object'
          && result !== null
          && 'error' in result
          && typeof result.error === 'string'
            ? result.error
            : labels.switchFailed
        throw new Error(message)
      }

      router.refresh()
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : labels.switchFailed)
    } finally {
      setIsSwitching(false)
    }
  }

  return (
    <div className="rounded-lg bg-sidebar-accent/70 p-3">
      <label className="block text-[0.65rem] uppercase tracking-[0.16em] text-sidebar-foreground/60" htmlFor="administration-switcher">
        {labels.administration}
      </label>
      <select
        aria-describedby={error ? 'administration-switcher-error' : undefined}
        className="mt-2 w-full rounded-md border border-white/15 bg-sidebar px-2 py-2 text-sm text-sidebar-foreground outline-none focus:ring-2 focus:ring-sidebar-foreground/50 disabled:opacity-60"
        disabled={isSwitching}
        id="administration-switcher"
        onChange={(event) => void switchAdministration(event.target.value)}
        value={activeAdministration.id}
      >
        {administrations.map((administration) => (
          <option key={administration.id} value={administration.id}>
            {administration.name}
          </option>
        ))}
      </select>
      <p className="mt-2 truncate text-xs text-sidebar-foreground/60">{tenantName}</p>
      {isSwitching ? <p className="mt-2 text-xs text-sidebar-muted" role="status">{labels.switching}</p> : null}
      {error ? <p className="mt-2 text-xs text-sidebar-foreground" id="administration-switcher-error" role="alert">{error}</p> : null}
    </div>
  )
}
