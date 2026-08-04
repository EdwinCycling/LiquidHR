'use client'

import { Check, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import type { EmployeeDirectorySettings } from '@/lib/employee-directory/service'

interface Labels {
  enabled: string
  enabledDescription: string
  fieldsTitle: string
  fieldsDescription: string
  name: string
  nameAlwaysOn: string
  jobDepartment: string
  workEmail: string
  workPhone: string
  presence: string
  schedule: string
  save: string
  saving: string
  saved: string
  failed: string
}

const FIELD_LABELS: Array<{ key: keyof EmployeeDirectorySettings; label: keyof Labels }> = [
  { key: 'showName', label: 'name' },
  { key: 'showJobDepartment', label: 'jobDepartment' },
  { key: 'showWorkEmail', label: 'workEmail' },
  { key: 'showWorkPhone', label: 'workPhone' },
  { key: 'showPresence', label: 'presence' },
  { key: 'showSchedule', label: 'schedule' },
]

export function EmployeeDirectorySettingsForm({ initial, labels }: { initial: EmployeeDirectorySettings; labels: Labels }) {
  const [settings, setSettings] = useState(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')

  async function save(): Promise<void> {
    setStatus('saving')
    const response = await fetch('/api/settings/employee-directory', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setStatus(response.ok ? 'saved' : 'failed')
  }

  return <section className="max-w-3xl space-y-6">
    <label className="flex items-start gap-3 rounded-2xl border bg-surface p-5 shadow-sm">
      <input checked={settings.enabled} className="mt-1 size-4 accent-primary" onChange={(event) => { setSettings((current) => ({ ...current, enabled: event.target.checked })); setStatus('idle') }} type="checkbox" />
      <span><span className="block font-semibold">{labels.enabled}</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">{labels.enabledDescription}</span></span>
    </label>
    <div className="rounded-2xl border bg-surface p-5 shadow-sm">
      <h2 className="font-semibold">{labels.fieldsTitle}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.fieldsDescription}</p>
      <div className="mt-5 divide-y rounded-xl border bg-background">
        {FIELD_LABELS.map(({ key, label }) => <label className="flex items-center justify-between gap-4 px-4 py-3 text-sm" key={key}>
          <span>{labels[label]}{key === 'showName' ? <span className="ml-2 text-xs text-muted-foreground">{labels.nameAlwaysOn}</span> : null}</span>
          <input checked={key === 'showName' || settings[key] as boolean} className="size-4 accent-primary" disabled={key === 'showName'} onChange={(event) => { setSettings((current) => ({ ...current, [key]: event.target.checked })); setStatus('idle') }} type="checkbox" />
        </label>)}
      </div>
      <div className="mt-5 flex min-h-11 items-center justify-between gap-4 border-t pt-5">
        <p aria-live="polite" className={`text-sm ${status === 'failed' ? 'text-destructive' : 'text-success'}`} role="status">{status === 'saved' ? <><Check className="mr-1 inline" size={16} />{labels.saved}</> : status === 'failed' ? labels.failed : ''}</p>
        <button className="button-primary inline-flex items-center gap-2" disabled={status === 'saving'} onClick={() => void save()} type="button">{status === 'saving' ? <LoaderCircle className="animate-spin" size={16} /> : null}{status === 'saving' ? labels.saving : labels.save}</button>
      </div>
    </div>
  </section>
}
