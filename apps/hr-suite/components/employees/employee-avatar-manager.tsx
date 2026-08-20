'use client'
/* eslint-disable @next/next/no-img-element -- private avatar routes and customer-hosted URLs are intentionally rendered without remote image configuration. */

import { Camera, Trash2, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { IconButton } from '@/components/ui/icon-button'

interface Labels {
  upload: string
  replace: string
  remove: string
  failed: string
}

export function EmployeeAvatarManager({ employeeId, avatarUrl, name, gender, canManage, compact = false, labels }: { employeeId: string; avatarUrl: string | null; name: string; gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY'; canManage: boolean; compact?: boolean; labels: Labels }) {
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

  const initials = name.split(' ').filter(Boolean).map((part) => part.slice(0, 1)).slice(0, 2).join('').toUpperCase()
  const avatarClass = compact ? 'h-9 w-9 rounded-lg' : 'h-24 w-24 rounded-full sm:h-28 sm:w-28'
  const fallback = gender === 'OTHER' || gender === 'PREFER_NOT_TO_SAY'
    ? <span aria-label={name} className={`flex ${avatarClass} items-center justify-center bg-primary ${compact ? 'text-[0.65rem]' : 'text-2xl'} font-bold text-primary-foreground ${compact ? '' : 'ring-[6px] ring-primary-foreground shadow-lg'}`}>{initials}</span>
    : <span aria-label={name} className={`flex ${avatarClass} items-center justify-center text-primary-foreground ${compact ? 'shadow-sm' : 'ring-[5px] ring-primary-foreground shadow-lg'} ${gender === 'FEMALE' ? 'bg-chart-2' : 'bg-primary'}`}><UserRound aria-hidden="true" className={compact ? 'h-4 w-4' : 'h-12 w-12'} strokeWidth={1.6} /></span>
  return <div className="flex flex-col items-center gap-2">
    {avatarUrl ? <img src={avatarUrl} alt={name} className={`${avatarClass} object-cover ${compact ? 'shadow-sm' : 'ring-[5px] ring-primary-foreground shadow-lg'}`} /> : fallback}
    {canManage && <div className="flex flex-wrap justify-center gap-1.5">
      <input ref={inputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = '' }} />
      <IconButton label={avatarUrl ? labels.replace : labels.upload} title={avatarUrl ? labels.replace : labels.upload} variant="ghost" size="sm" className="border border-subtle bg-surface text-muted-foreground hover:bg-muted hover:text-foreground" disabled={saving} onClick={() => inputRef.current?.click()}><Camera aria-hidden="true" /></IconButton>
      {avatarUrl && <IconButton label={labels.remove} title={labels.remove} variant="ghost" size="sm" className="border border-subtle bg-surface text-muted-foreground hover:bg-muted hover:text-foreground" disabled={saving} onClick={() => void remove()}><Trash2 aria-hidden="true" /></IconButton>}
    </div>}
    {failed && <p className="text-xs text-destructive">{labels.failed}</p>}
  </div>
}
