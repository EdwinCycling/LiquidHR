import { describe, expect, it } from 'vitest'
import { actualWorkBulkSaveSchema, actualWorkEntrySchema, actualWorkTypeSchema } from './schemas'

const ids = {
  employeeId: '11111111-1111-4111-8111-111111111111',
  employmentId: '22222222-2222-4222-8222-222222222222',
  typeId: '33333333-3333-4333-8333-333333333333',
}

describe('actual work input contracts', () => {
  it('requires a reason when an existing entry is corrected', () => {
    const result = actualWorkEntrySchema.safeParse({
      employeeId: ids.employeeId,
      employmentId: ids.employmentId,
      entryId: ids.typeId,
      workHourTypeId: ids.typeId,
      entryGranularity: 'DAY',
      subjectPeriodStart: '2026-10-05',
      hours: '2.0000',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some((issue) => issue.message === 'ACTUAL_WORK_CORRECTION_REASON_REQUIRED')).toBe(true)
  })

  it('accepts deterministic PostgreSQL UUID text used by DEV fixtures', () => {
    const result = actualWorkEntrySchema.safeParse({
      employeeId: '66ef22a5-5777-44dc-9bde-44a65d0a6d60',
      employmentId: 'b058d882-47a9-43ff-853e-0e05237214af',
      entryId: '00000000-0000-0000-0000-00000000b001',
      workHourTypeId: '00000000-0000-0000-0000-00000000a001',
      entryGranularity: 'DAY',
      subjectPeriodStart: '2026-09-29',
      hours: '7.5000',
      correctionReason: 'DEV fixture correction',
    })
    expect(result.success).toBe(true)
  })

  it('accepts an explicit type configuration with distinct limits', () => {
    const result = actualWorkTypeSchema.safeParse({
      code: 'AW_CUSTOM',
      name: 'Custom actual work',
      family: 'ADDITIONAL',
      validFrom: '2026-01-01',
      entryGranularity: 'BOTH',
      commentRequired: true,
      futureEntryAllowed: false,
      showInTeamOverview: false,
      showInCalendar: false,
      approvalRequired: false,
      displayOrder: 10,
      limits: [
        { scope: 'DAY', maxHours: '4.0000' },
        { scope: 'MONTH', maxHours: '40' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('keeps an open-period edit eligible for the canonical EDIT operation', () => {
    const result = actualWorkBulkSaveSchema.safeParse({
      month: '2026-10',
      workHourTypeId: ids.typeId,
      entryGranularity: 'DAY',
      changes: [{
        employeeId: ids.employeeId,
        employmentId: ids.employmentId,
        entryId: ids.typeId,
        subjectPeriodStart: '2026-10-05',
        hours: '8.1250',
        note: null,
        correctionReason: null,
      }],
    })
    expect(result.success).toBe(true)
  })

  it('bounds a bulk request to a bounded set of changed cells', () => {
    const change = {
      employeeId: ids.employeeId,
      employmentId: ids.employmentId,
      entryId: null,
      subjectPeriodStart: '2026-10-05',
      hours: '1',
    }
    const result = actualWorkBulkSaveSchema.safeParse({
      month: '2026-10',
      workHourTypeId: ids.typeId,
      entryGranularity: 'DAY',
      changes: Array.from({ length: 251 }, () => change),
    })
    expect(result.success).toBe(false)
  })
})
