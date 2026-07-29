'use client'

import { useState } from 'react'

interface TimelineItem {
  id: string
  title: string
  period: string
  summary: string
  details: Array<{ label: string; value: string }>
}

export function SelectableTimelineList({ items, labels }: {
  items: TimelineItem[]
  labels: { current: string; history: string; empty: string; close: string }
}) {
  const [selected, setSelected] = useState<TimelineItem | null>(null)
  if (items.length === 0) return <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{labels.empty}</div>
  return <>
    <div className="grid gap-3">
      {items.map((item, index) => <button type="button" key={item.id} onClick={() => setSelected(item)} className="cursor-pointer rounded-2xl border bg-surface p-4 text-left shadow-sm transition hover:border-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{index === 0 ? labels.current : labels.history}</p><p className="mt-1 font-semibold">{item.title}</p></div>
          <span className="status-chip bg-accent text-accent-foreground">{item.period}</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{item.summary}</p>
      </button>)}
    </div>
    {selected && <div className="fixed inset-0 z-[70] grid place-items-center bg-sidebar/70 p-4" role="presentation">
      <section role="dialog" aria-modal="true" className="w-full max-w-xl rounded-3xl border bg-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b pb-4"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{selected.period}</p><h3 className="mt-1 text-xl font-semibold">{selected.title}</h3></div><button type="button" className="button-secondary" onClick={() => setSelected(null)}>{labels.close}</button></div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">{selected.details.map((detail) => <div key={detail.label} className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">{detail.label}</dt><dd className="mt-1 font-semibold">{detail.value}</dd></div>)}</dl>
      </section>
    </div>}
  </>
}
