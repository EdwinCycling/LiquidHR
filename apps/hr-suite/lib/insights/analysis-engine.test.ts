import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { AuthContext } from '@/lib/auth/permissions'
import { AnalysisEngineError } from './analysis-errors'
import { executeAnalysisSpec, type AnalysisEmployeeRecord } from './analysis-engine'
import { validateAnalysisSpec } from './analysis-spec'

function context(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    tenantId: 'tenant-a',
    hrGroupId: 'hr-group-a',
    administrationId: null,
    userId: 'actor-a',
    employeeId: null,
    activeRoles: ['HR_ADMIN'],
    permissions: ['dashboard:read', 'employee:read'],
    ...overrides,
  }
}

function spec(overrides: Record<string, unknown> = {}) {
  return validateAnalysisSpec({
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
  })
}

const records: readonly AnalysisEmployeeRecord[] = [
  { id: 'employee-1', tenantId: 'tenant-a', hrGroupId: 'hr-group-a', department: 'Engineering', job: 'Developer', employmentStatus: 'ACTIVE_EMPLOYEE' },
  { id: 'employee-2', tenantId: 'tenant-a', hrGroupId: 'hr-group-a', department: 'Engineering', job: 'Designer', employmentStatus: 'ACTIVE_EMPLOYEE' },
  { id: 'employee-3', tenantId: 'tenant-a', hrGroupId: 'hr-group-a', department: 'People', job: null, employmentStatus: 'FUTURE_EMPLOYEE' },
  { id: 'employee-4', tenantId: 'tenant-a', hrGroupId: 'hr-group-a', department: null, job: 'Developer', employmentStatus: 'FORMER_EMPLOYEE' },
]

function run(
  requestedSpec = spec(),
  requestedContext = context(),
  requestedRecords = records,
) {
  const retrieve = vi.fn(async () => requestedRecords)
  return {
    retrieve,
    result: executeAnalysisSpec(requestedSpec, {
      getContext: async () => requestedContext,
      retrieve,
    }),
  }
}

describe('Analysis Engine V1', () => {
  it('retrieves after authorization and returns a deterministic KPI result', async () => {
    const first = run()
    const firstResult = await first.result
    const second = run()
    const secondResult = await second.result

    expect(first.retrieve).toHaveBeenCalledTimes(1)
    expect(firstResult).toEqual(secondResult)
    expect(firstResult.summary).toEqual({ headcount: 4 })
    expect(firstResult.columns).toEqual([{ key: 'headcount', dataType: 'integer' }])
    expect(firstResult.presentationHints.preferred).toBe('kpi')
    expect(JSON.stringify(firstResult)).not.toContain('employee-1')
    expect(JSON.stringify(firstResult)).not.toContain('tenant-a')
  })

  it('uses count-distinct employee semantics if a source repeats an employee row', async () => {
    const result = await run(spec(), context(), [...records, { ...records[0], department: 'People' }]).result

    expect(result.summary).toEqual({ headcount: 4 })
    expect(result.metadata.matchedRecordCount).toBe(4)
  })

  it('applies an authorized filter and groups deterministically by department', async () => {
    const execution = run(spec({
      dimensions: ['department'],
      filters: [{ dimension: 'employment_status', operator: 'eq', value: 'ACTIVE_EMPLOYEE' }],
      sort: { by: 'value', direction: 'desc' },
      presentation: 'table',
    }))
    const result = await execution.result

    expect(result.metadata).toEqual({ matchedRecordCount: 2, groupCount: 1 })
    expect(result.rows).toEqual([{ values: { dimension: 'Engineering', headcount: 2 } }])
    expect(result.presentationHints.preferred).toBe('table')
  })

  it('keeps unknown dimension values visible as an explicit null group', async () => {
    const result = await run(spec({ dimensions: ['job'], presentation: 'table' })).result

    expect(result.rows).toEqual([
      { values: { dimension: 'Developer', headcount: 2 } },
      { values: { dimension: 'Designer', headcount: 1 } },
      { values: { dimension: null, headcount: 1 } },
    ])
  })

  it('rejects an unauthorized actor before retrieval', async () => {
    const execution = run(spec(), context({ permissions: ['dashboard:read'] }))

    await expect(execution.result).rejects.toMatchObject({
      code: 'ANALYSIS_UNAUTHORIZED',
      status: 403,
    })
    expect(execution.retrieve).not.toHaveBeenCalled()
  })

  it('requires the existing Analysis hub permission as well as data permission', async () => {
    const execution = run(spec(), context({ permissions: ['employee:read'] }))

    await expect(execution.result).rejects.toMatchObject({ code: 'ANALYSIS_UNAUTHORIZED' })
    expect(execution.retrieve).not.toHaveBeenCalled()
  })

  it('denies a record from another tenant without returning a result', async () => {
    const execution = run(spec(), context(), [{ ...records[0], tenantId: 'tenant-b' }])

    await expect(execution.result).rejects.toBeInstanceOf(AnalysisEngineError)
    await expect(execution.result).rejects.toMatchObject({ code: 'ANALYSIS_SCOPE_VIOLATION', status: 403 })
  })

  it('denies a record from another HR group without returning a result', async () => {
    const execution = run(spec(), context(), [{ ...records[0], hrGroupId: 'hr-group-b' }])

    await expect(execution.result).rejects.toMatchObject({ code: 'ANALYSIS_SCOPE_VIOLATION', status: 403 })
  })

  it('fails closed when the HR-group context is absent', async () => {
    const execution = run(spec(), context({ hrGroupId: undefined }))

    await expect(execution.result).rejects.toMatchObject({ code: 'ANALYSIS_UNAUTHORIZED', status: 403 })
    expect(execution.retrieve).not.toHaveBeenCalled()
  })
})
