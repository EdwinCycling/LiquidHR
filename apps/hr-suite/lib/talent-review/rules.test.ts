import { describe, expect, it } from 'vitest'
import { calculateCampaignReminderAt, canManagerAccessReviewSubject, deriveGridCell, movementDirection } from './rules'

describe('talent review rules', () => {
  it('uses seven days before the deadline when that is after the campaign start', () => {
    expect(calculateCampaignReminderAt('2026-08-01', '2026-08-20', new Date('2026-08-01T08:00:00.000Z')).toISOString()).toBe('2026-08-13T09:00:00.000Z')
  })

  it('uses the deadline for a campaign shorter than seven days', () => {
    expect(calculateCampaignReminderAt('2026-08-01', '2026-08-05', new Date('2026-08-01T08:00:00.000Z')).toISOString()).toBe('2026-08-05T09:00:00.000Z')
  })

  it('moves a late score to the next executable minute instead of the past', () => {
    expect(calculateCampaignReminderAt('2026-08-01', '2026-08-05', new Date('2026-08-05T10:00:00.000Z')).toISOString()).toBe('2026-08-05T10:01:00.000Z')
  })

  it('derives a cell and a simple movement direction', () => {
    expect(deriveGridCell('HIGH', 'NORMAL')).toBe('HIGH_NORMAL')
    expect(movementDirection('LOW_LOW', 'HIGH_NORMAL')).toBe('UP')
    expect(movementDirection(null, 'HIGH_HIGH')).toBe('NEW')
  })

  it('never exposes the manager as a review subject, even when the organization says they manage themselves', () => {
    expect(canManagerAccessReviewSubject('employee-1', 'employee-2')).toBe(true)
    expect(canManagerAccessReviewSubject('employee-1', 'employee-1')).toBe(false)
  })
})
