'use client'

import { ArrowDown, ArrowUp, Save } from 'lucide-react'
import { useState } from 'react'
import { FormActions } from '@/components/patterns/form-actions'
import { Surface } from '@/components/ui/surface'
import { IconButton } from '@/components/ui/icon-button'

export function MenuOrderForm({ cancelLabel, items, saveLabel, savedLabel, moveUpLabel, moveDownLabel }: { cancelLabel: string; items: Array<{ href: string; label: string }>; saveLabel: string; savedLabel: string; moveUpLabel: string; moveDownLabel: string }) {
  const [order, setOrder] = useState(items.map((item) => item.href)); const [saved, setSaved] = useState(false)
  function move(index: number, direction: -1 | 1): void { const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= order.length) return; const next = [...order]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; setOrder(next); setSaved(false) }
  function save(): void { window.localStorage.setItem('liquidhr.sidebar-menu-order', JSON.stringify(order)); window.dispatchEvent(new CustomEvent('liquidhr-menu-order-changed', { detail: order })); setSaved(true) }
  const labels = new Map(items.map((item) => [item.href, item.label]))
  return <form className="max-w-2xl" onSubmit={(event) => { event.preventDefault(); save() }}><Surface className="p-5"><ol className="space-y-2">{order.map((href, index) => { const label = labels.get(href) ?? href; return <li className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border bg-background px-4 py-3" key={href}><span className="min-w-0 break-words font-medium">{label}</span><span className="flex shrink-0 gap-1"><IconButton label={`${label} ${moveUpLabel}`} disabled={index === 0} onClick={() => move(index, -1)} size="sm" type="button" variant="ghost"><ArrowUp aria-hidden="true" /></IconButton><IconButton label={`${label} ${moveDownLabel}`} disabled={index === order.length - 1} onClick={() => move(index, 1)} size="sm" type="button" variant="ghost"><ArrowDown aria-hidden="true" /></IconButton></span></li> })}</ol><div className="mt-5 border-t border-border-subtle pt-5"><FormActions cancelLabel={cancelLabel} onCancel={() => { setOrder(items.map((item) => item.href)); setSaved(false) }} saveLabel={saveLabel} /><p aria-live="polite" className="mt-3 text-sm text-success" role="status">{saved ? <><Save aria-hidden="true" className="mr-1 inline size-4" />{savedLabel}</> : null}</p></div></Surface></form>
}
