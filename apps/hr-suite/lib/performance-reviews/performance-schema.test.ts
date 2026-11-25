import { describe, expect, it } from 'vitest'
import { acknowledgementSchema, managerSubmissionSchema, roundSchema } from './performance-schema'

describe('gespreksronde contract', () => {
  const round = { title: 'Jaarlijks gesprek', introduction: 'Terugkijken en vooruitkijken', periodStart: '2026-01-01', periodEnd: '2026-12-31', startDate: '2026-11-22', rating: null }

  it('staat geen omgekeerde inhoudelijke periode toe', () => {
    expect(roundSchema.safeParse({ ...round, periodStart: '2027-01-01' }).success).toBe(false)
  })

  it('accepteert een schaal met exact vier, vijf of tien beschreven scores', () => {
    for (const size of [4, 5, 10]) {
      const options = Array.from({ length: size }, (_, i) => ({ score: i + 1, label: `Niveau ${i + 1}`, description: 'Toelichting' }))
      expect(roundSchema.safeParse({ ...round, rating: { options } }).success).toBe(true)
    }
    expect(roundSchema.safeParse({ ...round, rating: { options: [{ score: 1, label: 'Een', description: 'Toelichting' }] } }).success).toBe(false)
  })

  it('weigert dubbele of niet-aaneengesloten scores', () => {
    const options = [1, 2, 2, 4].map(score => ({ score, label: 'Niveau', description: 'Toelichting' }))
    expect(roundSchema.safeParse({ ...round, rating: { options } }).success).toBe(false)
  })

  it('weigert ongewenste velden en een lege niet-akkoordreden', () => {
    expect(acknowledgementSchema.safeParse({ version: 1, decision: 'DISAGREE', reason: '  ' }).success).toBe(false)
    expect(acknowledgementSchema.safeParse({ version: 1, decision: 'AGREE', reason: 'tekst' }).success).toBe(false)
    expect(managerSubmissionSchema.safeParse({ version: 1, body: 'Reactie', actorUserId: 'client' }).success).toBe(false)
  })
})
