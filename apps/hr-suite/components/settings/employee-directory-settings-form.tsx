'use client'

import { useState } from 'react'
import type { EmployeeDirectorySettings } from '@/lib/employee-directory/service'
import { FormActions } from '@/components/patterns/form-actions'
import { FormField } from '@/components/patterns/form-field'
import { Surface } from '@/components/ui/surface'
import { Switch } from '@/components/ui/switch'

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
  cancel: string
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
    <Surface className="p-5">
      <Switch checked={settings.enabled} description={labels.enabledDescription} label={labels.enabled} onCheckedChange={(checked) => { setSettings((current) => ({ ...current, enabled: checked })); setStatus('idle') }} />
    </Surface>
    <Surface className="p-5">
      <h2 className="font-semibold">{labels.fieldsTitle}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.fieldsDescription}</p>
      <div className="mt-5 divide-y divide-border-subtle rounded-[var(--radius-control)] border border-border bg-background">
        {FIELD_LABELS.map(({ key, label }) => <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm" key={key}>
          <FormField className="min-w-0" control={<Switch checked={key === 'showName' || settings[key] as boolean} disabled={key === 'showName'} onCheckedChange={(checked) => { setSettings((current) => ({ ...current, [key]: checked })); setStatus('idle') }} />} label={<>{labels[label]}{key === 'showName' ? <span className="ml-2 text-xs text-muted-foreground">{labels.nameAlwaysOn}</span> : null}</>} />
        </div>)}
      </div>
      <form className="mt-5 border-t border-border-subtle pt-5" onSubmit={(event) => { event.preventDefault(); void save() }}>
        <p aria-live="polite" className={`mb-3 min-h-5 text-sm ${status === 'failed' ? 'text-destructive' : 'text-success'}`} role={status === 'failed' ? 'alert' : 'status'}>{status === 'saved' ? labels.saved : status === 'failed' ? labels.failed : ''}</p>
        <FormActions cancelLabel={labels.cancel} onCancel={() => { setSettings(initial); setStatus('idle') }} saveLabel={labels.save} saving={status === 'saving'} />
      </form>
    </Surface>
  </section>
}
