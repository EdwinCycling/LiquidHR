import Link from 'next/link'
import { AlertTriangle, ArrowRight, CalendarDays, Plus, Search, UsersRound } from 'lucide-react'
import { PageShell } from '@/components/layout/page-shell'
import { FilterBar } from '@/components/patterns/filter-bar'
import { PageHeader } from '@/components/patterns/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { deriveJourneyAttention, type JourneyAttention } from '@/lib/journeys/runtime-domain'
import type { JourneyLabels } from '@/lib/journeys/labels'
import type { JourneyProjection, JourneyProjectionList } from '@/lib/journeys/projection-domain'
import { journeyProgressPercent, localizedValue } from '@/lib/journeys/projection-domain'
import type { JourneyRuntimeListItem } from '@/lib/journeys/runtime-service'
import { filterJourneyProjections, filterJourneyRuntimeItems, journeyOverviewStatuses, parseJourneyOverviewQuery, type JourneyOverviewQuery, type JourneyOverviewStatus } from '@/lib/journeys/overview-domain'

type JourneyLiveOverviewProps = {
  mode: 'management' | 'projection'
  items: readonly JourneyRuntimeListItem[] | JourneyProjectionList
  labels: JourneyLabels
  locale: string
  query: { q?: string; status?: string }
  canWrite?: boolean
}

const statusKeys = journeyOverviewStatuses.filter((status): status is Exclude<JourneyOverviewStatus, 'ALL'> => status !== 'ALL')

const statusTones: Record<Exclude<JourneyOverviewStatus, 'ALL'>, BadgeTone> = {
  PLANNED: 'info',
  ACTIVE: 'info',
  PAUSED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
}

const statusLabelKeys: Record<Exclude<JourneyOverviewStatus, 'ALL'>, 'planned' | 'active' | 'paused' | 'completed' | 'cancelled'> = {
  PLANNED: 'planned',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
}

const attentionTones: Record<JourneyAttention, BadgeTone> = {
  PLANNED: 'info',
  UPCOMING: 'info',
  ATTENTION: 'danger',
  PAUSED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
}

function replaceValues(message: string, values: Readonly<Record<string, string | number>>): string {
  return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name: string) => values[name] === undefined ? placeholder : String(values[name]))
}

function statusLabel(status: Exclude<JourneyOverviewStatus, 'ALL'>, labels: JourneyLabels): string {
  return labels[statusLabelKeys[status]]
}

function StatusBadge({ labels, status }: { labels: JourneyLabels; status: Exclude<JourneyOverviewStatus, 'ALL'> }) {
  return <Badge tone={statusTones[status]}>{statusLabel(status, labels)}</Badge>
}

function ProgressSummary({ labels, progress }: { labels: JourneyLabels; progress: { completed: number; total: number } }) {
  const percent = journeyProgressPercent(progress)
  return <div className="min-w-0">
    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.progress}</p>
    <div className="mt-2 flex items-center gap-3">
      <div aria-label={`${labels.progress}: ${percent}%`} aria-valuemax={progress.total} aria-valuemin={0} aria-valuenow={progress.completed} className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{percent}%</span>
    </div>
    <p className="mt-1 text-xs text-muted-foreground">{replaceValues(labels.progressCount, { completed: progress.completed, total: progress.total })}</p>
  </div>
}

