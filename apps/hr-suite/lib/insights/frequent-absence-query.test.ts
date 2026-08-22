import { describe, expect, it } from 'vitest'
import { parseFrequentAbsenceQuery } from './frequent-absence-query'

describe('parseFrequentAbsenceQuery', () => {
  it('uses a rolling twelve-month window by default', () => {
    const query = parseFrequentAbsenceQuery(new URLSearchParams('report=absence-frequent&period=12-months'))
    expect(query?.period).toBe('12-months')
    expect(query?.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(query?.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('supports this year, previous year and department', () => {
    const query = parseFrequentAbsenceQuery(new URLSearchParams('report=absence-frequent&period=previous-year&department=dept-1'))
    expect(query?.period).toBe('previous-year')
    expect(query?.departmentId).toBe('dept-1')
    expect(query?.startDate).toMatch(/^\d{4}-01-01$/)
    expect(query?.endDate).toMatch(/^\d{4}-12-31$/)
  })

  it('ignores other insight reports', () => {
    expect(parseFrequentAbsenceQuery(new URLSearchParams('report=absence'))).toBeNull()
  })
})
