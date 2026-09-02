import { describe, expect, it } from 'vitest'
import { AnalysisEngineError } from './analysis-errors'
import { resolveSnapshotPopulation, type SnapshotSource } from './analysis-snapshot'
import { validateAnalysisSpecV2 } from './analysis-spec-v2'

const spec = validateAnalysisSpecV2({
  version: 2,
  source: 'workforce',
  entity: 'employees',
  measures: ['headcount'],
  dimensions: ['department', 'employment_type'],
  filters: [],
  period: { kind: 'snapshot', asOf: '2026-01-01' },
  comparison: null,
  sort: null,
  limit: 25,
  presentation: 'table',
})

function row(overrides: Partial<SnapshotSource['rows'][number]> = {}): SnapshotSource['rows'][number] {
  return {
    employmentId: 'employment-a',
    employeeId: 'employee-a',
    tenantId: 'tenant-a',
    hrGroupId: 'group-a',
    startsOn: '2020-01-01',
    endsOn: null,
    recordStatus: 'CONFIRMED',
    deletedAt: null,
    employeeDeletedAt: null,
    isPrimary: true,
    employmentType: 'EMPLOYEE',
    placement: {
      id: 'placement-a',
      tenantId: 'tenant-a',
      hrGroupId: 'group-a',
      employeeId: 'employee-a',
      employmentId: 'employment-a',
      departmentId: 'department-a',
      jobId: null,
      directManagerId: 'manager-a',
      effectiveFrom: '2020-01-01',
      effectiveTo: null,
      departmentLabel: 'Engineering',
      jobLabel: null,
    },
    ...overrides,
  }
}

function source(rows: readonly SnapshotSource['rows'][number][]): SnapshotSource {
  return { asOf: '2026-01-01', rows, expectedEmploymentCount: rows.length, retrievedEmploymentCount: rows.length, complete: true }
}

function expectCode(action: () => unknown, code: string): void {
  expect(action).toThrowError(expect.objectContaining({ code }))
}

describe('V2 snapshot population resolver', () => {
  it('includes only active confirmed, non-deleted employments and counts employees once', () => {
    const rows = [
      row(),
      row({ employmentId: 'future', startsOn: '2027-01-01', isPrimary: false }),
      row({ employmentId: 'former', endsOn: '2025-01-01', isPrimary: false }),
      row({ employmentId: 'cancelled', recordStatus: 'CANCELLED', isPrimary: false }),
      row({ employmentId: 'deleted', deletedAt: '2026-01-01', isPrimary: false }),
      row({ employmentId: 'deleted-employee', employeeId: 'employee-deleted', employeeDeletedAt: '2026-01-01', isPrimary: false }),
    ]
    const result = resolveSnapshotPopulation(source(rows), spec, { mode: 'HR_GROUP', actorEmployeeId: null })
    expect(result).toHaveLength(1)
    expect(result[0]?.employeeId).toBe('employee-a')
  })

  it('handles one primary and common parallel dimension values, but fails ambiguity', () => {
    const primary = row()
    const secondary = row({ employmentId: 'employment-b', isPrimary: false, placement: { ...row().placement!, id: 'placement-b', employmentId: 'employment-b' } })
    expect(resolveSnapshotPopulation(source([primary, secondary]), spec, { mode: 'HR_GROUP', actorEmployeeId: null })).toHaveLength(1)
    expect(resolveSnapshotPopulation(source([row({ isPrimary: false }), secondary]), spec, { mode: 'HR_GROUP', actorEmployeeId: null })).toHaveLength(1)
    expectCode(() => resolveSnapshotPopulation(source([primary, { ...secondary, isPrimary: true }]), spec, { mode: 'HR_GROUP', actorEmployeeId: null }), 'ANALYSIS_SNAPSHOT_AMBIGUOUS')
    expectCode(() => resolveSnapshotPopulation(source([row({ isPrimary: false }), { ...secondary, employmentType: 'INTERN' }]), spec, { mode: 'HR_GROUP', actorEmployeeId: null }), 'ANALYSIS_SNAPSHOT_AMBIGUOUS')
  })

  it('keeps unknown job explicit while rejecting unresolved department references', () => {
    const jobSpec = validateAnalysisSpecV2({ ...spec, dimensions: ['job'] })
    const unknownJob = resolveSnapshotPopulation(source([row()]), jobSpec, { mode: 'HR_GROUP', actorEmployeeId: null })
    expect(unknownJob[0]?.jobKey).toBeNull()
    expectCode(() => resolveSnapshotPopulation(source([row({ placement: { ...row().placement!, departmentId: null } })]), spec, { mode: 'HR_GROUP', actorEmployeeId: null }), 'ANALYSIS_REFERENCE_NOT_RESOLVED')
  })

  it('does not require unrelated dimension labels for an undimensioned headcount', () => {
    const headcountSpec = validateAnalysisSpecV2({ ...spec, dimensions: [] })
    const result = resolveSnapshotPopulation(source([row({ placement: { ...row().placement!, departmentId: null, departmentLabel: null } })]), headcountSpec, { mode: 'HR_GROUP', actorEmployeeId: null })
    expect(result).toHaveLength(1)
  })

  it('requires employment-specific historical placement for Manager scope', () => {
    const manager = resolveSnapshotPopulation(source([row()]), spec, { mode: 'DIRECT_REPORTS', actorEmployeeId: 'manager-a' })
    expect(manager).toHaveLength(1)
    expectCode(() => resolveSnapshotPopulation(source([row({ placement: null })]), spec, { mode: 'DIRECT_REPORTS', actorEmployeeId: 'manager-a' }), 'ANALYSIS_SCOPE_NOT_PROVABLE')
    expectCode(() => resolveSnapshotPopulation(source([row({ placement: { ...row().placement!, directManagerId: 'manager-b' } })]), spec, { mode: 'DIRECT_REPORTS', actorEmployeeId: 'manager-a' }), 'ANALYSIS_SCOPE_NOT_PROVABLE')
  })

  it('fails closed on incomplete source retrieval', () => {
    expectCode(() => resolveSnapshotPopulation({ ...source([row()]), complete: false } as unknown as SnapshotSource, spec, { mode: 'HR_GROUP', actorEmployeeId: null }), 'ANALYSIS_RETRIEVAL_INCOMPLETE')
    expectCode(() => resolveSnapshotPopulation({ ...source([row()]), expectedEmploymentCount: 2 } as SnapshotSource, spec, { mode: 'HR_GROUP', actorEmployeeId: null }), 'ANALYSIS_RETRIEVAL_INCOMPLETE')
    expect(new AnalysisEngineError('ANALYSIS_RETRIEVAL_INCOMPLETE', 500)).toBeInstanceOf(Error)
  })
})