function JourneyOverviewFilters({ labels, query }: { labels: JourneyLabels; query: JourneyOverviewQuery }) {
  const hasFilters = query.q.length > 0 || query.status !== 'ALL'
  return <form className="mt-6" method="get">
    <FilterBar actions={<>
      <Button type="submit" variant="secondary"><Search aria-hidden="true" />{labels.searchJourneys}</Button>
      {hasFilters ? <Link className={buttonClasses({ variant: 'ghost' })} href="/journeys">{labels.clearFilters}</Link> : null}
    </>}>
      <label className="grid min-w-0 flex-1 gap-1 text-sm font-medium sm:min-w-[18rem]" htmlFor="journey-search">
        {labels.searchJourneys}
        <TextInput defaultValue={query.q} id="journey-search" leadingIcon={<Search aria-hidden="true" />} name="q" placeholder={labels.searchJourneys} />
      </label>
      <label className="grid w-full gap-1 text-sm font-medium sm:w-56" htmlFor="journey-status">
        {labels.status}
        <DropdownSelect aria-label={labels.status} defaultValue={query.status} emptyLabel={labels.noJourneys} id="journey-status" name="status" searchable searchPlaceholder={labels.searchJourneys}>
          <option value="ALL">{labels.allStatuses}</option>
          {statusKeys.map((status) => <option key={status} value={status}>{statusLabel(status, labels)}</option>)}
        </DropdownSelect>
      </label>
    </FilterBar>
  </form>
}

function ManagementJourneyRow({ item, labels, locale }: { item: JourneyRuntimeListItem; labels: JourneyLabels; locale: string }) {
  const today = new Date().toISOString().slice(0, 10)
  const attention = deriveJourneyAttention({ status: item.status, nextMomentOn: item.nextMomentOn, overdueRequiredTopics: item.overdueRequiredTopics, today })
  return <Surface className="overflow-hidden">
    <Link className="group block p-4 transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus sm:p-5" href={`/journeys/${item.id}`}>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(12rem,1fr)_minmax(14rem,1.1fr)_minmax(13rem,1fr)_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="min-w-0 break-words font-semibold text-foreground">{localizedValue(item.templateName, locale)}</h2>
            <StatusBadge labels={labels} status={item.status} />
            {attention === 'ATTENTION' ? <Badge tone={attentionTones[attention]}><AlertTriangle aria-hidden="true" className="mr-1 size-3.5" />{labels.attention}</Badge> : null}
          </div>
          <p className="mt-2 break-words text-sm text-muted-foreground">{item.targetEmployeeName} · {item.targetEmployeeNumber}</p>
          <p className="mt-1 text-xs text-muted-foreground">{labels.anchorDate}: {formatDate(item.anchorDate, locale)}</p>
        </div>
        <ProgressSummary labels={labels} progress={item.progress} />
        <div className="min-w-0 text-sm">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"><UsersRound aria-hidden="true" className="size-4" />{labels.participantsLabel}</p>
          <p className="mt-2 break-words text-foreground">{item.participantNames.length > 0 ? item.participantNames.join(', ') : '—'}</p>
        </div>
        <div className="min-w-0 text-sm">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"><CalendarDays aria-hidden="true" className="size-4" />{labels.nextMoment}</p>
          <p className="mt-2 break-words font-medium text-foreground">{item.nextMomentName ? localizedValue(item.nextMomentName, locale) : '—'}</p>
          {item.nextMomentOn ? <time className="mt-1 block text-xs text-muted-foreground" dateTime={item.nextMomentOn}>{formatDate(item.nextMomentOn, locale)}</time> : null}
        </div>
        <ArrowRight aria-hidden="true" className="size-5 text-primary transition-colors group-hover:text-primary-hover" />
      </div>
    </Link>
  </Surface>
}

function projectionNeedsAttention(item: JourneyProjection, today: string): boolean {
  return item.status === 'ACTIVE' && item.nextAction !== null && item.nextAction.scheduledOn < today
}

