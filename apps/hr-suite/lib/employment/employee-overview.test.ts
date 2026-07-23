import { describe, expect, it } from 'vitest'
import { mapEmployeeOverviewRpcRow } from './employee-overview'

describe('mapEmployeeOverviewRpcRow', () => {
  it('behoudt de lijstprojectie en berekent status uit de volledige historie', () => {
    expect(mapEmployeeOverviewRpcRow({
      id: 'employee-1',
      employee_number: 'E-001',
      first_name: 'Lina',
      birth_name_prefix: null,
      birth_name: 'Bakker',
      work_email: 'lina@example.test',
      avatar_url: 'storage://tenant/employee-1/avatar.webp',
      is_archived: false,
      employment_history: [
        { starts_on: '2024-01-01', ends_on: '2025-12-31', record_status: 'CONFIRMED' },
        { starts_on: '2026-01-01', ends_on: null, record_status: 'CONFIRMED' },
      ],
      department_name: 'People & Culture',
      job_title: 'HR Adviseur',
    }, '2026-07-23')).toEqual({
      id: 'employee-1',
      employeeNumber: 'E-001',
      firstName: 'Lina',
      birthNamePrefix: null,
      birthName: 'Bakker',
      departmentName: 'People & Culture',
      jobTitle: 'HR Adviseur',
      workEmail: 'lina@example.test',
      avatarUrl: '/api/employees/employee-1/avatar',
      isArchived: false,
      status: 'ACTIVE_EMPLOYEE',
      employmentCount: 2,
    })
  })

  it('verwerpt corrupte RPC-historie voordat een lijststatus wordt getoond', () => {
    expect(() => mapEmployeeOverviewRpcRow({
      id: 'employee-1', employee_number: 'E-001', first_name: 'Lina', birth_name_prefix: null, birth_name: 'Bakker',
      work_email: null, avatar_url: null, is_archived: false, employment_history: [{ starts_on: '2026-01-01' }],
      department_name: null, job_title: null,
    }, '2026-07-23')).toThrow('EMPLOYEE_OVERVIEW_HISTORY_INVALID')
  })
})
