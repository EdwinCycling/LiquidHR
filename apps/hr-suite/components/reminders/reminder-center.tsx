'use client'

import { BellRing, CalendarClock, Check, CheckCheck, CircleAlert, Clock3, LoaderCircle, Plus, Search, UserRound, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { ManagedReminder, ReminderItem, ReminderTargetOptions } from '@/lib/reminders/reminder-service'
import { formatDateTime } from '@/lib/preferences/formatters'
import type { DateFormat, TimeFormat } from '@/lib/preferences/user-preferences'
import { formatReminderCountdown } from '@/lib/reminders/reminder-rules'

export interface ReminderCenterLabels {
  personalList: string; hrList: string; empty: string; personal: string; hr: string
  newPersonal: string; newHr: string; titleLabel: string; descriptionLabel: string
  dateTimeLabel: string; targetLabel: string; everyone: string; departments: string
  employees: string; create: string; creating: string; publish: string
  cancelReminder: string; delete: string; complete: string; dismiss: string; snooze: string
  created: string; failed: string; draft: string; publishedStatus: string; cancelled: string
  completed: string; dismissed: string; pending: string; noHrPermission: string
  filterOpen: string; filterAll: string; filterCompleted: string; filterDismissed: string
  sortSoonest: string; sortLatest: string; sortTitle: string; search: string; selectAll: string
  clearSelection: string; bulkComplete: string; moreInfo: string; employee: string; noResults: string; selectedCount: string; visibleCount: string; close: string
}

interface ReminderCenterProps {
  canManageHr: boolean
  initialManaged: ManagedReminder[]
  initialReminders: ReminderItem[]
  labels: ReminderCenterLabels
  locale: string
  dateFormat: DateFormat
  timeFormat: TimeFormat
  targetOptions: ReminderTargetOptions
}

function toIso(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string' || !value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function ReminderCenter({ canManageHr, initialManaged, initialReminders, labels, locale, dateFormat, timeFormat, targetOptions }: ReminderCenterProps) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [targetType, setTargetType] = useState<'EVERYONE' | 'DEPARTMENTS' | 'EMPLOYEES'>('EVERYONE')
  const [filter, setFilter] = useState<'OPEN' | 'ALL' | 'COMPLETED' | 'DISMISSED'>('OPEN')
  const [sort, setSort] = useState<'SOONEST' | 'LATEST' | 'TITLE'>('SOONEST')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [detail, setDetail] = useState<ReminderItem | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

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
    if (response.ok) setDetail(null)
    router.refresh()
  }

  async function completeSelected() {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBusy('bulk')
    await Promise.all(ids.map(async (recipientId) => {
      await fetch(`/api/reminder-recipients/${recipientId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'COMPLETE' }) })
    }))
    setSelectedIds(new Set())
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

  const visibleReminders = initialReminders
    .filter((item) => filter === 'ALL' || (filter === 'OPEN' && item.recipientStatus === 'PENDING') || (filter === 'COMPLETED' && item.recipientStatus === 'COMPLETED') || (filter === 'DISMISSED' && item.recipientStatus === 'DISMISSED'))
    .filter((item) => `${item.title} ${item.description ?? ''} ${item.employeeName ?? ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort((left, right) => sort === 'TITLE' ? left.title.localeCompare(right.title) : sort === 'LATEST' ? new Date(right.remindAt).getTime() - new Date(left.remindAt).getTime() : new Date(left.remindAt).getTime() - new Date(right.remindAt).getTime())

  const pendingVisible = visibleReminders.filter((item) => item.recipientStatus === 'PENDING')
  const tone = (item: ReminderItem) => {
    if (item.recipientStatus !== 'PENDING') return 'border-border/70 bg-muted/50'
    const difference = new Date(item.remindAt).getTime() - now.getTime()
    if (difference < 0) return 'border-destructive/40 bg-destructive/5'
    if (difference < 86_400_000) return 'border-warning/40 bg-warning/5'
    return 'border-success/30 bg-success/5'
  }

  return (
    <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.75fr)]">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl border bg-surface shadow-sm">
          <header className="border-b bg-gradient-to-br from-primary/10 via-surface to-surface px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{labels.personalList}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">{labels.personalList}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.visibleCount.replace('{count}', String(visibleReminders.length))}</p></div><div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><BellRing aria-hidden="true" size={20} /></div></div>
            <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <label className="relative"><Search aria-hidden="true" className="absolute left-3 top-3.5 text-muted-foreground" size={16} /><span className="sr-only">{labels.search}</span><input className="form-field pl-9" onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} value={search} /></label>
              <label className="sr-only" htmlFor="reminder-filter">{labels.filterOpen}</label><select className="form-field" id="reminder-filter" onChange={(event) => setFilter(event.target.value as typeof filter)} value={filter}><option value="OPEN">{labels.filterOpen}</option><option value="ALL">{labels.filterAll}</option><option value="COMPLETED">{labels.filterCompleted}</option><option value="DISMISSED">{labels.filterDismissed}</option></select>
              <label className="sr-only" htmlFor="reminder-sort">{labels.sortSoonest}</label><select className="form-field" id="reminder-sort" onChange={(event) => setSort(event.target.value as typeof sort)} value={sort}><option value="SOONEST">{labels.sortSoonest}</option><option value="LATEST">{labels.sortLatest}</option><option value="TITLE">{labels.sortTitle}</option></select>
            </div>
          </header>
          {pendingVisible.length > 0 ? <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 text-sm sm:px-6"><label className="flex items-center gap-2 font-medium"><input checked={pendingVisible.every((item) => selectedIds.has(item.recipientId))} onChange={(event) => setSelectedIds(event.target.checked ? new Set(pendingVisible.map((item) => item.recipientId)) : new Set())} type="checkbox" />{labels.selectAll}</label>{selectedIds.size > 0 ? <div className="flex items-center gap-2"><span className="text-muted-foreground">{labels.selectedCount.replace('{count}', String(selectedIds.size))}</span><button className="button-primary min-h-9 gap-2" disabled={busy === 'bulk'} onClick={() => void completeSelected()} type="button"><CheckCheck aria-hidden="true" size={15} />{labels.bulkComplete}</button></div> : null}</div> : null}
          {visibleReminders.length === 0 ? <p className="px-5 py-12 text-center text-sm text-muted-foreground sm:px-6">{labels.noResults}</p> : <ul className="divide-y">{visibleReminders.map((item) => (
            <li id={item.reminderId} key={item.recipientId}>
              <article className={`p-4 transition-colors sm:p-5 ${tone(item)}`}>
                <div className="flex items-start gap-3">
                  <input aria-label={item.title} checked={selectedIds.has(item.recipientId)} disabled={item.recipientStatus !== 'PENDING'} onChange={(event) => setSelectedIds((current) => { const next = new Set(current); if (event.target.checked) next.add(item.recipientId); else next.delete(item.recipientId); return next })} type="checkbox" />
                  <button className="min-w-0 flex-1 text-left" onClick={() => setDetail(item)} type="button">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground"><span className={`size-2 rounded-full ${item.recipientStatus === 'PENDING' ? new Date(item.remindAt).getTime() < now.getTime() ? 'bg-destructive' : 'bg-success' : 'bg-muted-foreground'}`} />{item.type === 'HR' ? labels.hr : labels.personal}</p><h3 className="mt-1 truncate text-base font-semibold">{item.title}</h3></div><span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-semibold">{statusLabel(item.recipientStatus)}</span></div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1.5"><CalendarClock aria-hidden="true" size={15} />{formatDateTime(item.remindAt, { locale, dateFormat, timeFormat })}</span><span className="inline-flex items-center gap-1.5"><Clock3 aria-hidden="true" size={15} />{formatReminderCountdown(now, new Date(item.remindAt), locale)}</span>{item.employeeId && item.employeeName ? <span className="inline-flex items-center gap-1.5"><UserRound aria-hidden="true" size={15} />{item.employeeName}</span> : null}</div>
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 pl-7"><button className="button-secondary min-h-9" onClick={() => setDetail(item)} type="button">{labels.moreInfo}</button>{item.employeeId && item.employeeName ? <Link className="text-sm font-semibold text-accent-foreground hover:underline" href={`/employees/${item.employeeId}`}>{item.employeeName}</Link> : null}{item.recipientStatus === 'PENDING' ? <><button className="button-primary min-h-9 gap-2" disabled={busy === item.recipientId} onClick={() => void recipientAction(item, 'COMPLETE')} type="button"><Check aria-hidden="true" size={15} />{labels.complete}</button><button className="button-secondary min-h-9" disabled={busy === item.recipientId} onClick={() => void recipientAction(item, 'SNOOZE')} type="button">{labels.snooze}</button><button className="button-secondary min-h-9" disabled={busy === item.recipientId} onClick={() => void recipientAction(item, 'DISMISS')} type="button">{labels.dismiss}</button></> : null}</div>
              </article>
            </li>
          ))}</ul>}
        </section>

        {canManageHr ? <section className="rounded-2xl border bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{labels.hrList}</h2>
          {initialManaged.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{labels.empty}</p> : <ul className="mt-4 space-y-3">{initialManaged.map((item) => <li className="flex flex-col gap-3 rounded-xl border bg-surface-raised p-4 sm:flex-row sm:items-center sm:justify-between" key={item.id}>
            <div><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-xs text-muted-foreground">{hrStatusLabel(item.status)} · {formatDateTime(item.remindAt, { locale, dateFormat, timeFormat })}</p></div>
            <div className="flex gap-2">{item.status === 'DRAFT' ? <button className="button-primary" disabled={busy === item.id} onClick={() => void reminderAction(item.id, 'publish')} type="button">{labels.publish}</button> : null}{item.status !== 'CANCELLED' ? <button className="button-secondary" disabled={busy === item.id} onClick={() => void reminderAction(item.id, 'cancel')} type="button">{labels.cancelReminder}</button> : null}</div>
          </li>)}</ul>}
        </section> : null}
      </div>

      {detail ? <ReminderDetailModal busy={busy === detail.recipientId} item={detail} labels={labels} locale={locale} dateFormat={dateFormat} timeFormat={timeFormat} onAction={(item, action) => void recipientAction(item, action)} onClose={() => setDetail(null)} /> : null}

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

function ReminderDetailModal({ busy, item, labels, locale, dateFormat, timeFormat, onAction, onClose }: { busy: boolean; item: ReminderItem; labels: ReminderCenterLabels; locale: string; dateFormat: DateFormat; timeFormat: TimeFormat; onAction: (item: ReminderItem, action: 'COMPLETE' | 'DISMISS' | 'SNOOZE') => void; onClose: () => void }) {
  return <div aria-labelledby="reminder-detail-heading" aria-modal="true" className="fixed inset-0 z-[80] grid place-items-center bg-sidebar/70 p-4 backdrop-blur-sm" onClick={onClose} role="dialog">
    <section className="w-full max-w-lg overflow-hidden rounded-3xl border bg-surface shadow-[0_1.5rem_4.5rem_color-mix(in_srgb,var(--primary)_20%,transparent)]" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-start justify-between gap-4 border-b bg-gradient-to-br from-primary/10 via-surface to-surface p-5 sm:p-6"><div><p className="eyebrow">{labels.moreInfo}</p><h2 className="mt-1 text-xl font-semibold" id="reminder-detail-heading">{item.title}</h2></div><button aria-label={labels.close} className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose} type="button"><X aria-hidden="true" size={18} /></button></header>
      <div className="space-y-5 p-5 sm:p-6"><div className="flex flex-wrap gap-2"><span className="status-chip bg-muted"><BellRing aria-hidden="true" size={14} />{item.type === 'HR' ? labels.hr : labels.personal}</span><span className="status-chip bg-muted"><Clock3 aria-hidden="true" size={14} />{formatReminderCountdown(new Date(), new Date(item.remindAt), locale)}</span></div><div className="rounded-2xl border bg-muted/40 p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{labels.dateTimeLabel}</p><p className="mt-1 font-semibold">{formatDateTime(item.remindAt, { locale, dateFormat, timeFormat })}</p></div>{item.description ? <p className="text-sm leading-6 text-muted-foreground">{item.description}</p> : <p className="flex items-center gap-2 text-sm text-muted-foreground"><CircleAlert aria-hidden="true" size={16} />{labels.noResults}</p>}{item.employeeId && item.employeeName ? <Link className="flex items-center gap-3 rounded-2xl border p-4 font-semibold hover:bg-muted" href={`/employees/${item.employeeId}`} onClick={onClose}><UserRound aria-hidden="true" size={18} />{item.employeeName}<span className="ml-auto text-accent-foreground">→</span></Link> : null}</div>
      {item.recipientStatus === 'PENDING' ? <footer className="flex flex-wrap gap-2 border-t p-5 sm:p-6"><button className="button-primary min-h-10 gap-2" disabled={busy} onClick={() => onAction(item, 'COMPLETE')} type="button"><Check aria-hidden="true" size={16} />{labels.complete}</button><button className="button-secondary min-h-10" disabled={busy} onClick={() => onAction(item, 'SNOOZE')} type="button">{labels.snooze}</button><button className="button-secondary min-h-10" disabled={busy} onClick={() => onAction(item, 'DISMISS')} type="button">{labels.dismiss}</button></footer> : null}
    </section>
  </div>
}
