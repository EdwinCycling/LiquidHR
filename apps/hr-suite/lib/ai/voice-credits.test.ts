import { describe, expect, it } from 'vitest'

import { classifyFinalizeError } from './voice-credits'

describe('classifyFinalizeError', () => {
  it('maps known database messages to a safe diagnostic category', () => {
    expect(classifyFinalizeError({ code: 'P0001', message: 'AI_CREDITS_EXHAUSTED' })).toEqual({
      databaseCode: 'P0001',
      category: 'credits-exhausted',
    })
  })

  it('does not return an unknown database error message', () => {
    expect(classifyFinalizeError({ code: 'XX000', message: 'sensitive database detail' })).toEqual({
      databaseCode: 'XX000',
      category: 'unknown',
    })
  })
})
