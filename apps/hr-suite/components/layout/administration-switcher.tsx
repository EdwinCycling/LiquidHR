'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ADMINISTRATION_SWITCH_SUCCESS_PATH } from '@/lib/context/administration-context'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import type {
  AdministrationContextOption,
  AdministrationSwitcherMode,
} from '@/lib/context/administration-context'

interface AdministrationSwitcherProps {
  activeAdministrationId: string | null
  administrations: AdministrationContextOption[]
  mode: AdministrationSwitcherMode
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

      router.replace(ADMINISTRATION_SWITCH_SUCCESS_PATH)
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : labels.switchFailed)
    } finally {
      setIsSwitching(false)
    }
  }

  return (
    <div className="rounded-lg bg-sidebar-accent/70 p-2">
      <DropdownSelect
        aria-label={labels.administration}
        aria-describedby={error ? 'administration-switcher-error' : undefined}
        className="!border-white/15 !bg-sidebar !text-sidebar-foreground focus-visible:!ring-sidebar-foreground/50"
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
      </DropdownSelect>
      {isSwitching ? <p className="mt-2 text-xs text-sidebar-muted" role="status">{labels.switching}</p> : null}
      {error ? <p className="mt-2 text-xs text-sidebar-foreground" id="administration-switcher-error" role="alert">{error}</p> : null}
    </div>
  )
}
