import { describe, expect, it } from 'vitest'
import { teamCompassCampaignSchema, teamCompassResponseSchema } from './schemas'

const UUIDS = Array.from({ length: 42 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`)

describe('Teamkompas invoercontracten', () => {
  it('weigert een campagne zonder doelgroep of met een omgekeerde periode', () => {
    expect(teamCompassCampaignSchema.safeParse({
      campaignId: null, expectedVersion: null, questionnaireVersionId: UUIDS[0], name: 'Teammeting',
      description: '', personalMessage: '', startsOn: '2026-09-10', endsOn: '2026-09-01',
      anonymityThreshold: 5, departmentIds: [],
    }).success).toBe(false)
  })

  it('accepteert bestaande database-GUIDs zonder RFC-versie/variantbits', () => {
    expect(teamCompassCampaignSchema.safeParse({
      campaignId: null, expectedVersion: null,
      questionnaireVersionId: 'e11931fc-ea9b-f08d-0319-b6df140eec07',
      name: 'Teammeting', description: '', personalMessage: '',
      startsOn: '2026-09-01', endsOn: '2026-09-10', anonymityThreshold: 5,
      departmentIds: ['bdc6cc27-4faf-15c7-7a3e-e5174b8b5c92'],
    }).success).toBe(true)
  })

  it('vereist bij definitief indienen exact veertig unieke antwoorden', () => {
    const answer = { questionId: UUIDS[1], innerScore: 3, outerScore: 4 }
    expect(teamCompassResponseSchema.safeParse({
      expectedVersion: 1, answers: [answer], submit: true, shareOuter: false, shareInner: false,
    }).success).toBe(false)
    expect(teamCompassResponseSchema.safeParse({
      expectedVersion: 1,
      answers: UUIDS.slice(1, 41).map((questionId) => ({ questionId, innerScore: 3, outerScore: 4 })),
      submit: true, shareOuter: true, shareInner: true,
    }).success).toBe(true)
  })

  it('staat delen van de binnenstijl alleen toe wanneer de buitenrol ook wordt gedeeld', () => {
    expect(teamCompassResponseSchema.safeParse({
      expectedVersion: 1, answers: [{ questionId: UUIDS[1], innerScore: 3, outerScore: 3 }],
      submit: false, shareOuter: false, shareInner: true,
    }).success).toBe(false)
  })
})
