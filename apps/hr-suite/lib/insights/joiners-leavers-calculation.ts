import type { JoinersLeaversEventType, JoinersLeaversQuery } from './joiners-leavers-query'

export type JoinersLeaversPlacementStatus = 'ASSIGNED' | 'UNASSIGNED' | 'AMBIGUOUS'
export type JoinersLeaversEmployeeFlow = 'ENTERED_SCOPE' | 'LEFT_SCOPE' | 'EMPLOYMENT_CHANGE' | 'NOT_APPLICABLE'
export type JoinersLeaversReconciliationReason = 'SOFT_DELETED_EMPLOYMENT' | 'EMPLOYMENT_NOT_AVAILABLE'

export interface JoinersLeaversEmploymentSource {
  id: string
  employeeId: string
  administrationId: string
  startsOn: string
  endsOn: string | null
  recordStatus: string
  deletedAt: string | null
  employmentNumber: string | null
}

export interface JoinersLeaversTerminationSource {
  id: string
  employeeId: string
  employmentId: string
  administrationId: string
  lastWorkingDay: string
  workflowStatus: string
}

export interface JoinersLeaversOrganizationSource {
  employeeId: string
  employmentId: string | null
  administrationId: string
  departmentId: string | null
  directManagerId: string | null
  effectiveFrom: string
  effectiveTo: string | null
}

export interface JoinersLeaversEvent {
  id: string
  sourceId: string
  eventDate: string
  month: string
  eventType: JoinersLeaversEventType
  employeeId: string
  employmentId: string | null
  employmentNumber: string | null
  administrationId: string
  departmentId: string | null
  teamId: string | null
  placementStatus: JoinersLeaversPlacementStatus
  employeeFlow: JoinersLeaversEmployeeFlow
  terminationWorkflowStatus: string | null
  terminationDateMatchesEmploymentEnd: boolean | null
  linkedTerminationCount: number
  reconciliationReason: JoinersLeaversReconciliationReason | null
}

export interface JoinersLeaversMonthlyMetrics {
  month: string
  employmentStarts: number
  employeesWithStart: number
  employeesEnteringScope: number
  employmentEnds: number
  employeesWithEnd: number
  employeesLeavingScope: number
  terminationWorkflowEvents: number
  softDeletedReconciliations: number
  unavailableEmploymentReconciliations: number
  terminationDateMismatches: number
}

export interface JoinersLeaversMetrics extends Omit<JoinersLeaversMonthlyMetrics, 'month'> {
  employeesWithStart: number
  employeesEnteringScope: number
  employeesWithEnd: number
  employeesLeavingScope: number
}

export interface CalculatedJoinersLeaversReport {
  events: JoinersLeaversEvent[]
  trend: JoinersLeaversMonthlyMetrics[]
  summary: JoinersLeaversMetrics
  allHistorySoftDeletedReconciliationCount: number
  allHistoryUnavailableEmploymentReconciliationCount: number
}

interface CalculateInput {
  query: JoinersLeaversQuery
  allHistoryThroughDate: string
  authorizedAdministrationIds: readonly string[]
  employments: readonly JoinersLeaversEmploymentSource[]
  terminations: readonly JoinersLeaversTerminationSource[]
  organizations: readonly JoinersLeaversOrganizationSource[]
}

const CONFIRMED_TERMINATION_STATUSES = new Set(['CONFIRMED', 'PAYROLL_READY', 'REPORTED'])

function monthEnd(month: string): string {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10)
}

function monthsBetween(fromMonth: string, toMonth: string): string[] {
  const [startYear, startMonth] = fromMonth.split('-').map(Number)
  const [endYear, endMonth] = toMonth.split('-').map(Number)
  const months: string[] = []
  for (let year = startYear, month = startMonth; year < endYear || (year === endYear && month <= endMonth);) {
    months.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month > 12) { month = 1; year += 1 }
  }
  return months
}

function dateBefore(date: string): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() - 1)
  return value.toISOString().slice(0, 10)
}

function dateAfter(date: string): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

function isActiveOn(employment: JoinersLeaversEmploymentSource, date: string): boolean {
  return employment.recordStatus === 'CONFIRMED'
    && employment.deletedAt === null
    && employment.startsOn <= date
    && (employment.endsOn === null || employment.endsOn >= date)
}

function organizationAtEvent(
  employeeId: string,
  employmentId: string,
  administrationId: string,
  eventDate: string,
  organizations: readonly JoinersLeaversOrganizationSource[],
): { departmentId: string | null; teamId: string | null; placementStatus: JoinersLeaversPlacementStatus } {
  const matches = organizations.filter((row) => row.employeeId === employeeId
    && row.employmentId === employmentId
    && row.administrationId === administrationId
    && row.effectiveFrom <= eventDate
    && (row.effectiveTo === null || row.effectiveTo >= eventDate))
  if (matches.length !== 1) return { departmentId: null, teamId: null, placementStatus: matches.length ? 'AMBIGUOUS' : 'UNASSIGNED' }
  return { departmentId: matches[0].departmentId, teamId: matches[0].directManagerId, placementStatus: 'ASSIGNED' }
}

