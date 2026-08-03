import { describe, expect, it } from 'vitest'
import { talentReviewCampaignCreateSchema, talentReviewScoreSaveSchema } from './schemas'

describe('talent review schemas', () => {
  it('requires an end date after the start date', () => {
    expect(talentReviewCampaignCreateSchema.safeParse({ name: 'Q3', startsOn: '2026-08-10', endsOn: '2026-08-10' }).success).toBe(false)
  })

  it('accepts an incomplete draft and rejects unknown fields', () => {
    expect(talentReviewScoreSaveSchema.safeParse({ employeeId: '00000000-0000-4000-8000-000000000001', status: 'DRAFT' }).success).toBe(true)
    expect(talentReviewScoreSaveSchema.safeParse({ employeeId: '00000000-0000-4000-8000-000000000001', unexpected: true }).success).toBe(false)
  })
})
