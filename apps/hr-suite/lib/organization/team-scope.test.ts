import { beforeEach, describe, expect, it, vi } from 'vitest'

const scopeMocks = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: scopeMocks.createClient }))

import { isEmployeeOutsideDirectManagerScope, listDirectTeamEmployeeIds, listDirectTeamEmployeeScope } from './team-scope'

interface QueryCall {
  readonly method: string
  readonly column?: string
  readonly value?: unknown
}

interface FakeQuery {
  select(columns: string, options?: { count?: string }): FakeQuery
  eq(column: string, value: unknown): FakeQuery
  neq(column: string, value: unknown): FakeQuery
  lte(column: string, value: string): FakeQuery
  or(value: string): FakeQuery
  order(column: string, options?: { ascending?: boolean }): FakeQuery
  limit(value: number): Promise<{ data: Array<Record<string, unknown>>; error: null; count: number | null }>
}

const context = {
  tenantId: 'tenant-own',
  hrGroupId: 'group-own',
  administrationId: 'admin-own',
  userId: 'manager-user',
  employeeId: 'manager-employee',
  activeRoles: ['DIRECT_MANAGER'],
  permissions: ['talent-team:read'],
}

function placement(employeeId: string, effectiveFrom: string) {
  return {
    employee_id: employeeId,
    job_title: 'Planner',
    department_id: 'department-own',
    job_id: 'job-own',
    effective_from: effectiveFrom,
  }
}

function fakeClient(input: {
  rows?: Array<Record<string, unknown>>
  count?: number | null
  error?: unknown
} = {}) {
  const calls: QueryCall[] = []
  const query: FakeQuery = {
    select(columns, options) { calls.push({ method: 'select', value: { columns, options } }); return query },
    eq(column, value) { calls.push({ method: 'eq', column, value }); return query },
    neq(column, value) { calls.push({ method: 'neq', column, value }); return query },
    lte(column, value) { calls.push({ method: 'lte', column, value }); return query },
    or(value) { calls.push({ method: 'or', value }); return query },
    order(column, options) { calls.push({ method: 'order', column, value: options }); return query },
    async limit(value) {
      calls.push({ method: 'limit', value })
      return {
        data: input.rows ?? [],
        error: (input.error ?? null) as null,
        count: input.count === undefined ? 0 : input.count,
      }
    },
  }
  const client = { from: vi.fn(() => query) }
  return { client, calls }
}

describe('direct manager team scope', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries current placements by tenant, group, administration, and direct manager, then deduplicates members', async () => {
    const sixDirectEmployees = [
      placement('employee-1', '2026-08-01'),
      ...Array.from({ length: 5 }, (_, index) => placement(`employee-${index + 2}`, `2026-0${index + 2}-01`)),
    ]
    const { client, calls } = fakeClient({
      rows: [sixDirectEmployees[0]!, placement('employee-1', '2026-01-01'), ...sixDirectEmployees.slice(1)],
      count: 7,
    })

    const scope = await listDirectTeamEmployeeScope(context, client as never, 25, '2026-10-11')

    expect(scope.employeeIds).toEqual(['employee-1', 'employee-2', 'employee-3', 'employee-4', 'employee-5', 'employee-6'])
    expect(scope.members).toHaveLength(6)
    expect(scope.members[0]?.effective_from).toBe('2026-08-01')
    expect(scope.sourceTruncated).toBe(false)
    expect(scope.employeeIds.every((employeeId) => !isEmployeeOutsideDirectManagerScope(context, employeeId, scope.employeeIds))).toBe(true)
    expect(isEmployeeOutsideDirectManagerScope(context, 'employee-outside-team', scope.employeeIds)).toBe(true)
    expect(calls).toContainEqual({ method: 'eq', column: 'tenant_id', value: 'tenant-own' })
    expect(calls).toContainEqual({ method: 'eq', column: 'hr_group_id', value: 'group-own' })
    expect(calls).toContainEqual({ method: 'eq', column: 'administration_id', value: 'admin-own' })
    expect(calls).toContainEqual({ method: 'eq', column: 'direct_manager_id', value: 'manager-employee' })
    expect(calls).toContainEqual({ method: 'neq', column: 'employee_id', value: 'manager-employee' })
    expect(calls).toContainEqual({ method: 'lte', column: 'effective_from', value: '2026-10-11' })
    expect(calls).toContainEqual({ method: 'or', value: 'effective_to.is.null,effective_to.gte.2026-10-11' })
    expect(calls).toContainEqual({ method: 'limit', value: 25 })
  })

  it('reports truncated source data and preserves the shared ID helper contract', async () => {
    const { client } = fakeClient({ rows: [placement('employee-1', '2026-08-01')], count: 2 })

    await expect(listDirectTeamEmployeeScope(context, client as never, 1, '2026-10-11')).resolves.toMatchObject({
      employeeIds: ['employee-1'],
      sourceTruncated: true,
    })
    await expect(listDirectTeamEmployeeIds(context, client as never)).resolves.toEqual(['employee-1'])
  })

  it('returns no team scope without an active Direct Manager role or administration', async () => {
    const { client } = fakeClient()
    await expect(listDirectTeamEmployeeScope({ ...context, activeRoles: ['EMPLOYEE'] }, client as never)).resolves.toEqual({
      members: [],
      employeeIds: [],
      sourceTruncated: false,
    })
    await expect(listDirectTeamEmployeeScope({ ...context, administrationId: null }, client as never)).resolves.toEqual({
      members: [],
      employeeIds: [],
      sourceTruncated: false,
    })
    expect(client.from).not.toHaveBeenCalled()
  })

  it('fails closed when the exact count cannot be established', async () => {
    const { client } = fakeClient({ count: null })
    await expect(listDirectTeamEmployeeScope(context, client as never)).rejects.toThrow('DIRECT_TEAM_SCOPE_COUNT_UNAVAILABLE')
  })
})
