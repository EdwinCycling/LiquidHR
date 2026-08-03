'use client'

import { BellRing, CalendarClock, Check, CheckCheck, ChevronDown, CircleAlert, Clock3, Hand, LoaderCircle, Plus, Search, UserRound, X } from 'lucide-react'
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
  cancelReminder: string; delete: string; complete: string; saveComplete: string; dismiss: string; snoozeSingular: string; snoozePlural: string
  saveSnoozeSingular: string; saveSnoozePlural: string; decreaseSnoozeDays: string; increaseSnoozeDays: string
  save: string; deactivate: string; deleteConfirm: string
  created: string; failed: string; draft: string; publishedStatus: string; cancelled: string
  completed: string; dismissed: string; pending: string; noHrPermission: string
  filterOpen: string; filterAll: string; filterCompleted: string; filterOverdue: string
  sortSoonest: string; sortLatest: string; sortTitle: string; search: string; selectAll: string
  clearSelection: string; bulkComplete: string; moreInfo: string; employee: string; noResults: string; selectedCount: string; visibleCount: string; close: string; cancel: string
}

type ReminderFilter = 'OPEN' | 'ALL' | 'COMPLETED' | 'OVERDUE'

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
  const [filter, setFilter] = useState<ReminderFilter>('OPEN')
  const [sort, setSort] = useState<'SOONEST' | 'LATEST' | 'TITLE'>('SOONEST')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [detail, setDetail] = useState<ReminderItem | null>(null)
  const [managedDetail, setManagedDetail] = useState<ManagedReminder | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [openSection, setOpenSection] = useState<'personal' | 'hr'>('personal')

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

  async function recipientAction(item: ReminderItem, action: 'COMPLETE' | 'DISMISS' | 'SNOOZE', snoozeDays = 1) {
    setBusy(item.recipientId)
    const snoozeUntil = new Date()
    snoozeUntil.setDate(snoozeUntil.getDate() + snoozeDays)
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
    if (action === 'delete' && !window.confirm(labels.deleteConfirm)) return
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
    .filter((item) => filter === 'ALL' || (filter === 'OPEN' && item.recipientStatus === 'PENDING') || (filter === 'COMPLETED' && item.recipientStatus === 'COMPLETED') || (filter === 'OVERDUE' && item.recipientStatus === 'PENDING' && new Date(item.remindAt).getTime() < now.getTime()))
    .filter((item) => `${item.title} ${item.description ?? ''} ${item.employeeName ?? ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort((left, right) => sort === 'TITLE' ? left.title.localeCompare(right.title) : sort === 'LATEST' ? new Date(right.remindAt).getTime() - new Date(left.remindAt).getTime() : new Date(left.remindAt).getTime() - new Date(right.remindAt).getTime())

  const pendingVisible = visibleReminders.filter((item) => item.recipientStatus === 'PENDING')
  const visibleManaged = initialManaged
    .filter((item) => `${item.title} ${item.description ?? ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .filter((item) => filter === 'ALL' || (filter === 'OPEN' && item.status === 'PUBLISHED' && new Date(item.remindAt).getTime() >= now.getTime()) || (filter === 'OVERDUE' && item.status === 'PUBLISHED' && new Date(item.remindAt).getTime() < now.getTime()) || (filter === 'COMPLETED' && item.status === 'CANCELLED'))
    .sort((left, right) => sort === 'TITLE' ? left.title.localeCompare(right.title) : sort === 'LATEST' ? new Date(right.remindAt).getTime() - new Date(left.remindAt).getTime() : new Date(left.remindAt).getTime() - new Date(right.remindAt).getTime())
  const tone = (item: ReminderItem) => {
    if (item.recipientStatus !== 'PENDING') return 'border-border/70 bg-muted/50'
    const difference = new Date(item.remindAt).getTime() - now.getTime()
    if (difference < 0) return 'border-destructive/40 bg-destructive/5'
    if (difference < 86_400_000) return 'border-warning/40 bg-warning/5'
    return 'border-success/30 bg-success/5'
  }

  return (
    <div className="mt-7 space-y-3">
      <section className="rounded-2xl border bg-surface shadow-sm">
        <button aria-controls="reminder-section-personal" aria-expanded={openSection === 'personal'} className="flex w-full items-center justify-between gap-3 p-5 text-left font-semibold" onClick={() => setOpenSection(openSection === 'personal' ? 'personal' : 'personal')} type="button"><span className="flex items-center gap-2"><BellRing aria-hidden="true" size={18} />{labels.personalList}</span><ChevronDown aria-hidden="true" className={`transition-transform ${openSection === 'personal' ? 'rotate-180' : ''}`} size={18} /></button>
        {openSection === 'personal' ? <div className="grid gap-6 border-t p-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.75fr)]" id="reminder-section-personal"><div>
        <section className="overflow-hidden rounded-3xl border bg-surface shadow-sm">
          <header className="border-b bg-gradient-to-br from-primary/10 via-surface to-surface px-5 py-5 sm:px-6">
            <p className="text-sm text-muted-foreground">{labels.visibleCount.replace('{count}', String(visibleReminders.length))}</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <label className="relative"><Search aria-hidden="true" className="absolute left-3 top-3.5 text-muted-foreground" size={16} /><span className="sr-only">{labels.search}</span><input className="form-field pl-9" onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} value={search} /></label>
              <label className="sr-only" htmlFor="reminder-filter">{labels.filterOpen}</label><select className="form-field" id="reminder-filter" onChange={(event) => setFilter(event.target.value as ReminderFilter)} value={filter}><option value="OPEN">{labels.filterOpen}</option><option value="ALL">{labels.filterAll}</option><option value="COMPLETED">{labels.filterCompleted}</option><option value="OVERDUE">{labels.filterOverdue}</option></select>
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
                <div className="mt-4 flex flex-wrap items-center gap-2 pl-7"><button className="button-secondary min-h-9" onClick={() => setDetail(item)} type="button">{labels.moreInfo}</button>{item.employeeId && item.employeeName ? <Link className="text-sm font-semibold text-accent-foreground hover:underline" href={`/employees/${item.employeeId}`}>{item.employeeName}</Link> : null}{item.recipientStatus === 'PENDING' ? <><button className="button-primary min-h-9 gap-2" disabled={busy === item.recipientId} onClick={() => void recipientAction(item, 'COMPLETE')} type="button"><Check aria-hidden="true" size={15} />{labels.complete}</button><button className="button-secondary min-h-9" disabled={busy === item.recipientId} onClick={() => void recipientAction(item, 'SNOOZE', 1)} type="button">{labels.snoozeSingular.replace('{days}', '1')}</button><button className="button-secondary min-h-9" disabled={busy === item.recipientId} onClick={() => void recipientAction(item, 'DISMISS')} type="button">{labels.dismiss}</button></> : null}</div>
              </article>
            </li>
          ))}</ul>}
        </section>

      </div>

      {detail ? <ReminderDetailModal busy={busy === detail.recipientId} item={detail} labels={labels} locale={locale} dateFormat={dateFormat} timeFormat={timeFormat} onAction={(item, action, snoozeDays) => void recipientAction(item, action, snoozeDays)} onClose={() => { setDetail(null); router.refresh() }} /> : null}
      <ReminderForm busy={busy === 'PERSONAL'} labels={labels} onSubmit={(form) => void submitReminder(form, 'PERSONAL')} title={labels.newPersonal} />
        </div> : null}
      </section>

      {canManageHr ? <section className="rounded-2xl border bg-surface shadow-sm">
        <button aria-controls="reminder-section-hr" aria-expanded={openSection === 'hr'} className="flex w-full items-center justify-between gap-3 p-5 text-left font-semibold" onClick={() => setOpenSection(openSection === 'hr' ? 'personal' : 'hr')} type="button"><span className="flex items-center gap-2"><BellRing aria-hidden="true" size={18} />{labels.hrList}</span><span className="flex items-center gap-2 text-sm text-muted-foreground">{labels.visibleCount.replace('{count}', String(visibleManaged.length))}<ChevronDown aria-hidden="true" className={`transition-transform ${openSection === 'hr' ? 'rotate-180' : ''}`} size={18} /></span></button>
        {openSection === 'hr' ? <div className="grid gap-6 border-t p-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.75fr)]" id="reminder-section-hr">
          <section>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><label className="relative"><Search aria-hidden="true" className="absolute left-3 top-3.5 text-muted-foreground" size={16} /><span className="sr-only">{labels.search}</span><input className="form-field pl-9" onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} value={search} /></label><label className="sr-only" htmlFor="hr-reminder-filter">{labels.filterOpen}</label><select className="form-field" id="hr-reminder-filter" onChange={(event) => setFilter(event.target.value as ReminderFilter)} value={filter}><option value="OPEN">{labels.filterOpen}</option><option value="ALL">{labels.filterAll}</option><option value="COMPLETED">{labels.filterCompleted}</option><option value="OVERDUE">{labels.filterOverdue}</option></select><label className="sr-only" htmlFor="hr-reminder-sort">{labels.sortSoonest}</label><select className="form-field" id="hr-reminder-sort" onChange={(event) => setSort(event.target.value as typeof sort)} value={sort}><option value="SOONEST">{labels.sortSoonest}</option><option value="LATEST">{labels.sortLatest}</option><option value="TITLE">{labels.sortTitle}</option></select></div>
        {visibleManaged.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{labels.noResults}</p> : <ul className="mt-4 space-y-3">{visibleManaged.map((item) => <li key={item.id}><button className="group flex w-full items-center justify-between gap-3 rounded-xl border bg-surface-raised p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30" onClick={() => setManagedDetail(item)} type="button"><div className="min-w-0"><h3 className="truncate font-semibold">{item.title}</h3><p className="mt-1 text-xs text-muted-foreground">{hrStatusLabel(item.status)} · {formatDateTime(item.remindAt, { locale, dateFormat, timeFormat })}</p>{item.description ? <p className="mt-2 truncate text-sm text-muted-foreground">{item.description}</p> : null}</div><Hand aria-hidden="true" className="shrink-0 text-muted-foreground transition-colors group-hover:text-primary" size={18} /></button></li>
            )}</ul>}
          </section>
          <ReminderForm busy={busy === 'HR'} labels={labels} onSubmit={(form) => void submitReminder(form, 'HR')} title={labels.newHr}>
            <label className="block text-sm font-medium">{labels.targetLabel}<select className="form-field mt-1" name="targetType" onChange={(event) => setTargetType(event.target.value as typeof targetType)} value={targetType}><option value="EVERYONE">{labels.everyone}</option><option value="DEPARTMENTS">{labels.departments}</option><option value="EMPLOYEES">{labels.employees}</option></select></label>
            {targetType !== 'EVERYONE' ? <label className="block text-sm font-medium">{targetType === 'DEPARTMENTS' ? labels.departments : labels.employees}<select className="form-field mt-1 min-h-36" multiple name="targetIds" required>{(targetType === 'DEPARTMENTS' ? targetOptions.departments : targetOptions.employees).map((option) => <option key={option.id} value={option.id}>{'employeeNumber' in option ? `${option.employeeNumber} · ${option.name}` : option.name}</option>)}</select></label> : null}
          </ReminderForm>
        </div> : null}
      </section> : null}
      {managedDetail ? <ManagedReminderDetailModal busy={busy === managedDetail.id} item={managedDetail} labels={labels} locale={locale} dateFormat={dateFormat} timeFormat={timeFormat} onClose={() => setManagedDetail(null)} onSave={async (input) => { setBusy(managedDetail.id); const response = await fetch(`/api/reminders/${managedDetail.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }); setBusy(null); if (!response.ok) { setFeedback(labels.failed); return } setManagedDetail(null); router.refresh() }} onAction={async (action) => { await reminderAction(managedDetail.id, action); setManagedDetail(null) }} /> : null}
      {feedback ? <p className="rounded-xl border bg-surface px-4 py-3 text-sm" role="status">{feedback}</p> : null}
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

function localDateTimeValue(value: string): string {
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

function ManagedReminderDetailModal({ busy, item, labels, locale, dateFormat, timeFormat, onAction, onClose, onSave }: {
  busy: boolean
  item: ManagedReminder
  labels: ReminderCenterLabels
  locale: string
  dateFormat: DateFormat
  timeFormat: TimeFormat
  onAction: (action: 'delete' | 'publish' | 'cancel') => Promise<void>
  onClose: () => void
  onSave: (input: { title: string; description: string; remindAt: string }) => Promise<void>
}) {
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  const [remindAt, setRemindAt] = useState(localDateTimeValue(item.remindAt))

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function save() {
    const parsedDate = new Date(remindAt)
    if (!title.trim() || Number.isNaN(parsedDate.getTime())) return
    await onSave({ title: title.trim(), description: description.trim(), remindAt: parsedDate.toISOString() })
  }

  return <div aria-labelledby="managed-reminder-detail-heading" aria-modal="true" className="fixed inset-0 z-[80] grid place-items-center bg-sidebar/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }} role="dialog">
    <section className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl border bg-surface shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-start justify-between gap-4 border-b bg-gradient-to-br from-primary/10 via-surface to-surface p-5 sm:p-6">
        <div><p className="eyebrow">{labels.hr}</p><h2 className="mt-1 text-xl font-semibold" id="managed-reminder-detail-heading">{item.title}</h2></div>
        <button aria-label={labels.close} className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose} type="button"><X aria-hidden="true" size={18} /></button>
      </header>
      <div className="space-y-4 p-5 sm:p-6">
        <div className="rounded-2xl border bg-muted/40 p-4 text-sm"><p className="font-semibold">{item.status === 'DRAFT' ? labels.draft : item.status === 'PUBLISHED' ? labels.publishedStatus : labels.cancelled}</p><p className="mt-1 text-muted-foreground">{formatDateTime(item.remindAt, { locale, dateFormat, timeFormat })}</p></div>
        <label className="block text-sm font-medium">{labels.titleLabel}<input className="form-field mt-1" maxLength={160} onChange={(event) => setTitle(event.target.value)} required value={title} /></label>
        <label className="block text-sm font-medium">{labels.descriptionLabel}<textarea className="form-field mt-1 min-h-24" maxLength={2000} onChange={(event) => setDescription(event.target.value)} value={description} /></label>
        <label className="block text-sm font-medium">{labels.dateTimeLabel}<input className="form-field mt-1" onChange={(event) => setRemindAt(event.target.value)} required type="datetime-local" value={remindAt} /></label>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 p-5 sm:p-6">
        <div className="flex flex-wrap gap-2"><button className="button-secondary" disabled={busy} onClick={() => void onAction('delete')} type="button">{labels.delete}</button>{item.status === 'PUBLISHED' ? <button className="button-secondary" disabled={busy} onClick={() => void onAction('cancel')} type="button">{labels.deactivate}</button> : null}</div>
        <div className="flex flex-wrap justify-end gap-2"><button className="button-secondary" disabled={busy} onClick={onClose} type="button">{labels.cancel}</button>{item.status === 'DRAFT' ? <button className="button-secondary" disabled={busy} onClick={() => void onAction('publish')} type="button">{labels.publish}</button> : null}<button className="button-primary" disabled={busy || !title.trim() || !remindAt} onClick={() => void save()} type="button">{labels.save}</button></div>
      </footer>
    </section>
  </div>
}

function ReminderDetailModal({ busy, item, labels, locale, dateFormat, timeFormat, onAction, onClose }: { busy: boolean; item: ReminderItem; labels: ReminderCenterLabels; locale: string; dateFormat: DateFormat; timeFormat: TimeFormat; onAction: (item: ReminderItem, action: 'COMPLETE' | 'DISMISS' | 'SNOOZE', snoozeDays?: number) => void; onClose: () => void }) {
  const [snoozeDays, setSnoozeDays] = useState(1)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return <div aria-labelledby="reminder-detail-heading" aria-modal="true" className="fixed inset-0 z-[80] grid place-items-center bg-sidebar/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }} role="dialog">
    <section className="w-full max-w-lg overflow-hidden rounded-3xl border bg-surface shadow-[0_1.5rem_4.5rem_color-mix(in_srgb,var(--primary)_20%,transparent)]" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-start justify-between gap-4 border-b bg-gradient-to-br from-primary/10 via-surface to-surface p-5 sm:p-6"><div><p className="eyebrow">{labels.moreInfo}</p><h2 className="mt-1 text-xl font-semibold" id="reminder-detail-heading">{item.title}</h2></div><button aria-label={labels.close} className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose} type="button"><X aria-hidden="true" size={18} /></button></header>
      <div className="space-y-5 p-5 sm:p-6"><div className="flex flex-wrap gap-2"><span className="status-chip bg-muted"><BellRing aria-hidden="true" size={14} />{item.type === 'HR' ? labels.hr : labels.personal}</span><span className="status-chip bg-muted"><Clock3 aria-hidden="true" size={14} />{formatReminderCountdown(new Date(), new Date(item.remindAt), locale)}</span></div><div className="rounded-2xl border bg-muted/40 p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{labels.dateTimeLabel}</p><p className="mt-1 font-semibold">{formatDateTime(item.remindAt, { locale, dateFormat, timeFormat })}</p></div>{item.description ? <p className="text-sm leading-6 text-muted-foreground">{item.description}</p> : <p className="flex items-center gap-2 text-sm text-muted-foreground"><CircleAlert aria-hidden="true" size={16} />{labels.noResults}</p>}{item.employeeId && item.employeeName ? <Link className="flex items-center gap-3 rounded-2xl border p-4 font-semibold hover:bg-muted" href={`/employees/${item.employeeId}`} onClick={onClose}><UserRound aria-hidden="true" size={18} />{item.employeeName}<span className="ml-auto text-accent-foreground">→</span></Link> : null}</div>
      {item.recipientStatus === 'PENDING' ? <><footer className="border-t p-5 sm:p-6"><div className="flex flex-col items-end gap-3"><button className="button-secondary min-h-10" disabled={busy} onClick={() => void onAction(item, 'DISMISS')} type="button">{labels.dismiss}</button><div className="flex gap-2"><button aria-label={labels.decreaseSnoozeDays} className="button-secondary min-h-10 px-3" disabled={busy || snoozeDays <= 1} onClick={() => setSnoozeDays((days) => Math.max(1, days - 1))} type="button">−</button><button className="button-secondary min-h-10" disabled={busy} onClick={() => onAction(item, 'SNOOZE', snoozeDays)} type="button">{(snoozeDays === 1 ? labels.saveSnoozeSingular : labels.saveSnoozePlural).replace('{days}', String(snoozeDays))}</button><button aria-label={labels.increaseSnoozeDays} className="button-secondary min-h-10 px-3" disabled={busy || snoozeDays >= 99} onClick={() => setSnoozeDays((days) => Math.min(99, days + 1))} type="button">+</button></div><button className="button-primary min-h-11 w-full justify-center gap-2" disabled={busy} onClick={() => onAction(item, 'COMPLETE')} type="button"><Check aria-hidden="true" size={16} />{labels.saveComplete}</button></div></footer><div className="flex justify-end border-t bg-muted/30 px-5 py-3 sm:px-6"><button className="min-h-10 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={onClose} type="button">{labels.cancel}</button></div></> : null}
    </section>
  </div>
}