function ProjectionJourneyRow({ item, labels, locale }: { item: JourneyProjection; labels: JourneyLabels; locale: string }) {
  const today = new Date().toISOString().slice(0, 10)
  const participantNames = [...new Set(item.participants.map((participant) => participant.employeeName ?? localizedValue(participant.roleName, locale)).filter(Boolean))]
  const needsAttention = projectionNeedsAttention(item, today)
  return <Surface className="overflow-hidden">
    <Link className="group block p-4 transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus sm:p-5" href={`/journeys/${item.id}`}>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(12rem,1fr)_minmax(14rem,1.1fr)_minmax(13rem,1fr)_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="min-w-0 break-words font-semibold text-foreground">{localizedValue(item.templateName, locale)}</h2>
            <StatusBadge labels={labels} status={item.status} />
            <Badge tone={item.relationship === 'SELF' ? 'info' : 'neutral'}>{item.relationship === 'SELF' ? labels.selfJourney : labels.participantJourney}</Badge>
            {needsAttention ? <Badge tone="danger"><AlertTriangle aria-hidden="true" className="mr-1 size-3.5" />{labels.attention}</Badge> : null}
          </div>
          <p className="mt-2 break-words text-sm text-muted-foreground">{item.targetEmployeeName ?? '—'}</p>
          <p className="mt-1 text-xs text-muted-foreground">{labels.anchorDate}: {formatDate(item.anchorDate, locale)}</p>
        </div>
        <ProgressSummary labels={labels} progress={item.progress} />
        <div className="min-w-0 text-sm">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"><UsersRound aria-hidden="true" className="size-4" />{labels.participantsLabel}</p>
          <p className="mt-2 break-words text-foreground">{participantNames.length > 0 ? participantNames.join(', ') : '—'}</p>
        </div>
        <div className="min-w-0 text-sm">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"><CalendarDays aria-hidden="true" className="size-4" />{labels.nextAction}</p>
          <p className="mt-2 break-words font-medium text-foreground">{item.nextAction ? localizedValue(item.nextAction.title, locale) : '—'}</p>
          {item.nextAction ? <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><time dateTime={item.nextAction.scheduledOn}>{formatDate(item.nextAction.scheduledOn, locale)}</time><span aria-hidden="true">·</span><span>{item.nextAction.availability === 'AVAILABLE' ? labels.available : labels.upcomingTopic}</span></div> : null}
        </div>
        <ArrowRight aria-hidden="true" className="size-5 text-primary transition-colors group-hover:text-primary-hover" />
      </div>
    </Link>
  </Surface>
}

export function JourneyLiveOverview({ canWrite = false, items, labels, locale, mode, query: rawQuery }: JourneyLiveOverviewProps) {
  const query = parseJourneyOverviewQuery(rawQuery)
  const visibleItems = mode === 'management'
    ? filterJourneyRuntimeItems(items as readonly JourneyRuntimeListItem[], query)
    : filterJourneyProjections(items as JourneyProjectionList, query)
  const title = mode === 'management' ? labels.liveTitle : labels.participantOverviewTitle
  const subtitle = mode === 'management' ? labels.liveSubtitle : labels.participantOverviewSubtitle
  const eyebrow = mode === 'management' ? labels.eyebrow : labels.participantOverviewEyebrow

  return <PageShell width="standard" className="py-6 lg:py-8">
    <p className="eyebrow mb-2">{eyebrow}</p>
    <PageHeader actions={mode === 'management' && canWrite ? <Link className={buttonClasses({ className: 'gap-2' })} href="/journeys/new"><Plus aria-hidden="true" />{labels.startJourney}</Link> : undefined} description={subtitle} title={title} />
    <JourneyOverviewFilters labels={labels} query={query} />
    <div aria-live="polite" className="mt-6 flex items-center justify-between gap-3">
      <p className="text-sm font-medium text-muted-foreground">{replaceValues(labels.resultCount, { count: visibleItems.length })}</p>
    </div>
    <div className="mt-3 space-y-3">
      {visibleItems.length > 0
        ? visibleItems.map((item) => mode === 'management'
          ? <ManagementJourneyRow item={item as JourneyRuntimeListItem} key={item.id} labels={labels} locale={locale} />
          : <ProjectionJourneyRow item={item as JourneyProjection} key={item.id} labels={labels} locale={locale} />)
        : <EmptyState actions={query.q.length > 0 || query.status !== 'ALL' ? <Link className={buttonClasses({ variant: 'secondary' })} href="/journeys">{labels.clearFilters}</Link> : undefined} description={query.q.length > 0 || query.status !== 'ALL' ? labels.noResultsDescription : undefined} icon={<UsersRound />} title={labels.noJourneys} />}
    </div>
  </PageShell>
}
