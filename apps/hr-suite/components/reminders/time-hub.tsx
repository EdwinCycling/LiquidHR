'use client'

import { Building2, Check, Clock3, ExternalLink, UserRound, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Locale } from '@/lib/i18n/config'
import type { ReminderItem } from '@/lib/reminders/reminder-service'
import { formatReminderCountdown, formatReminderDaysUntil } from '@/lib/reminders/reminder-rules'
import { formatDateTime } from '@/lib/preferences/formatters'
import type { DateFormat, TimeFormat } from '@/lib/preferences/user-preferences'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { IconButton } from '@/components/ui/icon-button'
import { Surface } from '@/components/ui/surface'

export interface TimeHubLabels {
  timeHub: string
  openManagement: string
  openAction: string
  pendingCount: string
  moreReminders: string
  empty: string
  nextReminder: string
  upcomingTitle: string
  overdueTitle: string
  noUpcoming: string
  noOverdue: string
  dueTitle: string
  personal: string
  hr: string
  complete: string
  saveComplete: string
  dismiss: string
  snoozeSingular: string
  snoozePlural: string
  saveSnoozeSingular: string
  saveSnoozePlural: string
  decreaseSnoozeDays: string
  increaseSnoozeDays: string
  cancel: string
  close: string
}

interface TimeHubProps {
  collapsed: boolean
  compact?: boolean
  initialReminders: ReminderItem[]
  labels: TimeHubLabels
  locale: Locale
  dateFormat: DateFormat
  timeFormat: TimeFormat
}

