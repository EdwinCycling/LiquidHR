import { describe, expect, it } from 'vitest'
import {
  absenceReportSpecs,
  assertReport,
  assertDeploymentEvidence,
  assertDirectTeamBaseline,
  assertMigrationStage,
  assertNegativeFixtureReference,
  assertNoNegativeFixtureNames,
  assertNoNegativeFixtureRows,
  assertPeriodBounds,
  expectedCalendarYearRange,
  expectedRollingRange,
  validate,
} from './ins-release-04-core-test-acceptance.mjs'
import { parseAbsenceInsightQuery } from '../lib/insights/absence-query'

const ids = {
  tenant: '00000000-0000-4000-8000-000000000001',
  group: '00000000-0000-4000-8000-000000000002',
  administration: '00000000-0000-4000-8000-000000000003',
  secondAdministration: '00000000-0000-4000-8000-000000000004',
  forbiddenAdministration: '00000000-0000-4000-8000-000000000005',
  forbiddenGroup: '00000000-0000-4000-8000-000000000006',
  forbiddenTenant: '00000000-0000-4000-8000-000000000007',
  outsideEmployee: '00000000-0000-4000-8000-000000000008',
}

function validManifest() {
  const sessions = Object.fromEntries(['hrAdmin', 'manager', 'employee', 'emptyManager'].map((name) => [name, { nl: `${name}-nl.json` }]))
  sessions.hrAdmin.en = 'hr-admin-en.json'
  sessions.manager.en = 'manager-en.json'
  const context = { tenantId: ids.tenant, hrGroupId: ids.group }
  return {
    runtime: { sourceSha: 'f'.repeat(40), deploymentId: 'dpl_operator_claim', appliedMigrationVersions: ['wrong'] },
    sessions,
    expected: {
      hrAdmin: { ...context, administrationId: ids.administration, secondAdministrationId: ids.secondAdministration, frequentAbsenceThreshold: 3 },
      manager: {
        ...context, administrationId: ids.administration, secondAdministrationId: ids.secondAdministration,
        forbiddenAdministrationId: ids.forbiddenAdministration, forbiddenHrGroupId: ids.forbiddenGroup,
        forbiddenTenantId: ids.forbiddenTenant, outsideTeamEmployeeIds: [ids.outsideEmployee], frequentAbsenceThreshold: 3,
      },
      employee: context,
      emptyManager: { ...context, administrationId: ids.administration },
    },
  }
}

function fixtureProof() {
  const ranges = {
    calendarYear: expectedCalendarYearRange(new Date('2026-10-30T12:00:00Z')),
    rolling: expectedRollingRange(new Date('2026-10-30T12:00:00Z')),
  }
  const scope = { tenantId: ids.tenant, hrGroupId: ids.group, administrationId: ids.administration }
  const employees = [{ id: ids.outsideEmployee, tenant_id: ids.tenant, hr_group_id: ids.group, first_name: 'Rosa', birth_name_prefix: 'de', birth_name: 'Vries' }]
  const cases = [{ id: 'case-1', employee_id: ids.outsideEmployee, first_absence_on: '2026-02-01', tenant_id: ids.tenant, hr_group_id: ids.group, administration_id: ids.administration }]
  const spells = [{ id: 'spell-1', case_id: 'case-1', started_on: '2026-02-01', recovered_on: '2026-02-10' }]
  return { ranges, scope, employees, cases, spells }
}

