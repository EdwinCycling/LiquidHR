import { describe, expect, it } from 'vitest'
import { moduleSelectionSchema } from './schemas'

describe('moduleSelectionSchema', () => {
  it('accepteert alleen beschikbare extra modules', () => {
    expect(moduleSelectionSchema.safeParse({ enabled: ['HERA', 'DOCUMENTS', 'SURVEYS', 'ENPS'] }).success).toBe(true)
    expect(moduleSelectionSchema.safeParse({ enabled: ['LEAVE'] }).success).toBe(false)
  })
})
