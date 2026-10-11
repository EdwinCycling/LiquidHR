import { beforeEach, describe, expect, it, vi } from 'vitest'

const { harness } = vi.hoisted(() => ({ harness: { start: vi.fn() } }))

vi.mock('@/lib/payroll/payroll-service', () => ({
  PAYROLL_OAUTH_STATE_COOKIE: 'liquid-hr-payroll-oauth-state',
  payrollErrorResponse: (error: unknown) => Response.json({ error: error instanceof Error ? error.message : 'failed' }, { status: 500 }),
  payrollOAuthStateCookieOptions: () => ({ httpOnly: true, sameSite: 'lax', secure: true, path: '/api/payroll/providers/nmbrs', maxAge: 600 }),
  startNmbrsAuthorization: harness.start,
}))

import { GET } from './route'

describe('Nmbrs OAuth authorization route', () => {
  beforeEach(() => {
    harness.start.mockReset().mockResolvedValue({
      authorizationUrl: 'https://identityservice.nmbrs.com/connect/authorize?state=one-time-state',
      connectionId: 'connection-id',
      state: 'one-time-state',
      expiresAt: '2026-10-11T12:10:00.000Z',
    })
  })

  it('starts OAuth only from a same-origin app navigation and sets a scoped HttpOnly state cookie', async () => {
    const response = await GET(new Request('https://app.example/api/payroll/providers/nmbrs/authorize?connectionId=connection-id', {
      headers: { referer: 'https://app.example/payroll-lab/integrations' },
    }))

    expect(harness.start).toHaveBeenCalledWith('connection-id')
    expect(response.headers.get('location')).toBe('https://identityservice.nmbrs.com/connect/authorize?state=one-time-state')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('set-cookie')).toMatch(/liquid-hr-payroll-oauth-state=one-time-state/i)
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/i)
    expect(response.headers.get('set-cookie')).toMatch(/Path=\/api\/payroll\/providers\/nmbrs/i)
  })

  it('rejects cross-origin initiation before creating state or changing the connection', async () => {
    const response = await GET(new Request('https://app.example/api/payroll/providers/nmbrs/authorize', {
      headers: { referer: 'https://attacker.example/launch', 'sec-fetch-site': 'cross-site' },
    }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'PAYROLL_REQUEST_ORIGIN_INVALID' })
    expect(harness.start).not.toHaveBeenCalled()
  })
})
