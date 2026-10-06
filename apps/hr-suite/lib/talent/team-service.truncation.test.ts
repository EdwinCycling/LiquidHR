import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requirePermission, requireTenantModule, createClient } = vi.hoisted(() => ({
  requirePermission: vi.fn(async () => ({
    tenantId: 'tenant-1',
    employeeId: 'manager-1',
    permissions: ['talent:manage'],
  })),
  requireTenantModule: vi.fn(async () => undefined),
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ requirePermission }))
vi.mock('@/lib/modules/module-service', () => ({ requireTenantModule }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { listTalentTeamMatrix } from './team-service'

type QueryResult = {
  data: Array<Record<string, unknown>> | null
  error: null | { message: string }
  count: number | null
}

function makeQuery(result: QueryResult, selectCalls: Array<{ columns: string; options?: { count: string } }>, limits: number[]) {
  const query = {
    select: vi.fn((columns: string, options?: { count: string }) => {
      selectCalls.push({ columns, options })
      return query
    }),
    eq: vi.fn(() => query),
    lte: vi.fn(() => query),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn((limit: number) => {
      limits.push(limit)
      return query
    }),
    in: vi.fn(() => query),
    is: vi.fn(() => query),
    then: (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  }
  return query
}

describe('listTalentTeamMatrix source bounds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requests exact source counts and reports either bounded query as truncated', async () => {
    const selectCalls: Array<{ columns: string; options?: { count: string } }> = []
    const limits: number[] = []
    const results: Record<string, QueryResult> = {
      employee_organizations: {
        data: [{ employee_id: 'employee-1', job_title: 'Planner', department_id: 'department-1', job_id: null, effective_from: '2026-01-01' }],
        error: null,
        count: 2,
      },
      employees: {
        data: [{ id: 'employee-1', employee_number: 'E-001', first_name: 'Taylor', birth_name: 'Example' }],
        error: null,
        count: null,
      },
      talent_employee_capability_records: {
        data: [{ id: 'record-1', employee_id: 'employee-1', capability_id: 'capability-1', status: 'RELEASED', source_type: 'MANAGER_ENTERED', valid_from: '2026-01-01', valid_until: null, certificate_status: null, evidence_status: null, certificate_code: null }],
        error: null,
        count: 2,
      },
      talent_capabilities: {
        data: [{ id: 'capability-1', code: 'PLAN', name: 'Planning', capability_type: 'SKILL' }],
        error: null,
        count: null,
      },
    }
    vi.mocked(createClient).mockResolvedValue({
      from: (table: string) => makeQuery(results[table] ?? { data: [], error: null, count: 0 }, selectCalls, limits),
    } as never)

    const result = await listTalentTeamMatrix()

    expect(result.sourceTruncated).toBe(true)
    expect(result.rows).toHaveLength(1)
    expect(selectCalls.filter((call) => call.options?.count === 'exact')).toHaveLength(2)
    expect(limits).toEqual(expect.arrayContaining([5000, 10000]))
  })

  it('fails closed if an exact count was not returned for a bounded source query', async () => {
    const selectCalls: Array<{ columns: string; options?: { count: string } }> = []
    const limits: number[] = []
    vi.mocked(createClient).mockResolvedValue({
      from: () => makeQuery({ data: [], error: null, count: null }, selectCalls, limits),
    } as never)

    await expect(listTalentTeamMatrix()).rejects.toMatchObject({
      code: 'TALENT_TEAM_SCOPE_READ_FAILED',
      status: 500,
    })
  })
})
