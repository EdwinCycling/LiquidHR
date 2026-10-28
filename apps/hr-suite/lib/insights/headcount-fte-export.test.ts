import { describe, expect, it } from 'vitest'
import { headcountFteCsv } from './headcount-fte-csv'
import type { HeadcountFteReport } from './headcount-fte-service'

const report: HeadcountFteReport = {
  report: 'headcount-fte', period: { fromMonth: '2025-01', toMonth: '2025-01', asOf: '2025-01-31' },
  headcount: 1, fte: 1, knownFte: 1, activeEmploymentCount: 1, completeScheduleCount: 1, incompleteScheduleCount: 0, unassignedPlacementCount: 0,
  trend: [{ month: '2025-01', headcount: 1, fte: 1, knownFte: 1, incompleteScheduleCount: 0 }],
  administrationOptions: [], departmentOptions: [], teamOptions: [],
  rows: [{ employeeId: 'e1', employeeNumber: 'E1', employeeName: '=1+1', employmentId: 'j1', employmentNumber: 'J1', administrationId: 'a1', administrationName: 'Admin', departmentId: null, departmentName: null, teamId: null, teamName: null, partTimeFactor: 1, scheduleStatus: 'VALID', placementStatus: 'MISSING' }],
}

describe('Headcount & FTE export', () => {
  it('exports the report rows and prevents spreadsheet formula injection', () => {
    const csv = headcountFteCsv(report, 'en')
    expect(csv).toContain('Employee no.')
    expect(csv).toContain("'=1+1")
    expect(csv).toContain('"VALID";"MISSING"')
    expect(csv).not.toContain('salary')
  })
})
