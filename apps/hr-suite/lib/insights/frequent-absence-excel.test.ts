import { describe, expect, it } from 'vitest'
import { frequentAbsenceExcel } from './frequent-absence-excel'
import type { FrequentAbsenceReport } from './frequent-absence-report'

describe('frequentAbsenceExcel', () => {
  it('exports case counts and source quality for only the service rows', () => {
    const report: FrequentAbsenceReport = {
      report: 'absence-frequent',
      period: { report: 'absence-frequent', period: 'this-year', year: 2025, startDate: '2025-01-01', endDate: '2025-12-31', departmentId: null, search: '', frequentOnly: false },
      threshold: 3,
      rows: [{ employeeId: 'employee-a', employeeName: 'Ada One', departmentName: 'Team One', reportCount: 2, totalSickDays: 4, isFrequent: false }],
      departments: [{ id: 'department-a', name: 'Team One' }],
      totalEmployees: 1,
      frequentCount: 0,
      totalReports: 2,
      dataQuality: { complete: false, unknownPlacements: 1 },
    }
    const output = frequentAbsenceExcel(report)
    expect(output).toContain('Aantal verzuimcases')
    expect(output).toContain('Unieke verzuimcases op basis van de eerste ziektedag')
    expect(output).toContain('Rapportageperiode')
    expect(output).toContain('Aantal verzuimcases')
    expect(output).toContain('Kalenderdagen in ziekteperioden')
    expect(output).toContain('Dit kalenderjaar (2025)')
    expect(output).toContain('ss:Format="0.0"')
    expect(output).toContain('Ada One')
    expect(output).toContain('Datakwaliteit')
    expect(output).toContain('1')
  })
})
