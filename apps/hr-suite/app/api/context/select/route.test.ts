import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { harness } = vi.hoisted(() => ({
  harness: {
    loadOptions: vi.fn(),
    selectActiveContext: vi.fn(),
    permissionErrorResponse: vi.fn(),
    cookieStore: { set: vi.fn(), delete: vi.fn() },
  },
}))

vi.mock('next/headers', () => ({ cookies: vi.fn(async () => harness.cookieStore) }))
vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse: harness.permissionErrorResponse }))
vi.mock('@/lib/context/administration-context', () => ({ selectActiveContext: harness.selectActiveContext }))
vi.mock('@/lib/context/server-context', () => ({
  ACTIVE_ADMINISTRATION_COOKIE: 'active-administration',
  ACTIVE_HR_GROUP_COOKIE: 'active-hr-group',
  ACTIVE_TENANT_COOKIE: 'active-tenant',
  loadAccessibleContextOptions: harness.loadOptions,
}))

import { POST } from './route'

const tenantId = '11111111-1111-4111-8111-111111111111'
const hrGroupId = '22222222-2222-4222-8222-222222222222'
const context = { tenant: { id: tenantId }, activeHrGroup: { id: hrGroupId } }

describe('POST /api/context/select', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    harness.loadOptions.mockReset().mockResolvedValue({ tenants: [{ id: tenantId }] })
    harness.selectActiveContext.mockReset().mockReturnValue(context)
    harness.permissionErrorResponse.mockReset().mockReturnValue(null)
    harness.cookieStore.set.mockReset()
    harness.cookieStore.delete.mockReset()
  })

  it('accepts a local development form when the embedded browser omits origin metadata', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const request = new Request('http://127.0.0.1:3010/api/context/select', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ selection: `${tenantId}|${hrGroupId}` }),
    })

    const response = await POST(request)

    expect(response.status).toBe(303)
    expect(harness.selectActiveContext).toHaveBeenCalled()
  })

  it('accepts localhost and loopback aliases on the same local development port', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const request = new Request('http://127.0.0.1:3010/api/context/select', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3010',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ selection: `${tenantId}|${hrGroupId}` }),
    })

    const response = await POST(request)

    expect(response.status).toBe(303)
    expect(harness.selectActiveContext).toHaveBeenCalled()
  })

  it('parses a plain-text native form without changing the JSON API contract', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const request = new Request('http://127.0.0.1:3010/api/context/select', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: `selection=${tenantId}|${hrGroupId}\r\n`,
    })

    const response = await POST(request)

    expect(response.status).toBe(303)
    expect(harness.selectActiveContext).toHaveBeenCalledWith(expect.objectContaining({
      requestedTenantId: tenantId,
      requestedHrGroupId: hrGroupId,
    }))
  })

  it('supports embedded-browser form serialization while preserving server-side context validation', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const request = new Request('http://127.0.0.1:3010/api/context/select', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ selection: `${tenantId}|${hrGroupId}` }),
    })

    const response = await POST(request)

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://127.0.0.1:3010/dashboard/start')
    expect(harness.selectActiveContext).toHaveBeenCalledWith(expect.objectContaining({
      requestedTenantId: tenantId,
      requestedHrGroupId: hrGroupId,
    }))
  })

  it('validates a same-origin native form selection and redirects with scoped cookies', async () => {
    const request = new Request('http://localhost:3010/api/context/select', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3010',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ selection: `${tenantId}|${hrGroupId}` }),
    })

    const response = await POST(request)

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://localhost:3010/dashboard/start')
    expect(response.headers.get('set-cookie')).toContain('active-tenant=')
    expect(response.headers.get('set-cookie')).toContain('active-hr-group=')
    expect(response.headers.get('set-cookie')).toContain('active-administration=;')
    expect(harness.selectActiveContext).toHaveBeenCalledWith({
      tenants: [{ id: tenantId }],
      requestedTenantId: tenantId,
      requestedHrGroupId: hrGroupId,
    })
    expect(harness.cookieStore.set).not.toHaveBeenCalled()
  })

  it('rejects a cross-origin native form before reading accessible contexts', async () => {
    const request = new Request('http://localhost:3010/api/context/select', {
      method: 'POST',
      headers: {
        origin: 'https://outside.example',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ selection: `${tenantId}|${hrGroupId}` }),
    })

    const response = await POST(request)

    expect(response.status).toBe(403)
    expect(harness.loadOptions).not.toHaveBeenCalled()
    expect(harness.selectActiveContext).not.toHaveBeenCalled()
  })

  it('redirects local form failures to a recoverable page message', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    harness.loadOptions.mockRejectedValueOnce(new Error('context lookup failed'))
    const request = new Request('http://localhost:3010/api/context/select', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3010',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ selection: `${tenantId}|${hrGroupId}` }),
    })

    const response = await POST(request)

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://localhost:3010/context/select?error=failed')
    expect(harness.selectActiveContext).not.toHaveBeenCalled()
  })

  it('accepts a native form without Origin only when Fetch Metadata confirms same-origin', async () => {
    const request = new Request('http://localhost:3010/api/context/select', {
      method: 'POST',
      headers: {
        'sec-fetch-site': 'same-origin',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ selection: `${tenantId}|${hrGroupId}` }),
    })

    const response = await POST(request)

    expect(response.status).toBe(303)
    expect(harness.selectActiveContext).toHaveBeenCalled()
  })

  it('keeps the existing authorized JSON client flow', async () => {
    const request = new Request('http://localhost:3010/api/context/select', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantId, hrGroupId }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { tenantId, hrGroupId } })
    expect(harness.cookieStore.set).toHaveBeenCalledTimes(2)
    expect(harness.cookieStore.delete).toHaveBeenCalledWith('active-administration')
  })
})
