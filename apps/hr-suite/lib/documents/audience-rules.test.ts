import { describe, expect, it } from 'vitest'
import { canAccessDocument } from './audience-rules'

describe('document audience rules', () => {
  it('requires permission and an audience match', () => {
    expect(canAccessDocument({ hasPermission: true, audienceMatches: false })).toBe(false)
    expect(canAccessDocument({ hasPermission: false, audienceMatches: true })).toBe(false)
    expect(canAccessDocument({ hasPermission: true, audienceMatches: true })).toBe(true)
  })
})
