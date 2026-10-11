import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  loadAccessibleContextOptions: vi.fn(),
  requireAuthContext: vi.fn(),
}))

vi.mock('@/lib/context/server-context', () => ({ loadAccessibleContextOptions: authMocks.loadAccessibleContextOptions }))
vi.mock('@/lib/auth/permissions', () => ({ requireAuthContext: authMocks.requireAuthContext }))

import { resolveDirectManagerContext } from './manager-context'

const USER_ID = 'manager-user'
const EMPLOYEE_ID = 'manager-employee'
const TODAY = new Date().toISOString().slice(0, 10)

interface QueryCall {
  readonly method: string
  readonly column?: string
  readonly value?: unknown
}

interface FakeQuery {
  select(columns: string): FakeQuery
  eq(column: string, value: unknown): FakeQuery
  in(column: string, value: readonly string[]): FakeQuery
  lte(column: string, value: string): FakeQuery
  or(value: string): FakeQuery
  is(column: string, value: unknown): FakeQuery
  limit(value: number): Promise<{ data: Array<Record<string, unknown>>; error: null }>
}

function contextOptions(administrationIds: readonly string[]) {
  return [{
    id: 'tenant-1',
    name: 'Synthetic tenant',
    slug: 'synthetic',
    administrationMode: 'SEPARATE' as const,
    sharingMode: 'FULLY_ISOLATED' as const,
    hrGroups: [{
      id: 'group-1',
      tenantId: 'tenant-1',
      code: 'OWN',
      name: 'Own group',
      description: null,
      administrations: administrationIds.map((id) => ({ id, code: id, name: id })),
    }],
  }]
}

function fakeClient(employmentRows: Array<Record<string, unknown>>) {
  const calls: QueryCall[] = []
  const query: FakeQuery = {
    select(columns) { calls.push({ method: 'select', value: columns }); return query },
    eq(column, value) { calls.push({ method: 'eq', column, value }); return query },
    in(column, value) { calls.push({ method: 'in', column, value }); return query },
    lte(column, value) { calls.push({ method: 'lte', column, value }); return query },
    or(value) { calls.push({ method: 'or', value }); return query },
    is(column, value) { calls.push({ method: 'is', column, value }); return query },
    async limit(value) {
      calls.push({ method: 'limit', value })
      return { data: employmentRows, error: null }
    },
  }
  return { client: { from: vi.fn(() => query) }, calls }
}

function employment(administrationId: string, startsOn: string, endsOn: string | null = null) {
  return { administration_id: administrationId, starts_on: startsOn, ends_on: endsOn }
}

describe('direct Manager context resolution', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    authMocks.loadAccessibleContextOptions.mockImplementation(async (userId: string) => ({
      userId,
      tenants: contextOptions(['admin-own']),
    }))
    authMocks.requireAuthContext.mockImplementation(async (_client: unknown, activeContext: {
      tenant: { id: string }
      activeHrGroup: { id: string }
      activeAdministration: { id: string }
    }) => ({
      tenantId: activeContext.tenant.id,
      hrGroupId: activeContext.activeHrGroup.id,
      administrationId: activeContext.activeAdministration.id,
      userId: USER_ID,
      employeeId: EMPLOYEE_ID,
      activeRoles: ['DIRECT_MANAGER'],
      permissions: ['talent-team:read'],
      focusExperience: 'EMPLOYEE',
    }))
  })

  it('binds to the one current manager administration and ignores stale or future employment rows', async () => {
    const { client, calls } = fakeClient([
      employment('admin-own', '2026-01-01'),
      employment('admin-ended', '2020-01-01', '2020-01-02'),
      employment('admin-future', '2999-01-01'),
    ])

    await expect(resolveDirectManagerContext(client as never, USER_ID)).resolves.toMatchObject({
      kind: 'resolved',
      context: {
        tenantId: 'tenant-1',
        hrGroupId: 'group-1',
        administrationId: 'admin-own',
        employeeId: EMPLOYEE_ID,
        activeRoles: ['DIRECT_MANAGER'],
      },
    })
    expect(authMocks.loadAccessibleContextOptions).toHaveBeenCalledWith(USER_ID, client, { requireComplete: true })
    expect(calls).toContainEqual({ method: 'eq', column: 'employee_id', value: EMPLOYEE_ID })
    expect(calls).toContainEqual({ method: 'eq', column: 'tenant_id', value: 'tenant-1' })
    expect(calls).toContainEqual({ method: 'eq', column: 'hr_group_id', value: 'group-1' })
    expect(calls).toContainEqual({ method: 'in', column: 'administration_id', value: ['admin-own'] })
    expect(calls).toContainEqual({ method: 'eq', column: 'record_status', value: 'CONFIRMED' })
    expect(calls).toContainEqual({ method: 'lte', column: 'starts_on', value: TODAY })
    expect(calls).toContainEqual({ method: 'is', column: 'deleted_at', value: null })
  })

  it('requires a unique current administration and fails closed on ambiguous scope', async () => {
    authMocks.loadAccessibleContextOptions.mockImplementationOnce(async (userId: string) => ({
      userId,
      tenants: contextOptions(['admin-own', 'admin-second']),
    }))
    const { client } = fakeClient([
      employment('admin-own', '2026-01-01'),
      employment('admin-second', '2026-01-01'),
    ])

    await expect(resolveDirectManagerContext(client as never, USER_ID)).resolves.toEqual({ kind: 'selection-required' })
  })

  it('does not derive Manager scope from HR access and rejects user identity mismatches', async () => {
    authMocks.requireAuthContext.mockImplementationOnce(async () => ({
      tenantId: 'tenant-1',
      hrGroupId: 'group-1',
      administrationId: 'admin-own',
      userId: USER_ID,
      employeeId: EMPLOYEE_ID,
      activeRoles: ['HR_ADMIN'],
      permissions: ['talent:manage'],
      focusExperience: 'EMPLOYEE',
    }))
    const { client } = fakeClient([employment('admin-own', '2026-01-01')])
    await expect(resolveDirectManagerContext(client as never, USER_ID)).resolves.toEqual({ kind: 'none' })

    authMocks.requireAuthContext.mockImplementationOnce(async () => ({
      tenantId: 'tenant-1',
      hrGroupId: 'group-1',
      administrationId: 'admin-own',
      userId: 'other-user',
      employeeId: EMPLOYEE_ID,
      activeRoles: ['DIRECT_MANAGER'],
      permissions: ['talent-team:read'],
      focusExperience: 'EMPLOYEE',
    }))
    const second = fakeClient([employment('admin-own', '2026-01-01')])
    await expect(resolveDirectManagerContext(second.client as never, USER_ID)).resolves.toEqual({ kind: 'none' })
  })

  it('fails closed when context discovery is incomplete or too large', async () => {
    authMocks.loadAccessibleContextOptions.mockRejectedValueOnce(new Error('context lookup incomplete'))
    const failed = fakeClient([])
    await expect(resolveDirectManagerContext(failed.client as never, USER_ID)).resolves.toEqual({ kind: 'unavailable' })

    authMocks.loadAccessibleContextOptions.mockResolvedValueOnce({
      userId: USER_ID,
      tenants: contextOptions(Array.from({ length: 101 }, (_value, index) => `admin-${index}`)),
    })
    const large = fakeClient([])
    await expect(resolveDirectManagerContext(large.client as never, USER_ID)).resolves.toEqual({ kind: 'selection-required' })
    expect(authMocks.requireAuthContext).not.toHaveBeenCalled()
  })
})
