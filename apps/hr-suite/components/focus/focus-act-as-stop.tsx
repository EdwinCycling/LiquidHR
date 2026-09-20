'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function FocusActAsStop({ token, label }: { token: string; label: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function stop(): Promise<void> {
    setLoading(true)
    try {
      const response = await fetch('/api/focus/act-as/stop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const payload = await response.json() as { href?: string }
      router.replace(response.ok && payload.href ? payload.href : '/focus')
    } catch {
      router.replace('/focus')
    }
  }

  return <Button disabled={loading} loading={loading} onClick={() => void stop()} size="sm" type="button" variant="secondary">{label}</Button>
}
