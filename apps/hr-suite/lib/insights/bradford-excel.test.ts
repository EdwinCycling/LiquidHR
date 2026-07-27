import { describe, expect, it } from 'vitest'
import { bradfordInsightExcel } from './bradford-excel'
import type { BradfordInsightReport } from './bradford-report'

describe('bradfordInsightExcel', () => {
  it('creates an Excel-compatible worksheet with factor columns', () => {
    const report: BradfordInsightReport = {
      report: 'absence-bradford',
      period: { report: 'absence-bradford', period: '52-weeks', year: 2026, month: 7, startDate: '2025-07-29', endDate: '2026-07-27', departmentId: null },
      departments: [],
      totalOccurrences: 2,
      totalSickDays: 7,
      rows: [{ employeeId: 'e1', employeeName: 'Fin de Groot', departmentName: 'Finance', firstAbsenceOn: '2026-07-18', absenceOccurrences: 2, sickDays: 7, score: 28, band: 'LOW' }],
    }
    const output = bradfordInsightExcel(report)
    expect(output).toContain('Bradford-factor')
    expect(output).toContain('Fin de Groot')
    expect(output).toContain('28')
  })
})
