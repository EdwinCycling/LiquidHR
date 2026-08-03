import { describe, expect, it } from 'vitest'
import { talentComparisonListQuerySchema } from './comparison-schemas'

describe('Talent comparison query contract', () => {
  it('accepts an empty scope query or two UUID selections', () => {
    expect(talentComparisonListQuerySchema.safeParse({}).success).toBe(true)
    expect(talentComparisonListQuerySchema.safeParse({
      employeeId: '9048f02b-4fdc-3c4c-e1aa-fd339660029c',
      profileVersionId: 'f02e688c-71c0-4434-894f-b32b67dda42c',
    }).success).toBe(true)
  })

  it('rejects malformed identifiers and unexpected query keys', () => {
    expect(talentComparisonListQuerySchema.safeParse({ employeeId: 'employee-1' }).success).toBe(false)
    expect(talentComparisonListQuerySchema.safeParse({ employeeId: '11111111-1111-4111-8111-111111111111', extra: 'nope' }).success).toBe(false)
  })
})
