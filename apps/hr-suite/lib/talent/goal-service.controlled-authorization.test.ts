import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import type { TalentGoalCreateInput } from './goal-schemas'

const authMocks = vi.hoisted(() => ({
  AuthorizationError: class MockAuthorizationError extends Error {},
  requireAuthContext: vi.fn(),
  requireHrGroupId: vi.fn((context: { hrGroupId?: string }) => context.hrGroupId ?? ''),
  requirePermission: vi.fn(),
  requireTenantModule: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  AuthorizationError: authMocks.AuthorizationError,
  requireAuthContext: authMocks.requireAuthContext,
  requireHrGroupId: authMocks.requireHrGroupId,
  requirePermission: authMocks.requirePermission,
}))
vi.mock('@/lib/modules/module-service', () => ({ requireTenantModule: authMocks.requireTenantModule }))
vi.mock('@/lib/supabase/server', () => ({ createClient: authMocks.createClient }))

import { authorizeTalentGoalCreate } from './goal-service'

const ids = {
  tenant: '10000000-0000-4000-8000-000000000001',
  hrGroup: '10000000-0000-4000-8000-000000000006',
  administration: '10000000-0000-4000-8000-000000000007',
  user: '10000000-0000-4000-8000-000000000002',
  employee: '10000000-0000-4000-8000-000000000003',
  directReport: '10000000-0000-4000-8000-000000000004',
  otherEmployee: '10000000-0000-4000-8000-000000000005',
}

type QueryPayload = { data: unknown; error: { message: string } | null }
type QueryFilter = { column: string; value: unknown }

class QueryStub {
  readonly filters: QueryFilter[] = []

  constructor(private readonly result: QueryPayload) {}

  select(): this { return this }
  eq(column: string, value: unknown): this { this.filters.push({ column, value }); return this }
  is(column: string, value: unknown): this { this.filters.push({ column, value }); return this }
  lte(column: string, value: unknown): this { this.filters.push({ column, value }); return this }
  or(): this { return this }
  limit(): this { return this }
  maybeSingle(): Promise<QueryPayload> { return Promise.resolve(this.result) }
  then<TResult1 = QueryPayload, TResult2 = never>(
    onfulfilled?: ((value: QueryPayload) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected)
  }
}

const goalInput: TalentGoalCreateInput = {
  title: 'Klantgesprekken verbeteren',
  periodStart: '2026-10-01',
  progressPercent: 0,
  status: 'DRAFT',
}

function makeContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    tenantId: ids.tenant,
    hrGroupId: ids.hrGroup,
    administrationId: null,
    userId: ids.user,
    employeeId: ids.employee,
    activeRoles: ['EMPLOYEE'],
    permissions: ['self:talent-goal:write'],
    ...overrides,
  }
}

function mockScopeReads(options: {
  employee?: { id: string } | null
  employeeError?: string
  placements?: Array<{ employee_id: string; direct_manager_id: string | null }>
  placementError?: string
} = {}): { employeeQuery: QueryStub; placementQuery: QueryStub } {
  const employeeQuery = new QueryStub({
    data: options.employee === undefined ? { id: ids.employee } : options.employee,
    error: options.employeeError ? { message: options.employeeError } : null,
  })
  const placementQuery = new QueryStub({
    data: options.placements ?? [],
    error: options.placementError ? { message: options.placementError } : null,
  })
  authMocks.createClient.mockResolvedValue({
    from: vi.fn((table: string) => table === 'employees' ? employeeQuery : placementQuery),
  } as never)
  return { employeeQuery, placementQuery }
}

