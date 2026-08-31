import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))

import type { AuthContext } from '@/lib/auth/permissions'
import { AnalysisEngineError } from './analysis-errors'
import { buildDrilledAnalysisSpec, validateAnalysisDrillRequest } from './analysis-drill'
import { executeAnalysisDrill } from './analysis-drill-runtime'
import type { AnalysisEmployeeRecord } from './analysis-engine'

function spec(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    source: 'workforce',
    entity: 'employees',
    measures: ['headcount'],
    dimensions: ['department'],
    filters: [],
    sort: null,
    limit: 25,
    presentation: 'auto',
    ...overrides,
  }
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    analysisSpec: spec(),
    contextDimension: 'department',
    contextValue: 'Engineering',
    nextDimension: 'job',
    ...overrides,
  }
}

describe('AN-6 contextual drill', () => {
  it('turns a department result row into a strict job AnalysisSpec', () => {
    const validated = validateAnalysisDrillRequest(request())
    const drilled = buildDrilledAnalysisSpec(validated)

    expect(drilled).toMatchObject({
      dimensions: ['job'],
      filters: [{ dimension: 'department', operator: 'eq', value: 'Engineering' }],
    })
  })

  it('supports job to department and deduplicates an existing context filter', () => {
    const validated = validateAnalysisDrillRequest(request({
      analysisSpec: spec({
        dimensions: ['job'],
        filters: [{ dimension: 'department', operator: 'eq', value: 'Engineering' }],
      }),
      contextDimension: 'job',
      contextValue: 'Developer',
      nextDimension: 'department',
    }))
    const drilled = buildDrilledAnalysisSpec(validated)
    expect(drilled.dimensions).toEqual(['department'])
    expect(drilled.filters).toEqual([
      { dimension: 'department', operator: 'eq', value: 'Engineering' },
      { dimension: 'job', operator: 'eq', value: 'Developer' },
    ])

    const deduplicated = buildDrilledAnalysisSpec(validateAnalysisDrillRequest(request({
      analysisSpec: spec({ filters: [{ dimension: 'department', operator: 'eq', value: 'Engineering' }] }),
    })))
    expect(deduplicated.filters).toEqual([{ dimension: 'department', operator: 'eq', value: 'Engineering' }])
  })

  it('rejects a conflicting context and same-dimension or malformed drill', () => {
    expect(() => buildDrilledAnalysisSpec(validateAnalysisDrillRequest(request({
      analysisSpec: spec({ filters: [{ dimension: 'department', operator: 'eq', value: 'People' }] }),
    })))).toThrowError(new AnalysisEngineError('ANALYSIS_DRILL_CONFLICT', 400))

    expect(() => validateAnalysisDrillRequest(request({ nextDimension: 'department' }))).toThrowError(
      new AnalysisEngineError('ANALYSIS_DRILL_DIMENSION_INVALID', 400),
    )
    expect(() => validateAnalysisDrillRequest(request({ nextDimension: 'tenant_id' }))).toThrowError(
      new AnalysisEngineError('ANALYSIS_DRILL_DIMENSION_INVALID', 400),
    )
  })

  it('verifies the visible context and executes the drilled spec with aggregate-only output', async () => {
    const authContext: AuthContext = {
      tenantId: 'tenant-a',
      hrGroupId: 'group-a',
      administrationId: null,
      userId: 'actor-a',
      employeeId: null,
      activeRoles: ['HR_ADMIN'],
      permissions: ['dashboard:read', 'employee:read'],
    }
    const records: readonly AnalysisEmployeeRecord[] = [
      { id: 'employee-1', tenantId: 'tenant-a', hrGroupId: 'group-a', department: 'Engineering', job: 'Developer', employmentStatus: 'ACTIVE_EMPLOYEE' },
      { id: 'employee-2', tenantId: 'tenant-a', hrGroupId: 'group-a', department: 'People', job: 'Partner', employmentStatus: 'ACTIVE_EMPLOYEE' },
    ]
    const retrieve = vi.fn(async () => records)
    const opened = await executeAnalysisDrill(request(), { getContext: async () => authContext, retrieve })

    expect(retrieve).toHaveBeenCalledTimes(1)
    expect(opened.analysisSpec.dimensions).toEqual(['job'])
    expect(opened.result.rows).toEqual([{ values: { dimension: 'Developer', headcount: 1 } }])
    expect(JSON.stringify(opened)).not.toContain('employee-1')
    await expect(executeAnalysisDrill(request({ contextValue: 'Missing' }), { getContext: async () => authContext, retrieve })).rejects.toMatchObject({
      code: 'ANALYSIS_DRILL_CONTEXT_INVALID',
    })
  })
})
