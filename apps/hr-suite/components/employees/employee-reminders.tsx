'use client'

import { BellRing, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ReminderItem } from '@/lib/reminders/reminder-service'

export function EmployeeReminders({ employeeId, reminders, labels }: { employeeId: string; reminders: ReminderItem[]; labels: { title: string; empty: string; add: string; titleLabel: string; dateLabel: string; save: string; saved: string; failed: string } }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  async function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    const response = await fetch('/api/reminders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'HR', title: data.get('title'), remindAt: new Date(String(data.get('remindAt'))).toISOString(), targetType: 'EMPLOYEES', targetIds: [employeeId] }) })
    if (!response.ok) { setFeedback(labels.failed); return }
    const result = await response.json() as { data?: { id?: string } }
    if (result.data?.id) await fetch(`/api/reminders/${result.data.id}/publish`, { method: 'POST' })
    setFeedback(labels.saved); setOpen(false); form.reset(); router.refresh()
  }
  return <section className="mt-8 rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-semibold"><BellRing aria-hidden="true" size={19} />{labels.title}</h2><button className="button-primary gap-2" onClick={() => setOpen((value) => !value)} type="button"><Plus aria-hidden="true" size={15} />{labels.add}</button></div>{reminders.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{labels.empty}</p> : <ul className="mt-4 space-y-2">{reminders.map((item) => <li className="rounded-xl border bg-surface-raised p-3" key={item.recipientId}><p className="font-medium">{item.title}</p><time className="mt-1 block text-sm text-muted-foreground" dateTime={item.remindAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.remindAt))}</time></li>)}</ul>}{open ? <form className="mt-4 grid gap-3 rounded-xl border bg-muted p-4" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget) }}><label className="grid gap-1 text-sm font-medium">{labels.titleLabel}<input className="form-field" name="title" required /></label><label className="grid gap-1 text-sm font-medium">{labels.dateLabel}<input className="form-field" name="remindAt" required type="datetime-local" /></label><button className="button-primary" type="submit">{labels.save}</button></form> : null}{feedback ? <p className="mt-3 text-sm" role="status">{feedback}</p> : null}</section>
}
