import { describe, expect, it } from 'vitest'
import { assessmentInputSchema, canSeeAssessment, computeCharacteristicAverages, correctionRevision } from './assessment-service'

describe('guided recruitment assessment service', () => {
  it('valideert scores 1 tot en met 5 en verbergt peerdata voor submit', () => {
    expect(assessmentInputSchema.safeParse({ interviewId: '11111111-1111-4111-8111-111111111111', scores: [{ characteristicId: '22222222-2222-4222-8222-222222222222', score: 4, note: 'Heldere uitleg' }] }).success).toBe(true)
    expect(canSeeAssessment({ status: 'DRAFT', reviewerEmployeeId: 'a' }, 'b')).toBe(false)
    expect(canSeeAssessment({ status: 'DRAFT', reviewerEmployeeId: 'a' }, 'a')).toBe(true)
    expect(canSeeAssessment({ status: 'SUBMITTED', reviewerEmployeeId: 'a' }, 'b')).toBe(true)
  })

  it('berekent transparante gemiddelden per kenmerk en maakt correction revisions', () => {
    expect(computeCharacteristicAverages([
      { characteristicId: 'c1', score: 4, status: 'SUBMITTED' },
      { characteristicId: 'c1', score: 3, status: 'SUBMITTED' },
      { characteristicId: 'c1', score: 1, status: 'DRAFT' },
    ])).toEqual([{ characteristicId: 'c1', average: 3.5, count: 2 }])
    expect(correctionRevision({ id: 'a1', revision: 1, status: 'SUBMITTED' }, 'Correctie nodig')).toEqual({ correctedFromAssessmentId: 'a1', revision: 2, correctionReason: 'Correctie nodig', status: 'CORRECTED' })
  })
})
