import Link from 'next/link'
import { AlertTriangle, CalendarDays, Plus, Users } from 'lucide-react'
import { journeyRuntime, listJourneyProjections } from '@/lib/journeys'
import { deriveJourneyAttention } from '@/lib/journeys/runtime-domain'
import { getJourneyLabels } from '@/lib/journeys/labels'
import { AuthorizationError, getRequestAuthorizationContext, requirePermission } from '@/lib/auth/permissions'
import { getLocale } from '@/lib/i18n/server'
import { journeyProgressPercent, localizedValue } from '@/lib/journeys/projection-domain'

const statuses = ['ALL', 'PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const

export default async function JourneyLivePage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const requestContext = await getRequestAuthorizationContext()
  const [participantLabels, participantLocale] = await Promise.all([getJourneyLabels(), getLocale()])
  if (!requestContext.context.permissions.includes('journey:read')) {
    const projections = await listJourneyProjections()
    return <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-10"><header><p className="eyebrow">{participantLabels.eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{participantLabels.participantTitle}</h1><p className="mt-3 text-muted-foreground">{participantLabels.participantSubtitle}</p></header><div className="mt-6 space-y-3">{projections.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">{participantLabels.noJourneys}</div> : projections.map((journey) => <Link className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-surface p-5 transition hover:border-primary/40 hover:shadow-sm" href={`/journeys/${journey.id}`} key={journey.id}><div><h2 className="font-semibold">{localizedValue(journey.templateName, participantLocale)}</h2><p className="mt-1 text-sm text-muted-foreground">{journey.targetEmployeeName ?? ''}</p></div><span className="text-sm font-semibold tabular-nums text-accent-foreground">{journeyProgressPercent(journey.progress)}%</span></Link>)}</div></div>
  }
  const [items, labels, query, canWrite, locale] = await Promise.all([journeyRuntime.list(), getJourneyLabels(), searchParams, requirePermission('journey:write').then(() => true).catch((error: unknown) => { if (error instanceof AuthorizationError) return false; throw error }), getLocale()])
  const q = query.q?.trim().toLocaleLowerCase() ?? ''
  const selectedStatus: (typeof statuses)[number] = statuses.includes(query.status as (typeof statuses)[number]) ? query.status as (typeof statuses)[number] : 'ALL'
  const filtered = items.filter((item) => (selectedStatus === 'ALL' || item.status === selectedStatus) && (!q || `${item.templateName.nl} ${item.templateName.en} ${item.targetEmployeeName} ${item.targetEmployeeNumber}`.toLocaleLowerCase().includes(q)))
  const statusLabels = { PLANNED: labels.planned, ACTIVE: labels.active, PAUSED: labels.paused, COMPLETED: labels.completed, CANCELLED: labels.cancelled } as const
  return <div className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-10">
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">{labels.eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{labels.liveTitle}</h1><p className="mt-3 text-muted-foreground">{labels.liveSubtitle}</p></div>{canWrite ? <Link className="button-primary" href="/journeys/new"><Plus size={17} />{labels.startJourney}</Link> : null}</header>
    <form className="mt-8 grid gap-3 rounded-2xl border bg-surface p-4 sm:grid-cols-[1fr_14rem_auto]"><input className="form-field" defaultValue={query.q} name="q" placeholder={labels.searchJourneys} /><select className="form-field" defaultValue={selectedStatus} name="status"><option value="ALL">{labels.allStatuses}</option>{statuses.filter((status): status is Exclude<(typeof statuses)[number], 'ALL'> => status !== 'ALL').map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select><button className="button-secondary" type="submit">{labels.search}</button></form>
    <div className="mt-6 space-y-3">{filtered.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">{labels.noJourneys}</div> : filtered.map((item) => {
      const attention = deriveJourneyAttention({ status: item.status, nextMomentOn: item.nextMomentOn, overdueRequiredTopics: item.overdueRequiredTopics, today: new Date().toISOString().slice(0, 10) })
      return <Link className="grid gap-4 rounded-2xl border bg-surface p-5 transition hover:border-primary/40 hover:shadow-sm md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center" href={`/journeys/${item.id}/overview`} key={item.id}><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{item.templateName[locale]}</h2><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{statusLabels[item.status]}</span>{attention === 'ATTENTION' ? <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive"><AlertTriangle size={13} />{labels.attention}</span> : null}</div><p className="mt-1 text-sm text-muted-foreground">{item.targetEmployeeName} · {item.targetEmployeeNumber}</p></div><div className="text-sm"><span className="flex items-center gap-2 text-muted-foreground"><Users size={15} />{labels.participantsLabel}</span><p className="mt-1 truncate">{item.participantNames.join(', ')}</p></div><div className="text-sm"><span className="flex items-center gap-2 text-muted-foreground"><CalendarDays size={15} />{labels.nextMoment}</span><p className="mt-1">{item.nextMomentName?.[locale] ?? '—'} {item.nextMomentOn ?? ''}</p></div><span className="text-primary">→</span></Link>
    })}</div>
  </div>
}
