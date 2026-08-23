import { describe, expect, it } from 'vitest'
import { matchesTalentReportTimeframe, talentReportCsv, type TalentReportWorkspace } from './report-service'

const report: TalentReportWorkspace = {
  mode: 'manager',
  query: { mode: 'manager', reportType: 'all', timeframe: 'all' },
  population: { scope: 'manager', employeeCount: 1, rowCount: 2 },
  goals: [{
    employeeId: '00000000-0000-4000-8000-000000000001',
    employeeLabel: 'Ada Lovelace',
    title: 'Improve quality',
    status: 'ACTIVE',
    progressPercent: 45,
    periodStart: '2026-07-01',
    periodEnd: '2026-12-31',
    capabilityLabel: 'Quality awareness',
  }],
  capabilities: [{
    employeeId: '00000000-0000-4000-8000-000000000001',
    employeeLabel: 'Ada Lovelace',
    capabilityCode: 'QUALITY_AWARENESS',
    capabilityName: 'Quality awareness',
    capabilityType: 'COMPETENCY',
    status: 'RELEASED',
    sourceType: 'HR_ENTERED',
    validFrom: '2026-07-01',
    validUntil: '2026-12-31',
    evidenceStatus: null,
    talentLevelName: 'Advanced',
  }],
}

describe('talent report service contracts', () => {
  it('keeps current and history as date-validity views', () => {
    expect(matchesTalentReportTimeframe('2026-07-01', '2026-12-31', 'current', '2026-08-23')).toBe(true)
    expect(matchesTalentReportTimeframe('2025-01-01', '2025-12-31', 'current', '2026-08-23')).toBe(false)
    expect(matchesTalentReportTimeframe('2025-01-01', '2025-12-31', 'history', '2026-08-23')).toBe(true)
    expect(matchesTalentReportTimeframe('2027-01-01', '2027-12-31', 'history', '2026-08-23')).toBe(false)
  })

  it('exports the same selected report rows without leaking internal IDs', () => {
    const csv = talentReportCsv(report)
    expect(csv).toContain('"goal","Ada Lovelace","Improve quality"')
    expect(csv).toContain('"capability","Ada Lovelace","Quality awareness (QUALITY_AWARENESS)"')
    expect(csv).not.toContain('00000000-0000-4000-8000-000000000001')
  })

  it('keeps employee IDs available for capability drilldown links', () => {
    expect(report.capabilities[0]?.employeeId).toBe('00000000-0000-4000-8000-000000000001')
  })

  it('neutralizes spreadsheet formula prefixes in exported values', () => {
    const csv = talentReportCsv({ ...report, goals: [{ ...report.goals[0], title: '=HYPERLINK("https://example.test")' }] })
    expect(csv).toContain(`"'=HYPERLINK(""https://example.test"")"`)
  })
})
