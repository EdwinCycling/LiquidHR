import { describe, expect, it } from 'vitest'
import { talentAssessmentCycleCreateSchema, talentAssessmentResponseSaveSchema } from './assessment-schemas'

describe('Talent assessment contracts', () => {
  it('accepts a cycle with an explicit item and bounded dates', () => {
    const result = talentAssessmentCycleCreateSchema.safeParse({
      code: 'CYCLE-2026',
      name: 'Talentgesprek 2026',
      opensOn: '2026-08-02',
      closesOn: '2026-09-01',
      items: [{ title: 'Vakmanschap', prompt: 'Beschrijf de ontwikkeling.', sortOrder: 1, maxScore: 5, isRequired: true }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a cycle with duplicate item order or inverted dates', () => {
    const result = talentAssessmentCycleCreateSchema.safeParse({
      code: 'CYCLE-INVALID',
      name: 'Ongeldige cyclus',
      opensOn: '2026-09-01',
      closesOn: '2026-08-02',
      items: [
        { title: 'Een', prompt: 'Vraag één', sortOrder: 1, maxScore: 5, isRequired: true },
        { title: 'Twee', prompt: 'Vraag twee', sortOrder: 1, maxScore: 5, isRequired: true },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('allows a self response without a client employee id', () => {
    const result = talentAssessmentResponseSaveSchema.safeParse({
      cycleId: '11111111-1111-4111-8111-111111111111',
      responseType: 'SELF',
      status: 'DRAFT',
      answers: [],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a manager response with a separate private note', () => {
    const result = talentAssessmentResponseSaveSchema.safeParse({
      cycleId: '11111111-1111-4111-8111-111111111111',
      responseType: 'MANAGER',
      subjectEmployeeId: '22222222-2222-4222-8222-222222222222',
      status: 'SUBMITTED',
      answers: [{ itemId: '33333333-3333-4333-8333-333333333333', score: 4, answerText: 'Sterk in de praktijk.' }],
      privateNote: 'Alleen voor manager en HR.',
    })
    expect(result.success).toBe(true)
  })
})
