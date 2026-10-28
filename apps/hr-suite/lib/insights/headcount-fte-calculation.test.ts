import { describe, expect, it } from 'vitest'
import {
  calculateHeadcountFteSnapshot,
  isActiveEmploymentOnDate,
  type HeadcountEmploymentSource,
  type HeadcountOrganizationSource,
  type HeadcountScheduleSource,
} from './headcount-fte-calculation'

const employment = (overrides: Partial<HeadcountEmploymentSource> = {}): HeadcountEmploymentSource => ({
  id: 'employment-1',
  employeeId: 'employee-1',
  administrationId: 'admin-a',
  startsOn: '2025-01-01',
  endsOn: null,
  recordStatus: 'CONFIRMED',
  deletedAt: null,
  ...overrides,
})

const schedule = (overrides: Partial<HeadcountScheduleSource> = {}): HeadcountScheduleSource => ({
  id: 'schedule-1',
  employmentId: 'employment-1',
  validFrom: '2025-01-01',
  validUntil: null,
  partTimeFactor: 1,
  ...overrides,
})

const placement = (overrides: Partial<HeadcountOrganizationSource> = {}): HeadcountOrganizationSource => ({
  id: 'placement-1',
  employeeId: 'employee-1',
  employmentId: 'employment-1',
  administrationId: 'admin-a',
  departmentId: 'department-a',
  directManagerId: 'manager-a',
  effectiveFrom: '2025-01-01',
  effectiveTo: null,
  ...overrides,
})