function distinctCount<T>(rows: readonly T[], key: (row: T) => string | null): number {
  return new Set(rows.map(key).filter((value): value is string => value !== null)).size
}

function monthlyMetrics(month: string, events: readonly JoinersLeaversEvent[]): JoinersLeaversMonthlyMetrics {
  const starts = events.filter((event) => event.eventType === 'employment-start')
  const ends = events.filter((event) => event.eventType === 'employment-end')
  const terminations = events.filter((event) => event.eventType === 'termination')
  const reconciliations = events.filter((event) => event.eventType === 'reconciliation')
  const mismatches = terminations.filter((event) => event.terminationDateMatchesEmploymentEnd === false)
  return {
    month,
    employmentStarts: distinctCount(starts, (event) => event.employmentId),
    employeesWithStart: distinctCount(starts, (event) => event.employeeId),
    employeesEnteringScope: distinctCount(starts.filter((event) => event.employeeFlow === 'ENTERED_SCOPE'), (event) => event.employeeId),
    employmentEnds: distinctCount(ends, (event) => event.employmentId),
    employeesWithEnd: distinctCount(ends, (event) => event.employeeId),
    employeesLeavingScope: distinctCount(ends.filter((event) => event.employeeFlow === 'LEFT_SCOPE'), (event) => event.employeeId),
    terminationWorkflowEvents: distinctCount(terminations, (event) => event.sourceId),
    softDeletedReconciliations: distinctCount(reconciliations.filter((event) => event.reconciliationReason === 'SOFT_DELETED_EMPLOYMENT'), (event) => event.sourceId),
    unavailableEmploymentReconciliations: distinctCount(reconciliations.filter((event) => event.reconciliationReason === 'EMPLOYMENT_NOT_AVAILABLE'), (event) => event.sourceId),
    terminationDateMismatches: distinctCount(mismatches, (event) => event.sourceId),
  }
}

function matchesSelectedDimensions(
  event: JoinersLeaversEvent,
  query: JoinersLeaversQuery,
  filterByEventType: boolean,
): boolean {
  return (!query.administrationIds.length || query.administrationIds.includes(event.administrationId))
    && (!query.departmentIds.length || (event.departmentId !== null && query.departmentIds.includes(event.departmentId)))
    && (!query.teamIds.length || (event.teamId !== null && query.teamIds.includes(event.teamId)))
    && (!filterByEventType || !query.eventTypes.length || query.eventTypes.includes(event.eventType))
}

function makeEvent(
  input: Omit<JoinersLeaversEvent, 'month' | 'departmentId' | 'teamId' | 'placementStatus'> & { employmentId: string; administrationId: string },
  organizations: readonly JoinersLeaversOrganizationSource[],
): JoinersLeaversEvent {
  const placement = organizationAtEvent(input.employeeId, input.employmentId, input.administrationId, input.eventDate, organizations)
  return { ...input, month: input.eventDate.slice(0, 7), ...placement }
}

