import { describe, expect, it } from 'vitest'
import { aggregateAbsenceEmployeeMetrics, countOverlappingAbsenceSpellPairs, uniqueAbsenceSpells } from './absence-report-calculations'

describe('absence report employee aggregation', () => {
  it('uses the combined capacity of multiple employments for the rate', () => {
    const [employee] = aggregateAbsenceEmployeeMetrics([
      {
        employeeId: 'employee-1', employeeName: 'Ada Example', departmentId: null, departmentName: null,
        status: 'ACTIVE', firstAbsenceOn: '2026-09-01', availableHours: 24, availableDays: 3,
        sickHours: 24, sickDays: 3, unknownScheduleDays: 0, unknownCapacityDays: 0, unknownPlacements: 0, overlappingSpellPairs: 0, caseIds: ['case-1'], spellIds: ['spell-1'],
      },
      {
        employeeId: 'employee-1', employeeName: 'Ada Example', departmentId: null, departmentName: null,
        status: 'ACTIVE', firstAbsenceOn: '2026-09-01', availableHours: 16, availableDays: 2,
        sickHours: 0, sickDays: 0, unknownScheduleDays: 0, unknownCapacityDays: 0, unknownPlacements: 0, overlappingSpellPairs: 0, caseIds: [], spellIds: [],
      },
    ])

    expect(employee).toMatchObject({ availableHours: 40, sickHours: 24, availableDays: 5, sickDays: 3 })
    expect(employee.caseIds).toEqual(new Set(['case-1']))
  })

  it('keeps case and spell identifiers unique across employment fragments while summing work obligations', () => {
    const [employee] = aggregateAbsenceEmployeeMetrics([
      {
        employeeId: 'employee-1', employeeName: 'Ada Example', departmentId: 'department-1', departmentName: 'HR',
        status: 'RECOVERY_WINDOW', firstAbsenceOn: '2026-08-01', availableHours: 8, availableDays: 1,
        sickHours: 4, sickDays: 0.5, unknownScheduleDays: 0, unknownCapacityDays: 0, unknownPlacements: 0, overlappingSpellPairs: 0, caseIds: ['case-1'], spellIds: ['spell-1'],
      },
      {
        employeeId: 'employee-1', employeeName: 'Ada Example', departmentId: 'department-1', departmentName: 'HR',
        status: 'CLOSED', firstAbsenceOn: '2026-09-01', availableHours: 8, availableDays: 1,
        sickHours: 2, sickDays: 0.25, unknownScheduleDays: 0, unknownCapacityDays: 0, unknownPlacements: 0, overlappingSpellPairs: 0, caseIds: ['case-1', 'case-2'], spellIds: ['spell-1', 'spell-2'],
      },
    ])

    expect(employee.firstAbsenceOn).toBe('2026-09-01')
    expect(employee.status).toBe('CLOSED')
    expect(employee.caseIds).toEqual(new Set(['case-1', 'case-2']))
    expect(employee.spellIds).toEqual(new Set(['spell-1', 'spell-2']))
    expect(employee.overlappingSpellPairs).toBe(0)
    expect(employee.sickDays).toBe(0.75)
  })

  it('counts inclusive spell overlap pairs once and deduplicates repeated spell IDs', () => {
    const spells = [
      { id: 'spell-a', startedOn: '2025-01-01', recoveredOn: '2025-01-05' },
      { id: 'spell-b', startedOn: '2025-01-05', recoveredOn: '2025-01-08' },
      { id: 'spell-c', startedOn: '2025-01-09', recoveredOn: null },
      { id: 'spell-a', startedOn: '2025-01-01', recoveredOn: '2025-01-05' },
    ]

    expect(uniqueAbsenceSpells(spells)).toHaveLength(3)
    expect(countOverlappingAbsenceSpellPairs(spells, '2025-01-05', '2025-01-10')).toBe(1)
  })
})
