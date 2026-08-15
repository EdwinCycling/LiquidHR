import { describe, expect, it } from 'vitest'
import {
  calculateBandMetrics,
  deriveAnchorsFromMidpointAndSpread,
  deriveMidpointFromMinimumAndMaximum,
} from './calculations'

describe('salary structure calculations', () => {
  it('derives money anchors from midpoint and spread with cent precision', () => {
    expect(deriveAnchorsFromMidpointAndSpread('3200.00', '35.00')).toEqual({
      minimum: '2723.40',
      midpoint: '3200.00',
      maximum: '3676.60',
    })
  })

  it('derives the midpoint from minimum and maximum with cent precision', () => {
    expect(deriveMidpointFromMinimumAndMaximum('2600.00', '3400.00')).toBe('3000.00')
  })

  it('matches the canonical spread, progression and overlap metrics', () => {
    expect(calculateBandMetrics(
      { minimum: '3166.67', midpoint: '3800.00', maximum: '4433.33' },
      { minimum: '2723.40', midpoint: '3200.00', maximum: '3676.60' },
    )).toEqual({
      rangeSpreadPercentage: '40.00',
      midpointProgressionPercentage: '18.75',
      overlapPercentage: '53.50',
      hasGap: false,
    })
  })

  it('keeps open-top metrics nullable while retaining compa-independent progression and overlap', () => {
    expect(calculateBandMetrics(
      { minimum: '7500.00', midpoint: '9000.00', maximum: null },
      { minimum: '5490.20', midpoint: '7000.00', maximum: '8509.80' },
    )).toEqual({
      rangeSpreadPercentage: null,
      midpointProgressionPercentage: '28.57',
      overlapPercentage: '33.44',
      hasGap: false,
    })
  })

  it('clamps negative overlap to zero and reports a gap separately', () => {
    expect(calculateBandMetrics(
      { minimum: '3600.00', midpoint: '3900.00', maximum: '4200.00' },
      { minimum: '2600.00', midpoint: '2900.00', maximum: '3400.00' },
    )).toMatchObject({ overlapPercentage: '0.00', hasGap: true })
  })

  it('rejects equal band anchors because the midpoint must be strictly between the bounds', () => {
    expect(() => deriveMidpointFromMinimumAndMaximum('3000.00', '3000.00')).toThrow('INVALID_BAND_ANCHORS')
    expect(() => calculateBandMetrics({ minimum: '3000.00', midpoint: '3000.00', maximum: '3600.00' })).toThrow('INVALID_BAND_ANCHORS')
    expect(() => calculateBandMetrics({ minimum: '3000.00', midpoint: '3400.00', maximum: '3400.00' })).toThrow('INVALID_BAND_ANCHORS')
  })
})
