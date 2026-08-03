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

export interface TimeHubLabels {
  timeHub: string
  openManagement: string
  pendingCount: string
  moreReminders: string
  empty: string
  nextReminder: string
  upcomingTitle: string
  overdueTitle: string
  noUpcoming: string
  noOverdue: string
  dueTitle: string
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
  const [automaticPopupId, setAutomaticPopupId] = useState<string | null>(null)
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [panelSection, setPanelSection] = useState<'upcoming' | 'overdue'>('upcoming')
  const [panelPosition, setPanelPosition] = useState({ left: 12, top: 12 })
  const isMounted = useSyncExternalStore(() => () => undefined, () => true, () => false)
  const reminderButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
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

  async function act(item: ReminderItem, action: 'COMPLETE' | 'DISMISS' | 'SNOOZE', snoozeDays = 1) {
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

  function togglePanel(section: 'upcoming' | 'overdue', event: MouseEvent<HTMLButtonElement>) {
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

  function selectReminder(recipientId: string) {
    setSelectedRecipientId(recipientId)
    setIsOpen(false)
  }

    return (
    <div className={`relative flex min-w-0 items-center gap-1.5 ${collapsed ? '' : 'flex-1 justify-end'}`}>
      {!collapsed && nextUpcoming ? <button aria-label={`${labels.nextReminder}: ${nextUpcoming.title}, ${formatReminderDaysUntil(now, new Date(nextUpcoming.remindAt), locale)}`} className="relative min-w-0 max-w-52 -rotate-1 rounded-md border border-warning/40 bg-warning-surface px-3 py-2 text-left text-warning shadow-[0_.35rem_1rem_color-mix(in_srgb,var(--warning)_22%,transparent)] transition hover:rotate-0 hover:shadow-[0_.5rem_1.15rem_color-mix(in_srgb,var(--warning)_28%,transparent)] focus-visible:rotate-0" onClick={() => selectReminder(nextUpcoming.recipientId)} type="button"><span aria-hidden="true" className="pointer-events-none absolute -top-1 left-1/2 h-3 w-10 -translate-x-1/2 -rotate-2 rounded-sm bg-warning/20" /><span className="block break-words text-xs font-semibold leading-4">{nextUpcoming.title}</span><span className="mt-1 block text-[10px] font-medium text-warning/75">{formatReminderDaysUntil(now, new Date(nextUpcoming.remindAt), locale)}</span></button> : null}
      <div className="flex shrink-0 flex-col items-end gap-1">
        <button aria-expanded={isOpen && panelSection === 'upcoming'} aria-label={`${labels.upcomingTitle}: ${upcomingSevenDays.length}`} className={`relative grid ${collapsed ? 'size-11' : 'size-9'} shrink-0 place-items-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground`} onClick={(event) => togglePanel('upcoming', event)} type="button"><Clock3 aria-hidden="true" size={17} />{upcomingSevenDays.length > 0 ? <span className="absolute right-0 top-0 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-bold text-primary-foreground">{Math.min(upcomingSevenDays.length, 99)}</span> : null}</button>
        {overdue.length > 0 ? <button aria-expanded={isOpen && panelSection === 'overdue'} aria-label={`${labels.overdueTitle}: ${overdue.length}`} className={`relative grid ${collapsed ? 'size-11' : 'size-9'} shrink-0 place-items-center rounded-lg text-red-300 transition-colors hover:bg-red-400/15 hover:text-red-200`} onClick={(event) => togglePanel('overdue', event)} type="button"><Clock3 aria-hidden="true" size={17} /><span className="absolute right-0 top-0 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold text-white">{Math.min(overdue.length, 99)}</span></button> : null}
      </div>

      {isMounted && isOpen ? createPortal(<section className="fixed z-[9990] w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground shadow-[0_1.5rem_4rem_color-mix(in_srgb,var(--sidebar)_55%,transparent)]" style={panelPosition}>
        <header className="flex items-center justify-between gap-3 border-b border-sidebar-border pb-3">
          <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-sidebar-muted">{labels.timeHub}</p><p className="mt-1 text-sm font-semibold">{labels.pendingCount.replace('{count}', String(pending.length))}</p></div>
          <div className="flex items-center gap-2">
            <Link className="rounded-lg bg-sidebar-accent px-2.5 py-1.5 text-xs font-semibold text-sidebar-foreground hover:brightness-110" href="/reminders" onClick={() => setIsOpen(false)}>{labels.openManagement}</Link>
            <button aria-label={labels.close} className="grid size-8 place-items-center rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={() => setIsOpen(false)} type="button"><X aria-hidden="true" size={15} /></button>
          </div>
        </header>
        {panelSection === 'upcoming' ? <ReminderPanelSection icon={<Clock3 aria-hidden="true" size={15} />} title={labels.upcomingTitle} empty={labels.noUpcoming} items={upcomingSevenDays} nextItem={nextUpcoming} nextLabel={labels.nextReminder} now={now} locale={locale} onSelect={selectReminder} /> : <ReminderPanelSection icon={<Clock3 aria-hidden="true" className="text-red-300" size={15} />} title={labels.overdueTitle} empty={labels.noOverdue} items={overdue} now={now} locale={locale} onSelect={selectReminder} overdue />}
      </section>, document.body) : null}

      {isMounted && popup ? createPortal(
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
            setIsOpen(false)
            router.refresh()
            if (automaticDue?.recipientId === popup.recipientId) setAutomaticPopupId(null)
            if (recipientId) window.requestAnimationFrame(() => reminderButtonRefs.current[recipientId]?.focus())
          }}
        />,
        document.body,
      ) : null}
    </div>
  )
}

