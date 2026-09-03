import { describe, expect, it } from 'vitest'
import { unwrapDocumentStudioData } from './api-response'

describe('Document Studio API response', () => {
  it('unwraps the standard data envelope', () => {
    expect(unwrapDocumentStudioData({ data: { revision: 2, valid: true } })).toEqual({ revision: 2, valid: true })
  })

  it('rejects an unwrapped operation response', () => {
    expect(unwrapDocumentStudioData({ revision: 2, valid: true })).toBeNull()
  })
})
