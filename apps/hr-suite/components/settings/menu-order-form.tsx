'use client'

import { ArrowDown, ArrowUp, Save } from 'lucide-react'
import { useState } from 'react'
import { FormActions } from '@/components/patterns/form-actions'
import { Surface } from '@/components/ui/surface'
import { IconButton } from '@/components/ui/icon-button'

type MenuOrderSection = { id: string; label: string; items: Array<{ href: string; label: string }> }

export function MenuOrderForm({ cancelLabel, sections, saveLabel, savedLabel, moveUpLabel, moveDownLabel }: { cancelLabel: string; sections: MenuOrderSection[]; saveLabel: string; savedLabel: string; moveUpLabel: string; moveDownLabel: string }) {
  const defaultOrder = sections.flatMap((section) => section.items.map((item) => item.href))
  const [order, setOrder] = useState(defaultOrder); const [saved, setSaved] = useState(false)
  const sectionByHref = new Map(sections.flatMap((section) => section.items.map((item) => [item.href, section.id] as const)))
  function move(href: string, direction: -1 | 1): void { const index = order.indexOf(href); const nextIndex = index + direction; if (index < 0 || nextIndex < 0 || nextIndex >= order.length || sectionByHref.get(order[nextIndex]) !== sectionByHref.get(href)) return; const next = [...order]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; setOrder(next); setSaved(false) }
  function save(): void { window.localStorage.setItem('liquidhr.sidebar-menu-order', JSON.stringify(order)); window.dispatchEvent(new CustomEvent('liquidhr-menu-order-changed', { detail: order })); setSaved(true) }
  const labels = new Map(sections.flatMap((section) => section.items.map((item) => [item.href, item.label])))
  return <form className="max-w-2xl" onSubmit={(event) => { event.preventDefault(); save() }}><Surface className="p-5"><div className="space-y-6">{sections.map((section) => { const sectionHrefs = order.filter((href) => sectionByHref.get(href) === section.id); return <section aria-labelledby={`menu-order-${section.id}`} key={section.id}><h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground" id={`menu-order-${section.id}`}>{section.label}</h2><ol className="space-y-2">{sectionHrefs.map((href) => { const label = labels.get(href) ?? href; const firstInSection = sectionHrefs[0] === href; const lastInSection = sectionHrefs[sectionHrefs.length - 1] === href; return <li className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border bg-background px-4 py-3" key={href}><span className="min-w-0 break-words font-medium">{label}</span><span className="flex shrink-0 gap-1"><IconButton label={`${label} ${moveUpLabel}`} disabled={firstInSection} onClick={() => move(href, -1)} size="sm" type="button" variant="ghost"><ArrowUp aria-hidden="true" /></IconButton><IconButton label={`${label} ${moveDownLabel}`} disabled={lastInSection} onClick={() => move(href, 1)} size="sm" type="button" variant="ghost"><ArrowDown aria-hidden="true" /></IconButton></span></li> })}</ol></section> })}</div><div className="mt-5 border-t border-border-subtle pt-5"><FormActions cancelLabel={cancelLabel} onCancel={() => { setOrder(defaultOrder); setSaved(false) }} saveLabel={saveLabel} /><p aria-live="polite" className="mt-3 text-sm text-success" role="status">{saved ? <><Save aria-hidden="true" className="mr-1 inline size-4" />{savedLabel}</> : null}</p></div></Surface></form>
}