export function TimeHub({ collapsed, compact = false, initialReminders, labels, locale, dateFormat, timeFormat }: TimeHubProps) {
  const router = useRouter()
  const [now, setNow] = useState(() => new Date())
  const [removedRecipientIds, setRemovedRecipientIds] = useState<ReadonlySet<string>>(() => new Set())
  const [snoozedTimes, setSnoozedTimes] = useState<Readonly<Record<string, string>>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [automaticPopupId, setAutomaticPopupId] = useState<string | null>(null)
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [panelSection, setPanelSection] = useState<'upcoming' | 'overdue'>('upcoming')
  const [panelPosition, setPanelPosition] = useState({ left: 12, top: 12 })
  const isMounted = useSyncExternalStore(() => () => undefined, () => true, () => false)
  const pendingRef = useRef<ReminderItem[]>([])
  const lastObservedTimeRef = useRef(new Date())

  useEffect(() => {
    const timer = window.setInterval(() => {
      const currentTime = new Date()
      const crossedReminder = pendingRef.current.find((item) => {
        const remindAt = new Date(item.remindAt).getTime()
        return remindAt > lastObservedTimeRef.current.getTime() && remindAt <= currentTime.getTime()
      })
      if (crossedReminder) setAutomaticPopupId(crossedReminder.recipientId)
      lastObservedTimeRef.current = currentTime
      setNow(currentTime)
    }, 1_000)
    return () => window.clearInterval(timer)
  }, [])

  const pending = useMemo(() => initialReminders
    .filter((item) => !removedRecipientIds.has(item.recipientId))
    .map((item) => snoozedTimes[item.recipientId] ? { ...item, remindAt: snoozedTimes[item.recipientId] } : item)
    .filter((item) => item.recipientStatus === 'PENDING' && item.reminderStatus === 'PUBLISHED'),
  [initialReminders, removedRecipientIds, snoozedTimes])

  useEffect(() => {
    pendingRef.current = pending
  }, [pending])

  const upcoming = pending.filter((item) => new Date(item.remindAt).getTime() > now.getTime()).sort((left, right) => new Date(left.remindAt).getTime() - new Date(right.remindAt).getTime())
  const nextUpcoming = upcoming[0] ?? null
  const upcomingSevenDays = upcoming.filter((item) => new Date(item.remindAt).getTime() <= now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const overdue = pending.filter((item) => new Date(item.remindAt).getTime() <= now.getTime()).sort((left, right) => new Date(right.remindAt).getTime() - new Date(left.remindAt).getTime())
  const selected = selectedRecipientId ? pending.find((item) => item.recipientId === selectedRecipientId) ?? null : null
  const automaticDue = automaticPopupId ? pending.find((item) => item.recipientId === automaticPopupId) ?? null : null
  const popup = selected ?? automaticDue ?? null

  async function act(item: ReminderItem, action: 'COMPLETE' | 'DISMISS' | 'SNOOZE', snoozeDays = 1): Promise<void> {
    setBusy(item.recipientId)
    const snoozeUntil = new Date()
    snoozeUntil.setDate(snoozeUntil.getDate() + snoozeDays)
    const body = action === 'SNOOZE'
      ? { action, remindAt: snoozeUntil.toISOString() }
      : { action }
    const response = await fetch(`/api/reminder-recipients/${item.recipientId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    if (response.ok) {
      if (action === 'SNOOZE') setSnoozedTimes((current) => ({ ...current, [item.recipientId]: snoozeUntil.toISOString() }))
      else setRemovedRecipientIds((current) => new Set([...current, item.recipientId]))
      setAutomaticPopupId(null)
      setSelectedRecipientId(null)
      router.refresh()
    }
    setBusy(null)
  }

  function togglePanel(section: 'upcoming' | 'overdue', event: MouseEvent<HTMLButtonElement>): void {
    if (isOpen && panelSection === section) {
      setIsOpen(false)
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const panelWidth = Math.min(384, window.innerWidth - 24)
    const panelHeight = Math.min(440, window.innerHeight - 24)
    const preferredLeft = rect.right + 12
    const left = preferredLeft + panelWidth <= window.innerWidth - 12
      ? preferredLeft
      : Math.max(12, rect.left - panelWidth - 12)
    const preferredTop = rect.bottom + 12
    const top = preferredTop + panelHeight <= window.innerHeight - 12
      ? preferredTop
      : Math.max(12, rect.top - panelHeight - 12)
    setPanelPosition({ left, top })
    setPanelSection(section)
    setIsOpen(true)
  }

  function selectReminder(recipientId: string): void {
    setSelectedRecipientId(recipientId)
    setIsOpen(false)
  }

  return (
    <div className={`relative flex min-w-0 items-center gap-1.5 ${collapsed ? '' : 'flex-1 justify-end'}`}>
      {!collapsed && !compact && nextUpcoming ? <Button aria-label={`${labels.nextReminder}: ${nextUpcoming.title}, ${formatReminderDaysUntil(now, new Date(nextUpcoming.remindAt), locale)}`} className="relative max-w-52 -rotate-1 whitespace-normal border border-warning/40 bg-warning-surface px-3 py-2 text-left text-warning shadow-[0_.35rem_1rem_color-mix(in_srgb,var(--warning)_22%,transparent)] transition hover:rotate-0 hover:shadow-[0_.5rem_1.15rem_color-mix(in_srgb,var(--warning)_28%,transparent)] focus-visible:rotate-0" onClick={() => selectReminder(nextUpcoming.recipientId)} size="sm" type="button" variant="ghost"><span className="pointer-events-none absolute -top-1 left-1/2 h-3 w-10 -translate-x-1/2 -rotate-2 rounded-sm bg-warning/20" /><span className="block break-words text-xs font-semibold leading-4">{nextUpcoming.title}</span><span className="mt-1 block text-[10px] font-medium text-warning/75">{formatReminderDaysUntil(now, new Date(nextUpcoming.remindAt), locale)}</span></Button> : null}
      <div className="flex shrink-0 flex-col items-end gap-1">
        <IconButton aria-controls={isOpen && panelSection === 'upcoming' ? 'time-hub-panel' : undefined} aria-expanded={isOpen && panelSection === 'upcoming'} className={`${collapsed ? 'size-11' : 'size-9'} text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground`} label={`${labels.upcomingTitle}: ${upcomingSevenDays.length}`} onClick={(event) => togglePanel('upcoming', event)} size="sm" type="button" variant="ghost"><Clock3 aria-hidden="true" /></IconButton>
        {upcomingSevenDays.length > 0 ? <Badge className="pointer-events-none absolute right-0 top-0 min-w-4 justify-center border-0 bg-primary px-1 text-[10px] font-bold text-primary-foreground" tone="info">{Math.min(upcomingSevenDays.length, 99)}</Badge> : null}
        {overdue.length > 0 ? <><IconButton aria-controls={isOpen && panelSection === 'overdue' ? 'time-hub-panel' : undefined} aria-expanded={isOpen && panelSection === 'overdue'} className={`${collapsed ? 'size-11' : 'size-9'} text-red-200 hover:bg-red-400/15 hover:text-red-100`} label={`${labels.overdueTitle}: ${overdue.length}`} onClick={(event) => togglePanel('overdue', event)} size="sm" type="button" variant="ghost"><Clock3 aria-hidden="true" /></IconButton><Badge className="pointer-events-none absolute right-0 top-9 min-w-4 justify-center border-0 bg-destructive px-1 text-[10px] font-bold text-primary-foreground" tone="danger">{Math.min(overdue.length, 99)}</Badge></> : null}
      </div>

      {isMounted && isOpen ? createPortal(<section aria-label={labels.timeHub} className="fixed z-[9990] w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground shadow-[0_1.5rem_4rem_color-mix(in_srgb,var(--sidebar)_55%,transparent)]" id="time-hub-panel" style={panelPosition}>
        <header className="flex items-center justify-between gap-3 border-b border-sidebar-border pb-3">
          <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-sidebar-muted">{labels.timeHub}</p><p className="mt-1 text-sm font-semibold">{labels.pendingCount.replace('{count}', String(pending.length))}</p></div>
          <div className="flex items-center gap-2">
            <Link className={buttonClasses({ className: 'bg-sidebar-accent text-sidebar-foreground hover:brightness-110', size: 'sm', variant: 'secondary' })} href="/reminders" onClick={() => setIsOpen(false)}>{labels.openManagement}</Link>
            <IconButton className="text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground" label={labels.close} onClick={() => setIsOpen(false)} size="sm" type="button" variant="ghost"><X aria-hidden="true" /></IconButton>
          </div>
        </header>
        {panelSection === 'upcoming' ? <ReminderPanelSection icon={<Clock3 aria-hidden="true" size={15} />} title={labels.upcomingTitle} empty={labels.noUpcoming} items={upcomingSevenDays} nextItem={nextUpcoming} nextLabel={labels.nextReminder} now={now} locale={locale} onSelect={selectReminder} /> : <ReminderPanelSection icon={<Clock3 aria-hidden="true" className="text-red-200" size={15} />} title={labels.overdueTitle} empty={labels.noOverdue} items={overdue} now={now} locale={locale} onSelect={selectReminder} overdue />}
      </section>, document.body) : null}

      {isMounted && popup ? <ReminderDetailDialog busy={busy === popup.recipientId} dateFormat={dateFormat} item={popup} labels={labels} locale={locale} onAction={act} onClose={() => { setSelectedRecipientId(null); setIsOpen(false); router.refresh(); if (automaticDue?.recipientId === popup.recipientId) setAutomaticPopupId(null) }} timeFormat={timeFormat} /> : null}
    </div>
  )
}

function ReminderPanelSection({ icon, title, empty, items, nextItem, nextLabel, now, locale, onSelect, overdue = false }: { icon: ReactNode; title: string; empty: string; items: ReminderItem[]; nextItem?: ReminderItem | null; nextLabel?: string; now: Date; locale: Locale; onSelect: (recipientId: string) => void; overdue?: boolean }) {
  const listItems = items.filter((item) => item.recipientId !== nextItem?.recipientId)
  return <div className="mt-3">
    <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] ${overdue ? 'text-red-200' : 'text-sidebar-muted'}`}>{icon}<span>{title}</span><Badge className="ml-auto border-sidebar-border bg-sidebar-accent text-sidebar-muted" tone={overdue ? 'danger' : 'neutral'}>{items.length}</Badge></div>
    {nextItem ? <div className="mt-2"><p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[.1em] text-sidebar-muted">{nextLabel}</p><ReminderPanelItem item={nextItem} now={now} locale={locale} onSelect={onSelect} overdue={overdue} emphasized /></div> : null}
    {listItems.length > 0 ? <ul className="mt-2 space-y-1.5">{listItems.map((item) => <li key={item.recipientId}><ReminderPanelItem item={item} now={now} locale={locale} onSelect={onSelect} overdue={overdue} /></li>)}</ul> : null}
    {!nextItem && listItems.length === 0 ? <p className="px-1 py-5 text-xs text-sidebar-muted">{empty}</p> : null}
  </div>
}

function ReminderPanelItem({ item, now, locale, onSelect, overdue, emphasized = false }: { item: ReminderItem; now: Date; locale: Locale; onSelect: (recipientId: string) => void; overdue?: boolean; emphasized?: boolean }) {
  return <Button className={`block h-auto w-full justify-start rounded-xl px-3 py-2.5 text-left whitespace-normal transition-[filter,background-color] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground ${overdue ? 'bg-red-400/15 text-sidebar-foreground' : 'bg-sidebar-accent text-sidebar-foreground'} ${emphasized ? 'border border-sidebar-border' : ''}`} onClick={() => onSelect(item.recipientId)} size="sm" type="button" variant="ghost">
    <span className="block min-w-0 truncate text-xs font-medium">{item.title}</span>
    <span className={`mt-0.5 flex items-center gap-1 text-[10px] ${overdue ? 'text-red-200' : 'text-sidebar-muted'}`}><Clock3 aria-hidden="true" size={11} />{formatReminderCountdown(now, new Date(item.remindAt), locale)}</span>
  </Button>
}

function ReminderDetailDialog({ busy, item, labels, locale, dateFormat, timeFormat, onAction, onClose }: { busy: boolean; item: ReminderItem; labels: TimeHubLabels; locale: Locale; dateFormat: DateFormat; timeFormat: TimeFormat; onAction: (item: ReminderItem, action: 'COMPLETE' | 'DISMISS' | 'SNOOZE', snoozeDays?: number) => Promise<void>; onClose: () => void }) {
  const [snoozeDays, setSnoozeDays] = useState(1)
  const scheduledAt = formatDateTime(item.remindAt, { locale, dateFormat, timeFormat })
  const TypeIcon = item.type === 'HR' ? Building2 : UserRound

  return <Dialog closeLabel={labels.close} contentClassName="space-y-4" description={item.description ?? labels.dueTitle} onOpenChange={(open) => { if (!open) onClose() }} open title={item.title} footer={<>
    {item.recipientStatus === 'PENDING' ? <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><Button aria-label={labels.decreaseSnoozeDays} disabled={busy || snoozeDays <= 1} onClick={() => setSnoozeDays((days) => Math.max(1, days - 1))} size="sm" type="button" variant="secondary">−</Button><Button disabled={busy} onClick={() => void onAction(item, 'SNOOZE', snoozeDays)} size="sm" type="button" variant="secondary">{(snoozeDays === 1 ? labels.saveSnoozeSingular : labels.saveSnoozePlural).replace('{days}', String(snoozeDays))}</Button><Button aria-label={labels.increaseSnoozeDays} disabled={busy || snoozeDays >= 99} onClick={() => setSnoozeDays((days) => Math.min(99, days + 1))} size="sm" type="button" variant="secondary">+</Button></div><Button disabled={busy} loading={busy} onClick={() => void onAction(item, 'COMPLETE')} type="button"><Check aria-hidden="true" size={16} />{labels.saveComplete}</Button></div> : null}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-3">{item.actionUrl ? <Link className={buttonClasses({ className: 'text-accent-foreground', size: 'sm', variant: 'ghost' })} href={item.actionUrl} onClick={onClose}><ExternalLink aria-hidden="true" size={16} />{labels.openAction}</Link> : null}<Link className={buttonClasses({ className: 'text-accent-foreground', size: 'sm', variant: 'ghost' })} href={`/reminders#${item.reminderId}`} onClick={onClose}><ExternalLink aria-hidden="true" size={16} />{labels.openManagement}</Link></div><div className="flex flex-wrap gap-2">{item.recipientStatus === 'PENDING' ? <Button disabled={busy} onClick={() => void onAction(item, 'DISMISS')} size="sm" type="button" variant="secondary">{labels.dismiss}</Button> : null}<Button disabled={busy} onClick={onClose} size="sm" type="button" variant="secondary">{labels.cancel}</Button></div></div>
  </>}>
    <div className="flex flex-wrap items-center gap-2"><Badge tone={item.type === 'HR' ? 'info' : 'neutral'}><TypeIcon aria-hidden="true" size={14} />{item.type === 'HR' ? labels.hr : labels.personal}</Badge><Badge tone="warning"><Clock3 aria-hidden="true" size={14} />{formatReminderCountdown(new Date(), new Date(item.remindAt), locale)}</Badge></div>
    <Surface className="p-4" variant="subtle"><p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{labels.dueTitle}</p><p className="mt-1 font-semibold"><time dateTime={item.remindAt}>{scheduledAt}</time></p></Surface>
    {item.employeeId && item.employeeName ? <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href={`/employees/${item.employeeId}`} onClick={onClose}><UserRound aria-hidden="true" size={16} />{item.employeeName}</Link> : null}
    {item.description ? <p className="text-sm leading-6 text-muted-foreground">{item.description}</p> : null}
  </Dialog>
}
