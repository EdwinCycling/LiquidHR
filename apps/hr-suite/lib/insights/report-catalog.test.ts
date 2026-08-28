import { describe, expect, it } from 'vitest'
import { INSIGHT_REPORTS } from './report-catalog'
import { canonicalInsightReportId, insightReportQueryKeys } from './query-seam'

describe('Insights Dashboard destination', () => {
  it('is permission-gated by dashboard:read and has no report filter state', () => {
    const dashboard = INSIGHT_REPORTS.find((report) => report.id === 'dashboard')
    expect(dashboard).toMatchObject({ category: 'other', permission: 'dashboard:read', available: true })
    expect(INSIGHT_REPORTS.filter((report) => ['report-employee-department:read', 'dashboard:read'].includes(report.permission)).map((report) => report.id)).toContain('dashboard')
    expect(INSIGHT_REPORTS.filter((report) => ['report-employee-department:read'].includes(report.permission)).map((report) => report.id)).not.toContain('dashboard')
    expect(canonicalInsightReportId('dashboard')).toBe('dashboard')
    expect(insightReportQueryKeys('dashboard')).toEqual([])
  })
})
