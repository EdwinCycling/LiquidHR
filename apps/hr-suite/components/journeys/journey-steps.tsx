'use client'

import Link from 'next/link'
import { CalendarDays, CheckCircle2, Circle, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { DetailColumns } from '@/components/layout/detail-columns'
import { PageShell } from '@/components/layout/page-shell'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { InfoList } from '@/components/patterns/info-list'
import { PageHeader } from '@/components/patterns/page-header'
import { SectionHeader } from '@/components/patterns/section-header'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import type { Locale } from '@/lib/i18n/config'
import { localizedValue, type JourneyProjection } from '@/lib/journeys/projection-domain'
import type { JourneyLabels } from '@/lib/journeys/labels'
import type { JourneyRuntimeDetail } from '@/lib/journeys'
import { journeyProgressFromTopics, isJourneyTopicActionAvailable } from '@/lib/journeys/steps'

export type JourneyStepsLabels = Pick<JourneyLabels, 'back' | 'progress' | 'nextAction' | 'available' | 'upcomingTopic' | 'completeTopic' | 'skipTopic' | 'topicDetails' | 'openTopicAction' | 'outcomeSaved' | 'topicActionFailed' | 'timeline' | 'participantsLabel' | 'active' | 'planned' | 'paused' | 'completed' | 'cancelled' | 'topicPending' | 'topicCompleted' | 'topicSkipped' | 'topicTypes' | 'required' | 'optional' | 'targetEmployee' | 'anchorDate' | 'emptySteps' | 'skipConfirmTitle' | 'skipConfirmDescription' | 'skipConfirm' | 'cancel'> & {
  title: string
  subtitle: string
}

type JourneyStepTopic = {
  id: string
  title: Record<string, string>
  body: Record<string, string>
  topicType: string
  isRequired: boolean
  status: string
  actionUrl: string | null
  ownerNames: readonly string[]
}

type JourneyStepMoment = {
  id: string
  name: Record<string, string>
  scheduledOn: string
  availableOn: string
  topics: readonly JourneyStepTopic[]
}

type JourneyStepPhase = {
  id: string
  name: Record<string, string>
  moments: readonly JourneyStepMoment[]
}

type JourneyStepParticipant = {
  roleName: Record<string, string>
  employeeName: string | null
}

type JourneyStepsModel = {
  id: string
  templateName: Record<string, string>
  status: string
  anchorDate: string
  targetEmployeeName: string | null
  progress: { completed: number; total: number }
  phases: readonly JourneyStepPhase[]
  participants: readonly JourneyStepParticipant[]
}

type JourneyStepsProps = {
  locale: Locale
  labels: JourneyStepsLabels
  backHref: string
} & ({ mode: 'management'; detail: JourneyRuntimeDetail } | { mode: 'participant'; projection: JourneyProjection })

type TopicOutcome = 'COMPLETE' | 'SKIP'

function dateLabel(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

function statusLabel(status: string, labels: JourneyStepsLabels): string {
  if (status === 'ACTIVE') return labels.active
  if (status === 'PLANNED') return labels.planned
  if (status === 'PAUSED') return labels.paused
  if (status === 'COMPLETED') return labels.completed
  return labels.cancelled
}

function statusTone(status: string): BadgeTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'PAUSED') return 'warning'
  if (status === 'COMPLETED') return 'info'
  if (status === 'CANCELLED') return 'danger'
  return 'neutral'
}

function topicStatusLabel(status: string, labels: JourneyStepsLabels): string {
  if (status === 'COMPLETED') return labels.topicCompleted
  if (status === 'SKIPPED') return labels.topicSkipped
  return labels.topicPending
}

function topicTone(status: string, available: boolean): BadgeTone {
  if (status === 'COMPLETED') return 'success'
  if (status === 'SKIPPED') return 'neutral'
  return available ? 'info' : 'neutral'
}

function topicTypeLabel(topicType: string, labels: JourneyStepsLabels): string {
  if (topicType === 'ACTION') return labels.topicTypes.ACTION
  if (topicType === 'CHECK_IN') return labels.topicTypes.CHECK_IN
  if (topicType === 'DOCUMENT') return labels.topicTypes.DOCUMENT
  return labels.topicTypes.INFORMATION
}

function fromProjection(projection: JourneyProjection): JourneyStepsModel {
  return {
    id: projection.id,
    templateName: projection.templateName,
    status: projection.status,
    anchorDate: projection.anchorDate,
    targetEmployeeName: projection.targetEmployeeName,
    progress: projection.progress,
    participants: projection.participants.map((participant) => ({ roleName: participant.roleName, employeeName: participant.employeeName })),
    phases: projection.phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      moments: phase.moments.map((moment) => ({
        id: moment.id,
        name: moment.name,
        scheduledOn: moment.scheduledOn,
        availableOn: moment.availableOn,
        topics: moment.topics.map((topic) => ({ ...topic, ownerNames: [] })),
      })),
    })),
  }
}

