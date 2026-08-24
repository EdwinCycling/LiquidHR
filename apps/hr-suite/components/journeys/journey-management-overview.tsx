import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Info,
  Users,
} from 'lucide-react'
import { DetailColumns } from '@/components/layout/detail-columns'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { SectionHeader } from '@/components/patterns/section-header'
import { buttonClasses } from '@/components/ui/button'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { InfoList } from '@/components/patterns/info-list'
import { Surface } from '@/components/ui/surface'
import { formatDate } from '@/lib/preferences/formatters'
import type { DateFormat } from '@/lib/preferences/user-preferences'
import type { JourneyLabels } from '@/lib/journeys/labels'
import type { JourneyRuntimeDetail, JourneyStartOptions } from '@/lib/journeys/runtime-service'
import { buildJourneyManagementOverview } from '@/lib/journeys/management-overview'
import { JourneyDetailActions } from './journey-detail-actions'

type JourneyManagementOverviewProps = {
  readonly detail: JourneyRuntimeDetail
  readonly labels: JourneyLabels
  readonly locale: 'nl' | 'en'
  readonly dateFormat: DateFormat
  readonly canWrite: boolean
  readonly options: JourneyStartOptions | null
}

function statusTone(status: JourneyRuntimeDetail['status']): BadgeTone {
  if (status === 'ACTIVE') return 'info'
  if (status === 'PAUSED') return 'warning'
  if (status === 'COMPLETED') return 'success'
  if (status === 'CANCELLED') return 'danger'
  return 'neutral'
}

function attentionTone(attention: ReturnType<typeof buildJourneyManagementOverview>['attention']): BadgeTone {
  if (attention === 'ATTENTION') return 'danger'
  if (attention === 'UPCOMING') return 'info'
  if (attention === 'PAUSED') return 'warning'
  if (attention === 'COMPLETED') return 'success'
  if (attention === 'CANCELLED') return 'danger'
  return 'neutral'
}

function statusLabel(status: JourneyRuntimeDetail['status'], labels: JourneyLabels): string {
  const key: 'planned' | 'active' | 'paused' | 'completed' | 'cancelled' = ({ PLANNED: 'planned', ACTIVE: 'active', PAUSED: 'paused', COMPLETED: 'completed', CANCELLED: 'cancelled' } as const)[status]
  return labels[key]
}

function topicLabel(status: string, labels: JourneyLabels): string {
  if (status === 'COMPLETED') return labels.topicCompleted
  if (status === 'SKIPPED') return labels.topicSkipped
  return labels.topicPending
}

function topicTone(status: string, overdue: boolean): BadgeTone {
  if (overdue) return 'danger'
  if (status === 'COMPLETED') return 'success'
  if (status === 'SKIPPED') return 'neutral'
  return 'info'
}

function displayDate(value: string, locale: 'nl' | 'en', dateFormat: DateFormat): string {
  return formatDate(value, { locale, dateFormat })
}

