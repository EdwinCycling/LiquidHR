import { describe, expect, it } from 'vitest'
import { moduleSelectionSchema } from './schemas'

describe('moduleSelectionSchema', () => {
  it('accepteert alleen de drie bestaande extra modules', () => {
    expect(moduleSelectionSchema.safeParse({ enabled: ['HERA', 'DOCUMENTS'] }).success).toBe(true)
    expect(moduleSelectionSchema.safeParse({ enabled: ['LEAVE'] }).success).toBe(false)
  })
})
