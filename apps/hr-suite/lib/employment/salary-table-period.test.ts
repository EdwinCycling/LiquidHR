import { describe, expect, it } from 'vitest'
import { salaryRowCoversPayrollPeriod, salaryRowOverlapsPayrollPeriod } from './salary-table-period'

describe('salary table period boundaries', () => {
  it('treats the previous salary end as exclusive when the successor starts on the same date', () => {
    expect(salaryRowOverlapsPayrollPeriod('2026-09-01', '2026-11-01', '2026-11-01', '2026-11-30')).toBe(false)
    expect(salaryRowOverlapsPayrollPeriod('2026-11-01', null, '2026-11-01', '2026-11-30')).toBe(true)
  })

  it('accepts a salary that covers the complete month and rejects an end on the last payroll day', () => {
    expect(salaryRowCoversPayrollPeriod('2026-11-01', '2026-12-01', '2026-11-01', '2026-11-30')).toBe(true)
    expect(salaryRowCoversPayrollPeriod('2026-11-01', '2026-11-30', '2026-11-01', '2026-11-30')).toBe(false)
  })

  it('does not treat a partial-period salary change as full-period coverage', () => {
    expect(salaryRowCoversPayrollPeriod('2026-11-15', null, '2026-11-01', '2026-11-30')).toBe(false)
    expect(salaryRowCoversPayrollPeriod('2026-11-01', '2026-11-16', '2026-11-01', '2026-11-30')).toBe(false)
  })
})
