'use client'

import { Plus, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { Textarea } from '@/components/ui/textarea'
import type { EmployeeActivityItem } from '@/lib/employees/employee-activity-service'
import { formatDateTime } from '@/lib/preferences/formatters'
import type { DateFormat, TimeFormat } from '@/lib/preferences/user-preferences'

interface Labels {
  placeholder: string
  add: string
  save: string
  saving: string
  empty: string
  failed: string
}

export function EmployeeActivityFeed({ employeeId, items, locale, dateFormat, timeFormat, canWrite, labels }: { employeeId: string; items: EmployeeActivityItem[]; locale: string; dateFormat: DateFormat; timeFormat: TimeFormat; canWrite: boolean; labels: Labels }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed'>('idle')

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!message.trim()) return
    setStatus('saving')
    const response = await fetch(`/api/employees/${employeeId}/activity`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message }) })
    if (!response.ok) { setStatus('failed'); return }
    setMessage('')
    setOpen(false)
    setStatus('idle')
    router.refresh()
  }

  return <div>
    {items.length ? <ul className="divide-y divide-border/70">{items.map((item) => <li className="py-3 first:pt-0 last:pb-0" key={item.id}><p className="break-words whitespace-pre-wrap text-sm leading-6">{item.message}</p><time className="mt-1 block text-xs text-muted-foreground" dateTime={item.createdAt}>{formatDateTime(item.createdAt, { locale, dateFormat, timeFormat })}</time></li>)}</ul> : <EmptyState title={labels.empty} className="items-start p-4 text-left" />}
    {canWrite ? <>
      <Button className="mt-4 justify-start px-0 text-primary hover:bg-transparent hover:underline" onClick={() => setOpen((value) => !value)} size="sm" type="button" variant="ghost"><Plus aria-hidden="true" />{labels.add}</Button>
      {open ? <Surface variant="subtle" className="mt-4 p-4"><form className="grid gap-4" onSubmit={(event) => void submit(event)}><FormField control={<Textarea autoFocus maxLength={2000} onChange={(event) => setMessage(event.target.value)} placeholder={labels.placeholder} value={message} />} label={labels.placeholder} required /><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{message.length}/2000</span><Button disabled={!message.trim()} loading={status === 'saving'} size="sm" type="submit"><Send aria-hidden="true" />{status === 'saving' ? labels.saving : labels.save}</Button></div>{status === 'failed' ? <p className="text-sm text-destructive" role="alert">{labels.failed}</p> : null}</form></Surface> : null}
    </> : null}
  </div>
}
