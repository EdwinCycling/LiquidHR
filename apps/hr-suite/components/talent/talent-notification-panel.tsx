'use client'

import { useEffect, useState } from 'react'
import type { TalentNotification } from '@/lib/talent/notification-service'

type NotificationLabels = {
  title: string
  intro: string
  empty: string
  markRead: string
  complete: string
  dismiss: string
  saved: string
  failed: string
}

export function TalentNotificationPanel({ labels }: { labels: NotificationLabels }) {
  const [notifications, setNotifications] = useState<TalentNotification[]>([])
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    const response = await fetch('/api/talent/notifications', { cache: 'no-store' })
    if (!response.ok) { setMessage(labels.failed); return }
    const payload = await response.json() as { data: TalentNotification[] }
    setNotifications(payload.data)
  }

  useEffect(() => {
    let cancelled = false
    void fetch('/api/talent/notifications', { cache: 'no-store' }).then(async (response) => {
      if (cancelled) return
      if (!response.ok) { setMessage(labels.failed); return }
      const payload = await response.json() as { data: TalentNotification[] }
      if (!cancelled) setNotifications(payload.data)
    }).catch(() => { if (!cancelled) setMessage(labels.failed) })
    return () => { cancelled = true }
  }, [labels.failed])

  async function update(notification: TalentNotification, status: 'READ' | 'DONE' | 'DISMISSED') {
    setMessage(null)
    const response = await fetch(`/api/talent/notifications/${notification.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (!response.ok) { setMessage(labels.failed); return }
    await load()
    setMessage(labels.saved)
  }

  return <section className="mt-6 rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.intro}</p></div>{message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}</div>{notifications.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{labels.empty}</p> : <ul className="mt-4 space-y-3">{notifications.map((notification) => <li className="rounded-xl border p-4" key={notification.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-medium">{notification.title}</h3><p className="mt-1 text-sm text-muted-foreground">{notification.summary}</p><time className="mt-2 block text-xs text-muted-foreground" dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleDateString('nl-NL')}</time></div><div className="flex flex-wrap gap-2">{notification.status === 'OPEN' ? <button className="button-secondary" onClick={() => void update(notification, 'READ')} type="button">{labels.markRead}</button> : null}{notification.status !== 'DONE' && notification.status !== 'DISMISSED' ? <button className="button-secondary" onClick={() => void update(notification, 'DONE')} type="button">{labels.complete}</button> : null}{notification.status !== 'DISMISSED' && notification.status !== 'DONE' ? <button className="button-secondary" onClick={() => void update(notification, 'DISMISSED')} type="button">{labels.dismiss}</button> : null}</div></div></li>)}</ul>}</section>
}
