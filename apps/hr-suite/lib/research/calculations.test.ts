import { describe, expect, it } from 'vitest'
import { calculateEnps, enforceAnonymityThreshold, summarizeNumericAnswers } from './calculations'

describe('research calculations', () => {
  it('berekent eNPS als percentage promoters minus percentage detractors', () => {
    expect(calculateEnps([10, 9, 8, 7, 6, 0])).toEqual({
      score: 0,
      total: 6,
      promoters: 2,
      passives: 2,
      detractors: 2,
      promoterPercentage: 33,
      passivePercentage: 33,
      detractorPercentage: 33,
    })
  })

  it('geeft een lege score terug zonder responses', () => {
    expect(calculateEnps([])).toEqual({
      score: null,
      total: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      promoterPercentage: 0,
      passivePercentage: 0,
      detractorPercentage: 0,
    })
  })

  it('verbergt eNPS-resultaten onder vijf responses', () => {
    expect(enforceAnonymityThreshold(['a', 'b', 'c', 'd'])).toEqual({ visible: false, values: [] })
    expect(enforceAnonymityThreshold(['a', 'b', 'c', 'd', 'e'])).toEqual({
      visible: true,
      values: ['a', 'b', 'c', 'd', 'e'],
    })
  })

  it('berekent numerieke survey-antwoorden zonder lege waarden', () => {
    expect(summarizeNumericAnswers([2, 0, 5, 3])).toEqual({ count: 4, minimum: 0, maximum: 5, average: 2.5, sum: 10 })
  })
})
