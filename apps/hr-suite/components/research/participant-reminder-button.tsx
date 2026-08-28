'use client'

import { BellRing, Check } from 'lucide-react'
import { useState } from 'react'
import type { ResearchKind } from '@/lib/research/admin-service'
import { Button } from '@/components/ui/button'

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

  return <Button aria-label={state === 'sent' ? labels.sent : labels.remind} disabled={state === 'sending' || state === 'sent'} loading={state === 'sending'} onClick={() => void remind()} size="sm" title={state === 'failed' ? labels.failed : undefined} type="button" variant="secondary">{state === 'sent' ? <Check aria-hidden="true" size={14} /> : <BellRing aria-hidden="true" size={14} />}{state === 'sent' ? labels.sent : labels.remind}</Button>
}
