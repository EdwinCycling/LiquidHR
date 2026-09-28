import { describe, expect, it } from 'vitest'
import { filterFrequentAbsenceRows } from './frequent-absence-report'
import type { FrequentAbsenceRow } from './frequent-absence-report'

const rows: readonly FrequentAbsenceRow[] = [
  { employeeId: '1', employeeName: 'Élodie de Vries', departmentName: 'Product', reportCount: 3, totalSickDays: 12, isFrequent: true },
  { employeeId: '2', employeeName: 'Bas Jansen', departmentName: 'Sales', reportCount: 1, totalSickDays: 2, isFrequent: false },
]

describe('frequent absence row filters', () => {
  it('applies frequent-only and case-insensitive employee search to the service population', () => {
    expect(filterFrequentAbsenceRows(rows, { frequentOnly: true, search: 'ÉLODIE' })).toEqual([rows[0]])
    expect(filterFrequentAbsenceRows(rows, { frequentOnly: false, search: 'jansen' })).toEqual([rows[1]])
  })

  it('keeps an empty search from removing any rows when frequent-only is off', () => {
    expect(filterFrequentAbsenceRows(rows, { frequentOnly: false, search: '  ' })).toEqual(rows)
  })
})
