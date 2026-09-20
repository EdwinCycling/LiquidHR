'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'

export function AbsenceConfirmationActions({ caseId, labels }: { caseId: string; labels: { confirm: string; correction: string; correctionSent: string; failed: string } }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'saving' | 'sent' | 'failed'>('idle')

  async function submit(path: '/api/focus/absence/confirm' | '/api/focus/absence/correction'): Promise<void> {
    setState('saving')
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caseId }) })
      if (!response.ok) throw new Error(labels.failed)
      setState(path.endsWith('/correction') ? 'sent' : 'idle')
      router.refresh()
    } catch {
      setState('failed')
    }
  }

  return <Surface className="space-y-3 border-info/30 bg-info-surface/40 p-5">
    <div className="flex flex-wrap gap-2">
      <Button disabled={state === 'saving'} loading={state === 'saving'} onClick={() => void submit('/api/focus/absence/confirm')} type="button"><Check aria-hidden="true" />{labels.confirm}</Button>
      <Button disabled={state === 'saving'} onClick={() => void submit('/api/focus/absence/correction')} type="button" variant="secondary"><RotateCcw aria-hidden="true" />{labels.correction}</Button>
    </div>
    {state === 'sent' ? <p className="text-sm font-medium text-success" role="status">{labels.correctionSent}</p> : null}
    {state === 'failed' ? <p className="text-sm text-destructive" role="alert">{labels.failed}</p> : null}
  </Surface>
}
