'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function ProvenanceCopyButton({ copiedLabel, copyLabel, failedLabel, value }: {
  readonly copiedLabel: string
  readonly copyLabel: string
  readonly failedLabel: string
  readonly value: string
}) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copyValue(): Promise<void> {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('CLIPBOARD_UNAVAILABLE')
      await navigator.clipboard.writeText(value)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
  }

  return <span className="inline-flex shrink-0 items-start gap-1">
    <Button aria-label={copyLabel} className="size-8 min-h-8 min-w-8 px-2" onClick={() => { void copyValue() }} size="sm" title={copyLabel} type="button" variant="ghost">
      {status === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </Button>
    <span aria-live="polite" className="sr-only" role="status">{status === 'copied' ? copiedLabel : status === 'failed' ? failedLabel : ''}</span>
  </span>
}
