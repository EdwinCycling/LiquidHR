'use client'

import { ArrowRight, Building2, Check, LoaderCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { AdministrationContextOption } from '@/lib/context/administration-context'

interface AdministrationSettingsPickerLabels {
  choose: string
  selected: string
  lastSelected: string
  administrationNumber: string
  code: string
  switching: string
  switchFailed: string
}

export function AdministrationSettingsPicker({
  administrations,
  lastSelectedAdministrationId,
  returnTo,
  labels,
}: {
  administrations: AdministrationContextOption[]
  lastSelectedAdministrationId: string | null
  returnTo: string
  labels: AdministrationSettingsPickerLabels
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState(lastSelectedAdministrationId)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function chooseAdministration(administrationId: string) {
    setSelectedId(administrationId)
    setSwitchingId(administrationId)
    setError(null)

    try {
      const response = await fetch('/api/context/administration', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ administrationId }),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message = typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
          ? result.error
          : labels.switchFailed
        throw new Error(message)
      }

      router.replace(returnTo)
      router.refresh()
    } catch (switchError) {
      setSelectedId(lastSelectedAdministrationId)
      setError(switchError instanceof Error ? switchError.message : labels.switchFailed)
    } finally {
      setSwitchingId(null)
    }
  }

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2">
        {administrations.map((administration) => {
          const isLastSelected = administration.id === lastSelectedAdministrationId
          const isSelected = administration.id === selectedId
          const isSwitching = administration.id === switchingId

          return (
            <button
              aria-pressed={isSelected}
              className={`group flex min-h-32 items-center gap-4 rounded-[var(--radius-surface)] border p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${isSelected ? 'border-primary bg-primary/[0.06]' : 'bg-surface hover:border-primary/40'} ${switchingId && !isSwitching ? 'cursor-not-allowed opacity-60' : ''}`}
              disabled={switchingId !== null}
              key={administration.id}
              onClick={() => void chooseAdministration(administration.id)}
              type="button"
            >
              <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-xl ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-accent text-primary'}`}>
                {isSwitching ? <LoaderCircle className="animate-spin" size={20} /> : isSelected ? <Check size={20} /> : <Building2 size={20} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-foreground">{administration.name}</span>
                  {isLastSelected ? <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">{labels.lastSelected}</span> : null}
                </span>
                <span className="mt-2 block text-xs text-muted-foreground">
                  {labels.code}: {administration.code}
                  {administration.administrationNumber ? ` · ${labels.administrationNumber}: ${administration.administrationNumber}` : ''}
                </span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  {isSwitching ? labels.switching : isSelected ? labels.selected : labels.choose}
                  {!isSwitching && !isSelected ? <ArrowRight aria-hidden="true" size={14} /> : null}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      {error ? <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</p> : null}
    </div>
  )
}
