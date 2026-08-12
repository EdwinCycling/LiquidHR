'use client'

import Link from 'next/link'
import { CalendarDays, CheckCircle2, Circle, ExternalLink, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Locale } from '@/lib/i18n/config'
import { journeyProgressPercent, localizedValue, type JourneyProjection } from '@/lib/journeys/projection-domain'
import type { JourneyLabels } from '@/lib/journeys/labels'

interface JourneyParticipantDetailProps {
  projection: JourneyProjection
  locale: Locale
  labels: Pick<JourneyLabels, 'back' | 'participantTitle' | 'participantSubtitle' | 'progress' | 'nextAction' | 'available' | 'upcomingTopic' | 'completeTopic' | 'skipTopic' | 'topicDetails' | 'openTopicAction' | 'outcomeSaved' | 'topicActionFailed' | 'timeline' | 'participantsLabel' | 'active' | 'planned' | 'paused' | 'completed' | 'cancelled' | 'topicPending' | 'topicCompleted' | 'topicSkipped' | 'topicTypes'>
}

function statusLabel(status: JourneyProjection['status'], labels: JourneyParticipantDetailProps['labels']): string {
  if (status === 'ACTIVE') return labels.active
  if (status === 'PLANNED') return labels.planned
  if (status === 'PAUSED') return labels.paused
  if (status === 'COMPLETED') return labels.completed
  return labels.cancelled
}

function topicStatusLabel(status: 'PENDING' | 'COMPLETED' | 'SKIPPED', labels: JourneyParticipantDetailProps['labels']): string {
  if (status === 'COMPLETED') return labels.topicCompleted
  if (status === 'SKIPPED') return labels.topicSkipped
  return labels.topicPending
}

