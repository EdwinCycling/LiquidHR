'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { InfoList } from '@/components/patterns/info-list'
import { Surface } from '@/components/ui/surface'
import { buttonClasses } from '@/components/ui/button'

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
  if (items.length === 0) return <EmptyState title={labels.empty} />
  return <>
    <div className="divide-y divide-subtle border-y border-subtle">
      {items.map((item, index) => <button type="button" key={item.id} onClick={() => setSelected(item)} className="group w-full cursor-pointer px-2 py-4 text-left transition-colors hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-sm font-medium text-muted-foreground">{index === 0 ? labels.current : labels.history}</p><p className="mt-1 font-semibold">{item.title}</p></div>
          <Badge tone={index === 0 ? 'info' : 'neutral'}>{item.period}</Badge>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{item.summary}</p>
      </button>)}
    </div>
    {selected && <div className="fixed inset-0 z-[70] grid place-items-center bg-sidebar/70 p-4" role="presentation">
      <Surface variant="overlay" role="dialog" aria-modal="true" className="w-full max-w-xl p-6">
        <div className="flex items-start justify-between gap-3 border-b border-subtle pb-4"><div><p className="text-sm font-medium text-muted-foreground">{selected.period}</p><h3 className="mt-1 text-xl font-semibold">{selected.title}</h3></div><button type="button" className={buttonClasses({ variant: 'secondary', size: 'sm' })} onClick={() => setSelected(null)}>{labels.close}</button></div>
        <InfoList className="mt-5" columns={2} items={selected.details.map((detail) => ({ label: detail.label, value: detail.value }))} />
      </Surface>
    </div>}
  </>
}
