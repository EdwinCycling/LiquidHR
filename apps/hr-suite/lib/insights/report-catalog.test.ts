import { describe, expect, it } from 'vitest'
import { canReadInsightReport, INSIGHT_REPORTS, insightReportRoute } from './report-catalog'
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

  it('registers only existing Talent and Star report destinations', () => {
    expect(INSIGHT_REPORTS.filter((report) => report.category === 'talent').map((report) => report.id)).toEqual([
      'talent-top-talent', 'talent-key-employees', 'talent-star-skills', 'talent-development', 'talent-profile-skill-gaps', 'talent-skills', 'talent-pop',
    ])
    expect(insightReportRoute(INSIGHT_REPORTS.find((report) => report.id === 'talent-pop')!, true)).toBe('/settings/talent/reports?reportType=goals')
    expect(insightReportRoute(INSIGHT_REPORTS.find((report) => report.id === 'talent-pop')!, false)).toBe('/workforce/talent/reports?reportType=goals')
    expect(canonicalInsightReportId('talent-top-talent')).toBe('talent-top-talent')
    expect(insightReportRoute(INSIGHT_REPORTS.find((report) => report.id === 'talent-profile-skill-gaps')!, false)).toBe('/workforce/talent/reports/star-performers?report=skill-gaps')
  })

  it('accepts the existing manager-read Star contract without exposing Talent reports to an employee', () => {
    const starReport = INSIGHT_REPORTS.find((report) => report.id === 'talent-top-talent')!
    const talentReport = INSIGHT_REPORTS.find((report) => report.id === 'talent-pop')!
    expect(canReadInsightReport(starReport, ['star-performer:manager-read'])).toBe(true)
    expect(canReadInsightReport(starReport, ['self:star-performer:read'])).toBe(false)
    expect(canReadInsightReport(talentReport, ['self:talent-report:read'])).toBe(false)
  })
})
