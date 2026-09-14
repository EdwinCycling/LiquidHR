import { describe, expect, it } from 'vitest'
import { calculateLeaveInsightsReport } from './leave-insights-calculations'
import type { LeaveInsightsFacts, LeaveInsightsQuery, LeaveInsightsTransactionFact } from './leave-insights-types'

const query: LeaveInsightsQuery = {
  report: 'leave', view: 'overview', year: 2026, asOfDate: '2026-06-30', periodStart: '2026-01-01', periodEnd: '2026-12-31',
  departmentId: null, managerId: null, leaveTypeId: null, profileId: null, severity: null, reservoirThreshold: 0.5,
}
function transaction(id: string, transactionType: LeaveInsightsTransactionFact['transactionType'], amount: number,
  overrides: Partial<LeaveInsightsTransactionFact> = {}): LeaveInsightsTransactionFact {
  return { id, employmentId: 'e1', leaveTypeId: 't1', bucketId: 'b1', transactionType, amount, transactionDate: '2026-01-01',
    reason: 'test', actorUserId: 'actor', actorDisplayName: null, sourceType: null, sourceKey: null, createdAt: '2026-01-01T12:00:00Z', ...overrides }
}
function facts(overrides: Partial<LeaveInsightsFacts> = {}): LeaveInsightsFacts {
  return {
    employments: [{ employeeId: 'person1', employeeNumber: '1', employeeName: 'Test', employmentId: 'e1', employmentNumber: '1',
      administrationId: 'a1', startsOn: '2025-01-01', endsOn: null, departmentId: 'd1', departmentName: 'Team', managerId: 'm1',
      managerName: 'Manager', profileId: 'p1', profileName: 'Profile', partTimeFactor: 1, deletedAt: null }],
    leaveTypes: [{ id: 't1', name: 'Leave', colorCode: null, entitlementMode: 'ACCRUAL', annualHoursCap: null, annualHoursFteCap: null }],
     profiles: [{ id: 'p1', name: 'Profile', isActive: true }], employeeSets: [], employeeSetMembers: [], assignments: [],
    rules: [{ id: 'r1', profileId: 'p1', leaveTypeId: 't1', validFrom: '2025-01-01', validUntil: null,
      accrualBasis: 'CONTRACT_HOURS', accrualFrequency: 'MONTHLY', accrualTiming: 'ARREARS', accrualAmount: 160, accrualRate: null, expirationMonths: 6 }],
    buckets: [{ id: 'b1', employmentId: 'e1', leaveTypeId: 't1', accrualYear: 2026, sourceAccrualYear: null,
      accrualReferenceDate: '2026-01-01', expirationDate: '2027-07-01', cohortKey: 'current', totalAccrued: 80, totalTaken: 0, totalExpired: 0 }],
     transactions: [transaction('opening', 'OPENING_BALANCE', 80)], exceptions: [], requests: [], allocations: [], scheduleDays: [],
     projectedDays: [], priorityRules: [], priorityItems: [], rulePauseTypes: [], absences: [], holidays: new Set(), yearControls: [], financialValuations: [], ...overrides,
  }
}
const calculate = (data: LeaveInsightsFacts, filters: Partial<LeaveInsightsQuery> = {}) => calculateLeaveInsightsReport({ query: { ...query, ...filters }, facts: data })