describe('controlled development-goal create authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMocks.requireTenantModule.mockResolvedValue(undefined)
    authMocks.requirePermission.mockResolvedValue(undefined)
  })

  it('allows an Employee self-action after checking active employee and HR-group scope', async () => {
    authMocks.requireAuthContext.mockResolvedValue(makeContext())
    const { employeeQuery, placementQuery } = mockScopeReads({ employee: { id: ids.employee } })

    await expect(authorizeTalentGoalCreate(goalInput)).resolves.toMatchObject({
      targetEmployeeId: ids.employee,
      context: { activeRoles: ['EMPLOYEE'] },
    })
    expect(authMocks.requireTenantModule).toHaveBeenCalledWith('TALENT')
    expect(authMocks.requirePermission).toHaveBeenCalledWith('talent-goal:write', ids.employee)
    expect(employeeQuery.filters).toContainEqual({ column: 'tenant_id', value: ids.tenant })
    expect(employeeQuery.filters).toContainEqual({ column: 'hr_group_id', value: ids.hrGroup })
    expect(employeeQuery.filters).toContainEqual({ column: 'is_active', value: true })
    expect(employeeQuery.filters).toContainEqual({ column: 'is_archived', value: false })
    expect(placementQuery.filters).toHaveLength(0)
  })

  it('allows a Manager direct report only when the current placement binds the Manager and target', async () => {
    authMocks.requireAuthContext.mockResolvedValue(makeContext({
      activeRoles: ['DIRECT_MANAGER'],
      permissions: ['talent-goal:write'],
    }))
    const { placementQuery } = mockScopeReads({
      employee: { id: ids.directReport },
      placements: [{ employee_id: ids.directReport, direct_manager_id: ids.employee }],
    })

    await expect(authorizeTalentGoalCreate({ ...goalInput, employeeId: ids.directReport }))
      .resolves.toMatchObject({ targetEmployeeId: ids.directReport })
    expect(authMocks.requirePermission).toHaveBeenCalledWith('talent-goal:write', ids.directReport)
    expect(placementQuery.filters).toContainEqual({ column: 'hr_group_id', value: ids.hrGroup })
    expect(placementQuery.filters).toContainEqual({ column: 'direct_manager_id', value: ids.employee })
  })

  it('denies a same-group employee who is not a current direct report before draft creation', async () => {
    authMocks.requireAuthContext.mockResolvedValue(makeContext({
      activeRoles: ['DIRECT_MANAGER'],
      permissions: ['talent-goal:write'],
    }))
    mockScopeReads({ employee: { id: ids.otherEmployee } })

    await expect(authorizeTalentGoalCreate({ ...goalInput, employeeId: ids.otherEmployee }))
      .rejects.toMatchObject({ code: 'TALENT_GOAL_FORBIDDEN', status: 403 })
  })

  it('denies a target in another HR group', async () => {
    authMocks.requireAuthContext.mockResolvedValue(makeContext({
      activeRoles: ['DIRECT_MANAGER'],
      permissions: ['talent-goal:write'],
    }))
    const { employeeQuery, placementQuery } = mockScopeReads({ employee: null })

    await expect(authorizeTalentGoalCreate({ ...goalInput, employeeId: ids.otherEmployee }))
      .rejects.toMatchObject({ code: 'TALENT_GOAL_FORBIDDEN', status: 403 })
    expect(employeeQuery.filters).toContainEqual({ column: 'hr_group_id', value: ids.hrGroup })
    expect(placementQuery.filters).toHaveLength(0)
  })

  it('denies an HR Admin target outside the selected administration', async () => {
    authMocks.requireAuthContext.mockResolvedValue(makeContext({
      administrationId: ids.administration,
      activeRoles: ['HR_ADMIN'],
      permissions: ['talent-goal:manage'],
    }))
    const { placementQuery } = mockScopeReads({ employee: { id: ids.otherEmployee } })

    await expect(authorizeTalentGoalCreate({ ...goalInput, employeeId: ids.otherEmployee }))
      .rejects.toMatchObject({ code: 'TALENT_GOAL_FORBIDDEN', status: 403 })
    expect(authMocks.requirePermission).not.toHaveBeenCalled()
    expect(placementQuery.filters).toContainEqual({ column: 'administration_id', value: ids.administration })
  })

  it('allows an HR Admin target within the active HR group and administration', async () => {
    authMocks.requireAuthContext.mockResolvedValue(makeContext({
      administrationId: ids.administration,
      activeRoles: ['HR_ADMIN'],
      permissions: ['talent-goal:manage'],
    }))
    mockScopeReads({
      employee: { id: ids.otherEmployee },
      placements: [{ employee_id: ids.otherEmployee, direct_manager_id: null }],
    })

    await expect(authorizeTalentGoalCreate({ ...goalInput, employeeId: ids.otherEmployee }))
      .resolves.toMatchObject({ targetEmployeeId: ids.otherEmployee })
    expect(authMocks.requirePermission).not.toHaveBeenCalled()
  })

  it('denies a target-scope database read failure closed', async () => {
    authMocks.requireAuthContext.mockResolvedValue(makeContext())
    mockScopeReads({ employeeError: 'database unavailable' })

    await expect(authorizeTalentGoalCreate(goalInput))
      .rejects.toMatchObject({ code: 'TALENT_GOAL_SCOPE_READ_FAILED', status: 500 })
  })
})
