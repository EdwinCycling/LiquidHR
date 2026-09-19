'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'

export interface FocusAbsenceFormLabels {
  title: string
  description: string
  startDate: string
  submit: string
  submitting: string
  success: string
  failed: string
}

export function FocusAbsenceForm({ employeeId, employmentId, endpoint = '/api/focus/absence/report', token, today, labels }: { employeeId: string; employmentId?: string | null; endpoint?: string; token?: string | null; today: string; labels: FocusAbsenceFormLabels }) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(today)
  const [state, setState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  async function submit(): Promise<void> {
    setState('saving')
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ employeeId, employmentId: employmentId ?? undefined, startDate, actAs: endpoint === '/api/focus/absence/report' ? token ?? null : undefined, idempotencyKey: globalThis.crypto.randomUUID() }),
      })
      if (!response.ok) throw new Error(labels.failed)
      setState('success')
      router.refresh()
    } catch {
      setState('error')
    }
  }

  return (
    <Surface className="space-y-4 p-4 sm:p-6">
      <div><h2 className="text-lg font-semibold">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.description}</p></div>
      <div className="max-w-sm"><label className="grid gap-1.5 text-sm font-medium"><span>{labels.startDate}</span><TextInput disabled={state === 'saving'} max={today} onChange={(event) => setStartDate(event.target.value)} required type="date" value={startDate} /></label></div>
      {state === 'success' ? <p className="text-sm font-medium text-success" role="status">{labels.success}</p> : null}
      {state === 'error' ? <p className="text-sm text-destructive" role="alert">{labels.failed}</p> : null}
      <Button disabled={state === 'saving' || state === 'success'} onClick={() => void submit()} type="button">{state === 'saving' ? labels.submitting : labels.submit}</Button>
    </Surface>
  )
}
