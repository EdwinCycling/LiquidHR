import type { JourneyProjection, JourneyProjectionList } from './projection-domain'
import type { JourneyRuntimeListItem } from './runtime-service'

export const journeyOverviewStatuses = ['ALL', 'PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const

export type JourneyOverviewStatus = (typeof journeyOverviewStatuses)[number]

export interface JourneyOverviewQuery {
  readonly q: string
  readonly status: JourneyOverviewStatus
}

export function parseJourneyOverviewQuery(query: { readonly q?: string; readonly status?: string }): JourneyOverviewQuery {
  const status = journeyOverviewStatuses.includes(query.status as JourneyOverviewStatus)
    ? query.status as JourneyOverviewStatus
    : 'ALL'
  return { q: query.q?.trim() ?? '', status }
}

function includesQuery(query: string, values: readonly string[]): boolean {
  const normalizedQuery = query.toLocaleLowerCase()
  return !normalizedQuery || values.some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
}

function matchesStatus(status: JourneyRuntimeListItem['status'] | JourneyProjection['status'], selectedStatus: JourneyOverviewStatus): boolean {
  return selectedStatus === 'ALL' || status === selectedStatus
}

export function filterJourneyRuntimeItems(items: readonly JourneyRuntimeListItem[], query: JourneyOverviewQuery): readonly JourneyRuntimeListItem[] {
  return items.filter((item) => matchesStatus(item.status, query.status) && includesQuery(query.q, [
    item.templateName.nl,
    item.templateName.en,
    item.targetEmployeeName,
    item.targetEmployeeNumber,
    ...item.participantNames,
  ]))
}

export function filterJourneyProjections(items: JourneyProjectionList, query: JourneyOverviewQuery): readonly JourneyProjection[] {
  return items.filter((item) => matchesStatus(item.status, query.status) && includesQuery(query.q, [
    item.templateName.nl,
    item.templateName.en,
    item.targetEmployeeName ?? '',
    ...item.participants.flatMap((participant) => [participant.employeeName ?? '', participant.roleName.nl, participant.roleName.en]),
  ]))
}
