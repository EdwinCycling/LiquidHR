import { describe, expect, it } from 'vitest'
import { buildInterviewSnapshots, interviewInputSchema } from './interview-service'

describe('guided recruitment interview service', () => {
  it('valideert gesprek met deelnemers en optionele set', () => {
    expect(interviewInputSchema.safeParse({
      applicationId: '11111111-1111-4111-8111-111111111111',
      title: 'TEST-RECRUITMENT-Eerste gesprek',
      scheduledAt: '2026-08-20T10:00:00.000Z',
      setId: null,
      participants: ['22222222-2222-4222-8222-222222222222'],
    }).success).toBe(true)
  })

  it('maakt preparation, questions en criteria afzonderlijke snapshots', () => {
    const snapshot = buildInterviewSnapshots([
      { itemType: 'PREPARATION', title: 'Bereid een voorbeeld voor', content: { prompt: 'Voorbeeld' } },
      { itemType: 'INTERVIEW_QUESTION', title: 'Vertel over samenwerken', content: { prompt: 'Samenwerken' } },
      { itemType: 'CRITERION', title: 'Samenwerken', content: { anchors: { 1: 'Laag', 3: 'Midden', 5: 'Hoog' } } },
    ])
    expect(snapshot.preparation).toHaveLength(1)
    expect(snapshot.questions).toHaveLength(1)
    expect(snapshot.criteria).toHaveLength(1)
  })
})
