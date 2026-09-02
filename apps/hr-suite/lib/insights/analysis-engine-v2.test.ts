import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { AuthContext } from '@/lib/auth/permissions'
import { executeAnalysisSpecV2 } from './analysis-engine-v2'
import type { SnapshotSource } from './analysis-snapshot'
import { validateAnalysisSpecV2 } from './analysis-spec-v2'

const auth: AuthContext = {
  tenantId: 'tenant-a',
  hrGroupId: 'group-a',
  administrationId: null,
  userId: 'user-a',
  employeeId: 'manager-a',
  activeRoles: ['HR_ADMIN'],
  permissions: ['dashboard:read', 'employee:read'],
}

function row(employeeId: string, department: string, employmentType = 'EMPLOYEE') {
  return {
    employmentId: `employment-${employeeId}`,
    employeeId,
    tenantId: 'tenant-a',
    hrGroupId: 'group-a',
    startsOn: '2020-01-01',
    endsOn: null,
    recordStatus: 'CONFIRMED',
    deletedAt: null,
    employeeDeletedAt: null,
    isPrimary: true,
    employmentType,
    placement: {
      id: `placement-${employeeId}`,
      tenantId: 'tenant-a',
      hrGroupId: 'group-a',
      employeeId,
      employmentId: `employment-${employeeId}`,
      departmentId: department.toLowerCase(),
      jobId: null,
      directManagerId: 'manager-a',
      effectiveFrom: '2020-01-01',
      effectiveTo: null,
      departmentLabel: department,
      jobLabel: null,
    },
  } as const
}

function source(asOf: string, rows: readonly SnapshotSource['rows'][number][]): SnapshotSource {
  return { asOf, rows, expectedEmploymentCount: rows.length, retrievedEmploymentCount: rows.length, complete: true }
}

describe('V2 snapshot engine', () => {
  it('groups aggregate rows without leaking source identifiers', async () => {
    const spec = validateAnalysisSpecV2({ version: 2, source: 'workforce', entity: 'employees', measures: ['headcount'], dimensions: ['department'], filters: [], period: { kind: 'snapshot', asOf: '2026-01-01' }, comparison: null, sort: { by: 'label', direction: 'asc' }, limit: 25, presentation: 'table' })
    const result = await executeAnalysisSpecV2(spec, { getContext: async () => auth, retrieve: async () => source('2026-01-01', [row('employee-a', 'Engineering'), row('employee-b', 'Sales')]) })
    expect(result.rows).toEqual([
      { values: { dimensions: { department: 'Engineering' }, headcount: 1 } },
      { values: { dimensions: { department: 'Sales' }, headcount: 1 } },
    ])
    expect(result.metadata).toMatchObject({ complete: true, matchedEmployeeCount: 2 })
    expect(JSON.stringify(result)).not.toContain('employee-a')
    expect(JSON.stringify(result)).not.toContain('tenant-a')
  })

  it('aligns comparison groups, calculates signed deltas and null percentages', async () => {
    const spec = validateAnalysisSpecV2({ version: 2, source: 'workforce', entity: 'employees', measures: ['headcount'], dimensions: ['department'], filters: [], period: { kind: 'snapshot', asOf: '2026-01-01' }, comparison: { kind: 'explicit_period', period: { kind: 'snapshot', asOf: '2025-01-01' } }, sort: { by: 'label', direction: 'asc' }, limit: 25, presentation: 'table' })
    const retrieve = vi.fn(async ({ asOf }: { readonly asOf: string }) => asOf === '2026-01-01'
      ? source(asOf, [row('employee-a', 'Engineering'), row('employee-b', 'Engineering')])
      : source(asOf, [row('employee-c', 'Sales')]))
    const result = await executeAnalysisSpecV2(spec, { getContext: async () => auth, retrieve })
    expect(retrieve).toHaveBeenCalledTimes(2)
    expect(result.rows).toEqual([
      { values: { dimensions: { department: 'Engineering' }, headcount: 2, comparisonHeadcount: 0, delta: 2, deltaPct: null } },
      { values: { dimensions: { department: 'Sales' }, headcount: 0, comparisonHeadcount: 1, delta: -1, deltaPct: -100 } },
    ])
    expect(result.summary).toMatchObject({ headcount: 2, comparisonHeadcount: 1, delta: 1, deltaPct: 100 })
  })

  it('applies limit after alignment and keeps Manager retrieval on DIRECT_REPORTS', async () => {
    const managerAuth = { ...auth, activeRoles: ['DIRECT_MANAGER'] }
    const spec = validateAnalysisSpecV2({ version: 2, source: 'workforce', entity: 'employees', measures: ['headcount'], dimensions: ['department'], filters: [], period: { kind: 'snapshot', asOf: '2026-01-01' }, comparison: { kind: 'explicit_period', period: { kind: 'snapshot', asOf: '2025-01-01' } }, sort: null, limit: 1, presentation: 'table' })
    const seenModes: string[] = []
    const result = await executeAnalysisSpecV2(spec, { getContext: async () => managerAuth, retrieve: async ({ asOf, populationMode }) => { seenModes.push(populationMode); return source(asOf, asOf === '2026-01-01' ? [row('employee-a', 'Engineering')] : [row('employee-b', 'Sales')]) } })
    expect(seenModes).toEqual(['DIRECT_REPORTS', 'DIRECT_REPORTS'])
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.values.delta).toBe(1)
  })
})
