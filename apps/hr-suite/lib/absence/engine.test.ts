import { describe, expect, it } from 'vitest'
import {
  calculateAbsenceCapacity,
  calculateEffectiveClockStartOn,
  countPriorAbsenceCases,
  getAbsenceCaseRelationship,
  getRecoveryWindowEnd,
  isAbsenceActualDate,
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
    expect(calculateEffectiveClockStartOn({ rootStartOn: '2026-01-01', recoveryGaps: [{ recoveredOn: '2026-01-10', nextStartedOn: '2026-01-20' }] })).toBe('2026-01-10')
  })

  it('telt de hersteldag en nieuwe eerste ziektedag niet als herstelgat', () => {
    expect(calculateEffectiveClockStartOn({
      rootStartOn: '2026-01-01',
      recoveryGaps: [
        { recoveredOn: '2026-01-10', nextStartedOn: '2026-01-20' },
        { recoveredOn: '2026-02-01', nextStartedOn: '2026-02-04' },
      ],
    })).toBe('2026-01-12')
  })

  it('herkent toekomstige operationele mutatiedatums', () => {
    expect(isAbsenceActualDate('2026-09-04', '2026-09-04')).toBe(true)
    expect(isAbsenceActualDate('2026-09-03', '2026-09-04')).toBe(true)
    expect(isAbsenceActualDate('2026-09-05', '2026-09-04')).toBe(false)
  })

  it('rekent uren en percentage vanuit dezelfde weekcapaciteit', () => {
    expect(calculateAbsenceCapacity({ scheduledHoursPerWeek: 40, absencePercentage: 50 })).toEqual({ absenceHoursPerWeek: 20, absencePercentage: 50 })
    expect(calculateAbsenceCapacity({ scheduledHoursPerWeek: 36, absenceHoursPerWeek: 18 })).toEqual({ absenceHoursPerWeek: 18, absencePercentage: 50 })
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
