'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Switch } from '@/components/ui/switch'

export interface SetupAssistantSettingsFormLabels {
  title: string
  description: string
  enabled: string
  enabledDescription: string
  saving: string
  saved: string
  saveFailed: string
  readOnly: string
}

export function SetupAssistantSettingsForm({
  initialEnabled,
  canWrite,
  labels,
}: {
  initialEnabled: boolean
  canWrite: boolean
  labels: SetupAssistantSettingsFormLabels
}) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function save(nextEnabled: boolean) {
    const previousEnabled = enabled
    setEnabled(nextEnabled)
    setStatus('saving')
    try {
      const response = await fetch('/api/setup-assistant', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isEnabled: nextEnabled }),
      })
      if (!response.ok) throw new Error('SETUP_ASSISTANT_SAVE_FAILED')
      setStatus('saved')
      router.refresh()
    } catch {
      setEnabled(previousEnabled)
      setStatus('error')
    }
  }

  return (
    <section className="max-w-3xl rounded-xl border bg-surface p-5 sm:p-6" aria-labelledby="setup-assistant-settings-title">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold" id="setup-assistant-settings-title">{labels.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{labels.description}</p>
        </div>
        <Switch
          aria-label={labels.enabled}
          checked={enabled}
          disabled={!canWrite || status === 'saving'}
          onCheckedChange={save}
        />
      </div>
      <p className="mt-5 text-sm font-medium text-foreground">{labels.enabled}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.enabledDescription}</p>
      <p aria-live="polite" className="mt-4 min-h-5 text-sm text-muted-foreground">
        {status === 'saving' ? labels.saving : status === 'saved' ? labels.saved : status === 'error' ? labels.saveFailed : !canWrite ? labels.readOnly : null}
      </p>
    </section>
  )
}