describe('INS-RELEASE-04 runner contracts', () => {
  it('uses the exact inclusive 365-day window for both rolling reports', () => {
    const range = expectedRollingRange(new Date('2026-10-30T23:59:59Z'))
    expect(range).toEqual({ startDate: '2025-10-31', endDate: '2026-10-30' })
    expect((Date.parse(`${range.endDate}T00:00:00Z`) - Date.parse(`${range.startDate}T00:00:00Z`)) / 86_400_000 + 1).toBe(365)
    expect(() => assertPeriodBounds({ period: range }, range)).not.toThrow()
    expect(() => assertPeriodBounds({ period: { ...range, endDate: '2026-10-29' } }, range)).toThrow('REPORT_PERIOD_MISMATCH')
  })

  it('uses a supported calendar-year period and verifies its returned dates', () => {
    const range = expectedCalendarYearRange(new Date('2026-10-30T00:00:00Z'))
    expect(range).toEqual({ mode: 'year', year: 2026, startDate: '2026-01-01', endDate: '2026-12-31' })
    expect(() => assertPeriodBounds({ period: range }, range)).not.toThrow()
    expect(() => assertPeriodBounds({ period: { ...range, startDate: '2026-02-01' } }, range)).toThrow('REPORT_PERIOD_MISMATCH')
  })

  it('uses only supported period parameters for ordinary absence and the shared 365-day window for rolling reports', () => {
    const windows = {
      calendarYear: expectedCalendarYearRange(new Date('2026-10-30T00:00:00Z')),
      rolling: expectedRollingRange(new Date('2026-10-30T00:00:00Z')),
    }
    const specs = absenceReportSpecs(windows)
    expect(specs.map(({ report, params }) => [report, params.period])).toEqual([
      ['absence', 'year'], ['absence-frequent', '12-months'], ['absence-bradford', '52-weeks'],
    ])
    expect(specs[1].range).toBe(windows.rolling)
    expect(specs[2].range).toBe(windows.rolling)
    expect(parseAbsenceInsightQuery(new URLSearchParams('report=absence&period=year&year=2026')))
      .toMatchObject({ period: 'year', startDate: '2026-01-01', endDate: '2026-12-31' })
    expect(parseAbsenceInsightQuery(new URLSearchParams('report=absence&period=52-weeks&year=2026&month=10')))
      .toMatchObject({ period: 'month', startDate: '2026-10-01', endDate: '2026-10-31' })
    for (const spec of specs.slice(1)) expect((Date.parse(`${spec.range.endDate}T00:00:00Z`) - Date.parse(`${spec.range.startDate}T00:00:00Z`)) / 86_400_000 + 1).toBe(365)
  })

  it('ignores operator-supplied deployment and migration claims in the manifest', () => {
    const checked = validate(validManifest(), 'a'.repeat(40), 'https://wnpfloqpjvaacobppbpk.supabase.co')
    expect(checked.baseUrl).toBe('https://liquid-hr-hr-suite.vercel.app')
    expect(checked).not.toHaveProperty('runtime')
  })

  it('requires the manager and HR Admin direct-team baselines to match', () => {
    expect(assertDirectTeamBaseline(['team-a', 'team-b'], ['team-b', 'team-a'])).toEqual(new Set(['team-b', 'team-a']))
    expect(() => assertDirectTeamBaseline(['team-a'], ['team-a', 'outside'])).toThrow('DIRECT_TEAM_BASELINE_MISMATCH')
    expect(() => assertDirectTeamBaseline([], [])).toThrow('DIRECT_TEAM_BASELINE_MISMATCH')
  })

  it('requires outside-team employees and relevant case/spell records in HR Admin reference data', () => {
    const proof = fixtureProof()
    const result = assertNegativeFixtureReference([ids.outsideEmployee], proof.employees, proof.cases, proof.spells, new Set(['team-member']), proof.ranges, proof.scope)
    expect(result.relevant).toEqual({ absenceCases: 1, frequentCases: 1, bradfordSpells: 1 })
    expect(result.employeeNames).toEqual(new Set(['Rosa de Vries']))
    expect(() => assertNegativeFixtureReference([ids.outsideEmployee], [], proof.cases, proof.spells, new Set(), proof.ranges, proof.scope))
      .toThrow('OUTSIDE_TEAM_EMPLOYEE_REFERENCE_MISSING')
    expect(() => assertNegativeFixtureReference([ids.outsideEmployee], proof.employees, [], proof.spells, new Set(), proof.ranges, proof.scope))
      .toThrow('OUTSIDE_TEAM_CASE_REFERENCE_MISSING')
    expect(() => assertNegativeFixtureReference([ids.outsideEmployee], proof.employees, proof.cases, [], new Set(), proof.ranges, proof.scope))
      .toThrow('OUTSIDE_TEAM_RELEVANT_CASE_MISSING')
    expect(() => assertNegativeFixtureReference([ids.outsideEmployee], proof.employees, proof.cases, proof.spells, new Set([ids.outsideEmployee]), proof.ranges, proof.scope))
      .toThrow('OUTSIDE_TEAM_FIXTURE_IN_ALLOWLIST')
  })

  it('fails when a fixture employee contributes to JSON details or appears in Excel', () => {
    expect(() => assertNoNegativeFixtureRows([{ employeeId: ids.outsideEmployee }], new Set([ids.outsideEmployee])))
      .toThrow('OUTSIDE_TEAM_EMPLOYEE_IN_REPORT')
    expect(() => assertNoNegativeFixtureNames(['Rosa de Vries'], new Set(['Rosa de Vries'])))
      .toThrow('OUTSIDE_TEAM_EMPLOYEE_IN_EXCEL')
    expect(() => assertNoNegativeFixtureRows([{ employeeId: 'allowed' }], new Set([ids.outsideEmployee]))).not.toThrow()
  })

  it('requires Bradford D and occurrence KPIs to equal the permitted detail rows', () => {
    const rows = [{ employeeId: 'allowed', absenceOccurrences: 2, sickDays: 1.2, score: 5, band: 'LOW' }]
    const report = { rows, totalOccurrences: 2, totalSickDays: 1.2 }
    expect(() => assertReport(report, new Set(['allowed']), 'absence-bradford')).not.toThrow()
    expect(() => assertReport({ ...report, totalSickDays: 2.2 }, new Set(['allowed']), 'absence-bradford'))
      .toThrow('BRADFORD_KPI_DETAIL_MISMATCH')
  })

  it('checks absence KPI cases against details and an independent direct-team reference', () => {
    const rows = [{ employeeId: 'allowed', caseCount: 1, sickHours: 8, sickDays: 1 }]
    const report = { rows, absenceCases: 1, activeCases: 1, sickHours: 8, sickDays: 1 }
    expect(() => assertReport(report, new Set(['allowed']), 'absence', { absenceCases: 1, activeCases: 1 })).not.toThrow()
    expect(() => assertReport({ ...report, absenceCases: 2 }, new Set(['allowed']), 'absence', { absenceCases: 2, activeCases: 1 }))
      .toThrow('ABSENCE_KPI_DETAIL_MISMATCH')
    expect(() => assertReport(report, new Set(['allowed']), 'absence', { absenceCases: 1, activeCases: 2 }))
      .toThrow('ABSENCE_KPI_REFERENCE_MISMATCH')
    expect(() => assertReport({ ...report, sickHours: 9 }, new Set(['allowed']), 'absence'))
      .toThrow('ABSENCE_SICKNESS_KPI_DETAIL_MISMATCH')
  })

  it('accepts only live platform readback matching the expected application and Core TEST', () => {
    const expectedSha = 'b'.repeat(40)
    const alias = { alias: 'liquid-hr-hr-suite.vercel.app', projectId: 'prj_h3voMtzXGfqG6QTodR5d1VTcC1zP', deploymentId: 'dpl_live123' }
    const deployment = { id: 'dpl_live123', url: 'liquidhr-live.vercel.app', projectId: alias.projectId, readyState: 'READY', target: 'production' }
    const runtime = {
      sourceSha: expectedSha, deploymentId: alias.deploymentId, projectId: alias.projectId,
      deploymentUrl: deployment.url, targetEnvironment: 'production', supabaseProjectRef: 'wnpfloqpjvaacobppbpk', platformSourceSha: null,
    }
    expect(assertDeploymentEvidence(runtime, expectedSha, alias, deployment).sourceSha).toBe(expectedSha)
    expect(() => assertDeploymentEvidence({ ...runtime, sourceSha: 'c'.repeat(40) }, expectedSha, alias, deployment)).toThrow('SOURCE_SHA_NOT_VERIFIED')
    expect(() => assertDeploymentEvidence(runtime, expectedSha, { ...alias, deploymentId: 'dpl_other' }, deployment)).toThrow('ACTIVE_DEPLOYMENT_READBACK_MISMATCH')
    expect(() => assertDeploymentEvidence(runtime, expectedSha, alias, { ...deployment, projectId: 'prj_wrong' })).toThrow('ACTIVE_DEPLOYMENT_READBACK_MISMATCH')
  })

  it('requires independently read migration stage states and exact migration names', () => {
    const phaseA = { version: '20261030065603', name: 'ins_release_02_manager_insights_unblock' }
    const phaseC = { version: '20261030120901', name: 'ins_release_04_manager_insights_activation' }
    expect(assertMigrationStage([phaseA, phaseC])).toEqual({ stage: 'complete', appliedVersions: ['20261030065603', '20261030120901'] })
    expect(assertMigrationStage([phaseA], 'a-only')).toEqual({ stage: 'a-only', appliedVersions: ['20261030065603'] })
    expect(assertMigrationStage([], 'none')).toEqual({ stage: 'none', appliedVersions: [] })
    expect(() => assertMigrationStage([phaseC], 'a-only')).toThrow('MIGRATION_STAGE_MISMATCH')
    expect(() => assertMigrationStage([phaseA], 'complete')).toThrow('MIGRATION_STAGE_MISMATCH')
    expect(() => assertMigrationStage([phaseA, { ...phaseC, name: 'unexpected_migration' }])).toThrow('MIGRATION_NAME_MISMATCH')
    expect(() => assertMigrationStage([phaseA, phaseA])).toThrow('MIGRATION_READBACK_INVALID')
  })
})
