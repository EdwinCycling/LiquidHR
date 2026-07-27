import { describe, expect, it } from 'vitest'
import {
  calculateEffectiveClockStartOn,
  countPriorAbsenceCases,
  getAbsenceCaseRelationship,
  getRecoveryWindowEnd,
  validateAbsencePercentage,
} from './engine'

describe('absence engine', () => {
  it('koppelt een nieuwe ziekteperiode binnen 28 dagen niet als nieuwe casus', () => {
    expect(getAbsenceCaseRelationship({ previousRecoveredOn: '2026-07-01', newStartedOn: '2026-07-28' })).toBe('COMPOUND')
  })

  it('maakt op exact 28 dagen een nieuwe casus', () => {
    expect(getAbsenceCaseRelationship({ previousRecoveredOn: '2026-07-01', newStartedOn: '2026-07-29' })).toBe('NEW_CASE')
  })

  it('telt casuswortels in het voorafgaande jaar en niet de nieuwe casus dubbel', () => {
    expect(countPriorAbsenceCases({ firstAbsenceDates: ['2025-08-01', '2026-01-10', '2026-07-01'], newFirstAbsenceOn: '2026-07-26', threshold: 3 })).toEqual({ priorCount: 3, isFrequentAbsence: true })
  })

  it('schuift de effectieve klok op met herstelgaten', () => {
    expect(calculateEffectiveClockStartOn({ rootStartOn: '2026-01-01', recoveryGaps: [{ recoveredOn: '2026-01-10', nextStartedOn: '2026-01-20' }] })).toBe('2026-01-11')
  })

  it('berekent de einddatum van de vierwekentermijn', () => {
    expect(getRecoveryWindowEnd('2026-07-01')).toBe('2026-07-29')
  })

  it('accepteert alleen percentages boven nul tot en met honderd', () => {
    expect(validateAbsencePercentage(0)).toBe(false)
    expect(validateAbsencePercentage(0.01)).toBe(true)
    expect(validateAbsencePercentage(100)).toBe(true)
    expect(validateAbsencePercentage(100.01)).toBe(false)
  })
})
