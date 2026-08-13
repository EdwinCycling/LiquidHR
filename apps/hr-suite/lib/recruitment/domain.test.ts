import { describe, expect, it } from 'vitest'
import {
  applicationStateSchema,
  calculateRetentionDueAt,
  canReviewerSeePeerScores,
  createCandidateDuplicateSignal,
  reopenApplication,
  transitionApplication,
} from './domain'

const stageId = '11111111-1111-4111-8111-111111111111'

describe('recruitment domain', () => {
  it('onderscheidt een normale fase van exact twee terminale uitkomsten', () => {
    expect(applicationStateSchema.parse({ kind: 'ACTIVE', stageId, version: 1 })).toEqual({ kind: 'ACTIVE', stageId, version: 1 })
    expect(applicationStateSchema.parse({ kind: 'TERMINAL', outcome: 'AFGEWEZEN', version: 2 })).toMatchObject({ outcome: 'AFGEWEZEN' })
    expect(applicationStateSchema.parse({ kind: 'TERMINAL', outcome: 'AANGENOMEN', version: 2 })).toMatchObject({ outcome: 'AANGENOMEN' })
    expect(() => applicationStateSchema.parse({ kind: 'TERMINAL', outcome: 'TERUGGETROKKEN', version: 2 })).toThrow()
  })

  it('weigert een normale fasewijziging na een terminale uitkomst', () => {
    expect(() => transitionApplication(
      { kind: 'TERMINAL', outcome: 'AFGEWEZEN', version: 4 },
      { stageId, expectedVersion: 4 },
    )).toThrowError('RECRUITMENT_APPLICATION_TERMINAL')
  })

  it('heropent met een nieuwe versie zonder oude deelnemers te herstellen', () => {
    expect(reopenApplication(
      { kind: 'TERMINAL', outcome: 'AFGEWEZEN', version: 4 },
      { stageId, expectedVersion: 4 },
    )).toEqual({ state: { kind: 'ACTIVE', stageId, version: 5 }, restoreParticipantAccess: false })
  })

  it('behandelt genormaliseerde e-mail uitsluitend als duplicaarsignaal', () => {
    expect(createCandidateDuplicateSignal('  Persoon@Example.COM ')).toEqual({ normalizedEmail: 'persoon@example.com', requiresHumanDecision: true })
  })

  it('berekent retentie vanaf terminale tijd en schermt peerscores af tot eigen submit', () => {
    expect(calculateRetentionDueAt('2026-08-13T10:00:00.000Z', 28)).toBe('2026-09-10T10:00:00.000Z')
    expect(canReviewerSeePeerScores('DRAFT')).toBe(false)
    expect(canReviewerSeePeerScores('SUBMITTED')).toBe(true)
    expect(canReviewerSeePeerScores('CORRECTED')).toBe(true)
  })
})
