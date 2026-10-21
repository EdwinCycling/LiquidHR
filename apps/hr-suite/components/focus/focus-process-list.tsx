import Link from 'next/link'
import { ArrowRight, BriefcaseBusiness, CalendarDays, ClipboardList, Plus } from 'lucide-react'
import { Surface } from '@/components/ui/surface'
import { buttonClasses } from '@/components/ui/button'
import type { ProcessWorkList } from '@/lib/process-automation/work-service'
import { getProcessWorkItemHref, withProcessWorkReturnContext } from '@/lib/process-automation/work-routing'
import { focusActAsHref } from '@/lib/focus/url'
import type { Locale } from '@/lib/i18n/config'

export interface FocusProcessListLabels {
  actionNeeded: string
  empty: string
  emptyRequests: string
  waiting: string
  statusOpen: string
  inProgress: string
  completed: string
  changesRequested: string
  rejected: string
  cancelled: string
  blocked: string
  expired: string
  open: string
  leave: string
  work: string
  request: string
  newRequest: string
}

function statusLabel(item: ProcessWorkList['items'][number], labels: FocusProcessListLabels, manager: boolean): string {
  const status = (item.businessStatus || item.status).toUpperCase()
  if (status === 'WAITING') return labels.waiting
  if (status === 'COMPLETED' || status === 'APPROVED' || item.instanceStatus === 'COMPLETED') return labels.completed
  if (status === 'CHANGES_REQUESTED') return labels.changesRequested
  if (status === 'REJECTED' || item.instanceStatus === 'REJECTED') return labels.rejected
  if (status === 'CANCELLED' || item.instanceStatus === 'CANCELLED') return labels.cancelled
  if (status === 'BLOCKED') return labels.blocked
  if (status === 'EXPIRED' || item.instanceStatus === 'EXPIRED') return labels.expired
  if (status === 'OPEN' && manager && (item.canAct || item.canClaim)) return labels.actionNeeded
  if (status === 'OPEN') return labels.statusOpen
  return labels.inProgress
}

function displayDate(value: string, locale: Locale): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date)
}

export function FocusProcessList({ data, labels, locale, manager = false }: { data: ProcessWorkList; labels: FocusProcessListLabels; locale: Locale; manager?: boolean }) {
  return <section aria-labelledby="focus-process-list-title" className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-semibold" id="focus-process-list-title">{manager ? labels.actionNeeded : labels.request}</h2><p className="mt-1 text-sm text-muted-foreground">{data.total} · {manager ? labels.work : labels.request}</p></div>
      {!manager ? <Link className={buttonClasses({ size: 'sm' })} href="/work?view=REQUESTS&returnTo=focus-requests" prefetch={false}><Plus aria-hidden="true" className="size-4" />{labels.newRequest}</Link> : null}
    </div>
    {data.items.length === 0 ? <Surface className="p-6"><p className="text-sm text-muted-foreground">{manager ? labels.empty : labels.emptyRequests}</p></Surface> : <div className="space-y-3">{data.items.map((item) => { const Icon = item.businessType === 'LEAVE' ? CalendarDays : manager ? BriefcaseBusiness : ClipboardList; const title = item.businessType === 'LEAVE' ? labels.leave : item.processTitle; const returnContext = manager ? 'focus-work' : 'focus-requests'; const href = withProcessWorkReturnContext(getProcessWorkItemHref(item.businessType, item.workItemId), returnContext); return <Surface className="flex flex-wrap items-start gap-3 p-4" key={item.workItemId}><Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="font-semibold">{item.subjectName ?? title}</p><p className="mt-1 text-sm text-muted-foreground">{title}{item.availableAt ? ` · ${displayDate(item.availableAt, locale)}` : ''}</p><p className="mt-2 text-sm font-medium">{statusLabel(item, labels, manager)}</p></div>{item.canAct || item.canClaim ? <Link className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-border px-3 text-sm font-semibold text-primary hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={focusActAsHref(href)} prefetch={false}>{labels.open}<ArrowRight aria-hidden="true" className="size-4" /></Link> : null}</Surface> })}</div>}
  </section>
}
