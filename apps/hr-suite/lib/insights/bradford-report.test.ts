import { describe, expect, it } from 'vitest'
import { bradfordBandFor, calculateBradfordScore, filterBradfordRows } from './bradford-report'
import type { BradfordInsightRow } from './bradford-report'

describe('calculateBradfordScore', () => {
  it('applies S squared times D', () => {
    expect(calculateBradfordScore(2, 7)).toBe(28)
    expect(calculateBradfordScore(4, 12.5)).toBe(200)
  })

  it('rounds only the final score and applies the existing 51 and 400 band boundaries', () => {
    const below51 = calculateBradfordScore(1, 50.49)
    const at51 = calculateBradfordScore(1, 50.5)
    const at400 = calculateBradfordScore(1, 400.49)
    const at401 = calculateBradfordScore(1, 400.5)

    expect(below51).toBe(50)
    expect(at51).toBe(51)
    expect(at400).toBe(400)
    expect(at401).toBe(401)
    expect(bradfordBandFor(below51)).toBe('LOW')
    expect(bradfordBandFor(at51)).toBe('MEDIUM')
    expect(bradfordBandFor(at400)).toBe('MEDIUM')
    expect(bradfordBandFor(at401)).toBe('HIGH')
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
