import { describe, expect, it } from 'vitest'
import { absenceInsightExcel } from './absence-excel'
import type { AbsenceInsightReport } from './absence-report'

const report: AbsenceInsightReport = {
  report: 'absence', period: { mode: 'month', year: 2026, month: 7, startDate: '2026-07-01', endDate: '2026-07-31' },
  absenceCases: 1, activeCases: 1, sickHours: 8, availableHours: 160, sickDays: 1, availableDays: 20, absenceRate: 5,
  dataQuality: { complete: true, unknownScheduleDays: 0, unknownCapacityDays: 0, unknownPlacements: 0 },
  departments: [], trend: [], rows: [{ employeeId: 'employee-1', employeeName: 'Fin de Groot', departmentId: null, departmentName: null, status: 'ACTIVE', firstAbsenceOn: '2026-07-01', caseCount: 1, absenceOccurrences: 1, sickDays: 1, sickHours: 8, absenceRate: 5, dataQuality: { complete: true, unknownScheduleDays: 0, unknownCapacityDays: 0, unknownPlacements: 0 } }],
}

describe('absenceInsightExcel', () => {
  it('maakt een Excel-compatibel werkblad met totalen per medewerker', () => {
    const output = absenceInsightExcel(report)
    expect(output).toContain('Excel.Sheet')
    expect(output).toContain('Fin de Groot')
    expect(output).toContain('Verzuimpercentage')
    expect(output).toContain('Datakwaliteit')
  })

  it('exports unknown denominators as unknown values, never as 0%', () => {
    const incomplete = { ...report, absenceRate: null, dataQuality: { ...report.dataQuality, complete: false, unknownScheduleDays: 1 }, rows: report.rows.map((row) => ({ ...row, absenceRate: null, sickHours: null, sickDays: null, dataQuality: { ...row.dataQuality, complete: false, unknownScheduleDays: 1 } })) }
    const output = absenceInsightExcel(incomplete)
    expect(output).toContain('Onbekend')
    expect(output).not.toContain('0%')
    expect(output).toContain('Onvolledig')
  })
})
