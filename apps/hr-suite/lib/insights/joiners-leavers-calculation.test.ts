import { describe, expect, it } from 'vitest'
import { defaultJoinersLeaversQuery } from './joiners-leavers-query'
import { calculateJoinersLeaversReport, type JoinersLeaversEmploymentSource, type JoinersLeaversOrganizationSource, type JoinersLeaversTerminationSource } from './joiners-leavers-calculation'

const baseQuery = { ...defaultJoinersLeaversQuery(new Date('2026-10-29T12:00:00Z')), fromMonth: '2025-01', toMonth: '2025-12' }

function employment(id: string, employeeId: string, administrationId: string, startsOn: string, endsOn: string | null = null, deletedAt: string | null = null): JoinersLeaversEmploymentSource {
  return { id, employeeId, administrationId, startsOn, endsOn, recordStatus: 'CONFIRMED', deletedAt, employmentNumber: `N-${id}` }
}

function termination(id: string, employeeId: string, employmentId: string, administrationId: string, lastWorkingDay: string): JoinersLeaversTerminationSource {
  return { id, employeeId, employmentId, administrationId, lastWorkingDay, workflowStatus: 'CONFIRMED' }
}

function organization(employeeId: string, employmentId: string, administrationId: string, effectiveFrom: string, departmentId: string | null = 'dept-a', directManagerId: string | null = 'manager-a', effectiveTo: string | null = null): JoinersLeaversOrganizationSource {
  return { employeeId, employmentId, administrationId, effectiveFrom, effectiveTo, departmentId, directManagerId }
}

function calculate(options: {
  employments?: JoinersLeaversEmploymentSource[]
  terminations?: JoinersLeaversTerminationSource[]
  organizations?: JoinersLeaversOrganizationSource[]
  query?: typeof baseQuery
}) {
  return calculateJoinersLeaversReport({
    query: options.query ?? baseQuery,
    allHistoryThroughDate: '2026-09-30',
    authorizedAdministrationIds: ['admin-a', 'admin-b'],
    employments: options.employments ?? [],
    terminations: options.terminations ?? [],
    organizations: options.organizations ?? [],
  })
}