describe('Headcount & FTE calculation', () => {
  it('uses confirmed, non-deleted employments with inclusive employment dates', () => {
    expect(isActiveEmploymentOnDate(employment(), '2025-01-01')).toBe(true)
    expect(isActiveEmploymentOnDate(employment({ endsOn: '2025-01-31' }), '2025-01-31')).toBe(true)
    expect(isActiveEmploymentOnDate(employment({ startsOn: '2025-02-01' }), '2025-01-31')).toBe(false)
    expect(isActiveEmploymentOnDate(employment({ recordStatus: 'DRAFT' }), '2025-06-30')).toBe(false)
    expect(isActiveEmploymentOnDate(employment({ deletedAt: '2025-01-02' }), '2025-06-30')).toBe(false)
  })

  it('uses half-open schedule end dates and treats missing schedules as unknown', () => {
    const report = calculateHeadcountFteSnapshot({
      asOf: '2025-02-01',
      employments: [employment()],
      schedules: [schedule({ validUntil: '2025-02-01', partTimeFactor: 0.6 })],
      organizations: [placement()],
    })

    expect(report.fte).toBeNull()
    expect(report.knownFte).toBe(0)
    expect(report.incompleteScheduleCount).toBe(1)
    expect(report.rows[0]?.scheduleStatus).toBe('MISSING')
  })

  it('deduplicates headcount across administrations while summing each concurrent employment FTE', () => {
    const report = calculateHeadcountFteSnapshot({
      asOf: '2025-06-30',
      employments: [
        employment(),
        employment({ id: 'employment-2', administrationId: 'admin-b' }),
      ],
      schedules: [
        schedule({ partTimeFactor: 0.5 }),
        schedule({ id: 'schedule-2', employmentId: 'employment-2', partTimeFactor: 0.75 }),
      ],
      organizations: [
        placement(),
        placement({ id: 'placement-2', employmentId: 'employment-2', administrationId: 'admin-b', departmentId: 'department-b', directManagerId: 'manager-b' }),
      ],
    })

    expect(report.headcount).toBe(1)
    expect(report.activeEmploymentCount).toBe(2)
    expect(report.fte).toBe(1.25)
    expect(report.rows).toHaveLength(2)
  })

  it('filters administrations without double-counting the employee', () => {
    const report = calculateHeadcountFteSnapshot({
      asOf: '2025-06-30',
      employments: [
        employment(),
        employment({ id: 'employment-2', administrationId: 'admin-b' }),
      ],
      schedules: [
        schedule({ partTimeFactor: 0.5 }),
        schedule({ id: 'schedule-2', employmentId: 'employment-2', partTimeFactor: 0.75 }),
      ],
      organizations: [placement(), placement({ id: 'placement-2', employmentId: 'employment-2', administrationId: 'admin-b' })],
      administrationIds: ['admin-a'],
    })

    expect(report.headcount).toBe(1)
    expect(report.activeEmploymentCount).toBe(1)
    expect(report.fte).toBe(0.5)
  })

  it('shows a known FTE subtotal but marks the total incomplete when one employment has no valid factor', () => {
    const report = calculateHeadcountFteSnapshot({
      asOf: '2025-06-30',
      employments: [employment(), employment({ id: 'employment-2' })],
      schedules: [schedule({ partTimeFactor: 0.5 })],
      organizations: [placement()],
    })

    expect(report.headcount).toBe(1)
    expect(report.fte).toBeNull()
    expect(report.knownFte).toBe(0.5)
    expect(report.completeScheduleCount).toBe(1)
    expect(report.incompleteScheduleCount).toBe(1)
  })

  it('does not treat an overlapping schedule or out-of-range factor as complete FTE', () => {
    const overlap = calculateHeadcountFteSnapshot({
      asOf: '2025-06-30',
      employments: [employment()],
      schedules: [
        schedule(),
        schedule({ id: 'schedule-2', partTimeFactor: 0.5 }),
      ],
      organizations: [placement()],
    })
    const invalid = calculateHeadcountFteSnapshot({
      asOf: '2025-06-30',
      employments: [employment()],
      schedules: [schedule({ partTimeFactor: 1.1 })],
      organizations: [placement()],
    })
    const missingFactor = calculateHeadcountFteSnapshot({
      asOf: '2025-06-30',
      employments: [employment()],
      schedules: [schedule({ partTimeFactor: null })],
      organizations: [placement()],
    })

    expect(overlap.fte).toBeNull()
    expect(overlap.rows[0]?.scheduleStatus).toBe('MULTIPLE')
    expect(invalid.fte).toBeNull()
    expect(invalid.rows[0]?.scheduleStatus).toBe('INVALID_FACTOR')
    expect(missingFactor.fte).toBeNull()
    expect(missingFactor.rows[0]?.scheduleStatus).toBe('INVALID_FACTOR')
  })

  it('accepts a valid zero factor without confusing it with missing schedule data', () => {
    const report = calculateHeadcountFteSnapshot({
      asOf: '2025-06-30',
      employments: [employment()],
      schedules: [schedule({ partTimeFactor: 0 })],
      organizations: [placement()],
    })
    expect(report.fte).toBe(0)
    expect(report.completeScheduleCount).toBe(1)
  })

  it('uses historical organization dates and flags missing placement instead of choosing a current row', () => {
    const report = calculateHeadcountFteSnapshot({
      asOf: '2025-06-30',
      employments: [employment()],
      schedules: [schedule({ partTimeFactor: 0.8 })],
      organizations: [
        placement({ departmentId: 'old-department', effectiveTo: '2025-06-30' }),
        placement({ id: 'placement-2', departmentId: 'new-department', effectiveFrom: '2025-07-01' }),
      ],
    })

    expect(report.rows[0]?.departmentId).toBe('old-department')
    expect(report.unassignedPlacementCount).toBe(0)
  })

  it('does not use an employee-level placement to guess an employment team', () => {
    const report = calculateHeadcountFteSnapshot({
      asOf: '2025-06-30',
      employments: [employment()],
      schedules: [schedule()],
      organizations: [placement({ employmentId: null })],
    })

    expect(report.unassignedPlacementCount).toBe(1)
    expect(report.rows[0]?.placementStatus).toBe('MISSING')
  })

  it('applies department and team filters to the same employment rows used by the metrics', () => {
    const report = calculateHeadcountFteSnapshot({
      asOf: '2025-06-30',
      employments: [
        employment(),
        employment({ id: 'employment-2', employeeId: 'employee-2', administrationId: 'admin-b' }),
      ],
      schedules: [
        schedule({ partTimeFactor: 0.5 }),
        schedule({ id: 'schedule-2', employmentId: 'employment-2', partTimeFactor: 0.8 }),
      ],
      organizations: [
        placement(),
        placement({ id: 'placement-2', employmentId: 'employment-2', employeeId: 'employee-2', administrationId: 'admin-b', departmentId: 'department-b', directManagerId: 'manager-b' }),
      ],
      departmentIds: ['department-a'],
      teamIds: ['manager-a'],
    })

    expect(report.headcount).toBe(1)
    expect(report.activeEmploymentCount).toBe(1)
    expect(report.fte).toBe(0.5)
    expect(report.rows.map((row) => row.employmentId)).toEqual(['employment-1'])
  })
})
