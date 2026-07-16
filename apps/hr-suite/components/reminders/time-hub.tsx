'use client'

import { Bell, Check, Clock3, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { Locale } from '@/lib/i18n/config'
import type { ReminderItem } from '@/lib/reminders/reminder-service'
import { formatReminderCountdown } from '@/lib/reminders/reminder-rules'

export interface TimeHubLabels {
  timeHub: string
  openAll: string
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
  const popup = due?.recipientId === closedPopupId ? null : due

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
            <Link className="block rounded-lg bg-sidebar-accent px-2.5 py-2 hover:brightness-110" href={`/reminders#${item.reminderId}`}>
              <span className="block truncate text-xs font-medium">{item.title}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[10px] text-sidebar-muted"><Clock3 aria-hidden="true" size={11} />{formatReminderCountdown(now, new Date(item.remindAt), locale)}</span>
            </Link>
          </li>)}
        </ul>
      )}
      <Link className="mt-2 inline-block text-xs font-medium text-sidebar-muted underline-offset-4 hover:text-sidebar-foreground hover:underline" href="/reminders">{labels.openAll}</Link>

      {popup ? (
        <div aria-labelledby="due-reminder-title" aria-modal="true" className="fixed inset-0 z-[80] grid place-items-center bg-sidebar/70 p-4" role="dialog">
          <div className="w-full max-w-md rounded-2xl border bg-surface p-5 text-foreground shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="eyebrow">{labels.dueTitle}</p><h2 className="mt-1 text-xl font-semibold" id="due-reminder-title">{popup.title}</h2></div>
              <button aria-label={labels.close} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" onClick={() => setClosedPopupId(popup.recipientId)} type="button"><EyeOff aria-hidden="true" size={18} /></button>
            </div>
            {popup.description ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{popup.description}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="button-primary gap-2" disabled={busy === popup.recipientId} onClick={() => void act(popup, 'COMPLETE')} type="button"><Check aria-hidden="true" size={16} />{labels.complete}</button>
              <button className="button-secondary" disabled={busy === popup.recipientId} onClick={() => void act(popup, 'SNOOZE')} type="button">{labels.snooze}</button>
              <button className="button-secondary" disabled={busy === popup.recipientId} onClick={() => void act(popup, 'DISMISS')} type="button">{labels.dismiss}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
