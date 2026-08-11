import { describe, expect, it } from 'vitest'
import { moduleSelectionSchema } from './schemas'

describe('moduleSelectionSchema', () => {
  it('accepteert alleen beschikbare modules', () => {
    expect(moduleSelectionSchema.safeParse({ enabled: ['HERA', 'DOCUMENTS', 'TEAM_COMPASS'] }).success).toBe(true)
    expect(moduleSelectionSchema.safeParse({ enabled: ['LEAVE'] }).success).toBe(false)
  })
})
