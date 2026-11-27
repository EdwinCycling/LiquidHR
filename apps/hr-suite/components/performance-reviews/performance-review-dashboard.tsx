'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Clock3, ListChecks } from 'lucide-react'
import Link from 'next/link'
import { Surface } from '@/components/ui/surface'

type DashboardLabels = { dashboard: string; waitingEmployee: string; waitingAdditionalReviewer: string; waitingManager: string; waitingAcknowledgement: string; waitingReviewerClose: string; completedAgreed: string; completedDisagreed: string; closedOpen: string; nextActions: string; noActions: string; open: string; cancelled: string }
type DashboardData = { phaseCounts: Record<string, number>; nextActions: Array<{ id: string; title: string; phase: string; dueDate?: string | null }> }

export function PerformanceReviewDashboard({ role, labels }: { role: 'hr' | 'manager' | 'employee' | 'additional-reviewer'; labels: DashboardLabels }) {
  const [data, setData] = useState<DashboardData>({ phaseCounts: {}, nextActions: [] })
  useEffect(() => {
    let active = true
    void fetch(`/api/performance-reviews/dashboard?role=${role}`).then(async (response) => {
      if (response.ok) return response.json() as Promise<DashboardData>
      const fallback = await fetch(`/api/performance-reviews?role=${role}`)
      return fallback.ok ? fallback.json() as Promise<{ items?: Array<{ id: string; title: string; phase: string; dueDate?: string | null }> }> : { items: [] }
    }).then((result) => {
      if (!active) return
      if ('phaseCounts' in result) setData(result)
      else {
        const phaseCounts: Record<string, number> = {}
        const items = result.items ?? []
        for (const item of items) phaseCounts[item.phase] = (phaseCounts[item.phase] ?? 0) + 1
        setData({ phaseCounts, nextActions: items.slice(0, 3) })
      }
    }).catch(() => undefined)
    return () => { active = false }
  }, [role])
  const cards = [['WAITING_EMPLOYEE', labels.waitingEmployee], ['WAITING_ADDITIONAL_REVIEWER', labels.waitingAdditionalReviewer], ['WAITING_MANAGER', labels.waitingManager], ['WAITING_ACKNOWLEDGEMENT', labels.waitingAcknowledgement], ['WAITING_REVIEWER_CLOSE', labels.waitingReviewerClose], ['COMPLETED_AGREED', labels.completedAgreed], ['COMPLETED_DISAGREED', labels.completedDisagreed], ['CLOSED_OPEN', labels.closedOpen]] as const
  const phaseLabel = (phase: string) => ({ WAITING_EMPLOYEE: labels.waitingEmployee, WAITING_ADDITIONAL_REVIEWER: labels.waitingAdditionalReviewer, WAITING_MANAGER: labels.waitingManager, WAITING_ACKNOWLEDGEMENT: labels.waitingAcknowledgement, WAITING_REVIEWER_CLOSE: labels.waitingReviewerClose, COMPLETED_AGREED: labels.completedAgreed, COMPLETED_DISAGREED: labels.completedDisagreed, CANCELLED: labels.cancelled } as Record<string, string>)[phase] ?? phase
  return <section aria-label={labels.dashboard} className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([phase, label]) => <Surface className="p-4" key={phase}><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><ListChecks aria-hidden="true" className="size-4 text-muted-foreground" /></div><p className="mt-2 text-2xl font-semibold tabular-nums">{data.phaseCounts[phase] ?? 0}</p></Surface>)}<Surface className="p-4 sm:col-span-2 xl:col-span-3"><div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm font-semibold"><Clock3 aria-hidden="true" className="size-4" />{labels.nextActions}</p></div>{data.nextActions.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-3">{data.nextActions.map((item) => <li className="rounded-[var(--radius-control)] border border-border-subtle p-3" key={item.id}><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{phaseLabel(item.phase)}{item.dueDate ? ` · ${item.dueDate}` : ''}</p><Link className="mt-2 inline-flex items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline" href={`/conversations/${encodeURIComponent(item.id)}`}>{labels.open}<ArrowRight aria-hidden="true" className="size-3.5" /></Link></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">{labels.noActions}</p>}</Surface></section>
}
