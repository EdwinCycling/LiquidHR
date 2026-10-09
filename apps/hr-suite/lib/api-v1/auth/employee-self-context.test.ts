import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  loadAccessibleContextOptions: vi.fn(),
  requireAuthContext: vi.fn(),
}))

vi.mock('@/lib/context/server-context', () => ({ loadAccessibleContextOptions: authMocks.loadAccessibleContextOptions }))
vi.mock('@/lib/auth/permissions', () => ({ requireAuthContext: authMocks.requireAuthContext }))

import { resolveEmployeeSelfContext } from './employee-self-context'

const USER_ID = 'synthetic-employee-user'
const EMPLOYEE_ID = 'employee-fixture-id'

interface QueryFilter {
  readonly method: string
  readonly column: string
  readonly value: unknown
}

function contextOptions(administrations: readonly string[] = ['admin-own']): unknown[] {
  return [{
    id: 'tenant-1',
    name: 'Synthetic tenant',
    slug: 'synthetic',
    administrationMode: 'SEPARATE',
    sharingMode: 'FULLY_ISOLATED',
    hrGroups: [
      {
        id: 'group-stale-admin',
        tenantId: 'tenant-1',
        code: 'ADMIN',
        name: 'Admin group',
        description: null,
        administrations: [{ id: 'admin-stale', code: 'A', name: 'Admin' }],
      },
      {
        id: 'group-stale-employee',
        tenantId: 'tenant-1',
        code: 'STALE',
        name: 'Stale Employee group',
        description: null,
        administrations: [{ id: 'admin-stale-employee', code: 'S', name: 'Stale' }],
      },
      {
        id: 'group-own',
        tenantId: 'tenant-1',
        code: 'OWN',
        name: 'Own Employee group',
        description: null,
        administrations: administrations.map((id) => ({ id, code: id, name: id })),
      },
    ],
  }]
}

function fakeSupabase(employmentRows: readonly Record<string, unknown>[], groupAccessRows?: readonly Record<string, unknown>[]) {
  const queries: Array<{ table: string; filters: QueryFilter[] }> = []
  const client = {
    from(table: string) {
      const query = { table, filters: [] as QueryFilter[] }
      queries.push(query)
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => { query.filters.push({ method: 'eq', column, value }); return builder },
        in: (column: string, value: unknown) => { query.filters.push({ method: 'in', column, value }); return builder },
        is: (column: string, value: unknown) => { query.filters.push({ method: 'is', column, value }); return builder },
        or: (value: string) => { query.filters.push({ method: 'or', column: '', value }); return builder },
        limit: async () => {
          const rows = table === 'user_hr_group_access'
            ? [...(groupAccessRows ?? [
              { tenant_id: 'tenant-1', hr_group_id: 'group-own', management_role_id: 'employee-role' },
              { tenant_id: 'tenant-1', hr_group_id: 'group-stale-employee', management_role_id: 'employee-role' },
              { tenant_id: 'tenant-1', hr_group_id: 'group-stale-admin', management_role_id: 'hr-role' },
            ])].map((row) => ({ user_id: USER_ID, is_active: true, ...row }))
            : table === 'management_roles'
              ? [{ id: 'employee-role', tenant_id: null, code: 'EMPLOYEE', is_active: true }]
              : table === 'employments'
                ? [...employmentRows]
                : []
          const filtered = rows.filter((row) => query.filters.every((filter) => {
            if (filter.method === 'eq') return row[filter.column] === filter.value
            if (filter.method === 'in') return Array.isArray(filter.value) && filter.value.includes(row[filter.column])
            if (filter.method === 'is') return row[filter.column] === filter.value
            return true
          }))
          return { data: filtered, error: null }
        },
      }
      return builder
    },
  }
  return { client, queries }
}

function employment(administrationId: string, hrGroupId = 'group-own', startsOn = '2026-01-01') {
  return {
    employee_id: EMPLOYEE_ID,
    tenant_id: 'tenant-1',
    hr_group_id: hrGroupId,
    administration_id: administrationId,
    starts_on: startsOn,
    ends_on: null,
    record_status: 'CONFIRMED',
    deleted_at: null,
  }
}

