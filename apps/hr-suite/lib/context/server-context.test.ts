import { beforeEach, describe, expect, it, vi } from 'vitest'

const { cookies, createClient } = vi.hoisted(() => ({
  cookies: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('next/headers', () => ({ cookies }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { ContextAuthenticationError, loadAccessibleContextOptions, loadActiveContext } from './server-context'

interface QueryResult {
  data: unknown[]
  error: null
}

function query(result: QueryResult) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    is: () => builder,
    lte: () => builder,
    or: () => builder,
    order: () => builder,
    limit: () => Promise.resolve(result),
  }
  return builder
}

function fakeClient(withUser = true) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: withUser ? { claims: { sub: 'user-1' } } : { claims: null },
        error: null,
      }),
    },
    from(table: string) {
      if (table === 'user_hr_group_access') {
        return query({
          data: [
            { tenant_id: 'tenant-1', hr_group_id: 'group-a', management_role_id: 'tenant-admin-role' },
            { tenant_id: 'tenant-1', hr_group_id: 'group-b', management_role_id: 'tenant-admin-role' },
          ],
          error: null,
        })
      }
      if (table === 'user_access') {
        return query({
          data: [{ tenant_id: 'tenant-1', scope_type: 'TENANT', administration_id: null, hr_group_id: null }],
          error: null,
        })
      }
      if (table === 'management_roles') {
        return query({
          data: [{ id: 'tenant-admin-role', code: 'TENANT_ADMIN' }],
          error: null,
        })
      }
      if (table === 'tenants') {
        return query({
          data: [{
            id: 'tenant-1',
            name: 'Liquid HR Demo Holding',
            slug: 'liquid-hr-demo-holding',
            administration_mode: 'SEPARATE',
            sharing_mode: 'FULLY_ISOLATED',
          }],
          error: null,
        })
      }
      if (table === 'hr_groups') {
        return query({
          data: [
            { id: 'group-a', tenant_id: 'tenant-1', code: 'A', name: 'Groep A', description: null, is_active: true },
            { id: 'group-b', tenant_id: 'tenant-1', code: 'B', name: 'Groep B', description: 'Tweede groep', is_active: true },
          ],
          error: null,
        })
      }
      if (table === 'administrations') {
        return query({
          data: [
            { id: 'admin-a1', tenant_id: 'tenant-1', hr_group_id: 'group-a', code: 'A1', name: 'A1', is_active: true },
            { id: 'admin-b1', tenant_id: 'tenant-1', hr_group_id: 'group-b', code: 'B1', name: 'B1', is_active: true },
          ],
          error: null,
        })
      }
      throw new Error(`Onverwachte tabel: ${table}`)
    },
  }
}

describe('loadActiveContext', () => {
  beforeEach(() => {
    createClient.mockReset()
    cookies.mockReset()
    cookies.mockResolvedValue({
      get: (name: string) => ({
        value: name === 'liquid-hr-hr-group' ? 'group-b' : name === 'liquid-hr-administration' ? 'admin-b1' : 'tenant-1',
      }),
    })
  })

  it('bouwt de actieve context uit groepsaccess en gevalideerde cookies', async () => {
    createClient.mockResolvedValue(fakeClient())

    const result = await loadActiveContext()

    expect(result.tenant.id).toBe('tenant-1')
    expect(result.activeHrGroup.id).toBe('group-b')
    expect(result.activeAdministration?.id).toBe('admin-b1')
    expect(result.hrGroups).toHaveLength(2)
  })

  it('weigert een aanvraag zonder geverifieerde authclaim', async () => {
    createClient.mockResolvedValue(fakeClient(false))

    await expect(loadActiveContext()).rejects.toBeInstanceOf(ContextAuthenticationError)
  })
})

describe('loadAccessibleContextOptions APIAI-07 employment option', () => {
  it('includes confirmed future employment only when the caller explicitly allows it', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const futureStart = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    const queryDiagnostics: Array<{ table: string; filters: Array<{ method: string; column: string; value: unknown }> }> = []
    const client = {
      auth: { getClaims: vi.fn() },
      from(table: string) {
        const filters: Array<{ method: string; column: string; value: unknown }> = []
        queryDiagnostics.push({ table, filters })
        const builder = {
          select: () => builder,
          eq: (column: string, value: unknown) => { filters.push({ method: 'eq', column, value }); return builder },
          in: (column: string, value: unknown) => { filters.push({ method: 'in', column, value }); return builder },
          is: (column: string, value: unknown) => { filters.push({ method: 'is', column, value }); return builder },
          lte: (column: string, value: unknown) => { filters.push({ method: 'lte', column, value }); return builder },
          or: () => builder,
          order: () => builder,
          limit: async () => {
            const rows: Record<string, unknown>[] = table === 'user_hr_group_access'
              ? [{ user_id: 'employee-user', is_active: true, tenant_id: 'tenant-1', hr_group_id: 'group-1', management_role_id: 'employee-role' }]
              : table === 'user_access'
                ? [{ tenant_id: 'tenant-1', scope_type: 'ADMINISTRATION', administration_id: 'admin-1', hr_group_id: 'group-1' }]
                : table === 'management_roles'
                  ? [{ id: 'employee-role', code: 'EMPLOYEE' }]
                  : table === 'employees'
                    ? [{ id: 'employee-1', auth_user_id: 'employee-user', hr_group_id: 'group-1', deleted_at: null }]
                    : table === 'employments'
                      ? [{ employee_id: 'employee-1', tenant_id: 'tenant-1', hr_group_id: 'group-1', administration_id: 'admin-1', starts_on: futureStart, ends_on: null, record_status: 'CONFIRMED', deleted_at: null }]
                      : table === 'tenants'
                        ? [{ id: 'tenant-1', name: 'Synthetic', slug: 'synthetic', administration_mode: 'SEPARATE', sharing_mode: 'FULLY_ISOLATED' }]
                        : table === 'hr_groups'
                          ? [{ id: 'group-1', tenant_id: 'tenant-1', code: 'EMP', name: 'Employee', description: null, is_active: true }]
                          : table === 'administrations'
                            ? [{ id: 'admin-1', tenant_id: 'tenant-1', hr_group_id: 'group-1', code: 'A1', name: 'Admin', is_active: true }]
                            : []
            if (table === 'employments' && filters.some((filter) => filter.method === 'lte' && filter.column === 'starts_on' && filter.value === today)) {
              return { data: [], error: null }
            }
            return { data: rows, error: null }
          },
        }
        return builder
      },
    }
    createClient.mockResolvedValue(client)

    const defaults = await loadAccessibleContextOptions('employee-user', client as never)
    const preboarding = await loadAccessibleContextOptions('employee-user', client as never, {
      includeFutureEmployment: true,
      requireComplete: true,
    })

    expect(defaults.tenants[0]?.hrGroups[0]?.administrations).toEqual([])
    expect(preboarding.tenants[0]?.hrGroups[0]?.administrations.map((admin) => admin.id)).toEqual(['admin-1'])
    expect(futureStart > today).toBe(true)
    const employmentQueries = queryDiagnostics.filter((query) => query.table === 'employments')
    expect(employmentQueries[0]?.filters).toContainEqual({ method: 'lte', column: 'starts_on', value: today })
    expect(employmentQueries[1]?.filters).not.toContainEqual({ method: 'lte', column: 'starts_on', value: today })
  })
})
