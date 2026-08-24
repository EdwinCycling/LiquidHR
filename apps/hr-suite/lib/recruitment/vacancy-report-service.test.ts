import { describe, expect, it } from 'vitest'
import { buildRecruitmentVacancyReport, parseVacancyReportQuery, vacancyReportQuerySchema, type VacancyReportApplicationInput } from './vacancy-report-service'

const vacancy = { id: '10000000-0000-4000-8000-000000000001', title: 'TEST-REC-REPORT vacature', status: 'ACTIVE' as const }
const stages = [
  { id: '20000000-0000-4000-8000-000000000001', name: 'Screening', sortOrder: 1 },
  { id: '20000000-0000-4000-8000-000000000002', name: 'Gesprek', sortOrder: 2 },
]

const applications: readonly VacancyReportApplicationInput[] = [
  { activeStageId: stages[0].id, terminalOutcome: null, source: 'PUBLIC', createdAt: '2026-08-01T10:00:00.000Z', terminalAt: null, anonymizedAt: null },
  { activeStageId: stages[0].id, terminalOutcome: 'AFGEWEZEN', source: 'MANUAL', createdAt: '2026-08-02T10:00:00.000Z', terminalAt: '2026-08-03T10:00:00.000Z', anonymizedAt: null },
  { activeStageId: stages[1].id, terminalOutcome: 'AANGENOMEN', source: 'MANUAL', createdAt: '2026-08-03T10:00:00.000Z', terminalAt: '2026-08-04T10:00:00.000Z', anonymizedAt: null },
  { activeStageId: stages[1].id, terminalOutcome: null, source: 'PUBLIC', createdAt: '2026-08-03T11:00:00.000Z', terminalAt: null, anonymizedAt: '2026-08-03T12:00:00.000Z' },
  { activeStageId: stages[0].id, terminalOutcome: null, source: 'MANUAL', createdAt: '2026-07-31T10:00:00.000Z', terminalAt: null, anonymizedAt: null },
]

describe('vacancy report query and aggregation', () => {
  it('matches metrics to source applications and keeps terminal outcomes out of stages', () => {
    const report = buildRecruitmentVacancyReport({
      vacancy,
      stages,
      applications,
      query: vacancyReportQuerySchema.parse({ periodFrom: '2026-08-01', periodTo: '2026-08-03' }),
    })

    expect(report.metrics).toEqual({ totalApplications: 3, activeApplications: 1, hiredApplications: 1, rejectedApplications: 1, conversionRate: 33.3 })
    expect(report.statusBreakdown).toEqual([
      { key: stages[0].id, kind: 'STAGE', label: 'Screening', count: 1 },
      { key: 'AANGENOMEN', kind: 'OUTCOME', label: null, count: 1 },
      { key: 'AFGEWEZEN', kind: 'OUTCOME', label: null, count: 1 },
    ])
    expect(report.sourceBreakdown).toEqual([{ source: 'MANUAL', count: 2 }, { source: 'PUBLIC', count: 1 }])
  })

  it('applies status, stage and source filters before calculating metrics', () => {
    const report = buildRecruitmentVacancyReport({
      vacancy,
      stages,
      applications,
      query: vacancyReportQuerySchema.parse({ status: 'active', stageId: stages[0].id, source: 'PUBLIC' }),
    })

    expect(report.metrics).toEqual({ totalApplications: 1, activeApplications: 1, hiredApplications: 0, rejectedApplications: 0, conversionRate: 0 })
    expect(report.statusBreakdown).toEqual([{ key: stages[0].id, kind: 'STAGE', label: 'Screening', count: 1 }])
  })

  it('parses URL filters and rejects an invalid period', () => {
    expect(parseVacancyReportQuery({ status: 'hired', source: 'MANUAL', periodFrom: '2026-08-01' })).toMatchObject({ status: 'hired', source: 'MANUAL', periodFrom: '2026-08-01' })
    expect(() => parseVacancyReportQuery({ periodFrom: '2026-08-04', periodTo: '2026-08-01' })).toThrow('RECRUITMENT_REPORT_INPUT_INVALID')
    expect(() => parseVacancyReportQuery({ periodFrom: '2026-02-30' })).toThrow('RECRUITMENT_REPORT_INPUT_INVALID')
  })

  it('returns an explicit no-results report without inventing counters', () => {
    const report = buildRecruitmentVacancyReport({ vacancy, stages, applications, query: vacancyReportQuerySchema.parse({ periodFrom: '2027-01-01', periodTo: '2027-01-31' }) })
    expect(report.metrics).toEqual({ totalApplications: 0, activeApplications: 0, hiredApplications: 0, rejectedApplications: 0, conversionRate: null })
    expect(report.statusBreakdown).toEqual([])
    expect(report.sourceBreakdown).toEqual([])
  })
})
