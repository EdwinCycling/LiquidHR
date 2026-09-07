import { describe, expect, it } from 'vitest'

import { createAiTextProposalValidator, createSafeTextProposalValidator } from './proposal'

describe('AI Everywhere proposal contract', () => {
  it('accepts only human-review proposals and rejects extra fields', () => {
    const validator = createAiTextProposalValidator(40)
    expect(validator.validate({ resultType: 'PROPOSAL', proposedText: 'Voorstel', requiresHumanReview: true })).toMatchObject({ proposedText: 'Voorstel', requiresHumanReview: true })
    expect(() => validator.validate({ resultType: 'PROPOSAL', proposedText: 'x'.repeat(41), requiresHumanReview: true })).toThrowError(/INVALID_RESULT/)
    expect(() => validator.validate({ resultType: 'PROPOSAL', proposedText: 'Voorstel', requiresHumanReview: true, employeeId: 'leak' })).toThrowError(/INVALID_RESULT/)
  })

  it('rejects forbidden performance judgement text for conversation preparation', () => {
    const validator = createSafeTextProposalValidator({ forbidden: /score/i })
    expect(() => validator.validate({ resultType: 'PROPOSAL', proposedText: 'Performance score: 4', requiresHumanReview: true })).toThrowError(/INVALID_RESULT/)
  })
})