function fromManagementDetail(detail: JourneyRuntimeDetail): JourneyStepsModel {
  const topicsByMoment = new Map<string, JourneyStepTopic[]>(detail.moments.map((moment) => [moment.id, []]))
  for (const topic of detail.topics) {
    topicsByMoment.get(topic.momentId)?.push({
      id: topic.id,
      title: topic.title,
      body: topic.body,
      topicType: topic.topicType,
      isRequired: topic.isRequired,
      status: topic.status,
      actionUrl: topic.actionUrl,
      ownerNames: topic.ownerNames,
    })
  }
  const phases = detail.phases.map((phase) => ({
    id: phase.id,
    name: phase.name,
    moments: detail.moments.filter((moment) => moment.phaseId === phase.id).map((moment) => ({
      id: moment.id,
      name: moment.name,
      scheduledOn: moment.scheduledOn,
      availableOn: moment.availableOn,
      topics: topicsByMoment.get(moment.id) ?? [],
    })),
  }))
  return {
    id: detail.id,
    templateName: detail.templateName,
    status: detail.status,
    anchorDate: detail.anchorDate,
    targetEmployeeName: detail.targetEmployeeName,
    progress: journeyProgressFromTopics(detail.topics),
    participants: detail.participants.map((participant) => ({ roleName: participant.roleName, employeeName: participant.employeeName })),
    phases,
  }
}

function TopicOutcomeActions({ journeyId, topic, moment, journeyStatus, labels }: { journeyId: string; topic: JourneyStepTopic; moment: JourneyStepMoment; journeyStatus: string; labels: JourneyStepsLabels }) {
  const router = useRouter()
  const [pending, setPending] = useState<TopicOutcome | null>(null)
  const [skipOpen, setSkipOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const available = isJourneyTopicActionAvailable({ journeyStatus, topicStatus: topic.status, availableOn: moment.availableOn, today })

  async function submit(outcomeType: TopicOutcome): Promise<boolean> {
    setPending(outcomeType)
    setFailed(false)
    try {
      const response = await fetch(`/api/journeys/${journeyId}/topics/${topic.id}/outcome`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ outcomeType }),
      })
      if (!response.ok) throw new Error('JOURNEY_TOPIC_OUTCOME_FAILED')
      router.refresh()
      return true
    } catch {
      setFailed(true)
      return false
    } finally {
      setPending(null)
    }
  }

  if (!available) return null

  return <div className="mt-4 flex flex-wrap items-center gap-2">
    <Button disabled={pending !== null} loading={pending === 'COMPLETE'} onClick={() => void submit('COMPLETE')} size="sm" type="button">{labels.completeTopic}</Button>
    <Button disabled={pending !== null} onClick={() => setSkipOpen(true)} size="sm" type="button" variant="secondary">{labels.skipTopic}</Button>
    {failed ? <p className="basis-full text-sm text-destructive" role="alert">{labels.topicActionFailed}</p> : null}
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.skipConfirm} description={labels.skipConfirmDescription} destructive onConfirm={async () => { if (await submit('SKIP')) setSkipOpen(false) }} onOpenChange={setSkipOpen} open={skipOpen} pending={pending === 'SKIP'} title={labels.skipConfirmTitle} />
  </div>
}

