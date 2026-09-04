import { describe, expect, it } from 'vitest'
import { parseDecimalInput } from './decimal-input'

describe('parseDecimalInput', () => {
  it('accepts both decimal separators', () => {
    expect(parseDecimalInput('12,5')).toBe(12.5)
    expect(parseDecimalInput('12.5')).toBe(12.5)
    expect(parseDecimalInput('1.234,50')).toBe(1234.5)
    expect(parseDecimalInput('1,234.50')).toBe(1234.5)
    expect(parseDecimalInput('1.234,50')).toBe(1234.5)
  })

  it('keeps empty input invalid instead of turning it into zero', () => {
    expect(Number.isNaN(parseDecimalInput(''))).toBe(true)
  })
})
