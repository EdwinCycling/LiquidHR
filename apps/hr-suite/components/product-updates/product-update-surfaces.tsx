'use client'

import Link from 'next/link'
import { Gift, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Drawer } from '@/components/ui/drawer'
import type { ProductUpdate, ProductUpdateChannel } from '@/lib/product-updates/service'

export interface ProductUpdateSurfaceLabels {
  title: string
  subtitle: string
  open: string
  close: string
  kindNewFeature: string
  kindImprovement: string
  giftWindow: string
  loginPopup: string
  topBanner: string
  dateFrom: string
  dateUntil: string
  more: string
  manage: string
  seen: string
  empty: string
  unreadCount: string
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
}

function kindLabel(update: ProductUpdate, labels: ProductUpdateSurfaceLabels): string {
  return update.kind === 'NEW_FEATURE' ? labels.kindNewFeature : labels.kindImprovement
}

export function ProductUpdateCard({ update, labels, locale }: { update: ProductUpdate; labels: ProductUpdateSurfaceLabels; locale: string }) {
  return <article className="rounded-2xl border bg-surface p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
      <span className="rounded-full bg-primary/10 px-2.5 py-1">{kindLabel(update, labels)}</span>
      <span className="text-muted-foreground">{formatDate(update.startsAt ?? update.createdAt, locale)}</span>
    </div>
    <h2 className="mt-4 text-xl font-semibold text-foreground">{update.title}</h2>
    <p className="mt-2 text-base font-medium leading-6 text-muted-foreground">{update.summary}</p>
    <div className="mt-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">{update.content}</div>
  </article>
}

export function ProductUpdateBanner({ updates, labels }: { updates: ProductUpdate[]; labels: ProductUpdateSurfaceLabels }) {
  const update = updates.find((item) => item.displayChannels.includes('TOP_BANNER'))
  useEffect(() => {
    if (!update) return
    void fetch('/api/product-updates/surface-seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updateId: update.id, channel: 'TOP_BANNER' }),
    })
  }, [update])
  if (!update) return null
  return <div className="product-update-banner border-b px-5 py-3 sm:px-8"><div className="relative z-10 mx-auto flex max-w-7xl items-center gap-3 text-sm"><Gift aria-hidden="true" className="product-update-banner__icon shrink-0" size={17} /><p className="min-w-0 flex-1 truncate"><span className="font-semibold">{update.title}</span><span className="ml-2 hidden opacity-90 sm:inline">{update.summary}</span></p><Link className="product-update-banner__link shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold" href="/product-updates">{labels.more}</Link></div></div>
}

export function ProductUpdateLoginPopup({ updates, labels, locale }: { updates: ProductUpdate[]; labels: ProductUpdateSurfaceLabels; locale: string }) {
  const [open, setOpen] = useState(true)
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false)
  const loginUpdates = useMemo(() => updates.filter((item) => item.displayChannels.includes('LOGIN_POPUP')), [updates])
  const [markingSeen, setMarkingSeen] = useState(false)
  async function markSeen(): Promise<void> {
    setMarkingSeen(true)
    const results = await Promise.all(loginUpdates.slice(0, 3).map((update) => fetch('/api/product-updates/surface-seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updateId: update.id, channel: 'LOGIN_POPUP' }),
    })))
    if (results.every((result) => result.ok)) setOpen(false)
    setMarkingSeen(false)
  }
  if (!mounted || !open || loginUpdates.length === 0) return null
  return createPortal(<div className="fixed inset-0 z-[9999] grid place-items-center bg-sidebar/70 p-4 backdrop-blur-sm" role="presentation"><section aria-labelledby="product-update-login-title" aria-modal="true" className="max-h-[min(760px,calc(100vh-2rem))] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-surface p-5 shadow-2xl sm:p-7" role="dialog"><header className="flex items-start justify-between gap-4"><div><p className="eyebrow">{labels.title}</p><h2 className="mt-1 text-2xl font-semibold" id="product-update-login-title">{loginUpdates[0]?.title}</h2></div><button aria-label={labels.close} className="button-secondary" onClick={() => setOpen(false)} type="button"><X size={17} /></button></header><div className="mt-5 grid gap-4">{loginUpdates.slice(0, 3).map((update) => <ProductUpdateCard key={update.id} labels={labels} locale={locale} update={update} />)}</div><div className="mt-6 flex justify-end border-t pt-5"><button className="button-primary" disabled={markingSeen} onClick={() => void markSeen()} type="button">{labels.seen}</button></div></section></div>, document.body)
}

export function ProductUpdateDrawerTrigger({ unreadCount, updates, labels, locale, collapsed, onClose }: { unreadCount: number; updates: ProductUpdate[]; labels: ProductUpdateSurfaceLabels; locale: string; collapsed?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  const giftUpdates = updates.filter((update) => update.displayChannels.includes('GIFT_WINDOW'))
  const triggerLabel = unreadCount > 0
    ? `${labels.open} — ${labels.unreadCount.replace('{count}', String(unreadCount))}`
    : labels.open

  function openDrawer(): void {
    setOpen(true)
    onClose?.()
    if (unreadCount === 0) return
    void fetch('/api/product-updates/seen', { method: 'POST' }).then((response) => {
      if (response.ok) window.dispatchEvent(new CustomEvent('liquidhr-product-updates-seen'))
    })
  }

  return <>
    <button aria-label={triggerLabel} className={`relative grid size-11 place-items-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${collapsed ? 'mx-auto' : ''}`} onClick={openDrawer} title={labels.title} type="button">
      <Gift aria-hidden="true" size={18} />
      {unreadCount > 0 ? <span aria-hidden="true" className="absolute right-0.5 top-0.5 grid min-w-5 -translate-y-1/4 translate-x-1/4 place-items-center rounded-full bg-destructive px-1.5 py-0.5 text-[11px] font-bold leading-4 text-destructive-foreground">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
    </button>
    <Drawer closeLabel={labels.close} description={labels.subtitle} onOpenChange={setOpen} open={open} title={labels.title}>
      <div className="grid gap-4">
        {giftUpdates.length > 0 ? giftUpdates.map((update) => <ProductUpdateCard key={update.id} labels={labels} locale={locale} update={update} />) : <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{labels.empty}</p>}
      </div>
    </Drawer>
  </>
}

export const PRODUCT_UPDATE_CHANNELS: ProductUpdateChannel[] = ['GIFT_WINDOW', 'LOGIN_POPUP', 'TOP_BANNER']
