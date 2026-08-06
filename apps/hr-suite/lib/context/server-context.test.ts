import { beforeEach, describe, expect, it, vi } from 'vitest'

const { cookies, createClient } = vi.hoisted(() => ({
  cookies: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('next/headers', () => ({ cookies }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { ContextAuthenticationError, loadActiveContext } from './server-context'

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
