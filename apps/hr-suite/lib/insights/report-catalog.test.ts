import { describe, expect, it } from 'vitest'
import { INSIGHT_REPORTS } from './report-catalog'
import { canonicalInsightReportId } from './query-seam'

describe('Insights Analyse destination', () => {
  it('removes the retired Dashboard from the report catalogue and query seam', () => {
    expect(INSIGHT_REPORTS.some((report) => String(report.id) === 'dashboard')).toBe(false)
    expect(canonicalInsightReportId('dashboard')).toBeNull()
  })
})
