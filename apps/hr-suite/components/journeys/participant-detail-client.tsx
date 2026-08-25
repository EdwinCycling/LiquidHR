'use client'

import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Circle, ExternalLink, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { DetailColumns } from '@/components/layout/detail-columns'
import { PageHeader } from '@/components/patterns/page-header'
import { SectionHeader } from '@/components/patterns/section-header'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import type { JourneyLabels } from '@/lib/journeys/labels'
import { journeyProgressPercent, localizedValue, type JourneyProjection } from '@/lib/journeys/projection-domain'
import type { Locale } from '@/lib/i18n/config'
import type { JourneyParticipantAssignment, JourneyParticipantDetailLabels } from './journey-participant-detail'

interface ParticipantDetailClientProps {
  projection: JourneyProjection
  locale: Locale
  labels: JourneyParticipantDetailLabels
  backHref: string
  participantAssignments?: readonly JourneyParticipantAssignment[]
  selectedAssignment?: JourneyParticipantAssignment | null
  selectedParticipantId?: string
}

function journeyStatusTone(status: JourneyProjection['status']): BadgeTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'PAUSED') return 'warning'
  if (status === 'CANCELLED') return 'danger'
  return 'neutral'
}

function participantStatusLabel(status: JourneyParticipantAssignment['status'], labels: Pick<JourneyLabels, 'participantActive' | 'participantAssigned' | 'participantReplaced' | 'participantRemoved'>): string {
  if (status === 'ACTIVE') return labels.participantActive
  if (status === 'ASSIGNED') return labels.participantAssigned
  if (status === 'REPLACED') return labels.participantReplaced
  return labels.participantRemoved
}

function participantStatusTone(status: JourneyParticipantAssignment['status']): BadgeTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'ASSIGNED') return 'info'
  if (status === 'REPLACED') return 'warning'
  return 'danger'
}

function topicStatusLabel(status: 'PENDING' | 'COMPLETED' | 'SKIPPED', labels: JourneyParticipantDetailLabels): string {
  if (status === 'COMPLETED') return labels.topicCompleted
  if (status === 'SKIPPED') return labels.topicSkipped
  return labels.topicPending
}

function topicStatusTone(status: 'PENDING' | 'COMPLETED' | 'SKIPPED', available: boolean): BadgeTone {
  if (status === 'COMPLETED') return 'success'
  if (status === 'SKIPPED') return 'neutral'
  return available ? 'info' : 'neutral'
}

