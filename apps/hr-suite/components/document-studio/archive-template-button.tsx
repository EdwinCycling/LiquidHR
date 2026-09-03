'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { unwrapDocumentStudioData } from './api-response'

export function parseArchiveTemplateResponse(value: unknown): boolean {
  const data = unwrapDocumentStudioData(value)
  return data?.archived === true
}

export function ArchiveTemplateButton({ templateId, labels }: {
  templateId: string
  labels: { readonly archive: string; readonly confirm: string; readonly failed: string }
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function archive() {
    if (!window.confirm(labels.confirm)) return
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/document-studio/templates/${templateId}/archive`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
      })
      const result: unknown = await response.json()
      if (!response.ok || !parseArchiveTemplateResponse(result)) throw new Error(labels.failed)
      router.push('/document-studio')
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : labels.failed)
      setPending(false)
    }
  }

  return <div className="flex flex-wrap items-center gap-2"><Button disabled={pending} loading={pending} onClick={archive} type="button" variant="danger">{labels.archive}</Button>{error ? <p className="basis-full text-sm text-destructive" role="alert">{error}</p> : null}</div>
}
