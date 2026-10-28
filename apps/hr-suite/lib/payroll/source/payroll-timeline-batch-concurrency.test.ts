import { beforeEach, describe, expect, it, vi } from 'vitest'

const readers = vi.hoisted(() => ({
  timeline: vi.fn(),
  tax: vi.fn(),
  income: vi.fn(),
}))

vi.mock('@/lib/employment/employment-detail-service', () => ({
  getEmploymentPayrollSourceProjectionsBatch: readers.timeline,
  getEmploymentIncomeRelationshipProjection: readers.income,
  getEmploymentPayrollSourceProjection: vi.fn(),
}))
vi.mock('@/lib/employment/employment-payroll-tax-profile-service', () => ({
  getEmploymentPayrollTaxSourceProjectionsBatch: readers.tax,
  getEmploymentPayrollTaxSourceProjection: vi.fn(),
}))

import { loadDefaultPayrollTimelinesBatch } from './liquid-hr-source-provider'

const input = {
  employeeId: '40000000-0000-4000-8000-000000000004',
  employmentId: '50000000-0000-4000-8000-000000000005',
  payrollPeriod: { year: 2026, month: 10 },
}
const source = {
  employment: { id: input.employmentId }, salaries: [], schedules: [], contracts: [],
  laborConditions: [], organizations: [], pensionAssignments: [], laborConditionPensionArrangements: [],
}
const tax = { payrollIncomeRelationshipProjection: { complete: true, rows: [] } }

describe('default payroll timeline batch', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('starts the separately authorized timeline and tax reads together and keeps their paired results', async () => {
    let releaseTimeline: ((value: unknown[]) => void) | undefined
    readers.timeline.mockImplementation(() => new Promise((resolve) => { releaseTimeline = resolve }))
    readers.tax.mockResolvedValue([tax])
    const result = loadDefaultPayrollTimelinesBatch([input])

    await vi.waitFor(() => expect(readers.tax).toHaveBeenCalledOnce(), { timeout: 500 })
    releaseTimeline?.([source])
    await expect(result).resolves.toEqual([expect.objectContaining({
      employment: source.employment,
      taxProfileProjection: tax,
      incomeRelationships: [],
    })])
    expect(readers.income).not.toHaveBeenCalled()
  })

  it('propagates a tax batch failure instead of returning an incomplete timeline', async () => {
    readers.timeline.mockResolvedValue([source])
    readers.tax.mockRejectedValue(new Error('tax-source-unavailable'))
    await expect(loadDefaultPayrollTimelinesBatch([input])).rejects.toThrow()
  })
})
