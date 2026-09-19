'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Check, HeartPulse, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import type { FocusAbsenceWorkItem } from '@/lib/focus/section-service'

export interface FocusAbsenceWorkListLabels {
  title: string
  description: string
  sickness: string
  from: string
  confirm: string
  correction: string
  failed: string
  correctionSent: string
}

function displayDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'nl-NL', { day: 'numeric', month: 'long' }).format(new Date(value))
}

export function FocusAbsenceWorkList({ items, labels, locale = 'nl' }: { items: FocusAbsenceWorkItem[]; labels: FocusAbsenceWorkListLabels; locale?: string }) {
  const router = useRouter()
  const [busyCaseId, setBusyCaseId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, 'failed' | 'sent'>>({})

  async function confirm(caseId: string): Promise<void> {
    setBusyCaseId(caseId)
    try {
      const response = await fetch('/api/focus/absence/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId }),
      })
      if (!response.ok) throw new Error(labels.failed)
      router.refresh()
    } catch {
      setFeedback((current) => ({ ...current, [caseId]: 'failed' }))
    } finally {
      setBusyCaseId(null)
    }
  }

  async function requestCorrection(caseId: string): Promise<void> {
    setBusyCaseId(caseId)
    try {
      const response = await fetch('/api/focus/absence/correction', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId }),
      })
      if (!response.ok) throw new Error(labels.failed)
      setFeedback((current) => ({ ...current, [caseId]: 'sent' }))
      router.refresh()
    } catch {
      setFeedback((current) => ({ ...current, [caseId]: 'failed' }))
    } finally {
      setBusyCaseId(null)
    }
  }

  return <section aria-labelledby="focus-absence-work-title" className="space-y-4">
    <div>
      <h2 className="text-xl font-semibold" id="focus-absence-work-title">{labels.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{labels.description}</p>
    </div>
    <div className="space-y-3">
      {items.map((item) => <Surface className="space-y-4 p-4" key={item.caseId}>
        <div className="flex items-start gap-3">
          <HeartPulse aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{item.employeeName}</p>
            <p className="mt-1 text-sm">{labels.sickness} · {labels.from} {displayDate(item.firstAbsenceOn, locale)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busyCaseId !== null} onClick={() => void confirm(item.caseId)} type="button"><Check aria-hidden="true" />{labels.confirm}</Button>
          <Button disabled={busyCaseId !== null} loading={busyCaseId === item.caseId} onClick={() => void requestCorrection(item.caseId)} type="button" variant="secondary"><RotateCcw aria-hidden="true" />{labels.correction}</Button>
        </div>
        {feedback[item.caseId] === 'sent' ? <p className="text-sm font-medium text-success" role="status">{labels.correctionSent}</p> : null}
        {feedback[item.caseId] === 'failed' ? <p className="text-sm text-destructive" role="alert">{labels.failed}</p> : null}
      </Surface>)}
    </div>
  </section>
}
