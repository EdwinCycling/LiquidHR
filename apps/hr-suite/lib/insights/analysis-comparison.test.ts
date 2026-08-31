import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { AuthContext } from '@/lib/auth/permissions'
import { AnalysisEngineError } from './analysis-errors'
import { buildComparisonSpecs, executeAnalysisComparison } from './analysis-comparison'
import type { AnalysisEmployeeRecord } from './analysis-engine'
import { validateAnalysisComparisonRequest } from './analysis-comparison'

function context(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    tenantId: 'tenant-a',
    hrGroupId: 'group-a',
    administrationId: null,
    userId: 'actor-a',
    employeeId: null,
    activeRoles: ['HR_ADMIN'],
    permissions: ['dashboard:read', 'employee:read'],
    ...overrides,
  }
}

function spec(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    source: 'workforce',
    entity: 'employees',
    measures: ['headcount'],
    dimensions: [],
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
    comparisonDimension: 'department',
    comparisonValues: ['Sales', 'Engineering'],
    ...overrides,
  }
}

const records: readonly AnalysisEmployeeRecord[] = [
  { id: 'employee-1', tenantId: 'tenant-a', hrGroupId: 'group-a', department: 'Sales', job: 'Consultant', employmentStatus: 'ACTIVE_EMPLOYEE' },
  { id: 'employee-2', tenantId: 'tenant-a', hrGroupId: 'group-a', department: 'Sales', job: 'Consultant', employmentStatus: 'FORMER_EMPLOYEE' },
  { id: 'employee-3', tenantId: 'tenant-a', hrGroupId: 'group-a', department: 'Sales', job: 'Manager', employmentStatus: 'ACTIVE_EMPLOYEE' },
  { id: 'employee-4', tenantId: 'tenant-a', hrGroupId: 'group-a', department: 'Engineering', job: 'Consultant', employmentStatus: 'ACTIVE_EMPLOYEE' },
  { id: 'employee-5', tenantId: 'tenant-a', hrGroupId: 'group-a', department: 'Engineering', job: 'Manager', employmentStatus: 'ACTIVE_EMPLOYEE' },
  { id: 'employee-6', tenantId: 'tenant-a', hrGroupId: 'group-a', department: 'Engineering', job: 'Developer', employmentStatus: 'ACTIVE_EMPLOYEE' },
  { id: 'employee-7', tenantId: 'tenant-a', hrGroupId: 'group-a', department: 'People', job: null, employmentStatus: 'FUTURE_EMPLOYEE' },
]

function execute(input: unknown, requestedContext = context(), requestedRecords = records) {
  const retrieve = vi.fn(async () => requestedRecords)
  return { retrieve, result: executeAnalysisComparison(input, { getContext: async () => requestedContext, retrieve }) }
}

describe('AN-6 comparison', () => {
  it('compares two departments as KPI values with a signed difference', async () => {
    const result = await execute(request()).result
    expect(result).toMatchObject({
      comparisonValues: ['Sales', 'Engineering'],
      breakdownDimension: null,
      summary: { left: 3, right: 3, difference: 0 },
      presentation: 'kpi',
    })
  })

  it('aligns two departments by job and fills a missing side with zero', async () => {
    const result = await execute(request({ analysisSpec: spec({ dimensions: ['job'], sort: { by: 'label', direction: 'asc' } }) })).result
    expect(result.breakdownDimension).toBe('job')
    expect(result.rows).toEqual([
      { dimension: 'Consultant', left: 2, right: 1, difference: 1 },
      { dimension: 'Developer', left: 0, right: 1, difference: -1 },
      { dimension: 'Manager', left: 1, right: 1, difference: 0 },
    ])
  })

  it('compares jobs by employment status and handles a zero aggregate', async () => {
    const result = await execute(request({
      analysisSpec: spec({ dimensions: ['employment_status'] }),
      comparisonDimension: 'job',
      comparisonValues: ['Consultant', 'Developer'],
    })).result
    expect(result.rows).toEqual([
      { dimension: 'ACTIVE_EMPLOYEE', left: 2, right: 1, difference: 1 },
      { dimension: 'FORMER_EMPLOYEE', left: 1, right: 0, difference: 1 },
    ])
    expect(result.summary).toEqual({ left: 3, right: 1, difference: 2 })
  })

  it('uses strict specs, rejects identical/unsupported values and does not expose source records', async () => {
    const parsed = validateAnalysisComparisonRequest(request())
    const [left, right] = buildComparisonSpecs(parsed)
    expect(left.filters).toEqual([{ dimension: 'department', operator: 'eq', value: 'Sales' }])
    expect(right.filters).toEqual([{ dimension: 'department', operator: 'eq', value: 'Engineering' }])
    expect(() => validateAnalysisComparisonRequest(request({ comparisonValues: ['Sales', 'Sales'] }))).toThrowError(
      new AnalysisEngineError('ANALYSIS_COMPARISON_INVALID_REQUEST', 400),
    )
    await expect(execute(request({ comparisonValues: ['Sales', 'Not a department'] })).result).rejects.toMatchObject({
      code: 'ANALYSIS_COMPARISON_VALUE_NOT_AUTHORIZED',
    })

    const result = await execute(request()).result
    expect(JSON.stringify(result)).not.toContain('employee-1')
    expect(JSON.stringify(result)).not.toContain('tenant-a')
  })

  it('authorizes before retrieval and rejects out-of-scope records', async () => {
    const unauthorized = execute(request(), context({ permissions: ['dashboard:read'] }))
    await expect(unauthorized.result).rejects.toMatchObject({ code: 'ANALYSIS_UNAUTHORIZED', status: 403 })
    expect(unauthorized.retrieve).not.toHaveBeenCalled()

    await expect(execute(request(), context(), [{ ...records[0], tenantId: 'tenant-b' }]).result).rejects.toMatchObject({
      code: 'ANALYSIS_SCOPE_VIOLATION',
      status: 403,
    })
  })

  it('rejects a comparison dimension already used as the output or filter context', () => {
    expect(() => validateAnalysisComparisonRequest(request({ analysisSpec: spec({ dimensions: ['department'] }) }))).toThrowError(
      new AnalysisEngineError('ANALYSIS_COMPARISON_CONTEXT_CONFLICT', 400),
    )
    expect(() => validateAnalysisComparisonRequest(request({ analysisSpec: spec({ filters: [{ dimension: 'department', operator: 'eq', value: 'Sales' }] }) }))).toThrowError(
      new AnalysisEngineError('ANALYSIS_COMPARISON_CONTEXT_CONFLICT', 400),
    )
  })
})
