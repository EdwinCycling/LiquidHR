'use client'

import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function FocusPreviewClose({ label, returnHref }: { label: string; returnHref: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function closePreview(): Promise<void> {
    if (busy) return
    setBusy(true)
    await fetch('/api/focus/preview/close', { method: 'POST' }).catch(() => undefined)
    router.push(returnHref)
    router.refresh()
  }

  return <Button disabled={busy} loading={busy} onClick={() => void closePreview()} size="sm" type="button" variant="secondary"><X aria-hidden="true" />{label}</Button>
}