export function ParticipantDetailClient({ backHref, labels, locale, participantAssignments, projection, selectedAssignment, selectedParticipantId }: ParticipantDetailClientProps) {
  const router = useRouter()
  const [busyTopicId, setBusyTopicId] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const progress = journeyProgressPercent(projection.progress)
  const today = new Date().toISOString().slice(0, 10)
  const nextAction = projection.nextAction
  const detailTitle = selectedAssignment ? `${labels.participantDetailTitle}: ${selectedAssignment.employeeName}` : labels.participantTitle
  const visibleAssignments = participantAssignments ?? []
  const actorLabel = projection.relationship === 'HR' ? labels.hrView : projection.relationship === 'SELF' ? labels.selfView : labels.participantView

  async function recordOutcome(topicId: string, outcomeType: 'COMPLETE' | 'SKIP'): Promise<void> {
    setBusyTopicId(topicId)
    setError(false)
    try {
      const response = await fetch(`/api/journeys/${projection.id}/topics/${topicId}/outcome`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ outcomeType }),
      })
      if (!response.ok) throw new Error('JOURNEY_TOPIC_OUTCOME_FAILED')
      router.refresh()
    } catch {
      setError(true)
    } finally {
      setBusyTopicId(null)
    }
  }

  return (
    <div>
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" href={backHref}>
        <ArrowLeft aria-hidden="true" className="size-4" />{labels.back}
      </Link>
      <PageHeader
        actions={<Badge tone={journeyStatusTone(projection.status)}>{labels.statusLabel} · {actorLabel}</Badge>}
        className="mt-5"
        description={labels.participantSubtitle}
        title={detailTitle}
      />

      <Surface className="mt-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="font-medium text-muted-foreground">{labels.progress}</span>
          <span className="tabular-nums font-semibold">{projection.progress.completed}/{projection.progress.total} · {progress}%</span>
        </div>
        <div aria-label={`${labels.progress}: ${progress}%`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress} className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      </Surface>

      {error ? <p className="mt-5 rounded-[var(--radius-surface)] border border-destructive bg-destructive-surface p-4 text-sm text-destructive" role="alert">{labels.topicActionFailed}</p> : null}

      <DetailColumns
        className="mt-6"
        main={(
          <Surface className="p-5 sm:p-6">
            <SectionHeader description={labels.participantDetailSubtitle} title={labels.timeline} />
            <div className="mt-6 space-y-8">
              {projection.phases.length === 0 ? <EmptyState title={labels.noTopics} /> : projection.phases.map((phase) => (
                <section key={phase.id}>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{localizedValue(phase.name, locale)}</h3>
                  <div className="mt-4 space-y-5">
                    {phase.moments.map((moment) => (
                      <article className="relative border-l border-primary/25 pl-6" id={`moment-${moment.id}`} key={moment.id}>
                        <Circle aria-hidden="true" className="absolute -left-[0.55rem] top-0 fill-surface text-primary" size={18} />
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h4 className="font-semibold">{localizedValue(moment.name, locale)}</h4>
                            <time className="mt-1 block text-sm text-muted-foreground" dateTime={moment.scheduledOn}>{new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${moment.scheduledOn}T00:00:00Z`))}</time>
                          </div>
                          {moment.availableOn > today ? <Badge>{labels.upcomingTopic}</Badge> : null}
                        </div>
                        <div className="mt-3 space-y-3">
                          {moment.topics.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noTopics}</p> : moment.topics.map((topic) => {
                            const isAvailable = projection.status === 'ACTIVE' && topic.status === 'PENDING' && moment.availableOn <= today
                            return (
                              <div className="rounded-[var(--radius-surface)] border border-subtle bg-surface-subtle p-4" key={topic.id}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{labels.topicTypes[topic.topicType]}</p>
                                    <h5 className="mt-1 text-sm font-semibold">{localizedValue(topic.title, locale)}</h5>
                                  </div>
                                  <Badge tone={topicStatusTone(topic.status, isAvailable)}>{topic.status === 'PENDING' && isAvailable ? labels.available : topicStatusLabel(topic.status, labels)}</Badge>
                                </div>
                                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">{localizedValue(topic.body, locale)}</p>
                                <div className="mt-4 flex flex-wrap items-center gap-3">
                                  {topic.actionUrl ? <Link className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary hover:underline" href={topic.actionUrl}><ExternalLink aria-hidden="true" size={15} />{labels.openTopicAction}</Link> : null}
                                  {topic.status === 'COMPLETED' ? <span className="inline-flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 aria-hidden="true" size={16} />{labels.outcomeSaved}</span> : null}
                                  {isAvailable ? <div className="ml-auto flex flex-wrap gap-2"><Button loading={busyTopicId === topic.id} onClick={() => void recordOutcome(topic.id, 'COMPLETE')} type="button">{labels.completeTopic}</Button><Button disabled={busyTopicId === topic.id} onClick={() => void recordOutcome(topic.id, 'SKIP')} type="button" variant="secondary">{labels.skipTopic}</Button></div> : null}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </Surface>
        )}
        aside={(
          <div className="space-y-6">
            <Surface className="p-5 sm:p-6">
              <SectionHeader title={labels.participantsLabel} />
              <div className="mt-4 space-y-2">
                {visibleAssignments.length > 0 ? visibleAssignments.map((assignment) => (
                  <Link aria-current={assignment.id === selectedParticipantId ? 'page' : undefined} className={`block rounded-[var(--radius-control)] border p-3 transition-colors hover:bg-surface-raised ${assignment.id === selectedParticipantId ? 'border-primary bg-accent/20' : 'border-subtle'}`} href={`?participantId=${assignment.id}`} key={assignment.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2"><span className="font-semibold">{assignment.employeeName}</span><Badge tone={participantStatusTone(assignment.status)}>{participantStatusLabel(assignment.status, labels)}</Badge></div>
                    <p className="mt-1 text-sm text-muted-foreground">{localizedValue(assignment.roleName, locale)}</p>
                  </Link>
                )) : projection.participants.map((participant) => (
                  <div className="rounded-[var(--radius-control)] border border-subtle p-3" key={`${participant.roleKey}-${participant.employeeName ?? 'unknown'}`}><div className="flex flex-wrap items-start justify-between gap-2"><span className="font-semibold">{participant.employeeName ?? labels.unknownParticipant}</span><Badge tone={participant.status === 'ACTIVE' ? 'success' : 'info'}>{participant.status === 'ACTIVE' ? labels.participantActive : labels.participantAssigned}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{localizedValue(participant.roleName, locale)}</p></div>
                ))}
                {visibleAssignments.length === 0 && projection.participants.length === 0 ? <EmptyState icon={<Users />} title={labels.noParticipants} /> : null}
              </div>
            </Surface>
            {nextAction ? <Surface className="p-5 sm:p-6" variant="subtle"><SectionHeader title={labels.nextAction} /><p className="mt-3 font-semibold">{localizedValue(nextAction.title, locale)}</p><p className="mt-1 text-sm text-muted-foreground">{nextAction.availability === 'AVAILABLE' ? labels.available : labels.upcomingTopic}</p><Link className="mt-4 inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-border bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-raised" href={`#moment-${nextAction.momentId}`}>{labels.topicDetails}</Link></Surface> : null}
          </div>
        )}
      />
    </div>
  )
}
