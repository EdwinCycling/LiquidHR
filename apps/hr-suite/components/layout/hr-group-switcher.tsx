'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { HR_GROUP_SWITCH_SUCCESS_PATH } from '@/lib/context/administration-context'
import type { HrGroupContextOption, HrGroupSwitcherMode } from '@/lib/context/administration-context'

interface HrGroupSwitcherProps {
  activeHrGroupId: string
  hrGroups: HrGroupContextOption[]
  mode: HrGroupSwitcherMode
  labels: {
    hrGroup: string
    switching: string
    switchFailed: string
  }
}

export function HrGroupSwitcher({ activeHrGroupId, hrGroups, mode, labels }: HrGroupSwitcherProps) {
  const router = useRouter()
  const [isSwitching, setIsSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (mode === 'HIDDEN') return null

  const activeHrGroup = hrGroups.find((group) => group.id === activeHrGroupId) ?? hrGroups[0]
  if (!activeHrGroup) return null

  async function switchHrGroup(hrGroupId: string) {
    setIsSwitching(true)
    setError(null)

    try {
      const response = await fetch('/api/context/hr-group', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hrGroupId }),
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

      router.replace(HR_GROUP_SWITCH_SUCCESS_PATH)
      router.refresh()
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : labels.switchFailed)
    } finally {
      setIsSwitching(false)
    }
  }

  return (
    <div className="rounded-lg bg-sidebar-accent/70 p-2">
      <DropdownSelect
        aria-label={labels.hrGroup}
        aria-describedby={error ? 'hr-group-switcher-error' : undefined}
        className="!border-white/15 !bg-sidebar !text-sidebar-foreground focus-visible:!ring-sidebar-foreground/50"
        disabled={isSwitching}
        id="hr-group-switcher"
        onChange={(event) => void switchHrGroup(event.target.value)}
        value={activeHrGroup.id}
      >
        {hrGroups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </DropdownSelect>
      {isSwitching ? <p className="mt-2 text-xs text-sidebar-muted" role="status">{labels.switching}</p> : null}
      {error ? <p className="mt-2 text-xs text-sidebar-foreground" id="hr-group-switcher-error" role="alert">{error}</p> : null}
    </div>
  )
}
