import { describe, expect, it } from 'vitest'
import { talentRoleExplorerListQuerySchema } from './role-explorer-schemas'

describe('Talent role explorer query contract', () => {
  it('accepts an empty query or the stable employee/profile selection', () => {
    expect(talentRoleExplorerListQuerySchema.safeParse({}).success).toBe(true)
    expect(talentRoleExplorerListQuerySchema.safeParse({
      employeeId: '9048f02b-4fdc-3c4c-e1aa-fd339660029c',
      profileVersionId: 'f02e688c-71c0-4434-894f-b32b67dda42c',
    }).success).toBe(true)
  })

  it('rejects malformed identifiers and unexpected selection keys', () => {
    expect(talentRoleExplorerListQuerySchema.safeParse({ employeeId: 'employee-1' }).success).toBe(false)
    expect(talentRoleExplorerListQuerySchema.safeParse({
      profileVersionId: '11111111-1111-4111-8111-111111111111',
      asOf: '2026-08-23',
    }).success).toBe(false)
  })
})
