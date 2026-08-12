import { describe, expect, it } from 'vitest'
import { moduleSelectionSchema } from './schemas'

describe('moduleSelectionSchema', () => {
  it('accepteert alleen beschikbare extra modules', () => {
    expect(moduleSelectionSchema.safeParse({ enabled: ['HERA', 'SURVEYS', 'ENPS', 'TEAM_COMPASS'] }).success).toBe(true)
    expect(moduleSelectionSchema.safeParse({ enabled: ['DOCUMENTS'] }).success).toBe(false)
    expect(moduleSelectionSchema.safeParse({ enabled: ['LEAVE'] }).success).toBe(false)
  })
})
