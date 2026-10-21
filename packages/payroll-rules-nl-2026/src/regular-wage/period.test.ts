import { describe, expect, it } from 'vitest'
import { FixedDecimal } from '@liquid-hr/payroll-engine'
import {
  calculateNl2026PeriodSegments,
  countDutchWorkdays,
  encodeNl2026CompositeTimePeriod,
  parseNl2026CompositeTimePeriod,
  prorateMonthlySalary,
} from './period'

describe('Dutch 2026 broken-period segments', () => {
  it('uses the October 2026 22-workday denominator and 11 paid workdays', () => {
    const segments = calculateNl2026PeriodSegments({
      periodStart: '2026-10-01',
      periodEndExclusive: '2026-11-01',
      paidStart: '2026-10-16',
      paidEndExclusive: '2026-11-01',
    })

    expect(segments).toMatchObject({
      periodWorkdays: 22,
      paidWorkdays: 11,
      fullWeeks: 2,
      remainingDays: 1,
    })
    expect(prorateMonthlySalary(FixedDecimal.parse('3517.00'), 11, 22).toString(2)).toBe('1758.50')
    expect(encodeNl2026CompositeTimePeriod(segments)).toBe('WEEK_DAY_2_1')
    expect(parseNl2026CompositeTimePeriod('WEEK_DAY_2_1')).toEqual({ fullWeeks: 2, remainingDays: 1 })
  })

  it('does not count weekends as paid days', () => {
    expect(countDutchWorkdays('2026-10-16', '2026-10-19')).toBe(1)
    expect(parseNl2026CompositeTimePeriod('WEEK_DAY_0_5')).toBeNull()
  })
})
