import { describe, expect, it } from 'vitest'
import { canReadInsightReport, INSIGHT_REPORTS, insightReportRoute, visibleInsightReports } from './report-catalog'
import { canonicalInsightReportId, canonicalizeInsightParams, insightReportQueryKeys } from './query-seam'

describe('Insights Analyse destination', () => {
  it('removes the retired Dashboard from the report catalogue and query seam', () => {
    expect(INSIGHT_REPORTS.some((report) => String(report.id) === 'dashboard')).toBe(false)
    expect(canonicalInsightReportId('dashboard')).toBeNull()
  })

  it('registers AI usage as an available permission-gated report', () => {
    expect(INSIGHT_REPORTS).toContainEqual({ id: 'ai-usage', category: 'other', permission: 'ai:usage-read', available: true })
    expect(canonicalInsightReportId('ai-usage')).toBe('ai-usage')
  })

  it('registers Headcount & FTE on the existing employee-report permission and URL seam', () => {
    const report = INSIGHT_REPORTS.find((item) => item.id === 'headcount-fte')
    expect(report).toEqual({ id: 'headcount-fte', category: 'employees', permission: 'report-employee-department:read', available: true })
    expect(visibleInsightReports(['report-employee-department:read'], false)).toContainEqual(report)
    expect(canonicalInsightReportId('headcount-fte')).toBe('headcount-fte')
    expect(insightReportQueryKeys('headcount-fte')).toEqual(['fromMonth', 'toMonth', 'administrations', 'departmentIds', 'teamIds', 'sortBy', 'sortDirection', 'page'])

    const canonical = canonicalizeInsightParams(new URLSearchParams('report=headcount-fte&administrations=a1&administrations=a2&departmentIds=d1&teamIds=m1&teams=retired'))
    expect(canonical.getAll('administrations')).toEqual(['a1', 'a2'])
    expect(canonical.get('departmentIds')).toBe('d1')
    expect(canonical.get('teamIds')).toBe('m1')
    expect(canonical.has('teams')).toBe(false)
  })

  it('registers only existing Talent and Star report destinations', () => {
    expect(INSIGHT_REPORTS.filter((report) => report.category === 'talent').map((report) => report.id)).toEqual([
      'talent-top-talent', 'talent-key-employees', 'talent-star-skills', 'talent-development', 'talent-profile-skill-gaps', 'talent-skills', 'talent-pop', 'talent-appraisal',
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
