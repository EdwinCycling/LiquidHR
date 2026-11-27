'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'

type Entry = { id: string; title: string; phase?: string; status?: string; dueDate?: string | null; managerName?: string | null; finalScore?: number | null; additionalReviewerContribution?: string | null; completedAt?: string | null }

export function EmployeePerformanceReviewHistory({ employeeId, labels }: { employeeId: string; labels: { empty: string; status: string; dueDate: string; open: string; additionalContribution: string } }) {
  const [items, setItems] = useState<Entry[]>([])
  useEffect(() => { let active = true; void fetch(`/api/performance-reviews/employees/${encodeURIComponent(employeeId)}`).then((response) => response.ok ? response.json() as Promise<{ items?: Entry[] }> : { items: [] }).then((result) => { if (active) setItems(Array.isArray(result.items) ? result.items : []) }).catch(() => undefined); return () => { active = false } }, [employeeId])
  if (!items.length) return <p className="mt-4 text-sm text-muted-foreground">{labels.empty}</p>
  return <div className="mt-4 divide-y divide-border-subtle rounded-[var(--radius-control)] border border-border-subtle">{items.map((item) => <Link className="block p-4 hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-focus" href={`/conversations/${encodeURIComponent(item.id)}`} key={item.id}><div className="flex flex-wrap items-start justify-between gap-3"><p className="font-medium">{item.title}</p><span className="text-xs text-muted-foreground">{item.phase ?? item.status ?? labels.status}</span></div><div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3"><span>{item.managerName ?? labels.status}</span><span>{item.finalScore ?? '—'}</span><span className="inline-flex items-center gap-1"><CalendarDays aria-hidden="true" className="size-3.5" />{item.completedAt ?? item.dueDate ?? labels.open}</span></div>{item.additionalReviewerContribution ? <section className="mt-3 border-t border-border-subtle pt-3 text-sm"><h3 className="text-xs font-semibold text-muted-foreground">{labels.additionalContribution}</h3><p className="mt-1 whitespace-pre-wrap">{item.additionalReviewerContribution}</p></section> : null}</Link>)}</div>
}
