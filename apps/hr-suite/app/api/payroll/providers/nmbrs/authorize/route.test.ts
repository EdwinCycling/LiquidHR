import { beforeEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({
  cookieStore: { set: vi.fn() },
  start: vi.fn(),
  payrollErrorResponse: vi.fn((error: unknown) => Response.json({ error: error instanceof Error ? error.message : 'error' }, { status: 500 })),
  cookieOptions: { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 600 },
}))

vi.mock('next/headers', () => ({ cookies: async () => harness.cookieStore }))
vi.mock('next/server', () => ({
  NextResponse: {
    redirect: (url: URL | string) => new Response(null, { status: 307, headers: { Location: String(url) } }),
  },
}))
vi.mock('@/lib/payroll/payroll-service', () => ({
  PAYROLL_OAUTH_STATE_COOKIE: 'liquid-hr-payroll-oauth-state',
  payrollErrorResponse: harness.payrollErrorResponse,
  payrollOAuthStateCookieOptions: () => harness.cookieOptions,
  startNmbrsAuthorization: harness.start,
}))

import { GET } from './route'

describe('Nmbrs OAuth authorization route', () => {
  beforeEach(() => {
    harness.cookieStore.set.mockReset()
    harness.start.mockReset().mockResolvedValue({
      authorizationUrl: 'https://identityservice.nmbrs.com/connect/authorize?state=opaque-state',
      connectionId: '50000000-0000-4000-8000-000000000004',
      state: 'opaque-state',
      expiresAt: '2026-11-02T12:00:00.000Z',
    })
    harness.payrollErrorResponse.mockClear()
  })

  it('stores the one-time state in a protected cookie and redirects to the provider', async () => {
    const response = await GET(new Request('https://liquidhr.test/api/payroll/providers/nmbrs/authorize?connectionId=50000000-0000-4000-8000-000000000004'))

    expect(harness.start).toHaveBeenCalledWith('50000000-0000-4000-8000-000000000004')
    expect(harness.cookieStore.set).toHaveBeenCalledWith('liquid-hr-payroll-oauth-state', 'opaque-state', harness.cookieOptions)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('https://identityservice.nmbrs.com/connect/authorize')
  })

  it('returns the service error without redirecting or setting OAuth state', async () => {
    harness.start.mockRejectedValueOnce(new Error('PAYROLL_PROVIDER_NOT_CONFIGURED'))

    const response = await GET(new Request('https://liquidhr.test/api/payroll/providers/nmbrs/authorize'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'PAYROLL_PROVIDER_NOT_CONFIGURED' })
    expect(harness.cookieStore.set).not.toHaveBeenCalled()
  })
})