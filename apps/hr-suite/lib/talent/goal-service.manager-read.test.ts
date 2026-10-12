import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'

const authMocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requireTenantModule: vi.fn(),
  createClient: vi.fn(),
  listDirectTeamEmployeeScope: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth/permissions')>()
  return {
    ...original,
    requireHrGroupId: (context: { readonly hrGroupId?: string }) => context.hrGroupId ?? '',
    requirePermission: authMocks.requirePermission,
  }
})
vi.mock('@/lib/modules/module-service', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/modules/module-service')>()
  return { ...original, requireTenantModule: authMocks.requireTenantModule }
})
vi.mock('@/lib/supabase/server', () => ({ createClient: authMocks.createClient }))
vi.mock('@/lib/organization/team-scope', () => ({
  listDirectTeamEmployeeScope: authMocks.listDirectTeamEmployeeScope,
}))

import { listManagerTeamDevelopmentPlans } from './goal-service'

type QueryPayload = { data: unknown; count?: number | null; error: { message: string } | null }
type QueryFilter = { column: string; value: unknown }

class QueryStub {
  readonly filters: QueryFilter[] = []

  constructor(private readonly result: QueryPayload) {}

  select(): this { return this }
  eq(column: string, value: unknown): this { this.filters.push({ column, value }); return this }
  in(column: string, value: unknown): this { this.filters.push({ column, value }); return this }
  is(column: string, value: unknown): this { this.filters.push({ column, value }); return this }
  order(): this { return this }
  limit(): this { return this }
  then<TResult1 = QueryPayload, TResult2 = never>(
    onfulfilled?: ((value: QueryPayload) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected)
  }
}

const managerContext: AuthContext = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '10000000-0000-4000-8000-000000000002',
  administrationId: '10000000-0000-4000-8000-000000000003',
  userId: '10000000-0000-4000-8000-000000000004',
  employeeId: '10000000-0000-4000-8000-000000000005',
  activeRoles: ['DIRECT_MANAGER'],
  permissions: ['talent-goal:read'],
}

describe('Manager development-plan follow-up read', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMocks.requirePermission.mockResolvedValue(managerContext)
    authMocks.requireTenantModule.mockResolvedValue(undefined)
    authMocks.listDirectTeamEmployeeScope.mockResolvedValue({
      employeeIds: ['10000000-0000-4000-8000-000000000006'],
      sourceTruncated: false,
    })
  })

  it('returns only draft and active direct-team plans that still need follow-up', async () => {
    const employeeQuery = new QueryStub({
      data: [{ id: '10000000-0000-4000-8000-000000000006', first_name: 'Eva', birth_name: 'Jansen' }],
      error: null,
    })
    const goalsQuery = new QueryStub({
      data: [
        { employee_id: '10000000-0000-4000-8000-000000000006', period_start: '2026-01-01', period_end: null, progress_percent: 20, status: 'DRAFT', completed_at: null },
        { employee_id: '10000000-0000-4000-8000-000000000006', period_start: '2025-01-01', period_end: null, progress_percent: 80, status: 'ACTIVE', completed_at: null },
        { employee_id: '10000000-0000-4000-8000-000000000006', period_start: '2024-01-01', period_end: null, progress_percent: 100, status: 'COMPLETED', completed_at: '2024-12-01' },
        { employee_id: '10000000-0000-4000-8000-000000000006', period_start: '2023-01-01', period_end: null, progress_percent: 0, status: 'CANCELLED', completed_at: null },
      ],
      count: 2,
      error: null,
    })
    authMocks.createClient.mockResolvedValue({
      from: (table: string) => table === 'employees' ? employeeQuery : goalsQuery,
    } as never)

    const result = await listManagerTeamDevelopmentPlans()

    expect(goalsQuery.filters).toContainEqual({ column: 'status', value: ['DRAFT', 'ACTIVE'] })
    expect(result.plans.map((plan) => plan.status)).toEqual(['DRAFT', 'ACTIVE'])
    expect(result.sourceTruncated).toBe(true)
  })
})
