import { describe, expect, it } from 'vitest'
import { calculateBradfordScore, filterBradfordRows } from './bradford-report'
import type { BradfordInsightRow } from './bradford-report'

describe('calculateBradfordScore', () => {
  it('applies S squared times D', () => {
    expect(calculateBradfordScore(2, 7)).toBe(28)
    expect(calculateBradfordScore(4, 12.5)).toBe(200)
  })

  it('does not produce negative scores', () => {
    expect(calculateBradfordScore(-1, -5)).toBe(0)
  })

  it('applies risk and employee search to the service population used by export', () => {
    const rows: readonly BradfordInsightRow[] = [
      { employeeId: '1', employeeName: 'Élodie de Vries', departmentName: 'Product', firstAbsenceOn: '2026-01-01', absenceOccurrences: 3, sickDays: 12, score: 108, band: 'MEDIUM' },
      { employeeId: '2', employeeName: 'Bas Jansen', departmentName: 'Sales', firstAbsenceOn: '2026-01-01', absenceOccurrences: 1, sickDays: 2, score: 2, band: 'LOW' },
    ]
    expect(filterBradfordRows(rows, { risk: 'MEDIUM', search: 'ÉLODIE' })).toEqual([rows[0]])
    expect(filterBradfordRows(rows, { risk: 'ALL', search: 'jansen' })).toEqual([rows[1]])
  })
})