function TopicCard({ journeyId, moment, topic, journeyStatus, locale, labels }: { journeyId: string; moment: JourneyStepMoment; topic: JourneyStepTopic; journeyStatus: string; locale: Locale; labels: JourneyStepsLabels }) {
  const today = new Date().toISOString().slice(0, 10)
  const available = isJourneyTopicActionAvailable({ journeyStatus, topicStatus: topic.status, availableOn: moment.availableOn, today })
  const body = localizedValue(topic.body, locale)
  const topicType = topicTypeLabel(topic.topicType, labels)
  return <Surface className="p-4" data-topic-id={topic.id}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{topicType} · {topic.isRequired ? labels.required : labels.optional}</p>
        <h4 className="mt-1 text-sm font-semibold text-foreground">{localizedValue(topic.title, locale)}</h4>
      </div>
      <Badge tone={topicTone(topic.status, available)}>{topic.status === 'PENDING' && available ? labels.available : topicStatusLabel(topic.status, labels)}</Badge>
    </div>
    {body ? <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">{body}</p> : null}
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {topic.actionUrl ? <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href={topic.actionUrl}><ExternalLink aria-hidden="true" />{labels.openTopicAction}</Link> : null}
      {topic.status === 'COMPLETED' ? <span className="inline-flex items-center gap-2 text-sm font-medium text-success"><CheckCircle2 aria-hidden="true" size={16} />{labels.outcomeSaved}</span> : null}
      <TopicOutcomeActions journeyId={journeyId} journeyStatus={journeyStatus} labels={labels} moment={moment} topic={topic} />
    </div>
  </Surface>
}

export function JourneySteps(props: JourneyStepsProps) {
  const model = props.mode === 'management' ? fromManagementDetail(props.detail) : fromProjection(props.projection)
  const { labels, locale } = props
  const progress = model.progress
  const progressPercent = progress.total === 0 ? 0 : Math.min(100, Math.round((progress.completed / progress.total) * 100))
  const today = new Date().toISOString().slice(0, 10)
  const nextAction = model.phases.flatMap((phase) => phase.moments.flatMap((moment) => moment.topics.map((topic) => ({ moment, topic })))).find(({ topic }) => topic.status === 'PENDING') ?? null
  const hasTopics = model.phases.some((phase) => phase.moments.some((moment) => moment.topics.length > 0))

  return <main>
    <PageShell className="py-8 lg:py-10">
      <PageHeader actions={<Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href={props.backHref}>{labels.back}</Link>} description={labels.subtitle} title={labels.title} />
      <Surface className="mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><p className="text-sm font-medium text-muted-foreground">{localizedValue(model.templateName, locale)}</p><p className="mt-1 text-sm text-muted-foreground">{model.targetEmployeeName ?? ''}</p></div>
          <Badge tone={statusTone(model.status)}>{statusLabel(model.status, labels)}</Badge>
        </div>
        <InfoList className="mt-5" columns={2} items={[{ label: labels.targetEmployee, value: model.targetEmployeeName ?? '—' }, { label: labels.anchorDate, value: dateLabel(model.anchorDate, locale) }]} />
        <div aria-label={`${labels.progress}: ${progressPercent}%`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={progressPercent} className="mt-5 max-w-xl" role="progressbar">
          <div className="flex items-center justify-between gap-3 text-sm font-medium"><span>{labels.progress}</span><span className="tabular-nums">{progress.completed}/{progress.total} · {progressPercent}%</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progressPercent}%` }} /></div>
        </div>
      </Surface>

      <DetailColumns className="mt-6" main={<Surface className="p-5 sm:p-6">
        <SectionHeader description={labels.subtitle} title={labels.timeline} />
        {!hasTopics ? <EmptyState className="mt-5" description={labels.emptySteps} icon={<CalendarDays />} title={labels.emptySteps} /> : <div className="mt-6 space-y-8">
          {model.phases.map((phase) => <section key={phase.id}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{localizedValue(phase.name, locale)}</h3>
            <div className="mt-4 space-y-6">{phase.moments.map((moment) => <article className="relative border-l-2 border-border-subtle pl-4 sm:pl-6" id={`moment-${moment.id}`} key={moment.id}>
              <Circle aria-hidden="true" className="absolute -left-[0.6rem] top-0 fill-surface text-primary" size={18} />
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold text-foreground">{localizedValue(moment.name, locale)}</h4><time className="mt-1 block text-sm text-muted-foreground" dateTime={moment.scheduledOn}>{dateLabel(moment.scheduledOn, locale)}</time></div>{moment.availableOn > today ? <Badge>{labels.upcomingTopic}</Badge> : null}</div>
              <div className="mt-4 space-y-3">{moment.topics.map((topic) => <TopicCard journeyId={model.id} journeyStatus={model.status} labels={labels} locale={locale} moment={moment} topic={topic} key={topic.id} />)}</div>
            </article>)}</div>
          </section>)}
        </div>}
      </Surface>} aside={<div className="space-y-6">
        <Surface className="p-5 sm:p-6"><SectionHeader title={labels.participantsLabel} /><div className="mt-4 space-y-3">{model.participants.map((participant, index) => <div className="border-b border-border-subtle pb-3 last:border-0 last:pb-0" key={`${localizedValue(participant.roleName, locale)}-${participant.employeeName ?? index}`}><p className="font-medium text-foreground">{localizedValue(participant.roleName, locale)}</p><p className="mt-1 text-sm text-muted-foreground">{participant.employeeName ?? '—'}</p></div>)}</div></Surface>
        {nextAction ? <Surface className="p-5 sm:p-6" variant="subtle"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.nextAction}</p><p className="mt-2 font-semibold text-foreground">{localizedValue(nextAction.topic.title, locale)}</p><p className="mt-1 text-sm text-muted-foreground">{isJourneyTopicActionAvailable({ journeyStatus: model.status, topicStatus: nextAction.topic.status, availableOn: nextAction.moment.availableOn, today }) ? labels.available : labels.upcomingTopic}</p><Link className={buttonClasses({ className: 'mt-4', size: 'sm', variant: 'secondary' })} href={`#moment-${nextAction.moment.id}`}>{labels.topicDetails}</Link></Surface> : null}
      </div>} />
    </PageShell>
  </main>
}