describe('APIAI-07 Employee self context resolution', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    authMocks.loadAccessibleContextOptions.mockImplementation(async (userId: string) => ({
      userId,
      tenants: contextOptions(),
    }))
    authMocks.requireAuthContext.mockImplementation(async (_supabase: unknown, activeContext: { tenant: { id: string }; activeHrGroup: { id: string }; activeAdministration: { id: string } }) => {
      const ownGroup = activeContext.activeHrGroup.id === 'group-own'
      return {
        tenantId: activeContext.tenant.id,
        hrGroupId: activeContext.activeHrGroup.id,
        administrationId: activeContext.activeAdministration.id,
        userId: USER_ID,
        employeeId: ownGroup ? EMPLOYEE_ID : null,
        activeRoles: ['EMPLOYEE'],
        permissions: ['self:talent-goal:read'],
        focusExperience: 'EMPLOYEE',
      }
    })
  })

  it('ignores stale admin and wrong-group contexts and binds to the only assigned Employee administration', async () => {
    const { client, queries } = fakeSupabase([employment('admin-own')])

    const result = await resolveEmployeeSelfContext(client as never, USER_ID)

    expect(result).toMatchObject({
      kind: 'resolved',
      context: { tenantId: 'tenant-1', hrGroupId: 'group-own', administrationId: 'admin-own', employeeId: EMPLOYEE_ID },
    })
    expect(authMocks.requireAuthContext).toHaveBeenCalledWith(client, expect.objectContaining({
      activeHrGroup: expect.objectContaining({ id: 'group-own' }),
      activeAdministration: expect.objectContaining({ id: 'admin-own' }),
    }))
    expect(authMocks.loadAccessibleContextOptions).toHaveBeenCalledWith(USER_ID, client, {
      includeFutureEmployment: true,
      requireComplete: true,
    })
    expect(queries.find((query) => query.table === 'user_hr_group_access')?.filters).toContainEqual({
      method: 'eq', column: 'user_id', value: USER_ID,
    })
    expect(queries.find((query) => query.table === 'employments')?.filters).toContainEqual({
      method: 'eq', column: 'employee_id', value: EMPLOYEE_ID,
    })
  })

  it('returns selection-required when more than one own group or administration is valid', async () => {
    authMocks.loadAccessibleContextOptions.mockImplementationOnce(async (userId: string) => ({
      userId,
      tenants: contextOptions(['admin-own', 'admin-second']),
    }))
    const { client } = fakeSupabase([
      employment('admin-own'),
      employment('admin-second'),
      employment('admin-own', 'group-stale-employee'),
    ])
    authMocks.requireAuthContext.mockImplementation(async (_supabase: unknown, activeContext: { tenant: { id: string }; activeHrGroup: { id: string }; activeAdministration: { id: string } }) => ({
      tenantId: activeContext.tenant.id,
      hrGroupId: activeContext.activeHrGroup.id,
      administrationId: activeContext.activeAdministration.id,
      userId: USER_ID,
      employeeId: EMPLOYEE_ID,
      activeRoles: ['EMPLOYEE'],
      permissions: [],
      focusExperience: 'EMPLOYEE',
    }))

    expect(await resolveEmployeeSelfContext(client as never, USER_ID)).toEqual({ kind: 'selection-required' })
  })

  it('fails closed with selection-required when the bounded administration list is exceeded', async () => {
    authMocks.loadAccessibleContextOptions.mockImplementationOnce(async (userId: string) => ({
      userId,
      tenants: contextOptions(Array.from({ length: 101 }, (_value, index) => `admin-${index}`)),
    }))
    const { client } = fakeSupabase([])

    expect(await resolveEmployeeSelfContext(client as never, USER_ID)).toEqual({ kind: 'selection-required' })
    expect(authMocks.requireAuthContext).not.toHaveBeenCalled()
  })

  it('returns no Employee self context for HR or Manager access alone', async () => {
    const { client } = fakeSupabase([], [
      { user_id: USER_ID, is_active: true, tenant_id: 'tenant-1', hr_group_id: 'group-stale-admin', management_role_id: 'hr-role' },
    ])

    expect(await resolveEmployeeSelfContext(client as never, USER_ID)).toEqual({ kind: 'none' })
  })

  it.each(['DIRECT_MANAGER', 'TEAM_LEAD', 'HR_ADMIN', 'TENANT_ADMIN'])('denies mixed Employee and %s roles in the selected group', async (role) => {
    const { client } = fakeSupabase([employment('admin-own')])
    authMocks.requireAuthContext.mockImplementation(async (_supabase: unknown, activeContext: { tenant: { id: string }; activeHrGroup: { id: string }; activeAdministration: { id: string } }) => ({
      tenantId: activeContext.tenant.id,
      hrGroupId: activeContext.activeHrGroup.id,
      administrationId: activeContext.activeAdministration.id,
      userId: USER_ID,
      employeeId: EMPLOYEE_ID,
      activeRoles: ['EMPLOYEE', role],
      permissions: [],
      focusExperience: 'EMPLOYEE',
    }))

    expect(await resolveEmployeeSelfContext(client as never, USER_ID)).toEqual({ kind: 'none' })
  })

  it('fails closed when the authenticated access result is not complete', async () => {
    authMocks.loadAccessibleContextOptions.mockRejectedValueOnce(new Error('context query truncated'))
    const { client } = fakeSupabase([employment('admin-own')])

    expect(await resolveEmployeeSelfContext(client as never, USER_ID)).toEqual({ kind: 'unavailable' })
  })

  it('accepts a confirmed future employment through the explicit preboarding self context', async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    authMocks.requireAuthContext.mockImplementation(async (_supabase: unknown, activeContext: { tenant: { id: string }; activeHrGroup: { id: string }; activeAdministration: { id: string } }) => ({
      tenantId: activeContext.tenant.id,
      hrGroupId: activeContext.activeHrGroup.id,
      administrationId: activeContext.activeAdministration.id,
      userId: USER_ID,
      employeeId: EMPLOYEE_ID,
      activeRoles: ['EMPLOYEE'],
      permissions: [],
      focusExperience: 'PREBOARDING',
    }))
    const { client } = fakeSupabase([employment('admin-own', 'group-own', future)])

    expect(await resolveEmployeeSelfContext(client as never, USER_ID)).toMatchObject({ kind: 'resolved', context: { focusExperience: 'PREBOARDING' } })
  })
})
