'use client'

import { Check, Plus, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DashboardWidgetType } from '@/lib/dashboard/schemas'
import type { DashboardWidgetCategory } from '@/lib/dashboard/widget-catalog'
import { dashboardCategoryOrder, type DashboardWidgetPresentation } from '@/lib/dashboard/widget-presentation'
import { filterWidgetPresentations } from './widget-picker-model'

export interface WidgetPickerLabels { title: string; description: string; search: string; all: string; add: string; alreadyAdded: string; empty: string; done: string; close: string }

export function WidgetPickerDialog({ addedTypes, labels, locale, onAdd, onClose, open, presentations }: { addedTypes: Set<DashboardWidgetType>; labels: WidgetPickerLabels; locale: string; onAdd: (presentation: DashboardWidgetPresentation) => void; onClose: () => void; open: boolean; presentations: DashboardWidgetPresentation[] }) {
  const ref = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<DashboardWidgetCategory | 'ALL'>('ALL')
  useEffect(() => {
    if (open && !ref.current?.open) { ref.current?.showModal(); window.setTimeout(() => searchRef.current?.focus(), 0) }
    if (!open && ref.current?.open) ref.current.close()
  }, [open])
  const filtered = filterWidgetPresentations(presentations, { query, category, locale })
  const categories = dashboardCategoryOrder.filter((value) => presentations.some((item) => item.category === value))
  const close = () => { ref.current?.close(); onClose() }
  return <dialog aria-labelledby="widget-picker-title" className="settings-dialog m-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-4xl overflow-hidden rounded-2xl border bg-surface p-0 text-foreground shadow-2xl sm:max-h-[calc(100dvh-3rem)]" onCancel={(event) => { event.preventDefault(); close() }} onClick={(event) => { if (event.target === event.currentTarget) close() }} ref={ref}>
    <div className="flex max-h-[calc(100dvh-1rem)] flex-col sm:max-h-[calc(100dvh-3rem)]"><header className="flex items-start justify-between gap-5 border-b px-5 py-5 sm:px-7"><div><h2 className="text-xl font-semibold" id="widget-picker-title">{labels.title}</h2><p className="mt-1.5 text-sm text-muted-foreground">{labels.description}</p></div><button aria-label={labels.close} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted" onClick={close} type="button"><X aria-hidden="true" size={19} /></button></header>
    <div className="border-b px-5 py-4 sm:px-7"><label className="relative block"><span className="sr-only">{labels.search}</span><Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} /><input className="h-11 w-full rounded-xl border bg-surface pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus" onChange={(event) => setQuery(event.target.value)} placeholder={labels.search} ref={searchRef} value={query} /></label><div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist"><button aria-selected={category === 'ALL'} className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${category === 'ALL' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`} onClick={() => setCategory('ALL')} role="tab" type="button">{labels.all}</button>{categories.map((value) => { const item = presentations.find((candidate) => candidate.category === value)!; return <button aria-selected={category === value} className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${category === value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`} key={value} onClick={() => setCategory(value)} role="tab" type="button">{item.categoryLabel}</button> })}</div></div>
    <div className="overflow-y-auto px-5 py-5 sm:px-7">{filtered.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{labels.empty}</p> : <div className="grid gap-3 sm:grid-cols-2">{filtered.map((item) => { const added = addedTypes.has(item.type); return <article className="flex min-h-44 flex-col rounded-2xl border bg-surface-raised p-5" key={item.type}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent-foreground">{item.categoryLabel}</p><h3 className="mt-2 text-base font-semibold">{item.title}</h3></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{item.visualizationLabel}</span></div><p className="mt-2 text-sm leading-5 text-muted-foreground">{item.description}</p><button className={added ? 'button-secondary mt-auto min-h-10 gap-2 self-start' : 'button-primary mt-auto min-h-10 gap-2 self-start'} disabled={added} onClick={() => onAdd(item)} type="button">{added ? <Check aria-hidden="true" size={16} /> : <Plus aria-hidden="true" size={16} />}{added ? labels.alreadyAdded : labels.add}</button></article> })}</div>}</div>
    <footer className="mt-auto flex justify-end border-t bg-surface-raised px-5 py-4 sm:px-7"><button className="button-primary min-h-10" onClick={close} type="button">{labels.done}</button></footer></div>
  </dialog>
}
