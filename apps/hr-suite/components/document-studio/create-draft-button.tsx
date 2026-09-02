'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function CreateDraftButton({ templateId, labels }: { templateId: string; labels: { readonly create: string; readonly failed: string } }) {
  const [pending, setPending] = useState(false)
  const router = useRouter()
  async function create() {
    setPending(true)
    try {
      const response = await fetch(`/api/document-studio/templates/${templateId}/draft`, { method: 'POST' })
      const result = await response.json() as { data?: { draftId?: string } }
      if (!response.ok || !result.data?.draftId) throw new Error(labels.failed)
      router.push(`/document-studio/templates/${templateId}/edit?version=${result.data.draftId}`)
    } catch { setPending(false) }
  }
  return <Button loading={pending} onClick={create} type="button">{labels.create}</Button>
}
