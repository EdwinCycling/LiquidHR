import { describe, expect, it } from 'vitest'
import { ageOnDate, isNewEmployeeBirthDateValid } from './age-validation'

describe('new employee age validation', () => {
  const today = '2026-08-08'

  it('accepts the inclusive 10 and 90 year boundaries', () => {
    expect(ageOnDate('2016-08-08', today)).toBe(10)
    expect(ageOnDate('1936-08-08', today)).toBe(90)
    expect(isNewEmployeeBirthDateValid('2016-08-08', today)).toBe(true)
    expect(isNewEmployeeBirthDateValid('1936-08-08', today)).toBe(true)
  })

  it('rejects ages outside the range and invalid dates', () => {
    expect(isNewEmployeeBirthDateValid('2016-08-09', today)).toBe(false)
    expect(isNewEmployeeBirthDateValid('1935-08-07', today)).toBe(false)
    expect(isNewEmployeeBirthDateValid('2026-02-30', today)).toBe(false)
  })
})