describe('Joiners & Leavers event calculation', () => {
  it('deduplicates employee inflow across parallel employments in selected administrations', () => {
    const report = calculate({ employments: [
      employment('j1', 'e1', 'admin-a', '2025-03-01'), employment('j2', 'e1', 'admin-b', '2025-03-01'),
    ] })
    expect(report.summary.employmentStarts).toBe(2)
    expect(report.summary.employeesWithStart).toBe(1)
    expect(report.summary.employeesEnteringScope).toBe(1)
    expect(report.trend.find((item) => item.month === '2025-03')?.employeesEnteringScope).toBe(1)
  })

  it('distinguishes an employment change from a person entering the authorized scope', () => {
    const report = calculate({ employments: [
      employment('old', 'e1', 'admin-b', '2024-02-01'), employment('new', 'e1', 'admin-a', '2025-03-01'),
    ], query: { ...baseQuery, administrationIds: ['admin-a'] } })
    expect(report.summary.employmentStarts).toBe(1)
    expect(report.summary.employeesEnteringScope).toBe(0)
    expect(report.events[0].employeeFlow).toBe('EMPLOYMENT_CHANGE')
  })

  it('counts multiple employment endings once per employment and deduplicates the employee leaving scope', () => {
    const report = calculate({ employments: [
      employment('j1', 'e1', 'admin-a', '2024-01-01', '2025-03-31'),
      employment('j2', 'e1', 'admin-b', '2024-01-01', '2025-03-31'),
    ] })
    expect(report.summary.employmentEnds).toBe(2)
    expect(report.summary.employeesWithEnd).toBe(1)
    expect(report.summary.employeesLeavingScope).toBe(1)
    expect(report.trend.find((item) => item.month === '2025-03')?.employeesLeavingScope).toBe(1)
  })

  it('does not count a person leaving scope while another employment remains active', () => {
    const report = calculate({ employments: [
      employment('ended', 'e1', 'admin-a', '2024-01-01', '2025-03-31'),
      employment('ongoing', 'e1', 'admin-b', '2024-01-01'),
    ] })
    expect(report.summary.employmentEnds).toBe(1)
    expect(report.summary.employeesLeavingScope).toBe(0)
    expect(report.events.find((event) => event.eventType === 'employment-end')?.employeeFlow).toBe('EMPLOYMENT_CHANGE')
  })

  it('records same-month entry and exit without inferring a first-ever hire or a rehire label', () => {
    const report = calculate({ employments: [employment('short', 'e1', 'admin-a', '2025-04-03', '2025-04-20')] })
    expect(report.summary.employeesEnteringScope).toBe(1)
    expect(report.summary.employeesLeavingScope).toBe(1)
    expect(report.events.map((event) => event.employeeFlow)).toEqual(['ENTERED_SCOPE', 'LEFT_SCOPE'])
    expect(report.events.every((event) => !('isRehire' in event))).toBe(true)
  })

  it('recognizes an evidence-based scope re-entry without claiming a first-ever hire', () => {
    const report = calculate({ employments: [
      employment('prior', 'e1', 'admin-a', '2024-01-01', '2024-12-31'),
      employment('return', 'e1', 'admin-a', '2025-03-01'),
    ] })
    expect(report.summary.employeesEnteringScope).toBe(1)
    expect(report.events.find((event) => event.eventType === 'employment-start')?.employeeFlow).toBe('ENTERED_SCOPE')
    expect(report.events.some((event) => JSON.stringify(event).toLowerCase().includes('first-ever'))).toBe(false)
  })

  it('keeps soft-deleted employment termination events in reconciliation, not employment exits', () => {
    const report = calculate({
      employments: [employment('deleted', 'e1', 'admin-a', '2020-01-01', '2025-02-28', '2025-03-01')],
      terminations: [termination('t1', 'e1', 'deleted', 'admin-a', '2025-02-28')],
      organizations: [organization('e1', 'deleted', 'admin-a', '2020-01-01')],
    })
    expect(report.summary.employmentEnds).toBe(0)
    expect(report.summary.employeesLeavingScope).toBe(0)
    expect(report.summary.softDeletedReconciliations).toBe(1)
    expect(report.allHistorySoftDeletedReconciliationCount).toBe(1)
    expect(report.events[0]).toMatchObject({ eventType: 'reconciliation', reconciliationReason: 'SOFT_DELETED_EMPLOYMENT', employeeFlow: 'NOT_APPLICABLE' })
  })

  it('does not double-count a matching end date and termination workflow as employment endings', () => {
    const report = calculate({
      employments: [employment('j1', 'e1', 'admin-a', '2024-01-01', '2025-03-31')],
      terminations: [termination('t1', 'e1', 'j1', 'admin-a', '2025-03-31')],
    })
    expect(report.summary.employmentEnds).toBe(1)
    expect(report.summary.terminationWorkflowEvents).toBe(1)
    expect(report.events).toHaveLength(2)
    expect(report.events.find((event) => event.eventType === 'employment-end')?.linkedTerminationCount).toBe(1)
  })

  it('surfaces termination date disagreement and attributes events to their effective-date placement', () => {
    const report = calculate({
      employments: [employment('j1', 'e1', 'admin-a', '2024-01-01', '2025-03-20')],
      terminations: [termination('t1', 'e1', 'j1', 'admin-a', '2025-03-18')],
      organizations: [
        organization('e1', 'j1', 'admin-a', '2024-01-01', 'dept-old', 'manager-a', '2025-03-17'),
        organization('e1', 'j1', 'admin-a', '2025-03-18', 'dept-current'),
      ],
    })
    expect(report.summary.employmentEnds).toBe(1)
    expect(report.summary.terminationDateMismatches).toBe(1)
    expect(report.events.find((event) => event.eventType === 'termination')).toMatchObject({ departmentId: 'dept-current', teamId: 'manager-a', terminationDateMatchesEmploymentEnd: false })
    expect(report.events.find((event) => event.eventType === 'employment-end')?.departmentId).toBe('dept-current')
  })

  it('leaves ambiguous or absent event-date placements unassigned and applies event filters to every metric', () => {
    const ambiguous = calculate({
      employments: [employment('j1', 'e1', 'admin-a', '2025-03-01')],
      organizations: [organization('e1', 'j1', 'admin-a', '2025-01-01'), organization('e1', 'j1', 'admin-a', '2025-02-01')],
      query: { ...baseQuery, eventTypes: ['employment-end'] },
    })
    expect(ambiguous.summary.employmentStarts).toBe(0)
    expect(ambiguous.events).toEqual([])

    const unassigned = calculate({ employments: [employment('j2', 'e2', 'admin-a', '2025-03-01')] })
    expect(unassigned.events[0]).toMatchObject({ departmentId: null, teamId: null, placementStatus: 'UNASSIGNED' })
  })

  it('keeps the all-history deletion reconciliation visible outside the selected months', () => {
    const report = calculate({
      employments: [employment('deleted', 'e1', 'admin-a', '2019-01-01', '2020-12-31', '2021-01-01')],
      terminations: [termination('t1', 'e1', 'deleted', 'admin-a', '2020-12-31')],
      organizations: [organization('e1', 'deleted', 'admin-a', '2019-01-01')],
    })
    expect(report.events).toEqual([])
    expect(report.allHistorySoftDeletedReconciliationCount).toBe(1)
  })
})
