import { describe, expect, it } from 'vitest'
import { buildRetentionImpact, retentionSettingsSchema, retentionWarning } from './retention-service'

describe('guided recruitment retention service', () => {
  it('hanteert default 28 en range 1-3650 met alleen een waarschuwing boven 365', () => {
    expect(retentionSettingsSchema.parse({ retentionDays: 28 })).toEqual({ retentionDays: 28 })
    expect(retentionSettingsSchema.safeParse({ retentionDays: 0 }).success).toBe(false)
    expect(retentionWarning(365)).toBeNull()
    expect(retentionWarning(366)).toContain('365')
  })

  it('maakt een impactpreview zonder inhoud van kandidaten te tonen', () => {
    expect(buildRetentionImpact({ retentionDays: 28, terminalApplications: 4, earliestDueAt: '2026-08-20T00:00:00.000Z' })).toEqual({ retentionDays: 28, terminalApplications: 4, earliestDueAt: '2026-08-20T00:00:00.000Z', recomputesDueDates: true })
  })
})
