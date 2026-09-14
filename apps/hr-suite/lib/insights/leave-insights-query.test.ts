import { describe, expect, it } from 'vitest'
import { defaultLeaveInsightsQuery, leaveInsightsOwnedQueryKeys, leaveInsightsQueryParams, parseLeaveInsightsQuery } from './leave-insights-query'

describe('Leave Insights query contract', () => {
  it('requires the canonical report selector and round-trips owned state', () => {
    expect(parseLeaveInsightsQuery(new URLSearchParams('view=balances'))).toBeNull()
    const query = parseLeaveInsightsQuery(new URLSearchParams([
      ['report', 'leave'], ['view', 'exceptions'], ['year', '2026'], ['asOfDate', '2026-10-01'],
      ['periodStart', '2026-01-01'], ['periodEnd', '2026-12-31'], ['departmentId', 'd1'],
      ['managerId', 'm1'], ['leaveTypeId', 't1'], ['profileId', 'p1'], ['severity', 'ACTION_REQUIRED'],
      ['reservoirThreshold', '0.75'],
    ]))
    expect(query).toMatchObject({ report: 'leave', view: 'exceptions', year: 2026, asOfDate: '2026-10-01', departmentId: 'd1', managerId: 'm1', leaveTypeId: 't1', profileId: 'p1', severity: 'ACTION_REQUIRED', reservoirThreshold: 0.75 })
    expect([...leaveInsightsQueryParams(query!).entries()]).toEqual(expect.arrayContaining([
      ['report', 'leave'], ['view', 'exceptions'], ['year', '2026'], ['asOfDate', '2026-10-01'], ['severity', 'ACTION_REQUIRED'],
    ]))
    expect(leaveInsightsOwnedQueryKeys()).toContain('reservoirThreshold')
  })

  it('falls back safely for invalid closed values and inverted periods', () => {
    const query = parseLeaveInsightsQuery(new URLSearchParams('report=leave&view=not-a-view&year=1800&asOfDate=2026-02-30&periodStart=2026-12-31&periodEnd=2026-01-01&severity=NOPE&reservoirThreshold=9'))
    const defaults = defaultLeaveInsightsQuery()
    expect(query).toMatchObject({ view: 'overview', year: defaults.year, asOfDate: defaults.asOfDate, periodStart: `${defaults.year}-01-01`, periodEnd: `${defaults.year}-12-31`, severity: null, reservoirThreshold: 0.75 })
  })
})
