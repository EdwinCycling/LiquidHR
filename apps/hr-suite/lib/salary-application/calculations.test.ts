import { describe, expect, it } from 'vitest'
import { calculateSalaryBandPosition, calculateSalaryFromBandPercentage } from './calculations'

const band = { minimum: '3200.00', midpoint: '3800.00', maximum: '4400.00' }

describe('calculateSalaryBandPosition', () => {
  it('calculates compa ratio and range penetration at the midpoint', () => {
    expect(calculateSalaryBandPosition('3800.00', band)).toEqual({
      status: 'WITHIN_RANGE',
      compaRatioPercentage: '100.00',
      rangePenetrationPercentage: '50.00',
    })
  })

  it('keeps salary outside the range visible as a status', () => {
    expect(calculateSalaryBandPosition('3000.00', band).status).toBe('UNDER_MINIMUM')
    expect(calculateSalaryBandPosition('4500.00', band).status).toBe('ABOVE_MAXIMUM')
    expect(calculateSalaryBandPosition('4500.00', band).rangePenetrationPercentage).toBe('108.33')
  })

  it('returns no metrics when the effective band is unavailable', () => {
    expect(calculateSalaryBandPosition('3800.00', null)).toEqual({
      status: 'NO_VALID_BAND',
      compaRatioPercentage: null,
      rangePenetrationPercentage: null,
    })
  })

  it('supports an open-ended upper range', () => {
    expect(calculateSalaryBandPosition('5200.00', { ...band, maximum: null })).toEqual({
      status: 'WITHIN_RANGE',
      compaRatioPercentage: '136.84',
      rangePenetrationPercentage: null,
    })
  })

  it('converts the 100%-point percentage back to a full-time salary', () => {
    expect(calculateSalaryFromBandPercentage('100.00', band)).toBe('3800.00')
    expect(calculateSalaryFromBandPercentage('90.00', band)).toBe('3420.00')
  })

  it('rejects an invalid band or invalid percentage without a UI exception', () => {
    expect(calculateSalaryFromBandPercentage('90.001', band)).toBeNull()
    expect(calculateSalaryFromBandPercentage('90.00', null)).toBeNull()
    expect(calculateSalaryBandPosition('2500', { minimum: '2000', midpoint: '2000', maximum: '3000' }).status).toBe('NO_VALID_BAND')
    expect(calculateSalaryBandPosition('2500', { minimum: '2000', midpoint: '2500', maximum: '2500' }).status).toBe('NO_VALID_BAND')
  })
})
