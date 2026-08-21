'use client'

import { ArrowLeft, ArrowRight, BellRing, CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type FormEvent } from 'react'
import { FormField } from '@/components/patterns/form-field'
import { SectionHeader } from '@/components/patterns/section-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime } from '@/lib/preferences/formatters'
import type { DateFormat, TimeFormat } from '@/lib/preferences/user-preferences'
import type { ReminderItem } from '@/lib/reminders/reminder-service'

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

  return (
    <section className="mt-8 space-y-5">
      <SectionHeader actions={canAdd ? <Button className="whitespace-normal text-left" onClick={() => open ? setOpen(false) : startAdd()} type="button"><Plus aria-hidden="true" />{labels.add}</Button> : undefined} title={labels.title} />
      {feedback && <p className="border border-border-subtle bg-surface-subtle px-4 py-3 text-sm" role="status">{feedback}</p>}
      {reminders.length === 0 ? <EmptyState icon={<BellRing />} title={labels.empty} /> : <ol className="space-y-3">{reminders.map((item) => {
        const canManageItem = mode === 'PERSONAL' ? item.type === 'PERSONAL' : canManageHr
        return <li key={item.recipientId}><Surface className="p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h3 className="font-semibold text-foreground">{item.title}</h3>{item.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description}</p>}<time className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground" dateTime={item.remindAt}><CalendarDays aria-hidden="true" size={14} />{formatDateTime(item.remindAt, { locale, dateFormat, timeFormat })}</time></div>{canManageItem ? <div className="flex shrink-0 flex-wrap gap-2"><Button onClick={() => startEdit(item)} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" />{labels.edit}</Button><Button className="text-destructive" onClick={() => void remove(item)} size="sm" type="button" variant="secondary"><Trash2 aria-hidden="true" />{labels.remove}</Button></div> : null}</div></Surface></li>
      })}</ol>}
      {open && <Surface className="p-5" variant="subtle">
        <SectionHeader actions={<Button onClick={() => { setOpen(false); setEditing(null) }} size="sm" type="button" variant="secondary">{labels.cancel}</Button>} title={editing ? labels.edit : labels.add} />
        <form key={formKey} className="mt-4 grid gap-4" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField control={<TextInput defaultValue={editing?.title ?? ''} name="title" required />} label={labels.titleLabel} required />
            <FormField control={<TextInput name="remindAt" onChange={(event) => setDateTime(event.target.value)} required type="datetime-local" value={dateTime} />} label={labels.dateLabel} required />
            <FormField className="md:col-span-2" control={<Textarea defaultValue={editing?.description ?? ''} name="description" />} label={labels.descriptionLabel} />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
            <Button onClick={() => setDateTime(shift(dateTime, 'dayBack'))} size="sm" type="button" variant="ghost"><ArrowLeft aria-hidden="true" />{labels.shiftDayBack}</Button>
            <Button onClick={() => setDateTime(shift(dateTime, 'dayForward'))} size="sm" type="button" variant="ghost"><ArrowRight aria-hidden="true" />{labels.shiftDayForward}</Button>
            <Button onClick={() => setDateTime(shift(dateTime, 'weekForward'))} size="sm" type="button" variant="ghost">{labels.shiftWeekForward}</Button>
            <Button onClick={() => setDateTime(shift(dateTime, 'monthForward'))} size="sm" type="button" variant="ghost">{labels.shiftMonthForward}</Button>
          </div>
          <div><Button type="submit">{labels.save}</Button></div>
        </form>
      </Surface>}
    </section>
  )
}
