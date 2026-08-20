'use client'

import { ArrowDown, ArrowUp, GripVertical, LoaderCircle } from 'lucide-react'
import { useState, type DragEvent, type ReactNode } from 'react'
import type { EmployeeDashboardLayout as Layout, EmployeeDashboardNarrowWidget, EmployeeDashboardWideWidget } from '@/lib/preferences/employee-dashboard-layout'
import { DetailColumns } from '@/components/layout/detail-columns'

interface WidgetNode {
  id: EmployeeDashboardWideWidget | EmployeeDashboardNarrowWidget
  node: ReactNode
}

interface Labels {
  moveUp: string
  moveDown: string
  drag: string
  saving: string
  saved: string
  failed: string
}

export function EmployeeDashboardLayout({ wide, narrow, initialLayout, compact = false, labels }: { wide: WidgetNode[]; narrow: WidgetNode[]; initialLayout: Layout; compact?: boolean; labels: Labels }) {
  const [layout, setLayout] = useState<Layout>(initialLayout)
  const [dragged, setDragged] = useState<{ column: 'wide' | 'narrow'; id: string } | null>(null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const nodes = new Map([...wide, ...narrow].map((widget) => [widget.id, widget.node]))

  async function save(next: Layout): Promise<void> {
    setStatus('saving')
    const response = await fetch('/api/preferences/employee-dashboard', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next) })
    setStatus(response.ok ? 'saved' : 'failed')
  }

  function move(column: 'wide' | 'narrow', id: string, offset: -1 | 1): void {
    const current = [...layout[column]]
    const index = current.indexOf(id as never)
    const target = index + offset
    if (index < 0 || target < 0 || target >= current.length) return
    ;[current[index], current[target]] = [current[target], current[index]]
    const next = { ...layout, [column]: current } as Layout
    setLayout(next)
    void save(next)
  }

  function drop(column: 'wide' | 'narrow', targetId: string): void {
    if (!dragged || dragged.column !== column || dragged.id === targetId) return
    const current = [...layout[column]]
    const from = current.indexOf(dragged.id as never)
    const to = current.indexOf(targetId as never)
    if (from < 0 || to < 0) return
    const [item] = current.splice(from, 1)
    current.splice(to, 0, item)
    const next = { ...layout, [column]: current } as Layout
    setLayout(next)
    setDragged(null)
    void save(next)
  }

  function render(column: 'wide' | 'narrow', items: readonly string[]) {
    return items.map((id, index) => {
      const node = nodes.get(id as EmployeeDashboardWideWidget | EmployeeDashboardNarrowWidget)
      if (compact) return <div key={id}>{node}</div>
      return <div className="group" draggable key={id} onDragEnd={() => setDragged(null)} onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()} onDrop={() => drop(column, id)} onDragStart={() => setDragged({ column, id })}>
        <div className="mb-2 flex min-h-9 items-center justify-end gap-1 rounded-lg border border-dashed border-border/70 bg-surface/80 p-1 opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-within:opacity-100">
          <span aria-label={labels.drag} className="px-1 text-muted-foreground" title={labels.drag}><GripVertical aria-hidden="true" size={15} /></span>
          <button aria-label={labels.moveUp} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30" disabled={index === 0} onClick={() => move(column, id, -1)} type="button"><ArrowUp aria-hidden="true" size={14} /></button>
          <button aria-label={labels.moveDown} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30" disabled={index === items.length - 1} onClick={() => move(column, id, 1)} type="button"><ArrowDown aria-hidden="true" size={14} /></button>
        </div>
        {node}
      </div>
    })
  }

  return <>
    <DetailColumns main={<div className="space-y-5">{render('wide', layout.wide)}</div>} aside={<aside className="space-y-5">{render('narrow', layout.narrow)}</aside>} />
    <p aria-live="polite" className="sr-only">{status === 'saving' ? labels.saving : status === 'saved' ? labels.saved : status === 'failed' ? labels.failed : ''}{status === 'saving' ? <LoaderCircle aria-hidden="true" /> : null}</p>
  </>
}
