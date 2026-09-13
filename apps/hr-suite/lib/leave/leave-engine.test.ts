import { describe, expect, it } from 'vitest'
import {
  applyAccrualPause,
  calculateBonusAward,
  calculateBonusAccrualForYear,
  calculateContractAccrual,
  calculateWorkedHoursAccrual,
  clipAccrualSliceToCutover,
  getContractAccrualPeriodEntitlement,
  getMigrationCutoverDate,
  getPostedAutomaticAccrualAmounts,
  expirationDateForAccrualYear,
  generateAccrualPeriods,
  getPeriodBookingDate,
  roundAccrualHours,
  resolveAnnualTriggerDate,
  selectBonusTier,
  sortBucketsForFifo,
} from './leave-engine'

describe('leave engine', () => {
  it('gebruikt een jaarlijkse contracturen-entitlement als bron en verdeelt die per frequentie', () => {
    expect(getContractAccrualPeriodEntitlement({ annualEntitlement: 240, frequency: 'MONTHLY' })).toBe(20)
    expect(getContractAccrualPeriodEntitlement({ annualEntitlement: 26, frequency: 'FOUR_WEEKLY' })).toBe(2)
    expect(getContractAccrualPeriodEntitlement({ annualEntitlement: 240, frequency: 'PAYROLL_PERIOD', payrollFrequency: 'MONTHLY' })).toBe(20)
    expect(getContractAccrualPeriodEntitlement({ annualEntitlement: 26, frequency: 'PAYROLL_PERIOD', payrollFrequency: 'FOUR_WEEKLY' })).toBe(2)
  })

  it('geeft februari en juli een gelijke volledige maandopbouw', () => {
    const input = { annualEntitlement: 240, frequency: 'MONTHLY' as const, partTimeFactor: 1 }
    expect(calculateContractAccrual({ ...input, fullPeriodStart: '2026-02-01', fullPeriodEnd: '2026-03-01', sliceStart: '2026-02-01', sliceEnd: '2026-03-01' })).toBe(20)
    expect(calculateContractAccrual({ ...input, fullPeriodStart: '2026-07-01', fullPeriodEnd: '2026-08-01', sliceStart: '2026-07-01', sliceEnd: '2026-08-01' })).toBe(20)
  })

  it('prorateert een gedeeltelijke maand op kalenderdagen', () => {
    expect(calculateContractAccrual({
      fullPeriodStart: '2026-01-01',
      fullPeriodEnd: '2026-02-01',
      sliceStart: '2026-01-01',
      sliceEnd: '2026-01-11',
      annualEntitlement: 240,
      frequency: 'MONTHLY',
      partTimeFactor: 1,
    })).toBeCloseTo(20 * (10 / 31), 8)
  })

  it('prorateert een vierwekelijkse periode op tien van 28 kalenderdagen', () => {
    expect(calculateContractAccrual({
      fullPeriodStart: '2026-01-01',
      fullPeriodEnd: '2026-01-29',
      sliceStart: '2026-01-01',
      sliceEnd: '2026-01-11',
      annualEntitlement: 26,
      frequency: 'FOUR_WEEKLY',
      partTimeFactor: 1,
    })).toBeCloseTo(2 * (10 / 28), 8)
  })

  it('prorateert een jaar met de juiste 365- of 366-dagendeler', () => {
    expect(calculateContractAccrual({
      fullPeriodStart: '2026-01-01',
      fullPeriodEnd: '2027-01-01',
      sliceStart: '2026-01-01',
      sliceEnd: '2026-07-02',
      annualEntitlement: 160,
      frequency: 'YEARLY',
      partTimeFactor: 1,
    })).toBeCloseTo(160 * (182 / 365), 8)
    expect(calculateContractAccrual({
      fullPeriodStart: '2024-01-01',
      fullPeriodEnd: '2025-01-01',
      sliceStart: '2024-01-01',
      sliceEnd: '2024-03-02',
      annualEntitlement: 160,
      frequency: 'YEARLY',
      partTimeFactor: 1,
    })).toBeCloseTo(160 * (61 / 366), 8)
  })

  it('past de deeltijdfactor afzonderlijk toe en begrenst FTE boven 100 procent', () => {
    const input = {
      fullPeriodStart: '2026-01-01',
      fullPeriodEnd: '2026-02-01',
      sliceStart: '2026-01-01',
      sliceEnd: '2026-02-01',
      annualEntitlement: 240,
      frequency: 'MONTHLY' as const,
    }
    expect(calculateContractAccrual({ ...input, partTimeFactor: 0.5 })).toBe(10)
    expect(calculateContractAccrual({ ...input, partTimeFactor: 1.2 })).toBe(20)
  })

  it('laat een wijziging in weekdagverdeling de contracturen-entitlement niet wijzigen', () => {
    const mondayThroughFridaySlice = calculateContractAccrual({
      fullPeriodStart: '2026-09-01',
      fullPeriodEnd: '2026-10-01',
      sliceStart: '2026-09-21',
      sliceEnd: '2026-09-26',
      annualEntitlement: 240,
      frequency: 'MONTHLY',
      partTimeFactor: 1,
    })
    const weekendContainingSlice = calculateContractAccrual({
      fullPeriodStart: '2026-09-01',
      fullPeriodEnd: '2026-10-01',
      sliceStart: '2026-09-23',
      sliceEnd: '2026-09-28',
      annualEntitlement: 240,
      frequency: 'MONTHLY',
      partTimeFactor: 1,
    })
    expect(mondayThroughFridaySlice).toBeCloseTo(20 * (5 / 30), 8)
    expect(weekendContainingSlice).toBeCloseTo(mondayThroughFridaySlice, 8)
  })

  it('splitst starts, eindes en regel- of profielwijzigingen op kalenderdagen', () => {
    const firstSlice = calculateContractAccrual({
      fullPeriodStart: '2026-10-01',
      fullPeriodEnd: '2026-11-01',
      sliceStart: '2026-10-01',
      sliceEnd: '2026-10-11',
      annualEntitlement: 240,
      frequency: 'MONTHLY',
      partTimeFactor: 1,
    })
    const secondSlice = calculateContractAccrual({
      fullPeriodStart: '2026-10-01',
      fullPeriodEnd: '2026-11-01',
      sliceStart: '2026-10-11',
      sliceEnd: '2026-11-01',
      annualEntitlement: 120,
      frequency: 'MONTHLY',
      partTimeFactor: 0.5,
    })
    expect(firstSlice).toBeCloseTo(20 * (10 / 31), 8)
    expect(secondSlice).toBeCloseTo(10 * (21 / 31) * 0.5, 8)
  })

  it('geeft nul voor een ongeldig dienstverband en ondersteunt een ontbrekende payrollfrequentie niet', () => {
    expect(calculateContractAccrual({
      fullPeriodStart: '2026-01-01',
      fullPeriodEnd: '2026-02-01',
      sliceStart: '2026-01-01',
      sliceEnd: '2026-02-01',
      annualEntitlement: 240,
      frequency: 'MONTHLY',
      partTimeFactor: 1,
      employmentValid: false,
    })).toBe(0)
    expect(() => getContractAccrualPeriodEntitlement({ annualEntitlement: 240, frequency: 'PAYROLL_PERIOD', payrollFrequency: null })).toThrowError('LEAVE_PAYROLL_FREQUENCY_REQUIRED')
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

  it('maakt jaarlijkse, maandelijkse en vierwekelijkse halfopen perioden', () => {
    expect(generateAccrualPeriods({ calendarYear: 2026, frequency: 'YEARLY' })).toEqual([{ start: '2026-01-01', end: '2027-01-01' }])
    expect(generateAccrualPeriods({ calendarYear: 2026, frequency: 'MONTHLY' })).toHaveLength(12)
    expect(generateAccrualPeriods({ calendarYear: 2026, frequency: 'MONTHLY' })[1]).toEqual({ start: '2026-02-01', end: '2026-03-01' })
    const fourWeekly = generateAccrualPeriods({ calendarYear: 2026, frequency: 'FOUR_WEEKLY' })
    expect(fourWeekly).toHaveLength(13)
    expect(fourWeekly[0]).toEqual({ start: '2026-01-01', end: '2026-01-29' })
    expect(fourWeekly.at(-1)).toEqual({ start: '2026-12-03', end: '2026-12-31' })
  })

  it('laat payrollperioden alleen toe met een canonieke payrollfrequentie en rondt boekingen af', () => {
    expect(generateAccrualPeriods({ calendarYear: 2026, frequency: 'PAYROLL_PERIOD', payrollFrequency: 'MONTHLY' })).toHaveLength(12)
    expect(() => generateAccrualPeriods({ calendarYear: 2026, frequency: 'PAYROLL_PERIOD' })).toThrowError('LEAVE_PAYROLL_FREQUENCY_REQUIRED')
    expect(roundAccrualHours(1.23456)).toBe(1.2346)
  })

  it('knipt een migratiestartsaldo af op de inclusieve cutoverdatum', () => {
    const clipped = clipAccrualSliceToCutover({
      sliceStart: '2026-01-01',
      sliceEnd: '2027-01-01',
      cutoverDate: '2026-10-01',
    })
    expect(clipped).toEqual({ start: '2026-10-01', end: '2027-01-01' })
    expect(calculateContractAccrual({
      fullPeriodStart: '2026-01-01',
      fullPeriodEnd: '2027-01-01',
      sliceStart: clipped?.start ?? '2026-01-01',
      sliceEnd: clipped?.end ?? '2026-01-01',
      annualEntitlement: 160,
      frequency: 'YEARLY',
      partTimeFactor: 1,
    })).toBeCloseTo(160 * (92 / 365), 8)
  })

  it('herkent een reeds geboekte enginebron opnieuw zonder een andere basis te maken', () => {
    const sourceKey = 'LEAVE_ACCRUAL:v1:employment:type:2026:2026-01-01:2027-01-01:hash'
    const transaction = { transactionType: 'ACCRUAL', sourceType: 'LEAVE_ACCRUAL', sourceKey, amount: 160 }
    const firstRead = getPostedAutomaticAccrualAmounts([transaction])
    const replayRead = getPostedAutomaticAccrualAmounts([transaction])
    expect(replayRead.get('LEAVE_ACCRUAL:v1:employment:type:2026:2026-01-01:2027-01-01')).toBe(firstRead.get('LEAVE_ACCRUAL:v1:employment:type:2026:2026-01-01:2027-01-01'))
  })

  it('neemt het migratiestartsaldo niet op als reeds geboekte engineopbouw', () => {
    expect(getPostedAutomaticAccrualAmounts([{
      transactionType: 'OPENING_BALANCE',
      sourceType: 'MIGRATION_START_BALANCE',
      sourceKey: 'migration-2026-10-01',
      amount: 120,
    }])).toEqual(new Map())
  })

  it('laat een handmatige correctie geen cutover worden', () => {
    const employmentId = 'employment-1'
    const leaveTypeId = 'leave-type-1'
    expect(getMigrationCutoverDate([{
      employmentId,
      leaveTypeId,
      transactionType: 'MANUAL_ADJUSTMENT',
      sourceType: 'HR_MANUAL_ADJUSTMENT',
      transactionDate: '2026-01-01',
    }], employmentId, leaveTypeId)).toBeNull()
    expect(getMigrationCutoverDate([{
      employmentId,
      leaveTypeId,
      transactionType: 'MANUAL_ADJUSTMENT',
      sourceType: 'HR_MANUAL_ADJUSTMENT',
      transactionDate: '2026-01-01',
    }, {
      employmentId,
      leaveTypeId,
      transactionType: 'OPENING_BALANCE',
      sourceType: 'MIGRATION_START_BALANCE',
      transactionDate: '2026-10-01',
    }], employmentId, leaveTypeId)).toBe('2026-10-01')
  })

  it('houdt gemigreerde cohorten met verschillende vervaldatums FIFO afzonderlijk', () => {
    expect(sortBucketsForFifo([
      { id: 'migration-2026', accrualYear: 2026, expirationDate: '2027-07-01', remainingHours: 52 },
      { id: 'migration-2025', accrualYear: 2026, expirationDate: '2026-07-01', remainingHours: 13 },
    ]).map((bucket) => bucket.id)).toEqual(['migration-2025', 'migration-2026'])
  })

  it('laat de normale indiensttredingsdatum winnen wanneer die na de cutover ligt', () => {
    const clipped = clipAccrualSliceToCutover({ sliceStart: '2026-11-01', sliceEnd: '2027-01-01', cutoverDate: '2026-10-01' })
    expect(clipped).toEqual({ start: '2026-11-01', end: '2027-01-01' })
    expect(calculateContractAccrual({
      fullPeriodStart: '2026-01-01',
      fullPeriodEnd: '2027-01-01',
      sliceStart: clipped?.start ?? '2026-01-01',
      sliceEnd: clipped?.end ?? '2026-01-01',
      annualEntitlement: 160,
      frequency: 'YEARLY',
      partTimeFactor: 1,
    })).toBeCloseTo(160 * (61 / 365), 8)
  })

  it('boekt niets als het dienstverband eindigt vóór de cutover', () => {
    expect(clipAccrualSliceToCutover({ sliceStart: '2026-01-01', sliceEnd: '2026-10-01', cutoverDate: '2026-10-01' })).toBeNull()
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

  it('kent een leeftijdsbonus toe vanaf de drempel en houdt de hoogste trede vast', () => {
    expect(calculateBonusAccrualForYear({
      calendarYear: 2026,
      baseDate: '1971-06-15',
      triggerType: 'AGE',
      tiers: [{ thresholdYears: 50, bonusAmount: 4 }, { thresholdYears: 55, bonusAmount: 8 }],
      awardTiming: 'START_OF_YEAR',
      proRateFirstYear: true,
      partTimeFactor: 0.8,
    })).toMatchObject({ amount: 6.4, thresholdYears: 55, achievedYears: 55, triggerDate: '2026-06-15' })

    expect(calculateBonusAccrualForYear({
      calendarYear: 2027,
      baseDate: '1971-06-15',
      triggerType: 'AGE',
      tiers: [{ thresholdYears: 55, bonusAmount: 8 }],
      awardTiming: 'START_OF_YEAR',
      proRateFirstYear: true,
      partTimeFactor: 0.8,
    })?.amount).toBeCloseTo(6.4, 5)
  })

  it('kent een anciënniteitsbonus pro-rata toe op het jubileum', () => {
    expect(calculateBonusAccrualForYear({
      calendarYear: 2026,
      baseDate: '2021-07-01',
      triggerType: 'SENIORITY',
      tiers: [{ thresholdYears: 5, bonusAmount: 12 }],
      awardTiming: 'ON_TRIGGER_DATE',
      proRateFirstYear: true,
      partTimeFactor: 0.5,
    })?.amount).toBeCloseTo(3.024658, 5)
  })

  it('sorteert buckets FIFO op vervaldatum en daarna op jaar/id', () => {
    expect(sortBucketsForFifo([
      { id: 'b2', accrualYear: 2026, expirationDate: '2027-07-01', remainingHours: 2 },
      { id: 'b1', accrualYear: 2025, expirationDate: '2027-01-01', remainingHours: 4 },
      { id: 'b3', accrualYear: 2025, expirationDate: '2027-01-01', remainingHours: 1 },
    ]).map((bucket) => bucket.id)).toEqual(['b1', 'b3', 'b2'])
  })
})