export function JourneyParticipantDetail({ projection, locale, labels }: JourneyParticipantDetailProps) {
  const router = useRouter()
  const [busyTopicId, setBusyTopicId] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const progress = journeyProgressPercent(projection.progress)
  const today = new Date().toISOString().slice(0, 10)
  const nextAction = projection.nextAction

  async function recordOutcome(topicId: string, outcomeType: 'COMPLETE' | 'SKIP'): Promise<void> {
    setBusyTopicId(topicId)
    setError(false)
    const response = await fetch(`/api/journeys/${projection.id}/topics/${topicId}/outcome`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ outcomeType }),
    })
    if (response.ok) router.refresh()
    else setError(true)
    setBusyTopicId(null)
  }

  return <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" href="/dashboard/start">← {labels.back}</Link>
    <header className="mt-5 overflow-hidden rounded-[1.75rem] border border-primary/15 bg-primary p-5 text-primary-foreground shadow-[0_1.5rem_3rem_color-mix(in_srgb,var(--primary)_18%,transparent)] sm:p-7"><div className="flex flex-wrap items-start justify-between gap-5"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-foreground/70">{labels.participantTitle}</p><h1 className="mt-2 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{localizedValue(projection.templateName, locale)}</h1><p className="mt-2 text-sm text-primary-foreground/75">{projection.targetEmployeeName ?? ''} · {new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${projection.anchorDate}T00:00:00Z`))}</p></div><span className="status-chip bg-primary-foreground/15 text-primary-foreground">{statusLabel(projection.status, labels)}</span></div><p className="mt-4 max-w-2xl text-sm leading-6 text-primary-foreground/80">{labels.participantSubtitle}</p><div className="mt-6 max-w-xl"><div className="flex items-center justify-between gap-3 text-xs font-semibold text-primary-foreground/80"><span>{labels.progress}</span><span className="tabular-nums">{projection.progress.completed}/{projection.progress.total} · {progress}%</span></div><div aria-label={`${labels.progress}: ${progress}%`} className="mt-2 h-2 overflow-hidden rounded-full bg-primary-foreground/20"><div className="h-full rounded-full bg-primary-foreground transition-[width]" style={{ width: `${progress}%` }} /></div></div></header>

    {error ? <p className="mt-5 rounded-xl border border-destructive/30 bg-destructive-surface p-4 text-sm text-destructive" role="alert">{labels.topicActionFailed}</p> : null}
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,.75fr)]"><section className="rounded-[1.5rem] border bg-surface p-5 shadow-sm sm:p-6"><h2 className="flex items-center gap-2 text-xl font-semibold"><CalendarDays aria-hidden="true" className="text-primary" size={20} />{labels.timeline}</h2><div className="mt-6 space-y-7">{projection.phases.map((phase) => <section key={phase.id}><h3 className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">{localizedValue(phase.name, locale)}</h3><div className="mt-4 space-y-5">{phase.moments.map((moment) => <article className="relative border-l border-primary/25 pl-6" id={`moment-${moment.id}`} key={moment.id}><Circle aria-hidden="true" className="absolute -left-[0.55rem] top-0 fill-surface text-primary" size={18} /><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold">{localizedValue(moment.name, locale)}</h4><time className="mt-1 block text-sm text-muted-foreground" dateTime={moment.scheduledOn}>{new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${moment.scheduledOn}T00:00:00Z`))}</time></div>{moment.availableOn > today ? <span className="status-chip bg-muted text-muted-foreground">{labels.upcomingTopic}</span> : null}</div><div className="mt-3 space-y-3">{moment.topics.map((topic) => { const isAvailable = projection.status === 'ACTIVE' && topic.status === 'PENDING' && moment.availableOn <= today; const title = localizedValue(topic.title, locale); return <div className="rounded-2xl border border-border/80 bg-background p-4" key={topic.id}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{labels.topicTypes[topic.topicType]}</p><h5 className="mt-1 text-sm font-semibold">{title}</h5></div><span className={`status-chip shrink-0 ${topic.status === 'COMPLETED' ? 'bg-success-surface text-success' : topic.status === 'SKIPPED' ? 'bg-muted text-muted-foreground' : isAvailable ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>{topic.status === 'PENDING' && isAvailable ? labels.available : topicStatusLabel(topic.status, labels)}</span></div><p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">{localizedValue(topic.body, locale)}</p><div className="mt-4 flex flex-wrap items-center gap-3">{topic.actionUrl ? <Link className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary hover:underline" href={topic.actionUrl}><ExternalLink aria-hidden="true" size={15} />{labels.openTopicAction}</Link> : null}{topic.status === 'COMPLETED' ? <span className="inline-flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 aria-hidden="true" size={16} />{labels.outcomeSaved}</span> : null}{isAvailable ? <div className="ml-auto flex flex-wrap gap-2"><button className="button-primary min-h-10" disabled={busyTopicId === topic.id} onClick={() => void recordOutcome(topic.id, 'COMPLETE')} type="button">{labels.completeTopic}</button><button className="button-secondary min-h-10" disabled={busyTopicId === topic.id} onClick={() => void recordOutcome(topic.id, 'SKIP')} type="button">{labels.skipTopic}</button></div> : null}</div></div> })}</div></article>)}</div></section>)}</div></section>
      <aside className="space-y-6"><section className="rounded-[1.5rem] border bg-surface p-5 shadow-sm sm:p-6"><h2 className="flex items-center gap-2 text-xl font-semibold"><Users aria-hidden="true" className="text-primary" size={20} />{labels.participantsLabel}</h2><div className="mt-4 space-y-3">{projection.participants.map((participant) => <div className="rounded-xl border bg-background p-3" key={`${participant.roleKey}-${participant.employeeName ?? 'unknown'}`}><p className="font-semibold">{localizedValue(participant.roleName, locale)}</p><p className="mt-1 text-sm text-muted-foreground">{participant.employeeName ?? ''}</p></div>)}</div></section>{nextAction ? <section className="rounded-[1.5rem] border border-primary/20 bg-accent/25 p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{labels.nextAction}</p><p className="mt-2 font-semibold">{localizedValue(nextAction.title, locale)}</p><p className="mt-1 text-sm text-muted-foreground">{nextAction.availability === 'AVAILABLE' ? labels.available : labels.upcomingTopic}</p><Link className="button-secondary mt-4 inline-flex" href={`#moment-${nextAction.momentId}`}>{labels.topicDetails}</Link></section> : null}</aside>
    </div>
  </main>
}
