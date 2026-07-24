'use client'

import { ArrowDown, ArrowUp, Save } from 'lucide-react'
import { useState } from 'react'

export function MenuOrderForm({ items, saveLabel, savedLabel, moveUpLabel, moveDownLabel }: { items: Array<{ href: string; label: string }>; saveLabel: string; savedLabel: string; moveUpLabel: string; moveDownLabel: string }) {
  const [order, setOrder] = useState(items.map((item) => item.href)); const [saved, setSaved] = useState(false)
  function move(index: number, direction: -1 | 1): void { const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= order.length) return; const next = [...order]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; setOrder(next); setSaved(false) }
  function save(): void { window.localStorage.setItem('liquidhr.sidebar-menu-order', JSON.stringify(order)); window.dispatchEvent(new CustomEvent('liquidhr-menu-order-changed', { detail: order })); setSaved(true) }
  const labels = new Map(items.map((item) => [item.href, item.label]))
  return <section className="mt-7 max-w-2xl rounded-2xl border bg-surface p-5 shadow-sm"><ol className="space-y-2">{order.map((href, index) => <li className="flex items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3" key={href}><span className="font-medium">{labels.get(href)}</span><span className="flex gap-1"><button aria-label={`${labels.get(href)} ${moveUpLabel}`} className="rounded-lg p-2 hover:bg-muted disabled:opacity-40" disabled={index === 0} onClick={() => move(index, -1)} type="button"><ArrowUp size={16} /></button><button aria-label={`${labels.get(href)} ${moveDownLabel}`} className="rounded-lg p-2 hover:bg-muted disabled:opacity-40" disabled={index === order.length - 1} onClick={() => move(index, 1)} type="button"><ArrowDown size={16} /></button></span></li>)}</ol><div className="mt-5 flex items-center gap-3"><button className="button-primary inline-flex items-center gap-2" onClick={save} type="button"><Save size={16} />{saveLabel}</button>{saved ? <span className="text-sm text-success" role="status">{savedLabel}</span> : null}</div></section>
}
