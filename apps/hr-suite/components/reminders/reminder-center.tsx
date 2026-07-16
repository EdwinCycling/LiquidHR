'use client'

import { BellRing, Check, LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ManagedReminder, ReminderItem, ReminderTargetOptions } from '@/lib/reminders/reminder-service'

export interface ReminderCenterLabels {
  personalList: string; hrList: string; empty: string; personal: string; hr: string
  newPersonal: string; newHr: string; titleLabel: string; descriptionLabel: string
  dateTimeLabel: string; targetLabel: string; everyone: string; departments: string
  employees: string; create: string; creating: string; publish: string
  cancelReminder: string; delete: string; complete: string; dismiss: string; snooze: string
  created: string; failed: string; draft: string; publishedStatus: string; cancelled: string
  completed: string; dismissed: string; pending: string; noHrPermission: string
}

interface ReminderCenterProps {
  canManageHr: boolean
  initialManaged: ManagedReminder[]
  initialReminders: ReminderItem[]
  labels: ReminderCenterLabels
  locale: string
  targetOptions: ReminderTargetOptions
}

function toIso(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string' || !value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function ReminderCenter({ canManageHr, initialManaged, initialReminders, labels, locale, targetOptions }: ReminderCenterProps) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [targetType, setTargetType] = useState<'EVERYONE' | 'DEPARTMENTS' | 'EMPLOYEES'>('EVERYONE')

  async function submitReminder(form: HTMLFormElement, type: 'PERSONAL' | 'HR') {
    setBusy(type)
    setFeedback(null)
    const data = new FormData(form)
    const remindAt = toIso(data.get('remindAt'))
    if (!remindAt) { setFeedback(labels.failed); setBusy(null); return }
    const body: Record<string, unknown> = {
      type,
      title: data.get('title'),
      description: data.get('description') || undefined,
      remindAt,
    }
    if (type === 'HR') {
      body.targetType = targetType
      if (targetType !== 'EVERYONE') body.targetIds = data.getAll('targetIds')
    }
    const response = await fetch('/api/reminders', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    const result: unknown = await response.json()
    if (!response.ok || typeof result !== 'object' || result === null || !('data' in result)) {
      setFeedback(labels.failed); setBusy(null); return
    }
    const id = (result as { data?: { id?: unknown } }).data?.id
    if (type === 'HR' && typeof id === 'string') {
      const publishResponse = await fetch(`/api/reminders/${id}/publish`, { method: 'POST' })
      if (!publishResponse.ok) { setFeedback(labels.failed); setBusy(null); router.refresh(); return }
    }
    form.reset()
    setFeedback(labels.created)
    setBusy(null)
    router.refresh()
  }

  async function recipientAction(item: ReminderItem, action: 'COMPLETE' | 'DISMISS' | 'SNOOZE') {
    setBusy(item.recipientId)
    const snoozeUntil = new Date()
    snoozeUntil.setMinutes(snoozeUntil.getMinutes() + 15)
    const body = action === 'SNOOZE'
      ? { action, remindAt: snoozeUntil.toISOString() }
      : { action }
    const response = await fetch(`/api/reminder-recipients/${item.recipientId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    setFeedback(response.ok ? null : labels.failed)
    setBusy(null)
    router.refresh()
  }

  async function reminderAction(id: string, action: 'delete' | 'publish' | 'cancel') {
    setBusy(id)
    const response = await fetch(action === 'delete' ? `/api/reminders/${id}` : `/api/reminders/${id}/${action}`, {
      method: action === 'delete' ? 'DELETE' : 'POST',
    })
    setFeedback(response.ok ? null : labels.failed)
    setBusy(null)
    router.refresh()
  }

  const statusLabel = (status: ReminderItem['recipientStatus']) => ({
    PENDING: labels.pending, COMPLETED: labels.completed, DISMISSED: labels.dismissed,
  })[status]
  const hrStatusLabel = (status: ManagedReminder['status']) => ({
    DRAFT: labels.draft, PUBLISHED: labels.publishedStatus, CANCELLED: labels.cancelled,
  })[status]

  return (
    <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.75fr)]">
      <div className="space-y-6">
        <section className="rounded-2xl border bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{labels.personalList}</h2>
          {initialReminders.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{labels.empty}</p> : (
            <ul className="mt-4 space-y-3">{initialReminders.map((item) => (
              <li className="rounded-xl border bg-surface-raised p-4" id={item.reminderId} key={item.recipientId}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.type === 'HR' ? labels.hr : labels.personal}</p><h3 className="mt-1 font-semibold">{item.title}</h3></div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{statusLabel(item.recipientStatus)}</span>
                </div>
                {item.description ? <p className="mt-2 text-sm text-muted-foreground">{item.description}</p> : null}
                <time className="mt-3 block text-sm tabular-nums" dateTime={item.remindAt}>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.remindAt))}</time>
                {item.recipientStatus === 'PENDING' ? <div className="mt-4 flex flex-wrap gap-2">
                  <button className="button-primary gap-2" disabled={busy === item.recipientId} onClick={() => void recipientAction(item, 'COMPLETE')} type="button"><Check aria-hidden="true" size={15} />{labels.complete}</button>
                  <button className="button-secondary" disabled={busy === item.recipientId} onClick={() => void recipientAction(item, 'SNOOZE')} type="button">{labels.snooze}</button>
                  <button className="button-secondary" disabled={busy === item.recipientId} onClick={() => void recipientAction(item, 'DISMISS')} type="button">{labels.dismiss}</button>
                  {item.type === 'PERSONAL' ? <button aria-label={labels.delete} className="button-secondary gap-2" disabled={busy === item.recipientId} onClick={() => void reminderAction(item.reminderId, 'delete')} type="button"><Trash2 aria-hidden="true" size={15} />{labels.delete}</button> : null}
                </div> : null}
              </li>
            ))}</ul>
          )}
        </section>

        {canManageHr ? <section className="rounded-2xl border bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{labels.hrList}</h2>
          {initialManaged.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{labels.empty}</p> : <ul className="mt-4 space-y-3">{initialManaged.map((item) => <li className="flex flex-col gap-3 rounded-xl border bg-surface-raised p-4 sm:flex-row sm:items-center sm:justify-between" key={item.id}>
            <div><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-xs text-muted-foreground">{hrStatusLabel(item.status)} · {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.remindAt))}</p></div>
            <div className="flex gap-2">{item.status === 'DRAFT' ? <button className="button-primary" disabled={busy === item.id} onClick={() => void reminderAction(item.id, 'publish')} type="button">{labels.publish}</button> : null}{item.status !== 'CANCELLED' ? <button className="button-secondary" disabled={busy === item.id} onClick={() => void reminderAction(item.id, 'cancel')} type="button">{labels.cancelReminder}</button> : null}</div>
          </li>)}</ul>}
        </section> : null}
      </div>

      <div className="space-y-6">
        <ReminderForm busy={busy === 'PERSONAL'} labels={labels} onSubmit={(form) => void submitReminder(form, 'PERSONAL')} title={labels.newPersonal} />
        {canManageHr ? <ReminderForm busy={busy === 'HR'} labels={labels} onSubmit={(form) => void submitReminder(form, 'HR')} title={labels.newHr}>
          <label className="block text-sm font-medium">{labels.targetLabel}<select className="form-field mt-1" name="targetType" onChange={(event) => setTargetType(event.target.value as typeof targetType)} value={targetType}><option value="EVERYONE">{labels.everyone}</option><option value="DEPARTMENTS">{labels.departments}</option><option value="EMPLOYEES">{labels.employees}</option></select></label>
          {targetType !== 'EVERYONE' ? <label className="block text-sm font-medium">{targetType === 'DEPARTMENTS' ? labels.departments : labels.employees}<select className="form-field mt-1 min-h-36" multiple name="targetIds" required>{(targetType === 'DEPARTMENTS' ? targetOptions.departments : targetOptions.employees).map((option) => <option key={option.id} value={option.id}>{'employeeNumber' in option ? `${option.employeeNumber} · ${option.name}` : option.name}</option>)}</select></label> : null}
        </ReminderForm> : <p className="rounded-xl border bg-surface p-4 text-sm text-muted-foreground">{labels.noHrPermission}</p>}
        {feedback ? <p className="rounded-xl border bg-surface px-4 py-3 text-sm" role="status">{feedback}</p> : null}
      </div>
    </div>
  )
}

function ReminderForm({ busy, children, labels, onSubmit, title }: { busy: boolean; children?: ReactNode; labels: ReminderCenterLabels; onSubmit: (form: HTMLFormElement) => void; title: string }) {
  return <form className="rounded-2xl border bg-surface p-5 shadow-sm" onSubmit={(event) => { event.preventDefault(); onSubmit(event.currentTarget) }}>
    <h2 className="flex items-center gap-2 text-lg font-semibold"><BellRing aria-hidden="true" size={19} />{title}</h2>
    <div className="mt-4 space-y-4"><label className="block text-sm font-medium">{labels.titleLabel}<input className="form-field mt-1" maxLength={160} name="title" required /></label><label className="block text-sm font-medium">{labels.descriptionLabel}<textarea className="form-field mt-1 min-h-24" maxLength={2000} name="description" /></label><label className="block text-sm font-medium">{labels.dateTimeLabel}<input className="form-field mt-1" name="remindAt" required type="datetime-local" /></label>{children}</div>
    <button className="button-primary mt-5 gap-2" disabled={busy} type="submit">{busy ? <LoaderCircle aria-hidden="true" className="animate-spin" size={16} /> : <Plus aria-hidden="true" size={16} />}{busy ? labels.creating : labels.create}</button>
  </form>
}
