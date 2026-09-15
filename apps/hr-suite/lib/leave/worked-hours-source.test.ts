import { describe, expect, it } from 'vitest'
import { getPeriodBookingDate, type LeaveAccrualFrequency, type LeaveAccrualTiming } from './leave-engine'
import {
  calculateWorkedHoursAccrual,
  isActualWorkLeaveFamily,
  selectActualWorkLeaveTypes,
  sumQualifyingWorkedHours,
} from './worked-hours-source'

const types = [
  { id: 'work', name: 'Gewerkte uren', family: 'WORK', is_active: true },
  { id: 'additional', name: 'Aanvullende uren', family: 'ADDITIONAL', is_active: true },
  { id: 'overtime', name: 'Overwerk', family: 'OVERTIME', is_active: true },
  { id: 'transparent', name: 'Thuiswerk informatief', family: 'TRANSPARENT', is_active: true },
  { id: 'inactive-work', name: 'Oud werk', family: 'WORK', is_active: false },
] as const

describe('Actual Work source for worked-hours leave accrual', () => {
  it('selects active WORK, ADDITIONAL and OVERTIME types and excludes TRANSPARENT', () => {
    expect(selectActualWorkLeaveTypes(types).map((type) => type.id)).toEqual(['work', 'additional', 'overtime'])
    expect(isActualWorkLeaveFamily('WORK')).toBe(true)
    expect(isActualWorkLeaveFamily('ADDITIONAL')).toBe(true)
    expect(isActualWorkLeaveFamily('OVERTIME')).toBe(true)
    expect(isActualWorkLeaveFamily('TRANSPARENT')).toBe(false)
  })

  it('sums only approved entries for the selected types and period', () => {
    const entries = [
      { employment_id: 'employment-1', work_hour_type_id: 'work', subject_period_start: '2026-01-01', subject_period_end: '2026-02-01', hours: 8, status: 'APPROVED' },
      { employment_id: 'employment-1', work_hour_type_id: 'additional', subject_period_start: '2026-01-01', subject_period_end: '2026-02-01', hours: 2, status: 'APPROVED' },
      { employment_id: 'employment-1', work_hour_type_id: 'overtime', subject_period_start: '2026-01-01', subject_period_end: '2026-02-01', hours: 3, status: 'APPROVED' },
      { employment_id: 'employment-1', work_hour_type_id: 'transparent', subject_period_start: '2026-01-01', subject_period_end: '2026-02-01', hours: 100, status: 'APPROVED' },
      { employment_id: 'employment-1', work_hour_type_id: 'work', subject_period_start: '2026-01-01', subject_period_end: '2026-02-01', hours: 40, status: 'PENDING' },
      { employment_id: 'employment-2', work_hour_type_id: 'work', subject_period_start: '2026-01-01', subject_period_end: '2026-02-01', hours: 80, status: 'APPROVED' },
      { employment_id: 'employment-1', work_hour_type_id: 'work', subject_period_start: '2026-02-01', subject_period_end: '2026-03-01', hours: 16, status: 'APPROVED' },
    ]
    const mappings = [
      { accrual_rule_id: 'rule-1', work_hour_type_id: 'work' },
      { accrual_rule_id: 'rule-1', work_hour_type_id: 'additional' },
      { accrual_rule_id: 'rule-1', work_hour_type_id: 'overtime' },
      { accrual_rule_id: 'rule-1', work_hour_type_id: 'transparent' },
    ]

    expect(sumQualifyingWorkedHours({ entries, mappings, types, employmentId: 'employment-1', ruleId: 'rule-1', sliceStart: '2026-01-01', sliceEnd: '2026-02-01' })).toBe(13)
    expect(sumQualifyingWorkedHours({ entries, mappings: [], types, employmentId: 'employment-1', ruleId: 'rule-1', sliceStart: '2026-01-01', sliceEnd: '2026-02-01' })).toBe(0)
  })

  it('keeps precision, accepts ADDITIONAL and OVERTIME, and never applies FTE', () => {
    const rate = 0.07692308
    expect(calculateWorkedHoursAccrual({ hours: 2080, accrualRate: rate, status: 'APPROVED', family: 'WORK' })).toBeCloseTo(160.0000064, 8)
    expect(calculateWorkedHoursAccrual({ hours: 8, accrualRate: rate, status: 'APPROVED', family: 'ADDITIONAL' })).toBeCloseTo(8 * rate, 10)
    expect(calculateWorkedHoursAccrual({ hours: 8, accrualRate: rate, status: 'APPROVED', family: 'OVERTIME' })).toBeCloseTo(8 * rate, 10)
    expect(calculateWorkedHoursAccrual({ hours: 8, accrualRate: rate, status: 'APPROVED', family: 'TRANSPARENT' })).toBe(0)
    expect(calculateWorkedHoursAccrual({ hours: 8, accrualRate: rate, status: 'PENDING', family: 'WORK' })).toBe(0)
  })

  it('reflects an Actual Work correction deterministically in the qualifying source total', () => {
    const baseEntry = {
      employment_id: 'employment-1',
      work_hour_type_id: 'work',
      subject_period_start: '2026-01-01',
      subject_period_end: '2026-02-01',
      status: 'APPROVED',
    } as const
    const mappings = [{ accrual_rule_id: 'rule-1', work_hour_type_id: 'work' }]
    const originalHours = sumQualifyingWorkedHours({
      entries: [{ ...baseEntry, hours: 8 }],
      mappings,
      types,
      employmentId: 'employment-1',
      ruleId: 'rule-1',
      sliceStart: '2026-01-01',
      sliceEnd: '2026-02-01',
    })
    const correctedHours = sumQualifyingWorkedHours({
      entries: [{ ...baseEntry, hours: 10 }],
      mappings,
      types,
      employmentId: 'employment-1',
      ruleId: 'rule-1',
      sliceStart: '2026-01-01',
      sliceEnd: '2026-02-01',
    })

    expect(originalHours).toBe(8)
    expect(correctedHours).toBe(10)
    expect(calculateWorkedHoursAccrual({ hours: correctedHours, accrualRate: 0.07692308, status: 'APPROVED', family: 'WORK' }))
      .toBeCloseTo(0.7692308, 8)
  })

  it('keeps earned quantity independent from frequency and timing', () => {
    const frequencies: LeaveAccrualFrequency[] = ['PAYROLL_PERIOD', 'FOUR_WEEKLY', 'MONTHLY', 'YEARLY']
    const timings: LeaveAccrualTiming[] = ['UPFRONT', 'ARREARS']
    const amounts = frequencies.flatMap((frequency) => timings.map((timing) => ({ frequency, timing, amount: calculateWorkedHoursAccrual({ hours: 16, accrualRate: 0.07692308, status: 'APPROVED', family: 'WORK' }) })))

    expect(new Set(amounts.map((item) => item.amount)).size).toBe(1)
    expect(getPeriodBookingDate({ periodStart: '2026-01-01', periodEnd: '2026-02-01', timing: 'UPFRONT' })).toBe('2026-01-01')
    expect(getPeriodBookingDate({ periodStart: '2026-01-01', periodEnd: '2026-02-01', timing: 'ARREARS' })).toBe('2026-01-31')
  })
})
