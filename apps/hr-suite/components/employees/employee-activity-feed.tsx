'use client'

import { LoaderCircle, Plus, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
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
    {items.length ? <ul className="divide-y divide-border/70">{items.map((item) => <li className="py-3 first:pt-0 last:pb-0" key={item.id}><p className="whitespace-pre-wrap text-sm leading-6">{item.message}</p><time className="mt-1 block text-xs text-muted-foreground" dateTime={item.createdAt}>{formatDateTime(item.createdAt, { locale, dateFormat, timeFormat })}</time></li>)}</ul> : <p className="rounded-xl border border-dashed border-primary/25 bg-accent/20 p-4 text-sm text-muted-foreground">{labels.empty}</p>}
    {canWrite ? <>
      <button className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" onClick={() => setOpen((value) => !value)} type="button"><Plus aria-hidden="true" size={15} />{labels.add}</button>
      {open ? <form className="mt-4 rounded-xl border bg-muted/40 p-4" onSubmit={(event) => void submit(event)}><textarea aria-label={labels.placeholder} autoFocus className="form-field min-h-24 resize-y" maxLength={2000} onChange={(event) => setMessage(event.target.value)} placeholder={labels.placeholder} value={message} /><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{message.length}/2000</span><button className="button-primary inline-flex items-center gap-2" disabled={!message.trim() || status === 'saving'} type="submit">{status === 'saving' ? <LoaderCircle aria-hidden="true" className="animate-spin" size={15} /> : <Send aria-hidden="true" size={15} />}{status === 'saving' ? labels.saving : labels.save}</button></div>{status === 'failed' ? <p className="mt-2 text-sm text-destructive" role="alert">{labels.failed}</p> : null}</form> : null}
    </> : null}
  </div>
}
