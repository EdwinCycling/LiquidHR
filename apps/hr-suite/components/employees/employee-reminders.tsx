'use client'

import { BellRing, CalendarDays, ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { FormEvent, useMemo, useState } from 'react'
import type { ReminderItem } from '@/lib/reminders/reminder-service'
import { formatDateTime } from '@/lib/preferences/formatters'
import type { DateFormat, TimeFormat } from '@/lib/preferences/user-preferences'

interface Labels {
  title: string; empty: string; add: string; edit: string; remove: string; titleLabel: string; descriptionLabel: string; dateLabel: string; save: string; saved: string; failed: string; cancel: string; shiftDayBack: string; shiftDayForward: string; shiftWeekForward: string; shiftMonthForward: string; confirmDelete: string
}

function localDateTimeValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function initialDateTime(): string { return localDateTimeValue(new Date(Date.now() + 60_000)) }

function shift(value: string, kind: 'dayBack' | 'dayForward' | 'weekForward' | 'monthForward'): string {
  const date = new Date(value)
  if (kind === 'dayBack') date.setDate(date.getDate() - 1)
  if (kind === 'dayForward') date.setDate(date.getDate() + 1)
  if (kind === 'weekForward') date.setDate(date.getDate() + 7)
  if (kind === 'monthForward') date.setMonth(date.getMonth() + 1)
  return localDateTimeValue(date)
}

export function EmployeeReminders({ employeeId, reminders, locale, dateFormat, timeFormat, labels, mode, canManageHr }: { employeeId: string; reminders: ReminderItem[]; locale: string; dateFormat: DateFormat; timeFormat: TimeFormat; labels: Labels; mode: 'PERSONAL' | 'HR'; canManageHr: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ReminderItem | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [dateTime, setDateTime] = useState(initialDateTime)
  const formKey = useMemo(() => editing?.reminderId ?? 'new', [editing])

  const canAdd = mode === 'PERSONAL' || canManageHr
  function startAdd(): void { if (!canAdd) return; setEditing(null); setDateTime(initialDateTime()); setOpen(true); setFeedback(null) }
  function startEdit(item: ReminderItem): void { setEditing(item); setDateTime(localDateTimeValue(new Date(item.originalRemindAt))); setOpen(true); setFeedback(null) }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const remindAt = new Date(dateTime).toISOString()
    const body = { title: String(data.get('title') ?? ''), description: String(data.get('description') ?? ''), remindAt }
    const createBody = mode === 'PERSONAL' ? { type: 'PERSONAL' as const, ...body } : { type: 'HR' as const, ...body, targetType: 'EMPLOYEES' as const, targetIds: [employeeId] }
    const response = await fetch(editing ? `/api/reminders/${editing.reminderId}` : '/api/reminders', { method: editing ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(editing ? body : createBody) })
    if (!response.ok) { setFeedback(labels.failed); return }
    if (!editing && mode === 'HR') {
      const result = await response.json() as { data?: { id?: string } }
      if (result.data?.id) {
        const publishResponse = await fetch(`/api/reminders/${result.data.id}/publish`, { method: 'POST' })
        if (!publishResponse.ok) { setFeedback(labels.failed); return }
      }
    }
    setFeedback(labels.saved); setOpen(false); setEditing(null); router.refresh()
  }

  async function remove(item: ReminderItem): Promise<void> {
    if (!window.confirm(labels.confirmDelete)) return
    const response = await fetch(`/api/reminders/${item.reminderId}`, { method: 'DELETE' })
    setFeedback(response.ok ? labels.saved : labels.failed)
    if (response.ok) router.refresh()
  }

  return <section className="mt-8 space-y-5"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow text-primary">{labels.title}</p><h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold"><BellRing aria-hidden="true" size={21} />{labels.title}</h2></div></header>
    {feedback && <p className="rounded-xl border bg-muted/35 px-4 py-3 text-sm" role="status">{feedback}</p>}
    {reminders.length === 0 ? <p className="rounded-2xl border border-dashed bg-surface p-6 text-center text-sm text-muted-foreground">{labels.empty}</p> : <ol className="space-y-3">{reminders.map((item) => { const canManageItem = mode === 'PERSONAL' ? item.type === 'PERSONAL' : canManageHr; return <li key={item.recipientId} className="rounded-2xl border bg-surface p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold">{item.title}</h3>{item.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description}</p>}<time className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground" dateTime={item.remindAt}><CalendarDays aria-hidden="true" size={14} />{formatDateTime(item.remindAt, { locale, dateFormat, timeFormat })}</time></div>{canManageItem ? <div className="flex gap-2"><button type="button" className="button-secondary inline-flex items-center gap-1.5" onClick={() => startEdit(item)}><Pencil aria-hidden="true" size={14} />{labels.edit}</button><button type="button" className="button-secondary inline-flex items-center gap-1.5 text-destructive" onClick={() => void remove(item)}><Trash2 aria-hidden="true" size={14} />{labels.remove}</button></div> : null}</div></li> })}</ol>}
    {canAdd && <div><button className="button-primary inline-flex items-center gap-2" onClick={() => open ? setOpen(false) : startAdd()} type="button"><Plus aria-hidden="true" size={16} />{labels.add}</button></div>}
    {open && <form key={formKey} className="rounded-2xl border bg-surface p-5 shadow-sm" onSubmit={(event) => void submit(event)}><div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-semibold">{editing ? labels.edit : labels.add}</h3><button type="button" className="button-secondary" onClick={() => { setOpen(false); setEditing(null) }}>{labels.cancel}</button></div><div className="grid gap-4 md:grid-cols-2"><label className="grid gap-1 text-sm font-medium">{labels.titleLabel}<input className="form-field" name="title" defaultValue={editing?.title ?? ''} required /></label><label className="grid gap-1 text-sm font-medium">{labels.dateLabel}<input className="form-field" name="remindAt" value={dateTime} onChange={(event) => setDateTime(event.target.value)} required type="datetime-local" /></label><label className="grid gap-1 text-sm font-medium md:col-span-2">{labels.descriptionLabel}<textarea className="form-field min-h-24" name="description" defaultValue={editing?.description ?? ''} /></label></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" className="button-secondary inline-flex items-center gap-1.5" onClick={() => setDateTime(shift(dateTime, 'dayBack'))}><ChevronDown aria-hidden="true" size={15} />{labels.shiftDayBack}</button><button type="button" className="button-secondary inline-flex items-center gap-1.5" onClick={() => setDateTime(shift(dateTime, 'dayForward'))}><ChevronUp aria-hidden="true" size={15} />{labels.shiftDayForward}</button><button type="button" className="button-secondary" onClick={() => setDateTime(shift(dateTime, 'weekForward'))}>{labels.shiftWeekForward}</button><button type="button" className="button-secondary" onClick={() => setDateTime(shift(dateTime, 'monthForward'))}>{labels.shiftMonthForward}</button></div><button className="button-primary mt-5" type="submit">{labels.save}</button></form>}
  </section>
}
