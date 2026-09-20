import Link from 'next/link'
import { ArrowRight, BriefcaseBusiness, CalendarDays, ClipboardList } from 'lucide-react'
import { Surface } from '@/components/ui/surface'
import type { ProcessWorkList } from '@/lib/process-automation/work-service'
import { getProcessWorkItemHref } from '@/lib/process-automation/work-routing'
import { focusActAsHref } from '@/lib/focus/url'

export interface FocusProcessListLabels {
  actionNeeded: string
  empty: string
  waiting: string
  inProgress: string
  completed: string
  open: string
  leave: string
  work: string
  request: string
}

function statusLabel(status: string, labels: FocusProcessListLabels): string {
  const normalized = status.toUpperCase()
  if (normalized.includes('WAIT')) return labels.waiting
  if (normalized.includes('COMPLETE') || normalized.includes('APPROVED')) return labels.completed
  return labels.inProgress
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long' }).format(new Date(value))
}

export function FocusProcessList({ data, labels, token, manager = false }: { data: ProcessWorkList; labels: FocusProcessListLabels; token?: string | null; manager?: boolean }) {
  return <section aria-labelledby="focus-process-list-title" className="space-y-4"><div><h2 className="text-xl font-semibold" id="focus-process-list-title">{manager ? labels.actionNeeded : labels.request}</h2><p className="mt-1 text-sm text-muted-foreground">{data.total} · {manager ? labels.work : labels.request}</p></div>{data.items.length === 0 ? <Surface className="p-6"><p className="text-sm text-muted-foreground">{labels.empty}</p></Surface> : <div className="space-y-3">{data.items.map((item) => { const Icon = item.businessType === 'LEAVE' ? CalendarDays : manager ? BriefcaseBusiness : ClipboardList; const title = item.businessType === 'LEAVE' ? labels.leave : item.processTitle; return <Surface className="flex flex-wrap items-start gap-3 p-4" key={item.workItemId}><Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="font-semibold">{item.subjectName ?? title}</p><p className="mt-1 text-sm text-muted-foreground">{title}{item.availableAt ? ` · ${displayDate(item.availableAt)}` : ''}</p><p className="mt-2 text-sm font-medium">{statusLabel(item.businessStatus || item.status, labels)}</p></div>{item.canAct || item.canClaim ? <Link className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-border px-3 text-sm font-semibold text-primary hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={focusActAsHref(getProcessWorkItemHref(item.businessType, item.workItemId), token)} prefetch={false}>{labels.open}<ArrowRight aria-hidden="true" className="size-4" /></Link> : null}</Surface> })}</div>}</section>
}
