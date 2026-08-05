import { describe, expect, it } from 'vitest'
import { scopeRoleAssignmentDepartments } from './role-assignment-scope'

const departments = [
  { id: 'operations', code: 'OPS', name: 'Operations' },
  { id: 'services', code: 'SERV', name: 'Services' },
  { id: 'holding-only', code: 'HOLD', name: 'Holding only' },
]

describe('roltoewijzing-afdelingsscope', () => {
  it('toont alleen afdelingen die in de actieve administratie voorkomen', () => {
    const result = scopeRoleAssignmentDepartments(
      departments,
      [{ department_id: 'operations' }],
      [{ department_id: 'services' }, { department_id: null }],
    )

    expect(result).toEqual([departments[0], departments[1]])
  })

  it('behoudt een bestaande toewijzing zonder actuele plaatsing', () => {
    const result = scopeRoleAssignmentDepartments(
      departments,
      [],
      [{ department_id: 'services' }],
    )

    expect(result).toEqual([departments[1]])
  })
})
