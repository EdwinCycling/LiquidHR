'use client'

import { ArrowDown, ArrowUp, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import type { DashboardWidget } from '@/lib/dashboard/service'
import type { DashboardWidgetPresentation } from '@/lib/dashboard/widget-presentation'
import { WidgetPickerDialog, type WidgetPickerLabels } from './widget-picker-dialog'

interface DashboardEditorProps {
  labels: WidgetPickerLabels & { addWidget: string; moveUp: string; moveDown: string; removeWidget: string }
  locale: string
  presentations: DashboardWidgetPresentation[]
  widgets: DashboardWidget[]
  onAdd: (presentation: DashboardWidgetPresentation) => void
  onMove: (id: string, direction: 'up' | 'down') => void
  onRemove: (id: string) => void
}

export function DashboardEditor({ labels, locale, onAdd, onMove, onRemove, presentations, widgets }: DashboardEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const presentationMap = new Map(presentations.map((item) => [item.type, item]))
  return <section aria-label={labels.addWidget} className="rounded-2xl border border-dashed bg-muted/40 p-3 sm:p-4">
    <button className="button-primary min-h-10 gap-2" onClick={() => setPickerOpen(true)} type="button"><Plus aria-hidden="true" size={16} />{labels.addWidget}</button>
    <div className="mt-4 grid gap-2">{widgets.map((widget, index) => { const presentation = presentationMap.get(widget.type); return <div className="flex items-center justify-between gap-3 rounded-xl border bg-surface px-3 py-3" key={widget.id}><div className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">{presentation?.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{presentation?.categoryLabel} · {presentation?.visualizationLabel}</span></div><div className="flex shrink-0 items-center gap-1"><button aria-label={labels.moveUp} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted" disabled={index === 0} onClick={() => onMove(widget.id, 'up')} type="button"><ArrowUp aria-hidden="true" size={15} /></button><button aria-label={labels.moveDown} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted" disabled={index === widgets.length - 1} onClick={() => onMove(widget.id, 'down')} type="button"><ArrowDown aria-hidden="true" size={15} /></button><button aria-label={labels.removeWidget} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => onRemove(widget.id)} type="button"><Minus aria-hidden="true" size={15} /></button></div></div> })}</div>
    <WidgetPickerDialog addedTypes={new Set(widgets.map((widget) => widget.type))} labels={labels} locale={locale} onAdd={onAdd} onClose={() => setPickerOpen(false)} open={pickerOpen} presentations={presentations} />
  </section>
}
