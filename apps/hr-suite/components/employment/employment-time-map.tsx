import Link from 'next/link'
import type { HrChangeEvent, HrChangeEventType } from '@/lib/hr-events/types'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonClasses } from '@/components/ui/button'

type Lane = 'contract' | 'organization' | 'conditions' | 'compensation' | 'dossier'
type HistoryStatus = 'all' | 'past' | 'current' | 'future'

interface Labels {
  title: string
  subtitle: string
  empty: string
  noResults: string
  asOf: string
  filterStatus: string
  filterLane: string
  filterAll: string
  past: string
  current: string
  future: string
  details: string
  lanes: Record<Lane, string>
  events: Record<HrChangeEventType, string>
  values: Record<string, string>
}

const lanes: Lane[] = ['contract', 'organization', 'conditions', 'compensation', 'dossier']
const laneFor = (type: HrChangeEventType): Lane => type === 'EMPLOYMENT_STARTED' || type === 'EMPLOYMENT_ENDED' || type === 'INCOME_RELATIONSHIP_CHANGED' || type === 'CONTRACT_CHANGED'
  ? 'contract'
  : type === 'ORGANIZATION_CHANGED'
    ? 'organization'
    : type === 'LABOR_CONDITIONS_CHANGED' || type === 'SCHEDULE_CHANGED'
      ? 'conditions'
      : type === 'SALARY_CHANGED' || type === 'COST_ALLOCATION_CHANGED'
        ? 'compensation'
        : 'dossier'

function statusFor(event: HrChangeEvent, selectedDate: string): Exclude<HistoryStatus, 'all'> {
  if (event.eventDate > selectedDate) return 'future'
  const validUntil = event.titleValues.validUntil
  return typeof validUntil === 'string' && validUntil <= selectedDate ? 'past' : 'current'
}

function historyEnumValue(value: string, kind: 'contract' | 'worker', labels: Labels): string {
  const labelKey: Record<string, string> = kind === 'contract'
    ? {
        INDEFINITE: 'historyContractIndefinite',
        DEFINITE: 'historyContractDefinite',
        TEMPORARY_NO_END: 'historyContractTemporaryWithoutEnd',
        ON_CALL: 'historyContractOnCall',
        TEMPORARY_AGENCY: 'historyContractTemporaryAgency',
        EXTERNAL: 'historyContractExternal',
      }
    : {
        EMPLOYEE: 'historyWorkerEmployee',
        STUDENT_INTERN: 'historyWorkerStudentIntern',
        TEMPORARY_AGENCY: 'historyWorkerTemporaryAgency',
        EXTERNAL_NO_PAYROLL: 'historyWorkerExternal',
      }
  return labels.values[labelKey[value]] ?? value
}

function detailItems(event: HrChangeEvent, labels: Labels, locale: string): string[] {
  const values = event.titleValues
  const amount = typeof values.amount === 'number'
    ? new Intl.NumberFormat(locale, { style: 'currency', currency: typeof values.currency === 'string' ? values.currency : 'EUR' }).format(values.amount)
    : null
  const candidates: Array<[string, string | null]> = [
    ['number', typeof values.number === 'string' || typeof values.number === 'number' ? String(values.number) : null],
    ['contractType', typeof values.contractType === 'string' ? historyEnumValue(values.contractType, 'contract', labels) : null],
    ['workerType', typeof values.workerType === 'string' ? historyEnumValue(values.workerType, 'worker', labels) : null],
    ['startDate', typeof values.startsOn === 'string' ? values.startsOn : null],
    ['department', typeof values.department === 'string' ? values.department : null],
    ['jobTitle', typeof values.jobTitle === 'string' ? values.jobTitle : null],
    ['conditionGroup', typeof values.conditionGroup === 'string' ? values.conditionGroup : null],
    ['hours', typeof values.hours === 'number' ? `${values.hours}` : null],
    ['factor', typeof values.factor === 'number' ? `${Math.round(values.factor * 100)}%` : null],
    ['amount', amount],
    ['percentage', typeof values.percentage === 'number' ? `${values.percentage}%` : null],
    ['costCenter', typeof values.costCenter === 'string' ? values.costCenter : null],
    ['title', typeof values.title === 'string' ? values.title : null],
  ]
  return candidates.flatMap(([key, value]) => value ? [`${labels.values[key] ?? key}: ${value}`] : [])
}

function statusLabel(status: Exclude<HistoryStatus, 'all'>, labels: Labels): string {
  return status === 'past' ? labels.past : status === 'future' ? labels.future : labels.current
}

export function EmploymentTimeMap({ events, selectedDate, selectedStatus = 'all', selectedLane = 'all', locale, labels }: { events: HrChangeEvent[]; selectedDate: string; selectedStatus?: HistoryStatus; selectedLane?: Lane | 'all'; locale: string; labels: Labels }) {
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
  const filteredEvents = events.filter((event) => (selectedLane === 'all' || laneFor(event.eventType) === selectedLane) && (selectedStatus === 'all' || statusFor(event, selectedDate) === selectedStatus))
  return <section className="border border-subtle bg-surface p-5 sm:p-6"><header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-xl font-semibold">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p></div><form className="grid gap-3 sm:grid-cols-3" method="get"><input name="tab" type="hidden" value="history" /><input name="view" type="hidden" value="expanded" /><label className="text-sm font-medium"><span>{labels.asOf}</span><input className="form-field mt-1" defaultValue={selectedDate} name="date" type="date" /></label><label className="text-sm font-medium"><span>{labels.filterStatus}</span><select className="form-field mt-1" defaultValue={selectedStatus} name="status"><option value="all">{labels.filterAll}</option><option value="past">{labels.past}</option><option value="current">{labels.current}</option><option value="future">{labels.future}</option></select></label><label className="text-sm font-medium"><span>{labels.filterLane}</span><select className="form-field mt-1" defaultValue={selectedLane} name="lane"><option value="all">{labels.filterAll}</option>{lanes.map((lane) => <option key={lane} value={lane}>{labels.lanes[lane]}</option>)}</select></label><button className={`${buttonClasses({ variant: 'secondary' })} sm:col-span-3 sm:justify-self-end`} type="submit">{labels.asOf}</button></form></header>
    {events.length === 0 ? <EmptyState className="mt-5" title={labels.empty} /> : filteredEvents.length === 0 ? <EmptyState className="mt-5" title={labels.noResults} /> : <ol className="relative mt-6 space-y-4 border-l border-subtle pl-5 sm:pl-7">{filteredEvents.map((event) => { const lane = laneFor(event.eventType); const status = statusFor(event, selectedDate); const details = detailItems(event, labels, locale); return <li className="relative" key={event.id}><span aria-hidden="true" className="absolute -left-[1.65rem] top-5 size-3 rounded-full border-2 border-primary bg-surface sm:-left-[2.15rem]" /><article className="border border-subtle p-4 transition-colors hover:border-primary/40"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge tone="neutral">{labels.lanes[lane]}</Badge><Badge tone={status === 'current' ? 'success' : status === 'future' ? 'info' : 'neutral'}>{statusLabel(status, labels)}</Badge></div><h3 className="mt-3 font-semibold">{labels.events[event.eventType]}</h3></div><time className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground" dateTime={event.eventDate}>{dateFormatter.format(new Date(`${event.eventDate}T00:00:00Z`))}</time></div>{details.length > 0 && <p className="mt-3 text-sm text-muted-foreground">{details.join(' · ')}</p>}<Link className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline" href={event.sourceHref}>{labels.details} <span aria-hidden="true" className="ml-1">→</span></Link></article></li> })}</ol>}
  </section>
}
