'use client'

import { Bell, Building2, Check, Clock3, EyeOff, ExternalLink, UserRound, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Locale } from '@/lib/i18n/config'
import type { ReminderItem } from '@/lib/reminders/reminder-service'
import { formatReminderCountdown } from '@/lib/reminders/reminder-rules'
import { formatDateTime } from '@/lib/preferences/formatters'
import type { DateFormat, TimeFormat } from '@/lib/preferences/user-preferences'

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
  dateFormat: DateFormat
  timeFormat: TimeFormat
}

export function TimeHub({ collapsed, initialReminders, labels, locale, dateFormat, timeFormat }: TimeHubProps) {
  const router = useRouter()
  const [now, setNow] = useState(() => new Date())
  const [removedRecipientIds, setRemovedRecipientIds] = useState<ReadonlySet<string>>(() => new Set())
  const [snoozedTimes, setSnoozedTimes] = useState<Readonly<Record<string, string>>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [closedPopupId, setClosedPopupId] = useState<string | null>(null)
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null)
  const reminderButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

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
            <button className="block w-full rounded-lg bg-sidebar-accent px-2.5 py-2 text-left transition-[filter,background-color] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground" onClick={() => setSelectedRecipientId(item.recipientId)} ref={(element) => { reminderButtonRefs.current[item.recipientId] = element }} type="button">
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
          dateFormat={dateFormat}
          timeFormat={timeFormat}
          onAction={act}
          onClose={() => {
            const recipientId = selectedRecipientId
            setSelectedRecipientId(null)
            if (automaticDue?.recipientId === popup.recipientId) setClosedPopupId(popup.recipientId)
            if (recipientId) window.requestAnimationFrame(() => reminderButtonRefs.current[recipientId]?.focus())
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
  dateFormat,
  timeFormat,
  onAction,
  onClose,
}: {
  busy: boolean
  item: ReminderItem
  labels: TimeHubLabels
  locale: Locale
  dateFormat: DateFormat
  timeFormat: TimeFormat
  onAction: (item: ReminderItem, action: 'COMPLETE' | 'DISMISS' | 'SNOOZE') => Promise<void>
  onClose: () => void
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const scheduledAt = formatDateTime(item.remindAt, { locale, dateFormat, timeFormat })
  const typeIcon = item.type === 'HR' ? Building2 : UserRound
  const TypeIcon = typeIcon

  function trapFocus(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')
    if (!focusable || focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div aria-describedby="reminder-detail-description" aria-labelledby="reminder-detail-title" aria-modal="true" className="fixed inset-0 z-[80] grid place-items-center bg-sidebar/70 p-4 backdrop-blur-sm" role="dialog">
      <section className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-surface/90 p-1 text-foreground shadow-[0_1.5rem_4.5rem_color-mix(in_srgb,var(--primary)_20%,transparent)] backdrop-blur-xl sm:p-1.5" onKeyDown={trapFocus} ref={dialogRef}>
        <div className="rounded-[calc(var(--radius)*2.5)] border border-border/60 bg-surface/80 p-5 sm:p-6">
        <header className="flex items-start justify-between gap-4 border-b border-border/60 pb-4">
          <div className="min-w-0">
            <p className="eyebrow">{labels.dueTitle}</p>
            <h2 className="mt-1 truncate text-xl font-semibold" id="reminder-detail-title">{item.title}</h2>
          </div>
          <button aria-label={labels.close} className="grid size-9 shrink-0 place-items-center border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={onClose} ref={closeButtonRef} type="button"><X aria-hidden="true" size={18} /></button>
        </header>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-surface-raised/75 p-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-2 py-1 text-xs font-semibold text-foreground"><TypeIcon aria-hidden="true" size={13} />{item.type}</span>
            <span className="h-4 border-l border-border/70" aria-hidden="true" />
            <span className="flex min-w-0 items-center gap-1.5"><Clock3 aria-hidden="true" size={16} /><time className="truncate tabular-nums" dateTime={item.remindAt}>{scheduledAt} · {formatReminderCountdown(new Date(), new Date(item.remindAt), locale)}</time></span>
          </div>
          {item.description ? <p className="text-sm leading-6 text-muted-foreground" id="reminder-detail-description">{item.description}</p> : <p className="sr-only" id="reminder-detail-description">{item.title}</p>}
        </div>

        <footer className="mt-6 border-t border-border/60 pt-4">
          <button className="button-primary min-h-11 w-full justify-center gap-2" disabled={busy} onClick={() => void onAction(item, 'COMPLETE')} type="button"><Check aria-hidden="true" size={16} />{labels.complete}</button>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button className="button-secondary min-h-10 justify-center" disabled={busy} onClick={() => void onAction(item, 'SNOOZE')} type="button">{labels.snooze}</button>
            <button className="button-secondary min-h-10 justify-center" disabled={busy} onClick={() => void onAction(item, 'DISMISS')} type="button">{labels.dismiss}</button>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Link className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-accent-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={`/reminders#${item.reminderId}`} onClick={onClose}><ExternalLink aria-hidden="true" size={16} />{labels.openManagement}</Link>
            <button className="min-h-10 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={onClose} type="button"><EyeOff aria-hidden="true" className="mr-1 inline" size={15} />{labels.close}</button>
          </div>
        </footer>
        </div>
      </section>
    </div>
  )
}