export function JourneyManagementOverview({ canWrite, dateFormat, detail, labels, locale, options }: JourneyManagementOverviewProps) {
  const overview = buildJourneyManagementOverview(detail)
  const attentionCopy = overview.attention === 'ATTENTION'
    ? overview.overdueRequiredTopics > 0
      ? labels.overdueTopics.replace('{count}', String(overview.overdueRequiredTopics))
      : labels.attention
    : overview.attention === 'UPCOMING'
      ? detail.nextMomentName?.[locale] ?? labels.upcoming
      : overview.attention === 'PAUSED'
        ? labels.paused
        : overview.attention === 'COMPLETED'
          ? labels.completed
          : overview.attention === 'CANCELLED'
            ? labels.cancelled
            : labels.noAttention

  return (
    <PageShell className="space-y-6 py-6 lg:py-8" width="standard">
      <Link className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/journeys">
        <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{labels.back}</span>
      </Link>

      <div className="space-y-2">
        <p className="eyebrow">{labels.detailTitle}</p>
        <PageHeader
          actions={<div className="flex flex-wrap items-center gap-2"><Badge tone={statusTone(detail.status)}>{statusLabel(detail.status, labels)}</Badge><Badge tone={attentionTone(overview.attention)}>{overview.attention === 'ATTENTION' ? labels.attention : labels[overview.attention.toLowerCase() as 'planned' | 'upcoming' | 'paused' | 'completed' | 'cancelled']}</Badge></div>}
          description={`${labels.targetEmployee}: ${detail.targetEmployeeName} · ${detail.targetEmployeeNumber}`}
          title={detail.templateName[locale]}
        />
      </div>

      <DetailColumns
        main={
          <div className="space-y-6">
            <Surface className="p-5 sm:p-6">
              <SectionHeader title={<span className="inline-flex min-w-0 items-center gap-2"><Info aria-hidden="true" className="size-5 shrink-0 text-primary" />{labels.overviewMetadata}</span>} />
              <InfoList
                className="mt-5"
                columns={2}
                items={[
                  { label: labels.targetEmployee, value: <span className="break-words">{detail.targetEmployeeName} · {detail.targetEmployeeNumber}</span> },
                  { label: labels.anchorDate, value: <time dateTime={detail.anchorDate}>{displayDate(detail.anchorDate, locale, dateFormat)}</time> },
                  { label: labels.status, value: <Badge tone={statusTone(detail.status)}>{statusLabel(detail.status, labels)}</Badge> },
                  { label: labels.version, value: <span className="tabular-nums">{detail.version}</span> },
                  { label: labels.employmentLinked, value: detail.employmentId ? labels.employmentLinked : labels.noEmployment },
                  { label: labels.topicsLabel, value: <span className="tabular-nums">{overview.progress.total}</span> },
                ]}
              />
            </Surface>

            <Surface className="p-5 sm:p-6">
              <SectionHeader
                description={`${overview.progress.completed}/${overview.progress.total} ${labels.topicCompleted}`}
                title={<span className="inline-flex min-w-0 items-center gap-2"><CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-primary" />{labels.progress}</span>}
              />
              <div aria-label={labels.progress} aria-valuemax={100} aria-valuemin={0} aria-valuenow={overview.progress.percent} className="mt-5 h-3 overflow-hidden rounded-full bg-muted" role="progressbar">
                <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${overview.progress.percent}%` }} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{overview.progress.percent}%</p>
            </Surface>

            <Surface className="p-5 sm:p-6">
              <SectionHeader
                description={detail.nextMomentOn && detail.nextMomentName ? `${labels.nextMoment}: ${detail.nextMomentName[locale]} · ${displayDate(detail.nextMomentOn, locale, dateFormat)}` : labels.noNextMoment}
                title={<span className="inline-flex min-w-0 items-center gap-2"><CalendarDays aria-hidden="true" className="size-5 shrink-0 text-primary" />{labels.timeline}</span>}
              />
              {overview.progress.total === 0 ? <EmptyState className="mt-5" description={labels.noTopics} title={labels.topicsLabel} /> : <div className="mt-6 space-y-7">
                {overview.phases.map((phase) => <section key={phase.id}>
                  <h3 className="break-words text-base font-semibold">{phase.name[locale]}</h3>
                  <div className="mt-4 space-y-5 border-l-2 border-primary/20 pl-5">
                    {phase.moments.map((moment) => <article className="relative min-w-0" key={moment.id}>
                      <Circle aria-hidden="true" className="absolute -left-[1.8rem] top-0.5 fill-surface text-primary" size={16} />
                      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <h4 className="min-w-0 break-words font-semibold">{moment.name[locale]}</h4>
                        <div className="flex shrink-0 flex-col gap-1 text-xs text-muted-foreground sm:items-end">
                          <time dateTime={moment.scheduledOn}>{labels.scheduledOn}: {displayDate(moment.scheduledOn, locale, dateFormat)}</time>
                          <time dateTime={moment.availableOn}>{labels.availableOn}: {displayDate(moment.availableOn, locale, dateFormat)}</time>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {moment.topics.map((topic) => <div className="min-w-0 rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle p-3" key={topic.id}>
                          <div className="flex min-w-0 flex-wrap items-start gap-2">
                            <p className="min-w-0 flex-1 break-words text-sm font-medium">{topic.title[locale]}</p>
                            <Badge tone={topicTone(topic.status, topic.overdue)}>{topic.overdue ? labels.attention : topicLabel(topic.status, labels)}</Badge>
                          </div>
                          <p className="mt-1 break-words text-xs text-muted-foreground">{topic.ownerNames.length > 0 ? `${labels.ownerRole}: ${topic.ownerNames.join(', ')}` : topic.ownerRoleKey}</p>
                        </div>)}
                      {moment.topics.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noTopics}</p> : null}
                      </div>
                    </article>)}
                  </div>
                </section>)}
              </div>}
            </Surface>
          </div>
        }
        aside={
          <div className="space-y-6">
            <Surface className="p-5 lg:sticky lg:top-5">
              <SectionHeader title={<span className="inline-flex min-w-0 items-center gap-2"><AlertTriangle aria-hidden="true" className="size-5 shrink-0 text-primary" />{labels.attentionSummary}</span>} />
              <div className="mt-4 flex items-start gap-3 rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle p-3">
                <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="min-w-0 break-words text-sm text-foreground">{attentionCopy}</p>
              </div>
            </Surface>

            <Surface className="p-5">
              <SectionHeader title={labels.overviewActions} />
              {canWrite && options ? <div className="mt-4"><JourneyDetailActions employees={options.employees} journeyId={detail.id} labels={labels} locale={locale} participants={detail.participants} status={detail.status} version={detail.version} /></div> : <div className="mt-4 space-y-3"><Badge tone="neutral">{labels.readOnly}</Badge><p className="break-words text-sm text-muted-foreground">{labels.readOnlyDescription}</p></div>}
            </Surface>

            <Surface className="p-5">
              <SectionHeader title={<span className="inline-flex min-w-0 items-center gap-2"><Users aria-hidden="true" className="size-5 shrink-0 text-primary" />{labels.participantsLabel}</span>} />
              {overview.activeParticipantCount === 0 ? <EmptyState className="mt-4" description={labels.noParticipants} title={labels.participantsLabel} /> : <div className="mt-4 space-y-3">{detail.participants.filter((participant) => participant.status === 'ACTIVE' || participant.status === 'ASSIGNED').map((participant) => <div className="min-w-0 border-b border-border-subtle pb-3 last:border-b-0 last:pb-0" key={participant.id}><p className="break-words text-sm font-semibold">{participant.employeeName}</p><p className="mt-1 break-words text-xs text-muted-foreground">{participant.roleName[locale]}</p></div>)}</div>}
            </Surface>

            <Surface className="p-5">
              <SectionHeader title={labels.history} />
              {detail.changes.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{labels.noHistory}</p> : <div className="mt-4 space-y-3">{detail.changes.map((change) => <div className="min-w-0 border-b border-border-subtle pb-3 last:border-b-0 last:pb-0" key={change.id}><p className="break-words text-sm">{change.reason}</p><time className="mt-1 block text-xs text-muted-foreground" dateTime={change.changedAt}>{displayDate(change.changedAt, locale, dateFormat)}</time></div>)}</div>}
            </Surface>

            <Link className={buttonClasses({ className: 'w-full sm:w-auto', variant: 'secondary' })} href="/journeys"><ArrowLeft aria-hidden="true" />{labels.back}</Link>
          </div>
        }
      />
    </PageShell>
  )
}
