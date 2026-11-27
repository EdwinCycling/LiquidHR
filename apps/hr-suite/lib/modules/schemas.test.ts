import { describe, expect, it } from 'vitest'
import { moduleSelectionSchema } from './schemas'

describe('moduleSelectionSchema', () => {
  it('accepteert alleen beschikbare extra modules', () => {
    expect(moduleSelectionSchema.safeParse({ enabled: ['HERA', 'SURVEYS', 'ENPS', 'TEAM_COMPASS', 'JOURNEYS', 'RECRUITMENT', 'PAYROLL'] }).success).toBe(true)
    expect(moduleSelectionSchema.safeParse({ enabled: ['HERA', 'REMINDERS', 'TALENT', 'SURVEYS', 'ENPS', 'TEAM_COMPASS', 'JOURNEYS', 'RECRUITMENT', 'PAYROLL'] }).success).toBe(true)
    expect(moduleSelectionSchema.safeParse({ enabled: ['PAYROLL'] }).success).toBe(true)
    expect(moduleSelectionSchema.safeParse({ enabled: ['PERFORMANCE_REVIEW_QUESTION_SETS'] }).success).toBe(true)
    expect(moduleSelectionSchema.safeParse({ enabled: ['DOCUMENTS'] }).success).toBe(false)
    expect(moduleSelectionSchema.safeParse({ enabled: ['LEAVE'] }).success).toBe(false)
  })

  it('allows the full current set of optional modules', () => {
    expect(moduleSelectionSchema.safeParse({ enabled: ['HERA', 'REMINDERS', 'TALENT', 'SURVEYS', 'ENPS', 'TEAM_COMPASS', 'JOURNEYS', 'RECRUITMENT', 'PAYROLL', 'PERFORMANCE_REVIEW_QUESTION_SETS'] }).success).toBe(true)
  })
})
