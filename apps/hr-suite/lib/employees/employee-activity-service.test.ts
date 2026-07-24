import { describe, expect, it } from 'vitest'
import { employeeActivityMessageSchema } from './employee-activity-schemas'

describe('employeeActivityMessageSchema', () => {
  it('requires a non-empty bounded message', () => {
    expect(employeeActivityMessageSchema.safeParse('   ').success).toBe(false)
    expect(employeeActivityMessageSchema.safeParse('Een korte notitie').success).toBe(true)
    expect(employeeActivityMessageSchema.safeParse('x'.repeat(2_001)).success).toBe(false)
  })
})
