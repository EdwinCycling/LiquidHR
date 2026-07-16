'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

interface TerminationFormProps {
  employmentId: string
  internalReasons: Array<{ id: string; name: string }>
  statutoryReasons: Array<{ id: string; code: string; label: string }>
  labels: {
    title: string
    lastDay: string
    internalReason: string
    statutoryReason: string
    submit: string
    saved: string
    failed: string
  }
}

export function TerminationForm({
  employmentId,
  internalReasons,
  statutoryReasons,
  labels,
}: TerminationFormProps) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setState('saving')
    const form = new FormData(event.currentTarget)
    const response = await fetch(`/api/employments/${employmentId}/termination`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lastWorkingDay: String(form.get('lastWorkingDay')),
        internalReasonId: String(form.get('internalReasonId')),
        statutoryReasonId: String(form.get('statutoryReasonId')),
        initiator: 'EMPLOYER',
      }),
    })
    if (!response.ok) {
      setState('failed')
      return
    }
    setState('saved')
    router.refresh()
  }

  return (
    <details className="rounded-lg border bg-background/70 p-4">
      <summary className="cursor-pointer font-semibold">{labels.title}</summary>
      <form onSubmit={submit} className="mt-4 grid gap-3">
        <label className="grid gap-1.5 text-sm font-medium">
          {labels.lastDay}
          <input name="lastWorkingDay" type="date" required className="form-field" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {labels.internalReason}
          <select name="internalReasonId" required className="form-field">
            {internalReasons.map((reason) => <option key={reason.id} value={reason.id}>{reason.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {labels.statutoryReason}
          <select name="statutoryReasonId" required className="form-field">
            {statutoryReasons.map((reason) => (
              <option key={reason.id} value={reason.id}>{reason.code} · {reason.label}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={state === 'saving'} className="button-danger">{labels.submit}</button>
          {state === 'saved' && <span className="text-sm text-success">{labels.saved}</span>}
          {state === 'failed' && <span className="text-sm text-danger">{labels.failed}</span>}
        </div>
      </form>
    </details>
  )
}
