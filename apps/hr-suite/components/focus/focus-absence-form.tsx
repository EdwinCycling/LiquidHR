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
  expectedRecoveryOn: string
  optional: string
  recoveryTitle: string
  recoveryDescription: string
  recoveryDate: string
  recoverySubmit: string
  recoverySubmitting: string
  recoverySuccess: string
  recoveryFailed: string
}

export function FocusAbsenceForm({ employeeId, employmentId, endpoint = '/api/focus/absence/report', token, today, initialStartDate, initialExpectedRecoveryOn, showExpectedRecoveryOn = true, recoveryCaseId, mode = 'report', labels }: { employeeId: string; employmentId?: string | null; endpoint?: string; token?: string | null; today: string; initialStartDate?: string; initialExpectedRecoveryOn?: string | null; showExpectedRecoveryOn?: boolean; recoveryCaseId?: string | null; mode?: 'report' | 'recovery' | 'both'; labels: FocusAbsenceFormLabels }) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(initialStartDate ?? today)
  const [expectedRecoveryOn, setExpectedRecoveryOn] = useState(initialExpectedRecoveryOn ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [recoveredOn, setRecoveredOn] = useState(today)
  const [recoveryState, setRecoveryState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  async function submit(): Promise<void> {
    setState('saving')
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ employeeId, employmentId: employmentId ?? undefined, startDate, ...(showExpectedRecoveryOn ? { expectedRecoveryOn: expectedRecoveryOn || null } : {}), actAs: endpoint === '/api/focus/absence/report' ? token ?? null : undefined, idempotencyKey: globalThis.crypto.randomUUID() }),
      })
      if (!response.ok) throw new Error(labels.failed)
      setState('success')
      router.refresh()
    } catch {
      setState('error')
    }
  }

  async function submitRecovery(): Promise<void> {
    if (!recoveryCaseId) return
    setRecoveryState('saving')
    try {
      const response = await fetch('/api/absence/recovery', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId: recoveryCaseId, recoveredOn, idempotencyKey: globalThis.crypto.randomUUID() }),
      })
      if (!response.ok) throw new Error(labels.recoveryFailed)
      setRecoveryState('success')
      router.refresh()
    } catch {
      setRecoveryState('error')
    }
  }

  return (
    <div className="space-y-4">
      {mode !== 'recovery' ? <Surface className="space-y-4 p-4 sm:p-6">
        <div><h2 className="text-lg font-semibold">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.description}</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={showExpectedRecoveryOn ? 'grid gap-1.5 text-sm font-medium' : 'grid gap-1.5 text-sm font-medium sm:col-span-2'}><span>{labels.startDate}</span><TextInput disabled={state === 'saving'} max={today} onChange={(event) => setStartDate(event.target.value)} required type="date" value={startDate} /></label>
          {showExpectedRecoveryOn ? <label className="grid gap-1.5 text-sm font-medium"><span>{labels.expectedRecoveryOn} <span className="font-normal text-muted-foreground">({labels.optional})</span></span><TextInput disabled={state === 'saving'} min={startDate} onChange={(event) => setExpectedRecoveryOn(event.target.value)} type="date" value={expectedRecoveryOn} /></label> : null}
        </div>
        {state === 'success' ? <p className="text-sm font-medium text-success" role="status">{labels.success}</p> : null}
        {state === 'error' ? <p className="text-sm text-destructive" role="alert">{labels.failed}</p> : null}
        <Button disabled={state === 'saving' || state === 'success'} onClick={() => void submit()} type="button">{state === 'saving' ? labels.submitting : labels.submit}</Button>
      </Surface> : null}
      {mode !== 'report' && recoveryCaseId ? <Surface className="space-y-4 p-4 sm:p-6">
        <div><h2 className="text-lg font-semibold">{labels.recoveryTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.recoveryDescription}</p></div>
        <div className="max-w-sm"><label className="grid gap-1.5 text-sm font-medium"><span>{labels.recoveryDate}</span><TextInput disabled={recoveryState === 'saving'} max={today} onChange={(event) => setRecoveredOn(event.target.value)} required type="date" value={recoveredOn} /></label></div>
        {recoveryState === 'success' ? <p className="text-sm font-medium text-success" role="status">{labels.recoverySuccess}</p> : null}
        {recoveryState === 'error' ? <p className="text-sm text-destructive" role="alert">{labels.recoveryFailed}</p> : null}
        <Button disabled={recoveryState === 'saving' || recoveryState === 'success'} onClick={() => void submitRecovery()} type="button">{recoveryState === 'saving' ? labels.recoverySubmitting : labels.recoverySubmit}</Button>
      </Surface> : null}
    </div>
  )
}
