import { describe, expect, it } from 'vitest'
import { projectParticipantApplication } from './participant-projection'

describe('guided recruitment participant projection', () => {
  it('geeft terminale/revoked deelnemers geen kandidaatdata', () => {
    expect(projectParticipantApplication({ status: 'REVOKED', applicationState: 'ACTIVE', candidateName: 'Sanne', vacancyTitle: 'Product', ownAssessment: null, peerAssessments: [] })).toBeNull()
    expect(projectParticipantApplication({ status: 'ACTIVE', applicationState: 'TERMINAL', candidateName: 'Sanne', vacancyTitle: 'Product', ownAssessment: null, peerAssessments: [] })).toBeNull()
  })

  it('neemt voor een actieve deelnemer alleen de eigen draft op', () => {
    const projection = projectParticipantApplication({ status: 'ACTIVE', applicationState: 'ACTIVE', candidateName: 'Sanne', vacancyTitle: 'Product', ownAssessment: { status: 'DRAFT', scores: [] }, peerAssessments: [{ status: 'DRAFT', scores: [{ score: 5 }] }] })
    expect(projection).toEqual(expect.objectContaining({ candidateName: 'Sanne', ownAssessment: { status: 'DRAFT', scores: [] } }))
    expect(JSON.stringify(projection)).not.toContain('5')
  })
})
