'use client'

import { Bell, Check, Clock3, EyeOff, ExternalLink, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Locale } from '@/lib/i18n/config'
import type { ReminderItem } from '@/lib/reminders/reminder-service'
import { formatReminderCountdown } from '@/lib/reminders/reminder-rules'

export interface TimeHubLabels {
  timeHub: string
  openManagement: string
  pendingCount: string
  empty: string
  dueTitle: string
  complete: string
  dismiss: string
  snooze: string
  close: string
}

interface TimeHubProps {
  collapsed: boolean
  initialReminders: ReminderItem[]
  labels: TimeHubLabels
  locale: Locale
}

export function TimeHub({ collapsed, initialReminders, labels, locale }: TimeHubProps) {
  const router = useRouter()
  const [now, setNow] = useState(() => new Date())
  const [removedRecipientIds, setRemovedRecipientIds] = useState<ReadonlySet<string>>(() => new Set())
  const [snoozedTimes, setSnoozedTimes] = useState<Readonly<Record<string, string>>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [closedPopupId, setClosedPopupId] = useState<string | null>(null)
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  const pending = useMemo(() => initialReminders
    .filter((item) => !removedRecipientIds.has(item.recipientId))
    .map((item) => snoozedTimes[item.recipientId] ? { ...item, remindAt: snoozedTimes[item.recipientId] } : item)
    .filter((item) => item.recipientStatus === 'PENDING' && item.reminderStatus === 'PUBLISHED'),
  [initialReminders, removedRecipientIds, snoozedTimes])
  const visible = pending.slice(0, 3)
  const due = pending.find((item) => new Date(item.remindAt).getTime() <= now.getTime())
  const selected = selectedRecipientId ? pending.find((item) => item.recipientId === selectedRecipientId) ?? null : null
  const automaticDue = due?.recipientId === closedPopupId ? null : due
  const popup = selected ?? automaticDue ?? null

  async function act(item: ReminderItem, action: 'COMPLETE' | 'DISMISS' | 'SNOOZE') {
    setBusy(item.recipientId)
    const snoozeUntil = new Date()
    snoozeUntil.setMinutes(snoozeUntil.getMinutes() + 15)
    const body = action === 'SNOOZE'
      ? { action, remindAt: snoozeUntil.toISOString() }
      : { action }
    const response = await fetch(`/api/reminder-recipients/${item.recipientId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    if (response.ok) {
      if (action === 'SNOOZE') setSnoozedTimes((current) => ({ ...current, [item.recipientId]: snoozeUntil.toISOString() }))
      else setRemovedRecipientIds((current) => new Set([...current, item.recipientId]))
      setClosedPopupId(null)
      setSelectedRecipientId(null)
      router.refresh()
    }
    setBusy(null)
  }

  if (collapsed) {
    return (
      <Link aria-label={`${labels.timeHub}: ${labels.pendingCount.replace('{count}', String(pending.length))}`} className="relative grid size-10 place-items-center rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground" href="/reminders">
        <Bell aria-hidden="true" size={18} />
        {pending.length > 0 ? <span className="absolute right-0 top-0 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-bold text-primary-foreground">{Math.min(pending.length, 99)}</span> : null}
      </Link>
    )
  }

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sidebar-muted"><Bell aria-hidden="true" size={14} />{labels.timeHub}</span>
        <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-[10px] tabular-nums text-sidebar-muted">{pending.length}</span>
      </div>
      {visible.length === 0 ? <p className="text-xs text-sidebar-muted">{labels.empty}</p> : (
        <ul className="space-y-1.5">
          {visible.map((item) => <li key={item.recipientId}>
            <button className="block w-full rounded-lg bg-sidebar-accent px-2.5 py-2 text-left transition-[filter,background-color] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground" onClick={() => setSelectedRecipientId(item.recipientId)} type="button">
              <span className="block truncate text-xs font-medium">{item.title}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[10px] text-sidebar-muted"><Clock3 aria-hidden="true" size={11} />{formatReminderCountdown(now, new Date(item.remindAt), locale)}</span>
            </button>
          </li>)}
        </ul>
      )}
      <Link className="mt-2 inline-block text-xs font-medium text-sidebar-muted underline-offset-4 hover:text-sidebar-foreground hover:underline" href="/reminders">{labels.openManagement}</Link>

      {popup ? (
        <ReminderDetailDialog
          busy={busy === popup.recipientId}
          item={popup}
          labels={labels}
          locale={locale}
          onAction={act}
          onClose={() => {
            setSelectedRecipientId(null)
            if (automaticDue?.recipientId === popup.recipientId) setClosedPopupId(popup.recipientId)
          }}
        />
      ) : null}
    </div>
  )
}

function ReminderDetailDialog({
  busy,
  item,
  labels,
  locale,
  onAction,
  onClose,
}: {
  busy: boolean
  item: ReminderItem
  labels: TimeHubLabels
  locale: Locale
  onAction: (item: ReminderItem, action: 'COMPLETE' | 'DISMISS' | 'SNOOZE') => Promise<void>
  onClose: () => void
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const scheduledAt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.remindAt))

  return (
    <div aria-describedby="reminder-detail-description" aria-labelledby="reminder-detail-title" aria-modal="true" className="fixed inset-0 z-[80] grid place-items-center bg-sidebar/70 p-4" role="dialog">
      <section className="w-full max-w-md border border-border/80 bg-surface p-5 text-foreground shadow-2xl sm:p-6">
        <header className="flex items-start justify-between gap-4 border-b border-border/70 pb-4">
          <div className="min-w-0">
            <p className="eyebrow">{labels.dueTitle}</p>
            <h2 className="mt-1 truncate text-xl font-semibold" id="reminder-detail-title">{item.title}</h2>
          </div>
          <button aria-label={labels.close} className="grid size-9 shrink-0 place-items-center border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={onClose} ref={closeButtonRef} type="button"><X aria-hidden="true" size={18} /></button>
        </header>

        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock3 aria-hidden="true" size={16} /><time className="tabular-nums" dateTime={item.remindAt}>{scheduledAt} · {formatReminderCountdown(new Date(), new Date(item.remindAt), locale)}</time></div>
          {item.description ? <p className="text-sm leading-6 text-muted-foreground" id="reminder-detail-description">{item.description}</p> : <p className="sr-only" id="reminder-detail-description">{item.title}</p>}
        </div>

        <footer className="mt-6 grid gap-2 sm:grid-cols-2">
          <button className="button-primary min-h-10 justify-center gap-2 sm:col-span-2" disabled={busy} onClick={() => void onAction(item, 'COMPLETE')} type="button"><Check aria-hidden="true" size={16} />{labels.complete}</button>
          <button className="button-secondary min-h-10 justify-center" disabled={busy} onClick={() => void onAction(item, 'SNOOZE')} type="button">{labels.snooze}</button>
          <button className="button-secondary min-h-10 justify-center" disabled={busy} onClick={() => void onAction(item, 'DISMISS')} type="button">{labels.dismiss}</button>
          <Link className="button-secondary min-h-10 justify-center gap-2 sm:col-span-2" href={`/reminders#${item.reminderId}`} onClick={onClose}><ExternalLink aria-hidden="true" size={16} />{labels.openManagement}</Link>
          <button className="min-h-10 justify-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={onClose} type="button"><EyeOff aria-hidden="true" className="mr-1 inline" size={15} />{labels.close}</button>
        </footer>
      </section>
    </div>
  )
}
