import { describe, expect, it } from 'vitest'
import { INSIGHT_REPORTS, visibleInsightReports } from './report-catalog'
import { canonicalInsightReportId } from './query-seam'

describe('Insights Analyse destination', () => {
  it('removes the retired Dashboard from the report catalogue and query seam', () => {
    expect(INSIGHT_REPORTS.some((report) => String(report.id) === 'dashboard')).toBe(false)
    expect(canonicalInsightReportId('dashboard')).toBeNull()
  })

  it('registers AI usage as an available permission-gated report', () => {
    expect(INSIGHT_REPORTS).toContainEqual({ id: 'ai-usage', category: 'other', permission: 'ai:usage-read', available: true })
    expect(canonicalInsightReportId('ai-usage')).toBe('ai-usage')
  })

  it('keeps unavailable reports out of the user-facing catalogue and direct report URLs', () => {
    expect(visibleInsightReports(['report-leave-provision:read', 'report-wvp:read'], true)).toEqual([])
    expect(canonicalInsightReportId('provision')).toBeNull()
    expect(canonicalInsightReportId('wvp')).toBeNull()
  })

  it('limits the internal salary-position report to HR administrators', () => {
    const permissions = ['salary:read']
    expect(visibleInsightReports(permissions, false).some((report) => report.id === 'salary-internal-position')).toBe(false)
    expect(visibleInsightReports(permissions, true).some((report) => report.id === 'salary-internal-position')).toBe(true)
  })
})
