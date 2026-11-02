import { beforeEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn() },
  complete: vi.fn(),
  fail: vi.fn(),
  cookieOptions: { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 600 },
}))

vi.mock('next/headers', () => ({ cookies: async () => harness.cookieStore }))
vi.mock('next/server', () => ({
  NextResponse: {
    redirect: (url: URL | string) => new Response(null, { status: 307, headers: { Location: String(url) } }),
  },
}))
vi.mock('@/lib/payroll/payroll-service', () => ({
  completeNmbrsAuthorization: harness.complete,
  failNmbrsAuthorization: harness.fail,
  PAYROLL_OAUTH_STATE_COOKIE: 'liquid-hr-payroll-oauth-state',
  payrollOAuthStateCookieOptions: () => harness.cookieOptions,
}))

import { GET } from './route'

describe('Nmbrs OAuth callback route', () => {
  beforeEach(() => {
    harness.cookieStore.get.mockReset().mockReturnValue({ value: 'session-state' })
    harness.cookieStore.set.mockReset()
    harness.complete.mockReset().mockResolvedValue(undefined)
    harness.fail.mockReset().mockResolvedValue(undefined)
  })

  it('exchanges the code only when the callback state matches the protected cookie', async () => {
    const response = await GET(new Request('https://liquidhr.test/api/payroll/providers/nmbrs/callback?state=session-state&code=synthetic-code'))

    expect(harness.complete).toHaveBeenCalledWith({ state: 'session-state', code: 'synthetic-code' })
    expect(response.headers.get('location')).toBe('https://liquidhr.test/payroll/settings?payroll=connected')
    expect(harness.cookieStore.set).toHaveBeenCalledWith('liquid-hr-payroll-oauth-state', '', { ...harness.cookieOptions, maxAge: 0 })
  })

  it('rejects a state mismatch without exchanging the code and clears the cookie', async () => {
    const response = await GET(new Request('https://liquidhr.test/api/payroll/providers/nmbrs/callback?state=attacker-state&code=synthetic-code'))

    expect(harness.complete).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe('https://liquidhr.test/payroll/settings?payroll=error')
    expect(harness.cookieStore.set).toHaveBeenCalledWith('liquid-hr-payroll-oauth-state', '', { ...harness.cookieOptions, maxAge: 0 })
  })

  it('records a provider denial only for the matching one-time state', async () => {
    const response = await GET(new Request('https://liquidhr.test/api/payroll/providers/nmbrs/callback?state=session-state&error=access_denied'))

    expect(harness.fail).toHaveBeenCalledWith({ state: 'session-state' })
    expect(harness.complete).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe('https://liquidhr.test/payroll/settings?payroll=error')
  })
})