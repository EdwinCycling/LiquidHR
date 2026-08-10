import { describe, expect, it } from 'vitest'
import { nextAvailableEmploymentNumber } from './employment-number'

describe('nextAvailableEmploymentNumber', () => {
  it('starts at one when no number is in use', () => {
    expect(nextAvailableEmploymentNumber([])).toBe('1')
  })

  it('takes the highest numeric number for the employee and adds one', () => {
    expect(nextAvailableEmploymentNumber(['1', '3', 'EMP-DEMO-006-A'])).toBe('4')
    expect(nextAvailableEmploymentNumber(['0', '2', '-4', 'ABC'])).toBe('3')
  })

  it('does not overflow when existing numbers are large', () => {
    expect(nextAvailableEmploymentNumber(['9007199254740993'])).toBe('9007199254740994')
  })
})
