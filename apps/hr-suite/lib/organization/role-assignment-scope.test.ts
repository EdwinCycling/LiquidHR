import { describe, expect, it } from 'vitest'
import { scopeRoleAssignmentDepartments } from './role-assignment-scope'

const departments = [
  { id: 'operations', code: 'OPS', name: 'Operations' },
  { id: 'services', code: 'SERV', name: 'Services' },
  { id: 'holding-only', code: 'HOLD', name: 'Holding only' },
]

describe('roltoewijzing-afdelingsscope', () => {
  it('toont alle actieve afdelingen van de HR-groep', () => {
    const result = scopeRoleAssignmentDepartments(departments)

    expect(result).toEqual(departments)
  })

  it('verliest een afdeling zonder actuele plaatsing niet uit de groepsscope', () => {
    const result = scopeRoleAssignmentDepartments(departments)

    expect(result).toContainEqual(departments[2])
  })
})
