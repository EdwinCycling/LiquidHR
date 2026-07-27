import { describe, expect, it } from 'vitest'
import { calculateBradfordScore } from './bradford-report'

describe('calculateBradfordScore', () => {
  it('applies S squared times D', () => {
    expect(calculateBradfordScore(2, 7)).toBe(28)
    expect(calculateBradfordScore(4, 12.5)).toBe(200)
  })

  it('does not produce negative scores', () => {
    expect(calculateBradfordScore(-1, -5)).toBe(0)
  })
})
