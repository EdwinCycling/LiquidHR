'use client'

import { BellRing, Check } from 'lucide-react'
import { useState } from 'react'
import type { ResearchKind } from '@/lib/research/admin-service'

export function ParticipantReminderButton({ campaignId, employeeId, kind, labels }: { campaignId: string; employeeId: string; kind: ResearchKind; labels: { remind: string; sent: string; failed: string } }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

  async function remind() {
    setState('sending')
    const response = await fetch(`/api/research/admin/${kind}/${campaignId}/remind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId }),
    }).catch(() => null)
    setState(response?.ok ? 'sent' : 'failed')
  }

  return <button aria-label={state === 'sent' ? labels.sent : labels.remind} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs font-semibold text-primary transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60" disabled={state === 'sending' || state === 'sent'} onClick={remind} title={state === 'failed' ? labels.failed : undefined} type="button">{state === 'sent' ? <Check aria-hidden="true" size={14} /> : <BellRing aria-hidden="true" size={14} />}{state === 'sent' ? labels.sent : labels.remind}</button>
}
