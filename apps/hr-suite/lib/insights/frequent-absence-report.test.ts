import { beforeEach, describe, expect, it, vi } from 'vitest'
import { filterFrequentAbsenceRows, getFrequentAbsenceReport } from './frequent-absence-report'
import type { FrequentAbsenceQuery } from './frequent-absence-query'
import type { FrequentAbsenceRow } from './frequent-absence-report'

const { getScope } = vi.hoisted(() => ({ getScope: vi.fn() }))

vi.mock('./absence-insight-scope', () => ({
  assertAbsenceInsightEmployeeAllowlist: vi.fn(),
  getAbsenceInsightScope: getScope,
}))

const rows: readonly FrequentAbsenceRow[] = [
  { employeeId: '1', employeeName: 'Élodie de Vries', departmentName: 'Product', reportCount: 3, totalSickDays: 12, isFrequent: true },
  { employeeId: '2', employeeName: 'Bas Jansen', departmentName: 'Sales', reportCount: 1, totalSickDays: 2, isFrequent: false },
]

const query: FrequentAbsenceQuery = {
  report: 'absence-frequent',
  period: '12-months',
  year: 2026,
  startDate: '2025-11-01',
  endDate: '2026-10-31',
  departmentId: null,
  search: '',
  frequentOnly: false,
}

describe('frequent absence report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('applies frequent-only and case-insensitive employee search to the service population', () => {
    expect(filterFrequentAbsenceRows(rows, { frequentOnly: true, search: 'ÉLODIE' })).toEqual([rows[0]])
    expect(filterFrequentAbsenceRows(rows, { frequentOnly: false, search: 'jansen' })).toEqual([rows[1]])
  })

  it('keeps an empty search from removing any rows when frequent-only is off', () => {
    expect(filterFrequentAbsenceRows(rows, { frequentOnly: false, search: '  ' })).toEqual(rows)
  })

  it('fails closed for HR Admin when the Phase A threshold RPC is not yet available', async () => {
    getScope.mockResolvedValue({
      scopeTruncated: false,
      supabase: {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Could not find function public.get_frequent_absence_threshold' },
        }),
      },
      context: { tenantId: 'tenant-a', activeRoles: ['HR_ADMIN'] },
      hrGroupId: 'hr-group-a',
      administrationId: 'administration-a',
      employeeIds: null,
    })

    await expect(getFrequentAbsenceReport(query)).rejects.toMatchObject({
      code: 'INSIGHTS_FREQUENT_SETTINGS_FAILED',
      status: 503,
    })
  })
})
