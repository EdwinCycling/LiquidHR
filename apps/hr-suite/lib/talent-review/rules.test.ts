import { describe, expect, it } from 'vitest'
import { calculateCampaignReminderAt, campaignFilterGroup, canEditTalentReviewAssignment, canHrReviewMode, canManagerAccessReviewSubject, canManagerReviewMode, deriveGridCell, movementDirection } from './rules'

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
    expect(deriveGridCell(null, 'HIGH')).toBeNull()
    expect(movementDirection('LOW_LOW', 'HIGH_NORMAL')).toBe('UP')
    expect(movementDirection('HIGH_HIGH', 'NORMAL_LOW')).toBe('DOWN')
    expect(movementDirection('NORMAL_LOW', 'LOW_NORMAL')).toBe('STABLE')
    expect(movementDirection(null, 'HIGH_HIGH')).toBe('NEW')
  })

  it('never exposes the manager as a review subject, even when the organization says they manage themselves', () => {
    expect(canManagerAccessReviewSubject('employee-1', 'employee-2')).toBe(true)
    expect(canManagerAccessReviewSubject('employee-1', 'employee-1')).toBe(false)
  })

  it('locks submitted assignments while allowing draft and returned work to be edited', () => {
    expect(canEditTalentReviewAssignment('DRAFT')).toBe(true)
    expect(canEditTalentReviewAssignment('NOT_STARTED')).toBe(true)
    expect(canEditTalentReviewAssignment('IN_PROGRESS')).toBe(true)
    expect(canEditTalentReviewAssignment('RETURNED')).toBe(true)
    expect(canEditTalentReviewAssignment('SUBMITTED')).toBe(false)
  })

  it('enforces the three campaign review modes and groups campaign filters', () => {
    expect(canManagerReviewMode('MANAGER_ONLY')).toBe(true)
    expect(canHrReviewMode('MANAGER_ONLY')).toBe(false)
    expect(canManagerReviewMode('HR_ONLY')).toBe(false)
    expect(canHrReviewMode('HR_ONLY')).toBe(true)
    expect(canManagerReviewMode('HYBRID')).toBe(true)
    expect(canHrReviewMode('HYBRID')).toBe(true)
    expect(campaignFilterGroup('DRAFT')).toBe('DRAFT')
    expect(campaignFilterGroup('SCHEDULED')).toBe('RUNNING')
    expect(campaignFilterGroup('ACTIVE')).toBe('RUNNING')
    expect(campaignFilterGroup('HR_REVIEW')).toBe('RUNNING')
    expect(campaignFilterGroup('CLOSED')).toBe('CLOSED')
    expect(campaignFilterGroup('ARCHIVED')).toBe('CLOSED')
  })
})
