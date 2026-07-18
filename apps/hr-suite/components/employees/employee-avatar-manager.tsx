'use client'
/* eslint-disable @next/next/no-img-element -- private avatar routes and customer-hosted URLs are intentionally rendered without remote image configuration. */

import { Camera, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

interface Labels {
  upload: string
  replace: string
  remove: string
  failed: string
}

export function EmployeeAvatarManager({ employeeId, avatarUrl, name, canManage, labels }: { employeeId: string; avatarUrl: string | null; name: string; canManage: boolean; labels: Labels }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)

  async function upload(file: File) {
    setSaving(true)
    setFailed(false)
    const body = new FormData()
    body.set('file', file)
    const response = await fetch(`/api/employees/${employeeId}/avatar`, { method: 'POST', body })
    setSaving(false)
    if (!response.ok) {
      setFailed(true)
      return
    }
    router.refresh()
  }

  async function remove() {
    if (!window.confirm(labels.remove)) return
    setSaving(true)
    setFailed(false)
    const response = await fetch(`/api/employees/${employeeId}/avatar`, { method: 'DELETE' })
    setSaving(false)
    if (!response.ok) {
      setFailed(true)
      return
    }
    router.refresh()
  }

  return <div className="flex flex-col items-center gap-2">
    {avatarUrl ? <img src={avatarUrl} alt={name} className="h-20 w-20 rounded-2xl object-cover shadow-sm" /> : <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">{name.split(' ').map((part) => part.slice(0, 1)).slice(0, 2).join('')}</span>}
    {canManage && <div className="flex flex-wrap justify-center gap-2">
      <input ref={inputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = '' }} />
      <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline" disabled={saving} onClick={() => inputRef.current?.click()}><Camera aria-hidden="true" className="h-3.5 w-3.5" />{avatarUrl ? labels.replace : labels.upload}</button>
      {avatarUrl && <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-destructive hover:underline" disabled={saving} onClick={() => void remove()}><Trash2 aria-hidden="true" className="h-3.5 w-3.5" />{labels.remove}</button>}
    </div>}
    {failed && <p className="text-xs text-destructive">{labels.failed}</p>}
  </div>
}
