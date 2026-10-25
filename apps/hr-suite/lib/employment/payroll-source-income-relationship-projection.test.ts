import { describe, expect, it } from 'vitest'
import { buildPayrollSourceIncomeRelationshipProjection } from './payroll-source-income-relationship-projection'

describe('buildPayrollSourceIncomeRelationshipProjection', () => {
  it('reuses only complete, period-scoped source rows for the target employment', () => {
    const result = buildPayrollSourceIncomeRelationshipProjection({
      employmentId: 'employment-a',
      complete: true,
      links: [
        { id: 'link-b', employment_id: 'employment-b', income_relationship_id: 'income-b', valid_from: '2026-01-01', valid_until: null, updated_at: '2026-01-01T00:00:00Z' },
        { id: 'link-a2', employment_id: 'employment-a', income_relationship_id: 'income-a2', valid_from: '2026-03-01', valid_until: null, updated_at: '2026-03-01T00:00:00Z' },
        { id: 'link-a1', employment_id: 'employment-a', income_relationship_id: 'income-a1', valid_from: '2026-02-01', valid_until: null, updated_at: '2026-02-01T00:00:00Z' },
      ],
      incomeRelationships: [
        { id: 'income-a1', reporting_status: 'READY', starts_on: '2026-02-01', ends_on: null, updated_at: '2026-02-02T00:00:00Z' },
        { id: 'income-a2', reporting_status: 'DRAFT', starts_on: '2026-03-01', ends_on: null, updated_at: '2026-03-02T00:00:00Z' },
      ],
    })

    expect(result).toEqual({
      complete: true,
      rows: [
        {
          id: 'link-a1',
          incomeRelationshipId: 'income-a1',
          validFrom: '2026-02-01',
          validUntil: null,
          linkUpdatedAt: '2026-02-01T00:00:00Z',
          reportingStatus: 'READY',
          startsOn: '2026-02-01',
          endsOn: null,
          incomeRelationshipUpdatedAt: '2026-02-02T00:00:00Z',
        },
        {
          id: 'link-a2',
          incomeRelationshipId: 'income-a2',
          validFrom: '2026-03-01',
          validUntil: null,
          linkUpdatedAt: '2026-03-01T00:00:00Z',
          reportingStatus: 'DRAFT',
          startsOn: '2026-03-01',
          endsOn: null,
          incomeRelationshipUpdatedAt: '2026-03-02T00:00:00Z',
        },
      ],
    })
  })

  it('fails closed when either existing 100-row read may have been truncated', () => {
    const result = buildPayrollSourceIncomeRelationshipProjection({
      employmentId: 'employment-a',
      complete: false,
      links: [],
      incomeRelationships: [],
    })

    expect(result).toEqual({ complete: false, rows: [] })
  })

  it('falls back when a target link is absent from the period-filtered income read', () => {
    const result = buildPayrollSourceIncomeRelationshipProjection({
      employmentId: 'employment-a',
      complete: true,
      links: [
        { id: 'link-a', employment_id: 'employment-a', income_relationship_id: 'income-outside-period', valid_from: '2026-01-01', valid_until: null, updated_at: '2026-01-01T00:00:00Z' },
      ],
      incomeRelationships: [],
    })

    expect(result).toEqual({ complete: false, rows: [] })
  })
})
