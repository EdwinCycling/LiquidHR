import { describe, expect, it } from 'vitest'
import { leaveInsightsCsv } from './leave-insights-csv'
import type { LeaveInsightsReport } from './leave-insights-types'

const report: LeaveInsightsReport = {
  report: 'leave',
  query: { report: 'leave', view: 'overview', year: 2026, asOfDate: '2026-06-30', periodStart: '2026-01-01', periodEnd: '2026-12-31', departmentId: null, managerId: null, leaveTypeId: null, profileId: null, severity: null, reservoirThreshold: 0.5 },
  kpis: { employees: 1, employments: 1, balanceHours: 8, takenHours: 0, futurePlannedHours: 0, expiringHours: 0, expiring30Hours: 0, expiring60Hours: 0, expiring90Hours: 0, expiring180Hours: 0, carryForwardHours: 0, employeesWithReservoirSignal: 0, employeesWithoutTakenLeave: 0, employeesWithoutFutureLeave: 0, contractsEndingWithBalance: 0, exceptionCount: 0, valuedLiabilityHours: 0, valuedLiabilityAmount: null },
  balances: [{ employeeId: 'person1', employeeNumber: '1', employeeName: 'A, Test', employmentId: 'employment1', employmentNumber: 'E1', administrationId: 'admin1', startsOn: '2026-01-01', endsOn: null, departmentId: null, departmentName: null, managerId: null, managerName: null, profileId: null, profileName: null, partTimeFactor: 1, deletedAt: null, leaveTypeId: 'type1', leaveTypeName: 'Leave', entitlementMode: 'ACCRUAL', annualFullTimeEntitlement: 160, annualEntitlement: 160, openingBalance: 8, accruedToDate: 0, manualAdjustment: 0, takenToDate: 0, expiredToDate: 0, asOfBalance: 8, futurePlanned: 0, freeToPlan: 8, projectedYearEnd: 8, projectedContractEnd: null, reservoirRatio: 0.05, reservoirStatus: 'LOW' }],
  cohorts: [], usage: [], capacity: [], capacityDays: [], accrual: [], mutations: [], finance: [], contractEnd: [], yearClose: [], exceptions: [],
  filterOptions: { departments: [], managers: [], leaveTypes: [], profiles: [], severities: [] }, financeAvailable: false,
}

describe('Leave Insights CSV contract', () => {
  it('emits a UTF-8 BOM and safely quotes canonical values', () => {
    const csv = leaveInsightsCsv(report)
    expect(csv.startsWith('\ufeffview,overview')).toBe(true)
    expect(csv).toContain('"A, Test"')
    expect(csv).toContain('as_of_date,2026-06-30')
    expect(csv.endsWith('\r\n')).toBe(true)
  })
})
