import { describe, expect, it } from 'vitest'
import { talentCheckInCreateSchema, talentCheckInUpdateSchema } from './check-in-schemas'

describe('talent check-in schemas', () => {
  it('requires a title for a follow-up action', () => {
    expect(talentCheckInCreateSchema.safeParse({ entryType: 'FOLLOW_UP', body: 'Bespreken' }).success).toBe(false)
  })

  it('keeps employee reflection separate from follow-up fields', () => {
    expect(talentCheckInCreateSchema.safeParse({ entryType: 'EMPLOYEE_REFLECTION', body: 'Terugblik', followUpTitle: 'Niet toegestaan' }).success).toBe(false)
    expect(talentCheckInCreateSchema.safeParse({ entryType: 'EMPLOYEE_REFLECTION', body: 'Terugblik', followUpDueOn: '2026-09-01' }).success).toBe(false)
  })

  it('requires optimistic versioning on updates', () => {
    expect(talentCheckInUpdateSchema.safeParse({ status: 'COMPLETED' }).success).toBe(false)
    expect(talentCheckInUpdateSchema.parse({ version: 1, status: 'COMPLETED' }).status).toBe('COMPLETED')
  })
})
