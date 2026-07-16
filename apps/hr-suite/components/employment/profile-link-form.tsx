'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { Plus } from 'lucide-react'

interface ProfileLinkFormProps {
  employmentId: string
  labels: { add: string; label: string; url: string; save: string; failed: string }
}

export function ProfileLinkForm({ employmentId, labels }: ProfileLinkFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const response = await fetch(`/api/employments/${employmentId}/profile-links`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ linkType: 'LINKEDIN', label: String(form.get('label')), url: String(form.get('url')), isFeatured: true, sortOrder: 0 }),
    })
    setFailed(!response.ok)
    if (response.ok) { setOpen(false); router.refresh() }
  }
  if (!open) return <button type="button" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{labels.add}</button>
  return <form onSubmit={submit} className="mt-4 grid gap-3"><label className="grid gap-1 text-sm font-medium">{labels.label}<input name="label" className="form-field" required /></label><label className="grid gap-1 text-sm font-medium">{labels.url}<input name="url" className="form-field" type="url" required placeholder="https://" /></label><button className="button-primary" type="submit">{labels.save}</button>{failed && <p className="text-sm text-danger">{labels.failed}</p>}</form>
}
