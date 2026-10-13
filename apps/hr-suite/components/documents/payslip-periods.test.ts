import { describe, expect, it } from 'vitest'
import { groupEmployeePayslips, parseImportedPayslipMonth, type EmployeePayslipDocument } from './payslip-periods'

function document(id: string, periodYear: number, periodMonth: number | null, source: EmployeePayslipDocument['source']): EmployeePayslipDocument {
  return {
    id,
    periodYear,
    periodMonth,
    source,
    contentType: 'application/pdf',
    viewHref: `/protected/${id}`,
    downloadHref: `/protected/${id}?download=1`,
  }
}

describe('unified payslip period grouping', () => {
  it('does not fabricate a group when there are no documents', () => {
    expect(groupEmployeePayslips([], 'en-GB', 'Period not specified')).toEqual([])
  })

  it('groups imported and Payroll PDFs in the same available month', () => {
    const groups = groupEmployeePayslips([
      document('payroll:2026-10', 2026, 10, 'PAYROLL'),
      document('imported:prior', 2026, 10, 'IMPORTED'),
    ], 'en-GB', 'Period not specified')
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ year: 2026, month: 10, documents: [{ source: 'IMPORTED' }, { source: 'PAYROLL' }] })
  })

  it('keeps an unknown imported month unknown while grouping actual years and months', () => {
    const groups = groupEmployeePayslips([
      document('unknown', 2025, null, 'IMPORTED'),
      document('march', 2026, 3, 'IMPORTED'),
      document('october', 2026, 10, 'PAYROLL'),
    ], 'en-GB', 'Period not specified')
    expect(groups.map((group) => [group.year, group.month])).toEqual([[2026, 10], [2026, 3], [2025, null]])
  })

  it('parses only explicit month/year periods that match the recorded calendar year', () => {
    expect(parseImportedPayslipMonth('October 2026', 2026)).toBe(10)
    expect(parseImportedPayslipMonth('2026-03', 2026)).toBe(3)
    expect(parseImportedPayslipMonth('Period 2025-10', 2026)).toBeNull()
    expect(parseImportedPayslipMonth('Annual statement 2026', 2026)).toBeNull()
  })
})
