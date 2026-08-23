import { describe, expect, it } from 'vitest'
import { evaluateTalentRoleExplorerOutcome } from './role-explorer-service'

const baseInput = {
  capabilityAvailable: true,
  recordStatus: 'RELEASED',
  isCurrentRecord: true,
  isCertificate: false,
  evidenceStatus: 'VERIFIED',
  targetLevelRank: 3,
  currentLevelRank: 3,
  targetLanguageLevel: null,
  currentLanguageLevel: null,
}

describe('Talent role explorer outcome semantics', () => {
  it('returns MATCH for an evidence-backed current capability at the target level', () => {
    expect(evaluateTalentRoleExplorerOutcome(baseInput)).toBe('MATCH')
  })

  it('returns GAP when the released current level is below the requirement', () => {
    expect(evaluateTalentRoleExplorerOutcome({ ...baseInput, currentLevelRank: 2 })).toBe('GAP')
  })

  it('returns MISSING_EVIDENCE for an unverified certificate record', () => {
    expect(evaluateTalentRoleExplorerOutcome({ ...baseInput, isCertificate: true, evidenceStatus: 'PENDING' })).toBe('MISSING_EVIDENCE')
  })

  it('returns UNKNOWN when no current released source record is available', () => {
    expect(evaluateTalentRoleExplorerOutcome({ ...baseInput, recordStatus: null, isCurrentRecord: false })).toBe('UNKNOWN')
    expect(evaluateTalentRoleExplorerOutcome({ ...baseInput, recordStatus: 'DRAFT', isCurrentRecord: true })).toBe('UNKNOWN')
    expect(evaluateTalentRoleExplorerOutcome({ ...baseInput, capabilityAvailable: false })).toBe('UNKNOWN')
  })

  it('does not treat an unknown language level as a match', () => {
    expect(evaluateTalentRoleExplorerOutcome({ ...baseInput, targetLevelRank: null, targetLanguageLevel: 'B2', currentLanguageLevel: null })).toBe('UNKNOWN')
  })
})
