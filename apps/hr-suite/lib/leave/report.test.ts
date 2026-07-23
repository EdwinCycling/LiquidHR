import { describe, expect, it } from 'vitest'
import { calculateLeaveBalanceReport } from './report'

describe('leave balance report', () => {
  it('houdt saldo, carry-forward, mutaties en opnames per dienstverband gescheiden', () => {
    const report = calculateLeaveBalanceReport({
      employmentId: 'employment-1',
      calendarYear: 2026,
      asOfDate: '2026-06-30',
      leaveTypes: [
        { id: 'vacation', name: 'Vakantie', entitlementMode: 'ACCRUAL', colorCode: '#1e90ff' },
        { id: 'doctor', name: 'Zorgverlof', entitlementMode: 'UNLIMITED', colorCode: '#13b981' },
      ],
      buckets: [
        { id: 'old', leaveTypeId: 'vacation', accrualYear: 2025, expirationDate: '2026-07-01' },
        { id: 'current', leaveTypeId: 'vacation', accrualYear: 2026, expirationDate: '2027-07-01' },
      ],
      transactions: [
        { bucketId: 'old', leaveTypeId: 'vacation', transactionType: 'ACCRUAL', amount: 10, transactionDate: '2025-01-01' },
        { bucketId: 'old', leaveTypeId: 'vacation', transactionType: 'TAKEN', amount: -2, transactionDate: '2026-02-01' },
        { bucketId: 'current', leaveTypeId: 'vacation', transactionType: 'ACCRUAL', amount: 8, transactionDate: '2026-01-01' },
        { bucketId: 'current', leaveTypeId: 'vacation', transactionType: 'MANUAL_ADJUSTMENT', amount: 1, transactionDate: '2026-03-01', reason: 'Correctie HR' },
      ],
      carryForwards: [{ sourceBucketId: 'old', sourceAccrualYear: 2025, carriedHours: 8, expirationDate: '2026-07-01' }],
      projectedAccruals: [{ leaveTypeId: 'vacation', amount: 4 }],
      monthlyAccrualMoments: [{ leaveTypeId: 'vacation', month: 7, bookingDate: '2026-07-01', expectedHours: 2, timing: 'UPFRONT' }],
    })

    expect(report.employmentId).toBe('employment-1')
    expect(report.leaveTypes[0]).toMatchObject({
      leaveTypeId: 'vacation',
      startOfYearBalance: 10,
      currentBalance: 17,
      projectedEndBalance: 21,
    })
    expect(report.leaveTypes[0].carryForwards).toEqual([
      expect.objectContaining({ sourceAccrualYear: 2025, currentHours: 8 }),
    ])
    expect(report.leaveTypes[0].manualAdjustments).toHaveLength(1)
    expect(report.leaveTypes[0].taken).toHaveLength(1)
    expect(report.leaveTypes[1]).toMatchObject({
      leaveTypeId: 'doctor',
      status: 'UNLIMITED',
      currentBalance: null,
    })
  })
})
