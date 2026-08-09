import { describe, expect, it } from 'vitest'
import { nextAvailableEmploymentNumber } from './employment-number'

describe('nextAvailableEmploymentNumber', () => {
  it('starts at one when no number is in use', () => {
    expect(nextAvailableEmploymentNumber([])).toBe('1')
  })

  it('skips numbers already used in the administration', () => {
    expect(nextAvailableEmploymentNumber(['1', '3', 'EMP-DEMO-006-A'])).toBe('2')
    expect(nextAvailableEmploymentNumber(['1', '2', '3'])).toBe('4')
  })
})
