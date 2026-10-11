import { beforeEach, describe, expect, it, vi } from 'vitest'

const { harness } = vi.hoisted(() => ({
  harness: {
    cookieState: null as string | null,
    complete: vi.fn(),
    fail: vi.fn(),
  },
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: () => harness.cookieState ? { value: harness.cookieState } : undefined })),
}))

vi.mock('@/lib/payroll/payroll-service', () => ({
  completeNmbrsAuthorization: harness.complete,
  failNmbrsAuthorization: harness.fail,
  PAYROLL_OAUTH_STATE_COOKIE: 'liquid-hr-payroll-oauth-state',
  payrollOAuthStateCookieOptions: () => ({ httpOnly: true, sameSite: 'lax', secure: true, path: '/api/payroll/providers/nmbrs', maxAge: 600 }),
}))

import { GET } from './route'

describe('Nmbrs OAuth callback route', () => {
  beforeEach(() => {
    harness.cookieState = 'state-from-browser-cookie'
    harness.complete.mockReset().mockResolvedValue(undefined)
    harness.fail.mockReset().mockResolvedValue(undefined)
  })

  it('completes only when callback state matches the initiating browser cookie and clears it', async () => {
    const response = await GET(new Request('https://app.example/api/payroll/providers/nmbrs/callback?state=state-from-browser-cookie&code=authorization-code'))

    expect(harness.complete).toHaveBeenCalledWith({ state: 'state-from-browser-cookie', code: 'authorization-code' })
    expect(harness.fail).not.toHaveBeenCalled()
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/payroll-lab/integrations?payroll=connected')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('set-cookie')).toMatch(/liquid-hr-payroll-oauth-state=;.*Max-Age=0/i)
    expect(response.headers.get('location')).not.toContain('code=')
    expect(response.headers.get('location')).not.toContain('state=')
  })

  it('rejects a missing or mismatched browser state without consuming server state', async () => {
    const response = await GET(new Request('https://app.example/api/payroll/providers/nmbrs/callback?state=attacker-state&code=authorization-code'))

    expect(harness.complete).not.toHaveBeenCalled()
    expect(harness.fail).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe('/payroll-lab/integrations?payroll=error')
    expect(response.headers.get('set-cookie')).toMatch(/Max-Age=0/i)
  })

  it('records a matching provider denial and removes callback state from the browser', async () => {
    const response = await GET(new Request('https://app.example/api/payroll/providers/nmbrs/callback?state=state-from-browser-cookie&error=access_denied'))

    expect(harness.fail).toHaveBeenCalledWith({ state: 'state-from-browser-cookie' })
    expect(harness.complete).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe('/payroll-lab/integrations?payroll=error')
  })

  it('returns a clean error redirect if the one-time server exchange fails', async () => {
    harness.complete.mockRejectedValueOnce(new Error('private provider details'))

    const response = await GET(new Request('https://app.example/api/payroll/providers/nmbrs/callback?state=state-from-browser-cookie&code=authorization-code'))

    expect(response.headers.get('location')).toBe('/payroll-lab/integrations?payroll=error')
    expect(response.headers.get('location')).not.toContain('private')
    expect(response.headers.get('set-cookie')).toMatch(/Max-Age=0/i)
  })
})
