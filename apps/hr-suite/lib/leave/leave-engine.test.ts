import { describe, expect, it } from 'vitest'
import {
  applyAccrualPause,
  calculateBonusAward,
  calculateContractAccrual,
  calculateWorkedHoursAccrual,
  expirationDateForAccrualYear,
  getPeriodBookingDate,
  resolveAnnualTriggerDate,
  selectBonusTier,
  sortBucketsForFifo,
} from './leave-engine'

describe('leave engine', () => {
  it('rekent contracturen pro rata over werkdagen en FTE', () => {
    expect(calculateContractAccrual({
      fullPeriodStart: '2026-01-01',
      fullPeriodEnd: '2026-02-01',
      sliceStart: '2026-01-01',
      sliceEnd: '2026-01-16',
      accrualAmount: 16,
      partTimeFactor: 0.5,
    })).toBeCloseTo(4, 5)
  })

  it('neemt alleen goedgekeurde gewone uren en overwerk mee', () => {
    expect(calculateWorkedHoursAccrual({ hours: 8, accrualRate: 0.083333, status: 'APPROVED', category: 'REGULAR_WORK' })).toBeCloseTo(0.666664, 6)
    expect(calculateWorkedHoursAccrual({ hours: 8, accrualRate: 0.083333, status: 'APPROVED', category: 'REGULAR_WORK', employmentValid: false })).toBe(0)
    expect(calculateWorkedHoursAccrual({ hours: 8, accrualRate: 0.083333, status: 'APPROVED', category: 'INFORMATIONAL' })).toBe(0)
    expect(calculateWorkedHoursAccrual({ hours: 8, accrualRate: 0.083333, status: 'PENDING', category: 'OVERTIME' })).toBe(0)
  })

  it('boekt upfront aan het begin en arrears aan het einde van een halfopen periode', () => {
    expect(getPeriodBookingDate({ periodStart: '2026-01-01', periodEnd: '2026-02-01', timing: 'UPFRONT' })).toBe('2026-01-01')
    expect(getPeriodBookingDate({ periodStart: '2026-01-01', periodEnd: '2026-02-01', timing: 'ARREARS' })).toBe('2026-01-31')
  })

  it('geeft een expliciete fout als payrollfrequentie ontbreekt', () => {
    expect(() => getPeriodBookingDate({
      periodStart: '2026-01-01',
      periodEnd: '2026-02-01',
      timing: 'UPFRONT',
      frequency: 'PAYROLL_PERIOD',
      payrollFrequency: null,
    })).toThrowError('LEAVE_PAYROLL_FREQUENCY_REQUIRED')
  })

  it('pauzeert alleen het deel dat door gekoppeld verlof is opgenomen', () => {
    expect(applyAccrualPause({ baseAccrual: 8, plannedHours: 160, pausedHours: 40 })).toBe(6)
  })

  it('berekent verval als kalendermaanden na het einde van het opbouwjaar', () => {
    expect(expirationDateForAccrualYear(2026, 6)).toBe('2027-07-01')
  })

  it('kiest de hoogste behaalde bonustrede en pro-rate op de triggerdatum', () => {
    expect(selectBonusTier(7, [
      { thresholdYears: 5, bonusAmount: 8 },
      { thresholdYears: 10, bonusAmount: 16 },
    ])).toEqual({ thresholdYears: 5, bonusAmount: 8 })
    expect(calculateBonusAward({
      calendarYear: 2026,
      triggerDate: '2026-07-01',
      bonusAmount: 12,
      partTimeFactor: 0.5,
      awardTiming: 'ON_TRIGGER_DATE',
      proRateFirstYear: true,
    })).toBeCloseTo(3.024658, 5)
  })

  it('maakt exacte verjaardags- en jubileumdatums expliciet, inclusief schrikkeldagbeleid', () => {
    expect(resolveAnnualTriggerDate('1990-05-04', 2026)).toBe('2026-05-04')
    expect(() => resolveAnnualTriggerDate('2000-02-29', 2025)).toThrowError('LEAVE_FEBRUARY_29_POLICY_REQUIRED')
  })

  it('sorteert buckets FIFO op vervaldatum en daarna op jaar/id', () => {
    expect(sortBucketsForFifo([
      { id: 'b2', accrualYear: 2026, expirationDate: '2027-07-01', remainingHours: 2 },
      { id: 'b1', accrualYear: 2025, expirationDate: '2027-01-01', remainingHours: 4 },
      { id: 'b3', accrualYear: 2025, expirationDate: '2027-01-01', remainingHours: 1 },
    ]).map((bucket) => bucket.id)).toEqual(['b1', 'b3', 'b2'])
  })
})