function ReminderPanelSection({
  icon,
  title,
  empty,
  items,
  nextItem,
  nextLabel,
  now,
  locale,
  onSelect,
  overdue = false,
}: {
  icon: ReactNode
  title: string
  empty: string
  items: ReminderItem[]
  nextItem?: ReminderItem | null
  nextLabel?: string
  now: Date
  locale: Locale
  onSelect: (recipientId: string) => void
  overdue?: boolean
}) {
  const listItems = items.filter((item) => item.recipientId !== nextItem?.recipientId)
  return <div className="mt-3">
    <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] ${overdue ? 'text-red-300' : 'text-sidebar-muted'}`}>{icon}<span>{title}</span><span className="ml-auto rounded-full bg-sidebar-accent px-2 py-0.5 text-[10px] tabular-nums">{items.length}</span></div>
    {nextItem ? <div className="mt-2"><p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[.1em] text-sidebar-muted">{nextLabel}</p><ReminderPanelItem item={nextItem} now={now} locale={locale} onSelect={onSelect} overdue={overdue} emphasized /></div> : null}
    {listItems.length > 0 ? <ul className="mt-2 space-y-1.5">{listItems.map((item) => <li key={item.recipientId}><ReminderPanelItem item={item} now={now} locale={locale} onSelect={onSelect} overdue={overdue} /></li>)}</ul> : null}
    {!nextItem && listItems.length === 0 ? <p className="px-1 py-5 text-xs text-sidebar-muted">{empty}</p> : null}
  </div>
}

function ReminderPanelItem({ item, now, locale, onSelect, overdue, emphasized = false }: { item: ReminderItem; now: Date; locale: Locale; onSelect: (recipientId: string) => void; overdue?: boolean; emphasized?: boolean }) {
  return <button className={`block w-full rounded-xl px-3 py-2.5 text-left transition-[filter,background-color] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground ${overdue ? 'bg-red-400/15' : 'bg-sidebar-accent'} ${emphasized ? 'border border-sidebar-border' : ''}`} onClick={() => onSelect(item.recipientId)} type="button">
    <span className="block truncate text-xs font-medium">{item.title}</span>
    <span className={`mt-0.5 flex items-center gap-1 text-[10px] ${overdue ? 'text-red-200' : 'text-sidebar-muted'}`}><Clock3 aria-hidden="true" size={11} />{formatReminderCountdown(now, new Date(item.remindAt), locale)}</span>
  </button>
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
  onAction: (item: ReminderItem, action: 'COMPLETE' | 'DISMISS' | 'SNOOZE', snoozeDays?: number) => Promise<void>
  onClose: () => void
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const [snoozeDays, setSnoozeDays] = useState(1)

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
    <div aria-describedby="reminder-detail-description" aria-labelledby="reminder-detail-title" aria-modal="true" className="fixed inset-0 z-[9999] grid place-items-center bg-sidebar/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }} role="dialog">
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
          <div className="flex flex-col items-end gap-3">
            <div className="flex gap-2">
            <button aria-label={labels.decreaseSnoozeDays} className="button-secondary min-h-10 px-3" disabled={busy || snoozeDays <= 1} onClick={() => setSnoozeDays((days) => Math.max(1, days - 1))} type="button">−</button>
            <button className="button-secondary min-h-10 justify-center" disabled={busy} onClick={() => void onAction(item, 'SNOOZE', snoozeDays)} type="button">{(snoozeDays === 1 ? labels.saveSnoozeSingular : labels.saveSnoozePlural).replace('{days}', String(snoozeDays))}</button>
            <button aria-label={labels.increaseSnoozeDays} className="button-secondary min-h-10 px-3" disabled={busy || snoozeDays >= 99} onClick={() => setSnoozeDays((days) => Math.min(99, days + 1))} type="button">+</button>
            </div>
            <button className="button-primary min-h-11 w-full justify-center gap-2" disabled={busy} onClick={() => void onAction(item, 'COMPLETE')} type="button"><Check aria-hidden="true" size={16} />{labels.saveComplete}</button>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Link className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-accent-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={`/reminders#${item.reminderId}`} onClick={onClose}><ExternalLink aria-hidden="true" size={16} />{labels.openManagement}</Link>
            <div className="flex flex-wrap gap-2">
              <button className="button-secondary min-h-10" disabled={busy} onClick={() => void onAction(item, 'DISMISS')} type="button">{labels.dismiss}</button>
              <button className="button-secondary min-h-10" disabled={busy} onClick={onClose} type="button">{labels.cancel}</button>
            </div>
          </div>
        </footer>
        </div>
      </section>
    </div>
  )
}
