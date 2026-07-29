import { describe, expect, it } from 'vitest'
import { seniorityDuration } from './seniority'

describe('seniorityDuration', () => {
  it('uses the seniority date rather than the employment start date', () => {
    expect(seniorityDuration('2021-01-12', '2026-07-29')).toEqual({ years: 5, months: 6 })
  })

  it('does not count an incomplete calendar month', () => {
    expect(seniorityDuration('2024-01-31', '2024-02-28')).toEqual({ years: 0, months: 0 })
  })

  it('returns no duration for a future seniority date', () => {
    expect(seniorityDuration('2026-08-01', '2026-07-29')).toBeNull()
  })
})
