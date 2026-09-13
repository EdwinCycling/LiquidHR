import { describe, expect, it } from 'vitest'
import { projectApprovedLeave, type LeaveProjectionScheduleDay } from './calendar-projection'

function schedule(...days: Array<[string, number]>): ReadonlyMap<string, LeaveProjectionScheduleDay> {
  return new Map(days.map(([date, scheduledMinutes]) => [date, { date, scheduledMinutes, isWorkingDay: scheduledMinutes > 0 }]))
}

describe('canonical leave calendar projection', () => {
  it('distributes a priority allocation chronologically and keeps mixed types on the crossing day', () => {
    const result = projectApprovedLeave({
      requests: [{
        id: 'request-1', employeeId: 'employee-1', employmentId: 'employment-1',
        startDate: '2026-09-21', endDate: '2026-09-23', requestMode: 'PRIORITY',
        timeMode: 'FULL_DAY', specificStart: null, specificEnd: null,
        requestedMinutes: 1440, status: 'APPROVED',
      }],
      allocations: [
        { requestId: 'request-1', leaveTypeId: 'statutory', allocatedHours: 19.9123, sortOrder: 1 },
        { requestId: 'request-1', leaveTypeId: 'above-statutory', allocatedHours: 4.0877, sortOrder: 2 },
      ],
      scheduleDaysByEmployment: new Map([
        ['employment-1', schedule(['2026-09-21', 480], ['2026-09-22', 480], ['2026-09-23', 480])],
      ]),
    })

    expect(result.map((item) => [item.date, item.leaveTypeId, item.hours])).toEqual([
      ['2026-09-21', 'statutory', 8],
      ['2026-09-22', 'statutory', 8],
      ['2026-09-23', 'statutory', 3.9123],
      ['2026-09-23', 'above-statutory', 4.0877],
    ])
  })

  it('skips non-working and holiday dates instead of creating range markers', () => {
    const result = projectApprovedLeave({
      requests: [{
        id: 'request-2', employeeId: 'employee-1', employmentId: 'employment-1',
        startDate: '2026-09-18', endDate: '2026-09-21', requestMode: 'DIRECT',
        timeMode: 'FULL_DAY', specificStart: null, specificEnd: null,
        requestedMinutes: 480, status: 'APPROVED',
      }],
      allocations: [{ requestId: 'request-2', leaveTypeId: 'statutory', allocatedHours: 8, sortOrder: 1 }],
      scheduleDaysByEmployment: new Map([
        ['employment-1', schedule(['2026-09-18', 0], ['2026-09-19', 480], ['2026-09-20', 0], ['2026-09-21', 480])],
      ]),
      holidayDates: new Set(['2026-09-21']),
    })

    expect(result.map((item) => item.date)).toEqual(['2026-09-19'])
  })

  it('retains the request time metadata for accessible detail views', () => {
    const result = projectApprovedLeave({
      requests: [{
        id: 'request-3', employeeId: 'employee-1', employmentId: 'employment-1',
        startDate: '2026-09-16', endDate: '2026-09-16', requestMode: 'DIRECT',
        timeMode: 'SPECIFIC_HOURS', specificStart: '09:00', specificEnd: '13:00',
        requestedMinutes: 240, status: 'APPROVED',
      }],
      allocations: [{ requestId: 'request-3', leaveTypeId: 'statutory', allocatedHours: 4, sortOrder: 1 }],
      scheduleDaysByEmployment: new Map([
        ['employment-1', schedule(['2026-09-16', 480])],
      ]),
    })

    expect(result[0]).toMatchObject({ date: '2026-09-16', hours: 4, specificStart: '09:00', specificEnd: '13:00' })
  })
})
