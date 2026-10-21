import { describe, expect, it } from 'vitest'
import {
  assertCalendarRevisionIsSafe,
  assertPayrollPeriodsDoNotOverlap,
  classifyEmploymentCoverage,
  generatePayrollCalendar,
  PayrollCalendarError,
  validatePayrollCalendarConfigurations,
  type PayrollCalendarDefinition,
} from './payroll-calendar'

const monthlyCalendar: PayrollCalendarDefinition = {
  scopeKey: 'tenant/hr-group/administration',
  calendarCode: 'MONTHLY-2026',
  name: 'Maandelijkse salarisverwerking',
  version: 1,
  periodicity: 'MONTHLY',
  calendarYear: 2026,
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-12-31',
  paymentDateRule: { kind: 'PERIOD_END_OFFSET_DAYS', days: 7 },
}

describe('generatePayrollCalendar', () => {
  it('generates all twelve exact calendar months and applies an explicit payment-date rule', () => {
    const periods = generatePayrollCalendar(monthlyCalendar)

    expect(periods).toHaveLength(12)
    expect(periods[0]).toMatchObject({
      periodNumber: 1,
      startsOn: '2026-01-01',
      endsOn: '2026-01-31',
      plannedPaymentDate: '2026-02-07',
    })
    expect(periods[1]).toMatchObject({ periodNumber: 2, startsOn: '2026-02-01', endsOn: '2026-02-28' })
    expect(periods[11]).toMatchObject({ periodNumber: 12, startsOn: '2026-12-01', endsOn: '2026-12-31' })
  })

  it('generates thirteen complete four-week periods from an explicit year-end anchor', () => {
    const periods = generatePayrollCalendar({
      ...monthlyCalendar,
      calendarCode: 'FOUR-WEEKLY-2026',
      periodicity: 'FOUR_WEEKLY',
      effectiveFrom: '2025-12-31',
      effectiveTo: '2026-12-29',
      anchorDate: '2025-12-31',
      yearAssignment: 'PERIOD_END',
      paymentDateRule: undefined,
    })

    expect(periods).toHaveLength(13)
    expect(periods[0]).toMatchObject({ periodNumber: 1, startsOn: '2025-12-31', endsOn: '2026-01-27' })
    expect(periods[12]).toMatchObject({ periodNumber: 13, startsOn: '2026-12-02', endsOn: '2026-12-29' })
    expect(periods.every((period) => period.calculationCapability === 'NOT_FISCALLY_VALIDATED')).toBe(true)
  })

  it('derives a 53rd weekly period and a 27th biweekly period from their configured anchors', () => {
    const weekly = generatePayrollCalendar({
      ...monthlyCalendar,
      calendarCode: 'WEEKLY-2026',
      periodicity: 'WEEKLY',
      effectiveFrom: '2025-12-26',
      effectiveTo: '2026-12-31',
      anchorDate: '2025-12-26',
      yearAssignment: 'PERIOD_END',
      paymentDateRule: undefined,
    })
    const biweekly = generatePayrollCalendar({
      ...monthlyCalendar,
      calendarCode: 'BIWEEKLY-2026',
      periodicity: 'BIWEEKLY',
      effectiveFrom: '2026-01-01',
      effectiveTo: '2027-01-13',
      anchorDate: '2026-01-01',
      yearAssignment: 'PERIOD_START',
      paymentDateRule: undefined,
    })

    expect(weekly).toHaveLength(53)
    expect(weekly[0]).toMatchObject({ startsOn: '2025-12-26', endsOn: '2026-01-01' })
    expect(weekly[52]).toMatchObject({ periodNumber: 53, startsOn: '2026-12-25', endsOn: '2026-12-31' })
    expect(biweekly).toHaveLength(27)
    expect(biweekly[26]).toMatchObject({ periodNumber: 27, startsOn: '2026-12-31', endsOn: '2027-01-13' })
  })

  it('supports exact quarterly, half-year and annual partitions without inventing dates', () => {
    const calendarFor = (periodicity: PayrollCalendarDefinition['periodicity'], calendarCode: string) => generatePayrollCalendar({
      ...monthlyCalendar,
      calendarCode,
      periodicity,
      paymentDateRule: undefined,
    })

    const quarterly = calendarFor('QUARTERLY', 'QUARTERLY-2026')
    const halfYear = calendarFor('SEMI_ANNUAL', 'HALF-YEAR-2026')
    const annual = calendarFor('ANNUAL', 'ANNUAL-2026')

    expect(quarterly).toHaveLength(4)
    expect(quarterly[0]).toMatchObject({ startsOn: '2026-01-01', endsOn: '2026-03-31' })
    expect(quarterly[3]).toMatchObject({ startsOn: '2026-10-01', endsOn: '2026-12-31' })
    expect(halfYear).toHaveLength(2)
    expect(halfYear[1]).toMatchObject({ startsOn: '2026-07-01', endsOn: '2026-12-31' })
    expect(annual).toHaveLength(1)
    expect(annual[0]).toMatchObject({ periodNumber: 1, startsOn: '2026-01-01', endsOn: '2026-12-31' })
  })

  it('rejects invalid dates, incomplete effective ranges and invalid short-month payment rules', () => {
    expect(() => generatePayrollCalendar({ ...monthlyCalendar, effectiveFrom: '2026-02-30' })).toThrowError('CALENDAR_DATE_INVALID')
    expect(() => generatePayrollCalendar({ ...monthlyCalendar, effectiveFrom: '2026-02-01' })).toThrowError('CALENDAR_EFFECTIVE_RANGE_INCOMPLETE')
    expect(() => generatePayrollCalendar({
      ...monthlyCalendar,
      paymentDateRule: { kind: 'MONTH_DAY', monthsAfterPeriodEnd: 0, dayOfMonth: 31, shortMonth: 'REJECT' },
    })).toThrowError('CALENDAR_DATE_RULE_INVALID')
  })

  it('keeps calendar periods separate from the part of an employment they cover', () => {
    expect(classifyEmploymentCoverage({
      periodStartsOn: '2026-02-01', periodEndsOn: '2026-02-28',
      employmentStartsOn: '2026-02-01', employmentEndsOn: null,
    })).toBe('FULL_PERIOD')
    expect(classifyEmploymentCoverage({
      periodStartsOn: '2026-02-01', periodEndsOn: '2026-02-28',
      employmentStartsOn: '2026-02-15', employmentEndsOn: null,
    })).toBe('PARTIAL_PERIOD')
    expect(classifyEmploymentCoverage({
      periodStartsOn: '2026-02-01', periodEndsOn: '2026-02-28',
      employmentStartsOn: '2026-03-01', employmentEndsOn: null,
    })).toBe('NO_OVERLAP')
  })

  it('rejects overlapping periods, duplicate versions and concurrently active effective ranges', () => {
    const monthPeriods = generatePayrollCalendar(monthlyCalendar)
    expect(() => assertPayrollPeriodsDoNotOverlap([
      monthPeriods[0]!,
      { ...monthPeriods[1]!, startsOn: '2026-01-31' },
    ])).toThrowError('CALENDAR_PERIODS_OVERLAP')

    expect(() => validatePayrollCalendarConfigurations([monthlyCalendar, monthlyCalendar]))
      .toThrowError('CALENDAR_VERSION_DUPLICATE')
    expect(() => validatePayrollCalendarConfigurations([
      { ...monthlyCalendar, status: 'ACTIVE' },
      { ...monthlyCalendar, calendarYear: 2027, version: 2, effectiveFrom: '2026-12-01', status: 'ACTIVE' },
    ])).toThrowError('CALENDAR_EFFECTIVE_RANGE_OVERLAP')
  })

  it('requires a new calendar version before changing settings used by saved periods or runs', () => {
    const changedCalendar = { ...monthlyCalendar, paymentDateRule: { kind: 'PERIOD_END_OFFSET_DAYS' as const, days: 10 } }

    expect(() => assertCalendarRevisionIsSafe(monthlyCalendar, changedCalendar, { hasPeriods: true, hasRuns: true }))
      .toThrowError(new PayrollCalendarError('CALENDAR_VERSION_INCREMENT_REQUIRED'))
    expect(() => assertCalendarRevisionIsSafe(
      monthlyCalendar,
      { ...changedCalendar, version: 2 },
      { hasPeriods: true, hasRuns: true },
    )).not.toThrow()
    expect(() => assertCalendarRevisionIsSafe(monthlyCalendar, {
      ...monthlyCalendar,
      scopeKey: 'another-administration',
      version: 2,
    }, { hasPeriods: true, hasRuns: false })).toThrowError('CALENDAR_REVISION_IDENTITY_INVALID')
  })
})
