import { describe, expect, it } from 'vitest'
import { buildHrCalendarMonthUrl, buildHrCalendarUrl } from './calendar-url'

describe('buildHrCalendarUrl', () => {
  it('keeps calendar search and display options while changing month', () => {
    expect(buildHrCalendarUrl({
      month: '2026-10',
      q: 'demo employee',
      showWeekNumbers: '1',
      week: undefined,
    })).toBe('/hr-calendar?month=2026-10&q=demo+employee&showWeekNumbers=1')
  })

  it('preserves calendar filters and clears the prior week when changing month', () => {
    expect(buildHrCalendarMonthUrl('2026-10', {
      q: 'demo query',
      department: 'department-1',
      employee: 'employee-1',
      week: '37',
      size: '25',
      showWeekendsAndHolidays: true,
      showReminders: false,
      showScheduledHours: true,
      showWeekNumbers: true,
      showDayOccupancy: false,
    })).toBe('/hr-calendar?month=2026-10&q=demo+query&department=department-1&employee=employee-1&size=25&showReminders=0&showWeekNumbers=1')
  })
})
