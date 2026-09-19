'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function FocusActAsButton({ employeeId, errorLabel, label, loadingLabel }: { employeeId: string; errorLabel: string; label: string; loadingLabel: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  async function start(): Promise<void> {
    setLoading(true)
    setError(false)
    try {
      const response = await fetch('/api/focus/act-as', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ employeeId }),
      })
      const payload = await response.json() as { href?: string }
      if (!response.ok || !payload.href) throw new Error('FOCUS_ACT_AS_START_FAILED')
      router.replace(payload.href)
    } catch {
      setError(true)
      setLoading(false)
    }
  }

  return <span className="inline-flex flex-wrap items-center gap-2">
    <Button disabled={loading} loading={loading} onClick={() => void start()} size="sm" type="button" variant="secondary">{loading ? loadingLabel : label}</Button>
    {error ? <span className="text-xs text-destructive" role="alert">{errorLabel}</span> : null}
  </span>
}
