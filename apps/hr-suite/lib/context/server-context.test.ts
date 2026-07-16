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
      if (table === 'user_access') {
        return query({
          data: [{ tenant_id: 'tenant-1', scope_type: 'TENANT', administration_id: null }],
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
      if (table === 'administrations') {
        return query({
          data: [
            { id: 'admin-holding', tenant_id: 'tenant-1', code: 'HOLDING', name: 'Holding', is_active: true },
            { id: 'admin-services', tenant_id: 'tenant-1', code: 'SERVICES', name: 'Services', is_active: true },
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
        value: name === 'liquid-hr-administration' ? 'admin-services' : 'tenant-1',
      }),
    })
  })

  it('bouwt de actieve context uit eigen toegang en gevalideerde cookieopties', async () => {
    createClient.mockResolvedValue(fakeClient())

    const result = await loadActiveContext()

    expect(result.tenant.id).toBe('tenant-1')
    expect(result.administration?.id).toBe('admin-services')
    expect(result.administrations).toHaveLength(2)
  })

  it('weigert een aanvraag zonder geverifieerde authclaim', async () => {
    createClient.mockResolvedValue(fakeClient(false))

    await expect(loadActiveContext()).rejects.toBeInstanceOf(ContextAuthenticationError)
  })
})
