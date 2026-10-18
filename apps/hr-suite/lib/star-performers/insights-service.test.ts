import { describe, expect, it } from 'vitest'
import { buildCriticalityDistribution, buildFunctionSkillGapReport, buildGridDistribution, buildMovementSummary, buildSkillCoverage } from './insights-service'

describe('Star Performers insights aggregations', () => {
  it('counts unique employees once across all nine grid cells', () => {
    const distribution = buildGridDistribution([
      { employeeId: 'employee-1', gridCell: 'HIGH_HIGH' },
      { employeeId: 'employee-1', gridCell: 'LOW_LOW' },
      { employeeId: 'employee-2', gridCell: 'NORMAL_HIGH' },
      { employeeId: 'outside-scope', gridCell: 'HIGH_HIGH' },
    ], ['employee-1', 'employee-2'])

    expect(distribution.find((item) => item.cell === 'HIGH_HIGH')).toMatchObject({ count: 1, percent: 50 })
    expect(distribution.find((item) => item.cell === 'NORMAL_HIGH')).toMatchObject({ count: 1, percent: 50 })
    expect(distribution.reduce((total, item) => total + item.count, 0)).toBe(2)
  })

  it('keeps the criticality scale independent and unique per employee', () => {
    const distribution = buildCriticalityDistribution([
      { employeeId: 'employee-1', criticalityLevel: 5 },
      { employeeId: 'employee-1', criticalityLevel: 4 },
      { employeeId: 'employee-2', criticalityLevel: 2 },
    ])

    expect(distribution.find((item) => item.level === 5)).toMatchObject({ count: 1, percent: 50 })
    expect(distribution.find((item) => item.level === 2)).toMatchObject({ count: 1, percent: 50 })
  })

  it('does not manufacture historical movement when no comparable campaign exists', () => {
    expect(buildMovementSummary(['NEW', null])).toEqual({ state: 'unavailable', comparableEmployees: 0, up: 0, down: 0, stable: 0 })
    expect(buildMovementSummary(['UP', 'STABLE', 'NEW'])).toEqual({ state: 'available', comparableEmployees: 2, up: 1, down: 0, stable: 1 })
  })

  it('excludes unknown skill evidence from coverage and reports only evidenced gaps', () => {
    const result = buildSkillCoverage([
      { employeeId: 'employee-1', roleId: 'job-1', roleLabel: 'HR adviseur', jobGroupName: 'Service', axes: [{ capabilityName: 'Gesprek voeren', status: 'MATCH' }, { capabilityName: 'Data-analyse', status: 'GAP' }, { capabilityName: 'Onbekend', status: 'UNKNOWN' }] },
      { employeeId: 'employee-2', roleId: 'job-1', roleLabel: 'HR adviseur', jobGroupName: 'Service', axes: [{ capabilityName: 'Gesprek voeren', status: 'MISSING_EVIDENCE' }] },
    ])

    expect(result.evaluatedEmployees).toBe(2)
    expect(result.roles[0]).toMatchObject({ requirements: 3, coveredRequirements: 1, gapCount: 2, coveragePercent: 33, evidenceBacked: true })
    expect(result.topGaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Gesprek voeren', occurrences: 1 }),
      expect.objectContaining({ label: 'Data-analyse', occurrences: 1 }),
    ]))
  })

  it('keeps function-skillgap denominators unique and separates evidence states', () => {
    const base = {
      roleId: 'job-1', roleLabel: 'HR adviseur', jobGroupName: 'Service', departmentId: 'department-1', departmentName: 'People', profileVersionId: 'profile-1', profileVersion: 2, profileValidFrom: '2026-01-01', profileValidUntil: null,
      axes: [{ requirementId: 'requirement-1', capabilityId: 'capability-1', capabilityName: 'Gesprek voeren', requiredLevelLabel: 'Gevorderd', currentLevelLabel: 'Gevorderd', status: 'MATCH' as const }],
    }
    const report = buildFunctionSkillGapReport([
      { ...base, employeeId: 'employee-1', employeeLabel: 'Ada Admin', employeeNumber: 'E001' },
      { ...base, employeeId: 'employee-2', employeeLabel: 'Ben Beheer', employeeNumber: 'E002', axes: [{ ...base.axes[0], currentLevelLabel: 'Basis', status: 'INSUFFICIENT_LEVEL' }] },
      { ...base, employeeId: 'employee-3', employeeLabel: 'Cleo Collega', employeeNumber: 'E003', axes: [{ ...base.axes[0], currentLevelLabel: null, status: 'NOT_ASSESSED' }] },
      { ...base, employeeId: 'employee-1', employeeLabel: 'Ada Admin', employeeNumber: 'E001' },
    ], '2026-10-18')

    expect(report).toMatchObject({ state: 'ready', relevantEmployees: 3, assessedEmployees: 2 })
    expect(report.rows).toHaveLength(1)
    expect(report.rows[0]).toMatchObject({ totalRelevantEmployees: 3, assessedEmployees: 2, coveragePercent: 33, singlePersonDependency: false, statusCounts: { MATCH: 1, INSUFFICIENT_LEVEL: 1, NOT_ASSESSED: 1 } })
    expect(report.rows[0].employees).toHaveLength(3)

    const evidencedDependency = buildFunctionSkillGapReport([
      { ...base, employeeId: 'employee-1', employeeLabel: 'Ada Admin', employeeNumber: 'E001' },
      { ...base, employeeId: 'employee-2', employeeLabel: 'Ben Beheer', employeeNumber: 'E002', axes: [{ ...base.axes[0], currentLevelLabel: 'Basis', status: 'INSUFFICIENT_LEVEL' }] },
    ], '2026-10-18')
    expect(evidencedDependency.rows[0].singlePersonDependency).toBe(true)
  })
})
