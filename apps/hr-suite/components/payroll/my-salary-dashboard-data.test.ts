import { describe, expect, it } from 'vitest'
import type { EmployeePayrollStatement } from '@/lib/payroll/payroll-professional-service'
import { previousAvailableSalaryStatement, salaryComponentChanges, salaryTrendPoints } from './my-salary-dashboard-data'

function statement(year: number, month: number, components: EmployeePayrollStatement['components']): EmployeePayrollStatement {
  return { periodYear: year, periodMonth: month, components, pension: null, pensionReadiness: 'CALCULATED' }
}

describe('My Salary history projection', () => {
  it('shows an empty history without inventing a month', () => {
    expect(salaryTrendPoints([])).toEqual([])
  })

  it('shows one actual saved month and no previous-period comparison', () => {
    const october = statement(2026, 10, [
      { key: 'gross_salary', amount: 5500 },
      { key: 'net_salary', amount: 4200 },
    ])
    expect(salaryTrendPoints([october])).toEqual([{ period: '2026-10', periodYear: 2026, periodMonth: 10, gross: 5500, net: 4200 }])
    expect(previousAvailableSalaryStatement(october, [october])).toBeNull()
  })

  it('charts only available months and compares to the prior available month across gaps', () => {
    const august = statement(2026, 8, [{ key: 'gross_salary', amount: 5000 }, { key: 'net_salary', amount: 3900 }])
    const october = statement(2026, 10, [{ key: 'gross_salary', amount: 5200 }, { key: 'net_salary', amount: 4050 }])
    const november = statement(2026, 11, [{ key: 'gross_salary', amount: 5300 }, { key: 'net_salary', amount: 4100 }])
    expect(salaryTrendPoints([november, august, october]).map((point) => point.period)).toEqual(['2026-08', '2026-10', '2026-11'])
    expect(salaryTrendPoints([november, august, october], 2).map((point) => point.period)).toEqual(['2026-10', '2026-11'])
    expect(previousAvailableSalaryStatement(november, [november, august, october])).toBe(october)
  })

  it('compares only common persisted components and leaves zero-baseline percentages undefined', () => {
    const previous = statement(2026, 9, [
      { key: 'wage_tax', amount: 0 },
      { key: 'employee_pension', amount: 100 },
      { key: 'cumulative_gross', amount: 1000 },
      { key: 'missing_now', amount: 20 },
    ])
    const current = statement(2026, 10, [
      { key: 'wage_tax', amount: 15.25 },
      { key: 'employee_pension', amount: 110 },
      { key: 'cumulative_gross', amount: 2000 },
      { key: 'new_component', amount: 8 },
    ])
    expect(salaryComponentChanges(current, previous)).toEqual([
      { key: 'wage_tax', before: 0, after: 15.25, difference: 15.25, percentage: null },
      { key: 'employee_pension', before: 100, after: 110, difference: 10, percentage: 10 },
    ])
  })
})
