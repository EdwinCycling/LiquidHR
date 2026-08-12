import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarDays, Circle, Users } from 'lucide-react'
import { JourneyDetailActions } from '@/components/journeys/journey-detail-actions'
import { journeyRuntime, JourneyRuntimeServiceError } from '@/lib/journeys'
import { getJourneyLabels } from '@/lib/journeys/labels'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getLocale } from '@/lib/i18n/server'

export default async function JourneyDetailPage({ params }: { params: Promise<{ journeyId: string }> }) {
  const journeyId = (await params).journeyId
  let detail
  try { detail = await journeyRuntime.get(journeyId) } catch (error) { if (error instanceof JourneyRuntimeServiceError && error.status === 404) notFound(); throw error }
  const [labels, options, locale] = await Promise.all([getJourneyLabels(), requirePermission('journey:write').then(() => journeyRuntime.startOptions()).catch((error: unknown) => { if (error instanceof AuthorizationError) return null; throw error }), getLocale()])
  const journeyStatus = { PLANNED: labels.planned, ACTIVE: labels.active, PAUSED: labels.paused, COMPLETED: labels.completed, CANCELLED: labels.cancelled }
  const participantStatus = { ASSIGNED: labels.participantAssigned, ACTIVE: labels.participantActive, REPLACED: labels.participantReplaced, REMOVED: labels.participantRemoved }
  const topicStatus = { PENDING: labels.topicPending, COMPLETED: labels.topicCompleted, SKIPPED: labels.topicSkipped }
  return <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10"><Link className="text-sm font-semibold text-primary" href="/journeys">← {labels.back}</Link>
    <header className="mt-5 rounded-3xl border bg-surface p-6 shadow-sm"><p className="eyebrow">{labels.detailTitle}</p><div className="mt-2 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight">{detail.templateName[locale]}</h1><p className="mt-2 text-muted-foreground">{detail.targetEmployeeName} · {detail.targetEmployeeNumber}</p></div><span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">{journeyStatus[detail.status]}</span></div>{options ? <div className="mt-6"><JourneyDetailActions employees={options.employees} journeyId={detail.id} labels={labels} locale={locale} participants={detail.participants} status={detail.status} version={detail.version} /></div> : null}</header>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]"><section className="rounded-3xl border bg-surface p-6"><h2 className="flex items-center gap-2 text-xl font-semibold"><CalendarDays className="text-primary" size={20} />{labels.timeline}</h2><div className="mt-5 space-y-4">{detail.moments.map((moment) => <div className="relative border-l pl-6" key={moment.id}><Circle className="absolute -left-2.5 top-0 fill-surface text-primary" size={18} /><p className="font-semibold">{moment.name[locale]}</p><p className="mt-1 text-sm text-muted-foreground">{moment.scheduledOn}</p><div className="mt-2 space-y-1">{detail.topics.filter((topic) => topic.momentId === moment.id).map((topic) => <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm" key={topic.id}>{topic.title[locale]} · {topicStatus[topic.status as keyof typeof topicStatus]}</p>)}</div></div>)}</div></section>
    <aside className="space-y-6"><section className="rounded-3xl border bg-surface p-6"><h2 className="flex items-center gap-2 text-xl font-semibold"><Users className="text-primary" size={20} />{labels.participantsLabel}</h2><div className="mt-4 space-y-3">{detail.participants.map((participant) => <div className="rounded-xl border p-3" key={participant.id}><p className="font-semibold">{participant.roleName[locale]}</p><p className="text-sm text-muted-foreground">{participant.employeeName} · {participantStatus[participant.status as keyof typeof participantStatus]}</p></div>)}</div></section><section className="rounded-3xl border bg-surface p-6"><h2 className="text-xl font-semibold">{labels.history}</h2><div className="mt-4 space-y-3">{detail.changes.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noHistory}</p> : detail.changes.map((change) => <p className="rounded-xl border p-3 text-sm" key={change.id}>{change.reason} · {new Date(change.changedAt).toLocaleDateString(locale)}</p>)}</div></section></aside></div>
  </div>
}
