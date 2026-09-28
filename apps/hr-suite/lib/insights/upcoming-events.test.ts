import { describe, expect, it } from 'vitest'
import { scopeUpcomingDepartments } from './upcoming-events'

const departments = [{ id: 'department-1', name: 'Product' }, { id: 'department-2', name: 'Sales' }]
const organizations = [
  { employee_id: 'employee-1', employment_id: 'employment-1', department_id: 'department-1' },
  { employee_id: 'employee-2', employment_id: 'employment-2', department_id: 'department-2' },
]

describe('upcoming event department scope', () => {
  it('keeps all departments for an HR-admin population', () => {
    expect(scopeUpcomingDepartments(departments, organizations, null)).toEqual(departments)
  })

  it('returns only departments represented by a manager team', () => {
    expect(scopeUpcomingDepartments(departments, organizations, ['employee-1'])).toEqual([departments[0]])
  })
})
