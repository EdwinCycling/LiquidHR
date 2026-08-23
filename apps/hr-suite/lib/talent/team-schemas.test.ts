import { describe, expect, it } from 'vitest'
import { parseTalentTeamMatrixQuery, talentTeamMatrixQuerySchema } from './team-schemas'

describe('Talent Team Matrix query contract', () => {
  it('accepts the URL-state filters used by the team matrix', () => {
    expect(talentTeamMatrixQuerySchema.safeParse({ q: 'Mila', type: 'SKILL', status: 'RELEASED', source: 'HR_ENTERED' }).success).toBe(true)
    expect(parseTalentTeamMatrixQuery(new URLSearchParams('q=Mila&type=SKILL&status=RELEASED&source=HR_ENTERED')).success).toBe(true)
  })

  it('rejects unknown filter values and bounds search input', () => {
    expect(talentTeamMatrixQuerySchema.safeParse({ status: 'ARCHIVED' }).success).toBe(false)
    expect(talentTeamMatrixQuerySchema.safeParse({ q: 'x'.repeat(121) }).success).toBe(false)
    expect(parseTalentTeamMatrixQuery(new URLSearchParams('type=UNKNOWN')).success).toBe(false)
  })
})
