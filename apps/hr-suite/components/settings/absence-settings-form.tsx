'use client'

import { useState } from 'react'
import { Check, LoaderCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface CaseManagerOption {
  id: string
  employeeNumber: string
  name: string
}

interface AbsenceSettingsLabels {
  threshold: string
  thresholdHelp: string
  caseManager: string
  caseManagerHelp: string
  noCaseManager: string
  save: string
  saving: string
  saved: string
  failed: string
  invalid: string
}

export function AbsenceSettingsForm({
  frequentAbsenceThreshold,
  defaultCaseManagerEmployeeId,
  caseManagers,
  labels,
}: {
  frequentAbsenceThreshold: number
  defaultCaseManagerEmployeeId: string | null
  caseManagers: CaseManagerOption[]
  labels: AbsenceSettingsLabels
}) {
  const router = useRouter()
  const [threshold, setThreshold] = useState(String(frequentAbsenceThreshold))
  const [caseManager, setCaseManager] = useState(defaultCaseManagerEmployeeId ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed' | 'invalid'>('idle')

  async function save() {
    setStatus('saving')
    const response = await fetch('/api/settings/absence', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        frequentAbsenceThreshold: Number(threshold),
        defaultCaseManagerEmployeeId: caseManager || null,
      }),
    })
    if (response.ok) {
      setStatus('saved')
      router.refresh()
      return
    }
    const body = await response.json().catch(() => null) as { error?: string } | null
    setStatus(body?.error === 'ABSENCE_SETTINGS_INPUT_INVALID' || body?.error === 'ABSENCE_SETTINGS_CASE_MANAGER_INVALID' ? 'invalid' : 'failed')
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-surface p-5 shadow-sm">
        <label className="block text-sm font-semibold" htmlFor="frequent-absence-threshold">
          {labels.threshold}
        </label>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.thresholdHelp}</p>
        <input
          className="input mt-4 w-full max-w-xs"
          id="frequent-absence-threshold"
          max={20}
          min={1}
          onChange={(event) => setThreshold(event.target.value)}
          type="number"
          value={threshold}
        />
      </section>

      <section className="rounded-2xl border bg-surface p-5 shadow-sm">
        <label className="block text-sm font-semibold" htmlFor="absence-case-manager">
          {labels.caseManager}
        </label>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.caseManagerHelp}</p>
        <select
          className="input mt-4 w-full"
          id="absence-case-manager"
          onChange={(event) => setCaseManager(event.target.value)}
          value={caseManager}
        >
          <option value="">{labels.noCaseManager}</option>
          {caseManagers.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.name} · {manager.employeeNumber}
            </option>
          ))}
        </select>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-5">
        {status === 'saved' ? <span className="inline-flex items-center gap-2 text-sm font-medium text-success"><Check size={16} />{labels.saved}</span> : null}
        {status === 'failed' ? <span className="text-sm font-medium text-destructive">{labels.failed}</span> : null}
        {status === 'invalid' ? <span className="text-sm font-medium text-destructive">{labels.invalid}</span> : null}
        <button className="button-primary inline-flex items-center gap-2" disabled={status === 'saving'} onClick={save} type="button">
          {status === 'saving' ? <LoaderCircle className="animate-spin" size={16} /> : null}
          {status === 'saving' ? labels.saving : labels.save}
        </button>
      </div>
    </div>
  )
}
