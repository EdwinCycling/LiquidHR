'use client'

import { ArrowDown, ArrowUp, Minus, Plus } from 'lucide-react'
import type { DashboardWidget } from '@/lib/dashboard/service'
import type { DashboardWidgetType } from '@/lib/dashboard/schemas'

interface DashboardEditorProps {
  availableTypes: DashboardWidgetType[]
  labels: { addWidget: string; moveUp: string; moveDown: string; removeWidget: string }
  widgets: DashboardWidget[]
  onAdd: (type: DashboardWidgetType) => void
  onMove: (id: string, direction: 'up' | 'down') => void
  onRemove: (id: string) => void
}

export function DashboardEditor({ availableTypes, labels, onAdd, onMove, onRemove, widgets }: DashboardEditorProps) {
  return (
    <section aria-label={labels.addWidget} className="rounded-2xl border border-dashed bg-muted/40 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        {availableTypes.map((type) => <button className="inline-flex min-h-10 items-center gap-2 rounded-lg border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-focus" key={type} onClick={() => onAdd(type)} type="button"><Plus aria-hidden="true" size={16} />{type}</button>)}
      </div>
      <div className="mt-3 grid gap-2">
        {widgets.map((widget, index) => <div className="flex items-center justify-between gap-3 rounded-xl border bg-surface px-3 py-2" key={widget.id}>
          <span className="min-w-0 truncate text-sm font-semibold text-foreground">{widget.type}</span>
          <div className="flex shrink-0 items-center gap-1">
            <button aria-label={labels.moveUp} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-40" disabled={index === 0} onClick={() => onMove(widget.id, 'up')} type="button"><ArrowUp aria-hidden="true" size={15} /></button>
            <button aria-label={labels.moveDown} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-40" disabled={index === widgets.length - 1} onClick={() => onMove(widget.id, 'down')} type="button"><ArrowDown aria-hidden="true" size={15} /></button>
            <button aria-label={labels.removeWidget} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-focus" onClick={() => onRemove(widget.id)} type="button"><Minus aria-hidden="true" size={15} /></button>
          </div>
        </div>)}
      </div>
    </section>
  )
}