export function calculateJoinersLeaversReport(input: CalculateInput): CalculatedJoinersLeaversReport {
  const { query } = input
  const startDate = `${query.fromMonth}-01`
  const endDate = monthEnd(query.toMonth)
  const allowedAdministrations = new Set(input.authorizedAdministrationIds)
  const authorizedEmployments = input.employments.filter((row) => row.recordStatus === 'CONFIRMED'
    && allowedAdministrations.has(row.administrationId))
  const activeEmployments = authorizedEmployments.filter((row) => row.deletedAt === null)
  const employmentsByEmployee = new Map<string, JoinersLeaversEmploymentSource[]>()
  for (const employment of activeEmployments) {
    const current = employmentsByEmployee.get(employment.employeeId) ?? []
    current.push(employment)
    employmentsByEmployee.set(employment.employeeId, current)
  }
  const employmentById = new Map(authorizedEmployments.map((row) => [row.id, row]))
  const terminationByEmployment = new Map<string, JoinersLeaversTerminationSource[]>()
  for (const termination of input.terminations) {
    if (!CONFIRMED_TERMINATION_STATUSES.has(termination.workflowStatus) || !allowedAdministrations.has(termination.administrationId)) continue
    const current = terminationByEmployment.get(termination.employmentId) ?? []
    current.push(termination)
    terminationByEmployment.set(termination.employmentId, current)
  }

  const candidateEvents: JoinersLeaversEvent[] = []
  for (const employment of activeEmployments) {
    if (employment.startsOn >= startDate && employment.startsOn <= endDate) {
      const before = dateBefore(employment.startsOn)
      const hasActiveBefore = (employmentsByEmployee.get(employment.employeeId) ?? []).some((item) => isActiveOn(item, before))
      candidateEvents.push(makeEvent({
        id: `start:${employment.id}`,
        sourceId: employment.id,
        eventDate: employment.startsOn,
        eventType: 'employment-start',
        employeeId: employment.employeeId,
        employmentId: employment.id,
        employmentNumber: employment.employmentNumber,
        administrationId: employment.administrationId,
        employeeFlow: hasActiveBefore ? 'EMPLOYMENT_CHANGE' : 'ENTERED_SCOPE',
        terminationWorkflowStatus: null,
        terminationDateMatchesEmploymentEnd: null,
        linkedTerminationCount: 0,
        reconciliationReason: null,
      }, input.organizations))
    }
    if (employment.endsOn && employment.endsOn >= startDate && employment.endsOn <= endDate) {
      const after = dateAfter(employment.endsOn)
      const hasActiveAfter = (employmentsByEmployee.get(employment.employeeId) ?? []).some((item) => isActiveOn(item, after))
      const linkedTerminations = terminationByEmployment.get(employment.id) ?? []
      const statuses = [...new Set(linkedTerminations.map((termination) => termination.workflowStatus))]
      candidateEvents.push(makeEvent({
        id: `end:${employment.id}`,
        sourceId: employment.id,
        eventDate: employment.endsOn,
        eventType: 'employment-end',
        employeeId: employment.employeeId,
        employmentId: employment.id,
        employmentNumber: employment.employmentNumber,
        administrationId: employment.administrationId,
        employeeFlow: hasActiveAfter ? 'EMPLOYMENT_CHANGE' : 'LEFT_SCOPE',
        terminationWorkflowStatus: statuses.length ? statuses.join(', ') : null,
        terminationDateMatchesEmploymentEnd: linkedTerminations.length ? linkedTerminations.every((termination) => termination.lastWorkingDay === employment.endsOn) : null,
        linkedTerminationCount: linkedTerminations.length,
        reconciliationReason: null,
      }, input.organizations))
    }
  }

  const allTerminationEvents: JoinersLeaversEvent[] = []
  for (const termination of input.terminations) {
    if (!CONFIRMED_TERMINATION_STATUSES.has(termination.workflowStatus) || !allowedAdministrations.has(termination.administrationId) || termination.lastWorkingDay > input.allHistoryThroughDate) continue
    const employment = employmentById.get(termination.employmentId)
    const linkedAndConsistent = employment
      && employment.employeeId === termination.employeeId
      && employment.administrationId === termination.administrationId
      && employment.recordStatus === 'CONFIRMED'
    const reconciliationReason: JoinersLeaversReconciliationReason | null = !linkedAndConsistent
      ? 'EMPLOYMENT_NOT_AVAILABLE'
      : employment.deletedAt !== null
        ? 'SOFT_DELETED_EMPLOYMENT'
        : null
    const eventType: JoinersLeaversEventType = reconciliationReason ? 'reconciliation' : 'termination'
    const event: JoinersLeaversEvent = makeEvent({
      id: `${eventType}:${termination.id}`,
      sourceId: termination.id,
      eventDate: termination.lastWorkingDay,
      eventType,
      employeeId: termination.employeeId,
      employmentId: termination.employmentId,
      employmentNumber: employment?.employmentNumber ?? null,
      administrationId: termination.administrationId,
      employeeFlow: 'NOT_APPLICABLE',
      terminationWorkflowStatus: termination.workflowStatus,
      terminationDateMatchesEmploymentEnd: reconciliationReason || !employment ? null : employment.endsOn === termination.lastWorkingDay,
      linkedTerminationCount: 1,
      reconciliationReason,
    }, input.organizations)
    allTerminationEvents.push(event)
    if (termination.lastWorkingDay >= startDate && termination.lastWorkingDay <= endDate) candidateEvents.push(event)
  }

  const matchesPeriodAndDimensions = candidateEvents.filter((event) => matchesSelectedDimensions(event, query, false))
  const events = matchesPeriodAndDimensions
    .filter((event) => !query.eventTypes.length || query.eventTypes.includes(event.eventType))
  const months = monthsBetween(query.fromMonth, query.toMonth)
  const trend = months.map((month) => monthlyMetrics(month, events.filter((event) => event.month === month)))
  const periodMetrics = monthlyMetrics('period', events)

  const allHistoryReconciliations = allTerminationEvents
    .filter((event) => event.eventType === 'reconciliation' && matchesSelectedDimensions(event, query, false))
  return {
    events,
    trend,
    summary: periodMetrics,
    allHistorySoftDeletedReconciliationCount: distinctCount(allHistoryReconciliations.filter((event) => event.reconciliationReason === 'SOFT_DELETED_EMPLOYMENT'), (event) => event.sourceId),
    allHistoryUnavailableEmploymentReconciliationCount: distinctCount(allHistoryReconciliations.filter((event) => event.reconciliationReason === 'EMPLOYMENT_NOT_AVAILABLE'), (event) => event.sourceId),
  }
}
