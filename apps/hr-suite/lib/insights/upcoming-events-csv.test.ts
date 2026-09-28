import { describe, expect, it } from 'vitest'
import { upcomingEventsCsv } from './upcoming-events-csv'

describe('Upcoming Events CSV export', () => {
  it('neutralizes spreadsheet formula prefixes in employee values', () => {
    const csv = upcomingEventsCsv({
      startDate: '2026-09-28', endDate: '2026-10-25', departments: [],
      rows: [{ administrationNumber: 'ADM-1', employeeNumber: 'EMP-1', employeeId: 'employee-1', id: 'event-1', type: 'BIRTHDAY', date: '2026-10-01', employeeName: '=HYPERLINK("https://example.test")', departmentName: null, years: null }],
    })
    expect(csv).toContain(`"'=HYPERLINK(""https://example.test"")"`)
  })
})
