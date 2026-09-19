import { describe, expect, it } from 'vitest'
import {
  inclusiveCalendarDays,
  mondayWeekRange,
  selectSickItems,
  selectVacationItems,
  type FocusManagerVacationCandidate,
} from './manager-home-service'

describe('Focus Manager Home read model helpers', () => {
  it('counts inclusive calendar days for operational display', () => {
    expect(inclusiveCalendarDays('2026-09-18', '2026-09-18')).toBe(1)
    expect(inclusiveCalendarDays('2026-09-17', '2026-09-18')).toBe(2)
    expect(inclusiveCalendarDays('2026-09-19', '2026-09-18')).toBe(0)
  })

  it('resolves the NL Monday through Sunday week', () => {
    expect(mondayWeekRange('2026-09-16')).toEqual({ start: '2026-09-14', end: '2026-09-20' })
    expect(mondayWeekRange('2026-09-20')).toEqual({ start: '2026-09-14', end: '2026-09-20' })
  })

  it('keeps pending sickness operationally visible and marks it for confirmation', () => {
    expect(selectSickItems([
      { employeeId: 'e1', employeeName: 'Lisa de Vries', status: 'ACTIVE', firstAbsenceOn: '2026-09-17', pendingConfirmation: false },
      { employeeId: 'e2', employeeName: 'Martijn Jansen', status: 'ACTIVE', firstAbsenceOn: '2026-09-18', pendingConfirmation: true },
      { employeeId: 'e3', employeeName: 'Nora Future', status: 'ACTIVE', firstAbsenceOn: '2026-09-19', pendingConfirmation: false },
    ], '2026-09-18')).toEqual([
      { employeeId: 'e1', employeeName: 'Lisa de Vries', firstAbsenceOn: '2026-09-17', days: 2, pendingConfirmation: false },
      { employeeId: 'e2', employeeName: 'Martijn Jansen', firstAbsenceOn: '2026-09-18', days: 1, pendingConfirmation: true },
    ])
  })

  it('selects approved vacation by canonical family, including partial and multi-day ranges', () => {
    const candidates: FocusManagerVacationCandidate[] = [
      { id: 'r1', employeeId: 'e1', employeeName: 'Lisa de Vries', startDate: '2026-09-14', endDate: '2026-09-23', timeMode: 'FULL_DAY', specificStart: null, specificEnd: null },
      { id: 'r2', employeeId: 'e2', employeeName: 'Marlou de Vries', startDate: '2026-09-16', endDate: '2026-09-16', timeMode: 'MORNING', specificStart: null, specificEnd: null },
      { id: 'r3', employeeId: 'e3', employeeName: 'Other Leave', startDate: '2026-09-15', endDate: '2026-09-16', timeMode: 'FULL_DAY', specificStart: null, specificEnd: null },
      { id: 'r4', employeeId: 'e4', employeeName: 'Nina Jansen', startDate: '2026-09-25', endDate: '2026-09-26', timeMode: 'SPECIFIC_HOURS', specificStart: '13:00:00', specificEnd: '17:00:00' },
    ]

    expect(selectVacationItems({
      candidates,
      allocations: [
        { requestId: 'r1', leaveTypeId: 'vacation' },
        { requestId: 'r2', leaveTypeId: 'vacation' },
        { requestId: 'r3', leaveTypeId: 'other' },
        { requestId: 'r4', leaveTypeId: 'vacation' },
      ],
      leaveTypes: [
        { id: 'vacation', family: 'VACATION' },
        { id: 'other', family: 'OTHER' },
      ],
      week: { start: '2026-09-14', end: '2026-09-20' },
    })).toEqual([
      { employeeId: 'e1', employeeName: 'Lisa de Vries', startDate: '2026-09-14', endDate: '2026-09-23', overlapStartDate: '2026-09-14', timeMode: 'FULL_DAY', specificStart: null, specificEnd: null },
      { employeeId: 'e2', employeeName: 'Marlou de Vries', startDate: '2026-09-16', endDate: '2026-09-16', overlapStartDate: '2026-09-16', timeMode: 'MORNING', specificStart: null, specificEnd: null },
    ])
  })
})
