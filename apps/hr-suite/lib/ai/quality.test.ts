import { describe, expect, it } from 'vitest'
import { highestApplicableQualityProfile } from './quality'

describe('AI quality profile selection', () => {
  it('kiest het hoogste toepasselijke profiel bij meerdere rollen', () => {
    expect(highestApplicableQualityProfile(['EMPLOYEE', 'DIRECT_MANAGER'])).toBe('BALANCED')
    expect(highestApplicableQualityProfile(['DIRECT_MANAGER', 'HR_ADMIN'])).toBe('IN_DEPTH')
  })

  it('geeft null terug zonder bekende quota-rol', () => {
    expect(highestApplicableQualityProfile(['UNKNOWN_ROLE'])).toBeNull()
  })
})
