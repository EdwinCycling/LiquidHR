'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { Plus } from 'lucide-react'
import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'

interface ProfileLinkFormProps {
  employeeId: string
  labels: { add: string; label: string; url: string; save: string; failed: string }
}

export function ProfileLinkForm({ employeeId, labels }: ProfileLinkFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const response = await fetch(`/api/employees/${employeeId}/profile-links`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ linkType: 'LINKEDIN', label: String(form.get('label')), url: String(form.get('url')), isFeatured: true, sortOrder: 0 }),
    })
    setFailed(!response.ok)
    if (response.ok) { setOpen(false); router.refresh() }
  }
  if (!open) return <Button className="mt-4 justify-start px-0 text-primary hover:bg-transparent hover:underline" onClick={() => setOpen(true)} size="sm" type="button" variant="ghost"><Plus aria-hidden="true" />{labels.add}</Button>
  return <Surface variant="subtle" className="mt-4 p-4"><form onSubmit={submit} className="grid gap-4"><FormField control={<TextInput name="label" required />} label={labels.label} required /><FormField control={<TextInput name="url" type="url" required placeholder="https://" />} label={labels.url} required /><Button size="sm" type="submit">{labels.save}</Button>{failed && <p className="text-sm text-destructive" role="alert">{labels.failed}</p>}</form></Surface>
}
