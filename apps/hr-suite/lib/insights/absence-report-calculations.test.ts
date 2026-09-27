import { describe, expect, it } from 'vitest'
import { aggregateAbsenceEmployeeMetrics } from './absence-report-calculations'

describe('absence report employee aggregation', () => {
  it('uses the combined capacity of multiple employments for the rate', () => {
    const [employee] = aggregateAbsenceEmployeeMetrics([
      {
        employeeId: 'employee-1', employeeName: 'Ada Example', departmentId: null, departmentName: null,
        status: 'ACTIVE', firstAbsenceOn: '2026-09-01', availableHours: 24, availableDays: 3,
        sickHours: 24, sickDays: 3, caseIds: ['case-1'], spellIds: ['spell-1'],
      },
      {
        employeeId: 'employee-1', employeeName: 'Ada Example', departmentId: null, departmentName: null,
        status: 'ACTIVE', firstAbsenceOn: '2026-09-01', availableHours: 16, availableDays: 2,
        sickHours: 0, sickDays: 0, caseIds: [], spellIds: [],
      },
    ])

    expect(employee).toMatchObject({ availableHours: 40, sickHours: 24, availableDays: 5, sickDays: 3 })
    expect(employee.caseIds).toEqual(new Set(['case-1']))
  })

  it('keeps case and spell identifiers unique across employment fragments', () => {
    const [employee] = aggregateAbsenceEmployeeMetrics([
      {
        employeeId: 'employee-1', employeeName: 'Ada Example', departmentId: 'department-1', departmentName: 'HR',
        status: 'RECOVERY_WINDOW', firstAbsenceOn: '2026-08-01', availableHours: 8, availableDays: 1,
        sickHours: 4, sickDays: 0.5, caseIds: ['case-1'], spellIds: ['spell-1'],
      },
      {
        employeeId: 'employee-1', employeeName: 'Ada Example', departmentId: 'department-1', departmentName: 'HR',
        status: 'CLOSED', firstAbsenceOn: '2026-09-01', availableHours: 8, availableDays: 1,
        sickHours: 2, sickDays: 0.25, caseIds: ['case-1', 'case-2'], spellIds: ['spell-1', 'spell-2'],
      },
    ])

    expect(employee.firstAbsenceOn).toBe('2026-09-01')
    expect(employee.status).toBe('CLOSED')
    expect(employee.caseIds).toEqual(new Set(['case-1', 'case-2']))
    expect(employee.spellIds).toEqual(new Set(['spell-1', 'spell-2']))
  })
})
