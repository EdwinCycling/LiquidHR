import { describe, expect, it } from 'vitest'
import { getEmployeeOverviewPageRange, mapEmployeeOverviewPageRows } from './employee-overview'

function pageItem(id: string) {
  return {
    id,
    employee_number: null,
    first_name: 'Employee ' + id,
    birth_name_prefix: null,
    birth_name: 'Person ' + id,
    work_email: null,
    avatar_url: null,
    is_archived: false,
    department_name: null,
    job_title: null,
    status: 'ACTIVE_EMPLOYEE',
    employment_count: 0,
    employment_type: null,
    administration_names: [],
    hr_group_administration_count: 1,
    limited_detail: false,
  }
}

describe('employee overview page ranges', () => {
  it.each([
    [0, 1, 0, 0, 1],
    [5, 1, 1, 5, 1],
    [50, 1, 1, 50, 1],
    [51, 2, 51, 51, 2],
    [500, 10, 451, 500, 10],
    [10_005, 201, 10_001, 10_005, 201],
  ])('berekent bereik voor %i medewerkers op pagina %i', (total, page, from, to, pageCount) => {
    expect(getEmployeeOverviewPageRange(total, page)).toEqual({ from, to, pageCount })
  })

  it('geeft een leeg bereik buiten het aantal paginas en op een lege lijst', () => {
    expect(getEmployeeOverviewPageRange(51, 3)).toEqual({ from: 0, to: 0, pageCount: 2 })
    expect(getEmployeeOverviewPageRange(0, 1)).toEqual({ from: 0, to: 0, pageCount: 1 })
  })

  it('accepteert een pagina met maximaal 50 unieke medewerkerprojecties', () => {
    const mapped = mapEmployeeOverviewPageRows(Array.from({ length: 50 }, (_, index) => pageItem(String(index + 1))))
    expect(mapped.employees).toHaveLength(50)
    expect(mapped.limitedDetailEmployeeIds).toEqual([])
  })

  it('verwerpt afgekapt of dubbel medewerkerresultaat voordat de UI dit toont', () => {
    expect(() => mapEmployeeOverviewPageRows(Array.from({ length: 51 }, (_, index) => pageItem(String(index + 1)))))
      .toThrow('EMPLOYEE_OVERVIEW_PAGE_ROWS_INVALID')
    expect(() => mapEmployeeOverviewPageRows([pageItem('same'), pageItem('same')]))
      .toThrow('EMPLOYEE_OVERVIEW_PAGE_DUPLICATE_EMPLOYEE')
  })

  it('houdt de beperkte detailstatus alleen voor de records die de database als zodanig markeert', () => {
    const mapped = mapEmployeeOverviewPageRows([
      { ...pageItem('team-member'), employee_number: 'E-1', limited_detail: false },
      { ...pageItem('other-scope'), limited_detail: true },
    ])
    expect(mapped.limitedDetailEmployeeIds).toEqual(['other-scope'])
    expect(mapped.employees.map((employee) => employee.employeeNumber)).toEqual(['E-1', ''])
  })
})