describe('Leave Insights canonical calculations', () => {
  it('recognizes only matching migration openings and keeps the earliest cutover', () => {
    const data = facts({ transactions: [
      transaction('manual', 'MANUAL_ADJUSTMENT', 10, { sourceType: 'MIGRATION_START_BALANCE', transactionDate: '2026-01-01' }),
      transaction('migration2', 'OPENING_BALANCE', 20, { sourceType: 'MIGRATION_START_BALANCE', transactionDate: '2026-03-01' }),
      transaction('migration1', 'OPENING_BALANCE', 30, { sourceType: 'MIGRATION_START_BALANCE', transactionDate: '2026-02-01' }),
      transaction('other', 'OPENING_BALANCE', 100, { employmentId: 'outside', sourceType: 'MIGRATION_START_BALANCE' }),
    ] })
    const report = calculate(data)
    expect(report.accrual[0]).toMatchObject({ migrationCutoverDate: '2026-02-01', projectedAccrual: null, effectiveEntitlement: 160 })
    expect(calculate({ ...data, transactions: data.transactions.slice(0, 1) }).accrual[0].migrationCutoverDate).toBeNull()
    expect(report.balances[0]).toMatchObject({ openingBalance: 50, manualAdjustment: 10, asOfBalance: 60 })
  })

  it('keeps cohorts independent and distinguishes expired and expiring balances', () => {
    const data = facts()
    data.buckets = [
      { ...data.buckets[0], expirationDate: '2026-06-01', totalAccrued: 20 },
      { ...data.buckets[0], id: 'b2', cohortKey: 'old', sourceAccrualYear: 2025, expirationDate: '2026-07-15', totalAccrued: 30 },
    ]
    data.transactions = [transaction('a', 'OPENING_BALANCE', 20), transaction('b', 'OPENING_BALANCE', 30, { bucketId: 'b2' })]
    const report = calculate(data)
    expect(report.cohorts.map(row => [row.bucketId, row.remainingHours, row.status])).toEqual([
      ['b1', 20, 'EXPIRED_REMAINS'], ['b2', 30, 'EXPIRING_SOON'],
    ])
    expect(report.kpis.expiringHours).toBe(30)
  })

  it('uses signed ledger and canonical approved day hours with strict planning boundaries', () => {
    const data = facts({ transactions: [transaction('a', 'OPENING_BALANCE', 80), transaction('b', 'TAKEN', -8),
      transaction('c', 'TAKEN', 2), transaction('d', 'ACCRUAL', 4), transaction('e', 'MANUAL_ADJUSTMENT', -3),
      transaction('f', 'ACCRUAL', 100, { transactionDate: '2026-08-01' })] })
    data.requests = [{ id: 'q1', employeeId: 'person1', employmentId: 'e1', requestMode: 'DIRECT', timeMode: 'FULL_DAY',
      startDate: '2026-06-30', endDate: '2027-01-01', specificStart: null, specificEnd: null, requestedMinutes: 600, status: 'APPROVED', priorityRuleId: null }]
    data.projectedDays = ['2026-06-30', '2026-07-01', '2027-01-01'].map(date => ({ requestId: 'q1', employeeId: 'person1', employmentId: 'e1',
      date, leaveTypeId: 't1', hours: 3.25, requestMode: 'DIRECT', timeMode: 'FULL_DAY' }))
    const report = calculate(data)
    expect(report.balances[0]).toMatchObject({ openingBalance: 80, takenToDate: 6, asOfBalance: 75, futurePlanned: 3.25, freeToPlan: 71.75 })
    expect(report.usage[0]).toMatchObject({ takenHours: 6, plannedHours: 3.25 })
    expect(report.accrual[0].projectedAccrual).toBeNull()
    expect(report.mutations.find(row => row.id === 'e')).toMatchObject({ transactionType: 'MANUAL_ADJUSTMENT', amount: -3, actorDisplayName: 'actor', reason: 'test' })
  })

  it('does not assign balance, reservoir, cohorts or valuation to unlimited leave', () => {
    const data = facts()
    data.leaveTypes = [{ ...data.leaveTypes[0], entitlementMode: 'UNLIMITED' }]
    const report = calculate(data)
    expect(report.balances[0]).toMatchObject({ annualEntitlement: null, asOfBalance: null, futurePlanned: null, reservoirRatio: null, reservoirStatus: 'UNLIMITED' })
    expect(report.finance).toEqual([])
    expect(report.cohorts).toEqual([])
  })

  it('scopes rows, options and totals by department, manager, profile and leave type', () => {
    const data = facts()
    data.employments = [...data.employments, { ...data.employments[0], employmentId: 'outside', departmentId: 'private', departmentName: 'Private', managerId: 'private' }]
    data.transactions = [...data.transactions, transaction('outside', 'OPENING_BALANCE', 500, { employmentId: 'outside' })]
    const report = calculate(data, { departmentId: 'd1', managerId: 'm1', profileId: 'p1', leaveTypeId: 't1' })
    expect(report.kpis.employments).toBe(1)
    expect(report.kpis.balanceHours).toBe(80)
    expect(JSON.stringify(report)).not.toContain('Private')
    expect(calculate(data, { leaveTypeId: 'absent' }).balances).toEqual([])
    expect(calculate(data, { profileId: 'absent' }).filterOptions.departments).toEqual([])
  })

  it('produces deterministic exceptions and filters every output by severity', () => {
    const data = facts({ transactions: [transaction('a', 'MANUAL_ADJUSTMENT', -100), transaction('b', 'MANUAL_ADJUSTMENT', 2), transaction('c', 'MANUAL_ADJUSTMENT', 3)] })
    const report = calculate(data)
    expect(report).toEqual(calculate({ ...data, transactions: [...data.transactions].reverse() }))
    expect(report.exceptions.map(row => row.code)).toEqual(expect.arrayContaining(['NEGATIVE_BALANCE', 'LARGE_MANUAL_ADJUSTMENT', 'REPEATED_MANUAL_ADJUSTMENTS']))
    const filtered = calculate(data, { severity: 'ACTION_REQUIRED' })
    expect(filtered.exceptions.every(row => row.severity === 'ACTION_REQUIRED')).toBe(true)
    expect(filtered.kpis.exceptionCount).toBe(filtered.exceptions.length)
    expect(calculate(facts(), { severity: 'ACTION_REQUIRED' }).balances).toEqual([])
  })

  it('uses supplied valuation only and treats null hourly rates as unavailable', () => {
    expect(calculate(facts()).financeAvailable).toBe(false)
    const missing = calculate(facts({ financialValuations: [{ employmentId: 'e1', valuationDate: '2026-06-30', hourlyRate: null, basisLabel: null }] }))
    expect(missing.financeAvailable).toBe(true)
    expect(missing.finance[0].valuationStatus).toBe('UNAVAILABLE')
    const valued = calculate(facts({ financialValuations: [{ employmentId: 'e1', valuationDate: '2026-06-30', hourlyRate: 12.5, basisLabel: 'canonical' }] }))
    expect(valued.finance[0].liabilityAmount).toBe(1000)
  })

  it('keeps nonworking and holiday anomalies visible under severity filters', () => {
    const data = facts()
    data.requests = [{ id: 'q1', employeeId: 'person1', employmentId: 'e1', requestMode: 'DIRECT', timeMode: 'FULL_DAY',
      startDate: '2026-07-01', endDate: '2026-07-01', specificStart: null, specificEnd: null, requestedMinutes: 120, status: 'APPROVED', priorityRuleId: null }]
    data.projectedDays = [{ requestId: 'q1', employeeId: 'person1', employmentId: 'e1', date: '2026-07-01', leaveTypeId: 't1', hours: 2,
      requestMode: 'DIRECT', timeMode: 'FULL_DAY' }]
    data.scheduleDays = [{ employmentId: 'e1', date: '2026-07-01', scheduledHours: 0, isWorkingDay: false }]
    data.holidays = new Set(['2026-07-01'])
    const report = calculate(data, { severity: 'ACTION_REQUIRED' })
    expect(report.capacity[0]).toMatchObject({ scheduledHours: 0, leaveHours: 2, availableHours: -2, nonWorkdayConsumption: 1, holidayConsumption: 1 })
    expect(report.exceptions.map(row => row.code)).toContain('NON_WORKDAY_CONSUMPTION')
  })

  it('reports only evidenced allocation, priority and locked-year inconsistencies', () => {
    const data = facts()
    data.requests = [{ id: 'q1', employeeId: 'person1', employmentId: 'e1', requestMode: 'PRIORITY', timeMode: 'FULL_DAY',
      startDate: '2026-02-01', endDate: '2026-02-01', specificStart: null, specificEnd: null, requestedMinutes: 480, status: 'APPROVED', priorityRuleId: 'priority' }]
    data.allocations = [{ requestId: 'q1', employmentId: 'e1', leaveTypeId: 't1', bucketId: 'b1', allocatedHours: 8, sortOrder: 1 }]
    data.priorityRules = [{ id: 'priority', profileId: 'p1', isActive: true, validFrom: '2025-01-01', validUntil: null }]
    data.priorityItems = [{ priorityRuleId: 'priority', leaveTypeId: 't1', sortOrder: 1 }]
    data.transactions = [...data.transactions, transaction('taken', 'TAKEN', -8, { sourceKey: 'q1:b1', sourceType: 'HR_ADMIN_CALENDAR', transactionDate: '2026-02-01' })]
    data.buckets = [{ ...data.buckets[0], totalTaken: 8 }]
    data.yearControls = [{ administrationId: 'a1', year: 2026, status: 'LOCKED' }]
    const clean = calculate(data)
    expect(clean.yearClose[0].status).toBe('RECONCILED')
    expect(clean.exceptions.map(row => row.code)).not.toContain('TAKEN_ALLOCATION_MISMATCH')
    expect(clean.exceptions.map(row => row.code)).not.toContain('INVALID_PRIORITY_CONFIGURATION')
    data.priorityRules = [{ id: 'priority', profileId: 'other-profile', isActive: true, validFrom: '2025-01-01', validUntil: null }]
    expect(calculate(data).exceptions.map(row => row.code)).toContain('INVALID_PRIORITY_CONFIGURATION')
    data.transactions = data.transactions.slice(0, 1)
    data.requests = [{ ...data.requests[0], requestedMinutes: 600 }]
    data.priorityItems = []
    expect(calculate(data).exceptions.map(row => row.code)).toEqual(expect.arrayContaining([
      'TAKEN_ALLOCATION_MISMATCH', 'REQUEST_ALLOCATION_MISMATCH', 'INVALID_PRIORITY_CONFIGURATION', 'YEAR_LOCK_INCONSISTENCY',
    ]))
  })

  it('resolves effective profiles and does not reuse expired assignments', () => {
    const data = facts({ assignments: [{ employmentId: 'e1', profileId: 'p1', validFrom: '2025-01-01', validUntil: '2026-01-31' }] })
    const report = calculate(data)
    expect(report.accrual[0]).toMatchObject({ profileId: null, ruleId: null, explanation: 'NO_EFFECTIVE_LEAVE_PROFILE' })
    expect(calculate(data, { profileId: 'p1' }).balances).toEqual([])
  })

  it('retains independent employment balances and contract end exceptions', () => {
    const data = facts()
    data.employments = [{ ...data.employments[0], endsOn: '2026-10-01' },
      { ...data.employments[0], employmentId: 'e2', deletedAt: '2026-05-01' }]
    data.transactions = [...data.transactions, transaction('other', 'OPENING_BALANCE', 20, { employmentId: 'e2', bucketId: 'b2' })]
    data.buckets = [...data.buckets, { ...data.buckets[0], id: 'b2', employmentId: 'e2', totalAccrued: 20 }]
    const report = calculate(data)
    expect(report.kpis).toMatchObject({ employees: 1, employments: 2, balanceHours: 100 })
    expect(report.contractEnd[0]).toMatchObject({ employmentId: 'e1', balanceAtContractEnd: 80 })
    expect(report.exceptions.map(row => row.code)).toEqual(expect.arrayContaining(['CONTRACT_END_WITH_BALANCE', 'DELETED_EMPLOYMENT_HAS_ACTIVE_LEAVE_FACTS']))
  })

  it('reconstructs historical balances and does not treat a manual correction as taken or a migration boundary', () => {
    const data = facts({ transactions: [
      transaction('migration', 'OPENING_BALANCE', 40, { sourceType: 'MIGRATION_START_BALANCE', transactionDate: '2026-10-01' }),
      transaction('correction', 'MANUAL_ADJUSTMENT', 5, { sourceType: 'HR_MANUAL_ADJUSTMENT', transactionDate: '2026-10-02' }),
      transaction('future-accrual', 'ACCRUAL', 8, { transactionDate: '2026-11-01' }),
      transaction('future-taken', 'TAKEN', -4, { transactionDate: '2026-11-15' }),
    ] })
    const report = calculate(data, { asOfDate: '2026-10-15', periodStart: '2026-01-01', periodEnd: '2026-12-31' })
    expect(report.accrual[0].migrationCutoverDate).toBe('2026-10-01')
    expect(report.balances[0]).toMatchObject({ asOfBalance: 45, takenToDate: 0, accruedToDate: 0, manualAdjustment: 5 })
    expect(report.usage[0].takenHours).toBe(0)
    expect(report.mutations.map((row) => row.id)).not.toContain('future-accrual')
  })

  it('uses direct assignment, then employee-set priority, then active group default with exclusive validity', () => {
    const data = facts({
      profiles: [
        { id: 'p1', name: 'Original', isActive: true },
        { id: 'p2', name: 'Direct', isActive: true },
        { id: 'p3', name: 'Set', isActive: true },
        { id: 'p4', name: 'Default', isActive: true, isGroupDefault: true },
      ],
      assignments: [{ employmentId: 'e1', profileId: 'p2', validFrom: '2026-01-01', validUntil: '2026-06-30' }],
      employeeSets: [{ id: 'set', leaveProfileId: 'p3', priority: 1, name: 'Priority set', isActive: true }],
      employeeSetMembers: [{ employeeSetId: 'set', employeeId: 'person1', validFrom: '2026-01-01', validUntil: null }],
    })
    expect(calculate(data, { asOfDate: '2026-06-29' }).accrual[0].profileId).toBe('p2')
    expect(calculate(data, { asOfDate: '2026-06-30' }).accrual[0].profileId).toBe('p3')
    expect(calculate(facts({ profiles: [{ id: 'p1', name: 'Original', isActive: true }], assignments: [{ employmentId: 'e1', profileId: 'p1', validFrom: '2026-01-01', validUntil: '2026-06-30' }] }), { asOfDate: '2026-06-30' }).accrual[0].profileId).toBeNull()
  })

  it('reports configurable reservoir windows, carry-forward and daily capacity without adding business facts', () => {
    const data = facts({
      buckets: [
        { ...facts().buckets[0], id: 'old', sourceAccrualYear: 2025, expirationDate: '2026-07-15', totalAccrued: 20 },
        { ...facts().buckets[0], id: 'new', sourceAccrualYear: 2026, expirationDate: '2026-12-15', totalAccrued: 12 },
      ],
      transactions: [transaction('old-opening', 'OPENING_BALANCE', 20, { bucketId: 'old' }), transaction('new-opening', 'OPENING_BALANCE', 12, { bucketId: 'new' })],
      requests: [{ id: 'planned', employeeId: 'person1', employmentId: 'e1', requestMode: 'DIRECT', timeMode: 'MORNING', startDate: '2026-07-01', endDate: '2026-07-01', specificStart: null, specificEnd: null, requestedMinutes: 240, status: 'APPROVED', priorityRuleId: null }],
      projectedDays: [{ requestId: 'planned', employeeId: 'person1', employmentId: 'e1', date: '2026-07-01', leaveTypeId: 't1', hours: 4, requestMode: 'DIRECT', timeMode: 'MORNING' }],
      scheduleDays: [{ employmentId: 'e1', date: '2026-07-01', scheduledHours: 8, isWorkingDay: true }],
    })
    const report = calculate(data, { asOfDate: '2026-06-30', reservoirThreshold: 0.75 })
    expect(report.kpis).toMatchObject({ carryForwardHours: 20, expiring90Hours: 20 })
    expect(report.capacityDays).toMatchObject([{ date: '2026-07-01', scheduledHours: 8, leaveHours: 4, availableHours: 4, employeeCount: 1, leaveEmployeeCount: 1 }])
  })
})
