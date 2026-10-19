import { describe, expect, it } from 'vitest'
import { jsonValueEquals } from './json-value-equality'

describe('JSON value equality for persisted source metadata', () => {
  it('ignores object property order after a JSONB round-trip', () => {
    expect(jsonValueEquals(
      [{ code: 'RETAIL_STEP_2_PERCENT', percentage: '2.00', automaticallyApplied: false }],
      [{ automaticallyApplied: false, percentage: '2.00', code: 'RETAIL_STEP_2_PERCENT' }],
    )).toBe(true)
  })

  it('preserves array order and value types', () => {
    expect(jsonValueEquals([{ stepCode: 'A' }, { stepCode: 'B' }], [{ stepCode: 'B' }, { stepCode: 'A' }])).toBe(false)
    expect(jsonValueEquals([{ percentage: '2.00' }], [{ percentage: 2 }])).toBe(false)
  })
})
