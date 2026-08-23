'use client'

import { Bell, Check, ExternalLink, RotateCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SectionHeader } from '@/components/patterns/section-header'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { buttonClasses, Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import type { TalentNotification } from '@/lib/talent/notification-service'
import { talentNotificationActionHref } from '@/lib/talent/overview-utils'

type NotificationLabels = {
  title: string
  intro: string
  empty: string
  loading?: string
  retry?: string
  markRead: string
  complete: string
  dismiss: string
  openAction?: string
  saved: string
  failed: string
  statusOpen?: string
  statusRead?: string
  statusDone?: string
  statusDismissed?: string
}

type NotificationStatus = 'OPEN' | 'READ' | 'DONE' | 'DISMISSED'

function statusLabel(status: NotificationStatus, labels: NotificationLabels): string {
  if (status === 'READ') return labels.statusRead ?? labels.title
  if (status === 'DONE') return labels.statusDone ?? labels.complete
  if (status === 'DISMISSED') return labels.statusDismissed ?? labels.dismiss
  return labels.statusOpen ?? labels.title
}

function statusTone(status: NotificationStatus): BadgeTone {
  if (status === 'DONE') return 'success'
  if (status === 'DISMISSED') return 'neutral'
  if (status === 'READ') return 'info'
  return 'warning'
}

export function TalentNotificationPanel({ labels }: { labels: NotificationLabels }) {
  const [notifications, setNotifications] = useState<TalentNotification[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function loadNotifications(): Promise<boolean> {
    setState('loading')
    try {
      const response = await fetch('/api/talent/notifications', { cache: 'no-store' })
      if (!response.ok) {
        setState('error')
        setMessage(labels.failed)
        return false
      }
      const payload = await response.json() as { data: TalentNotification[] }
      setNotifications(payload.data)
      setState('ready')
      return true
    } catch {
      setState('error')
      setMessage(labels.failed)
      return false
    }
  }

  useEffect(() => {
    let cancelled = false
    void fetch('/api/talent/notifications', { cache: 'no-store' }).then(async (response) => {
      if (cancelled) return
      if (!response.ok) {
        setState('error')
        setMessage(labels.failed)
        return
      }
      const payload = await response.json() as { data: TalentNotification[] }
      if (!cancelled) {
        setNotifications(payload.data)
        setState('ready')
      }
    }).catch(() => {
      if (!cancelled) {
        setState('error')
        setMessage(labels.failed)
      }
    })
    return () => { cancelled = true }
  }, [labels.failed])

  async function update(notification: TalentNotification, status: Exclude<NotificationStatus, 'OPEN'>) {
    if (pendingId) return
    setPendingId(notification.id)
    setMessage(null)
    try {
      const response = await fetch(`/api/talent/notifications/${notification.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      if (!response.ok) {
        setMessage(labels.failed)
        return
      }
      const loaded = await loadNotifications()
      if (loaded) setMessage(labels.saved)
    } catch {
      setMessage(labels.failed)
    } finally {
      setPendingId(null)
    }
  }

  const openCount = notifications.filter((notification) => notification.status === 'OPEN' || notification.status === 'READ').length

  return <section className="mt-6">
    <Surface className="p-4 sm:p-5">
      <SectionHeader actions={<Badge tone={openCount > 0 ? 'warning' : 'success'}>{openCount}</Badge>} description={labels.intro} title={labels.title} />
      {message ? <p aria-live="polite" className="mt-3 text-sm text-muted-foreground" role="status">{message}</p> : null}
      {state === 'loading' ? <EmptyState className="mt-4" icon={<RotateCw className="animate-spin" />} title={labels.loading ?? labels.intro} /> : state === 'error' ? <EmptyState actions={<Button onClick={() => { setMessage(null); void loadNotifications() }} size="sm" type="button" variant="secondary"><RotateCw />{labels.retry ?? labels.failed}</Button>} className="mt-4" icon={<Bell />} title={labels.failed} /> : notifications.length === 0 ? <EmptyState className="mt-4" icon={<Bell />} title={labels.empty} /> : <ul className="mt-4 grid gap-3">{notifications.map((notification) => {
        const action = talentNotificationActionHref(notification.event_type)
        const isPending = pendingId === notification.id
        return <li className="min-w-0 rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-4" key={notification.id}>
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h3 className="min-w-0 font-semibold">{notification.title}</h3><Badge tone={statusTone(notification.status as NotificationStatus)}>{statusLabel(notification.status as NotificationStatus, labels)}</Badge></div>
              <p className="mt-1 text-sm text-muted-foreground">{notification.summary}</p>
              <time className="mt-2 block text-xs text-muted-foreground" dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleDateString()}</time>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {action ? <a className={buttonClasses({ size: 'sm', variant: 'secondary' })} href={action}><ExternalLink aria-hidden="true" />{labels.openAction ?? labels.title}</a> : null}
              {notification.status === 'OPEN' ? <Button loading={isPending} onClick={() => void update(notification, 'READ')} size="sm" type="button" variant="secondary">{labels.markRead}</Button> : null}
              {notification.status !== 'DONE' && notification.status !== 'DISMISSED' ? <Button loading={isPending} onClick={() => void update(notification, 'DONE')} size="sm" type="button" variant="secondary"><Check aria-hidden="true" />{labels.complete}</Button> : null}
              {notification.status !== 'DONE' && notification.status !== 'DISMISSED' ? <Button loading={isPending} onClick={() => void update(notification, 'DISMISSED')} size="sm" type="button" variant="ghost"><X aria-hidden="true" />{labels.dismiss}</Button> : null}
            </div>
          </div>
        </li>
      })}</ul>}
    </Surface>
  </section>
}
