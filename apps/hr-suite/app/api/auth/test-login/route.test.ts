import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, signInWithPassword, signOut } = vi.hoisted(() => ({
  createClient: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { NextRequest } from 'next/server'
import { ACTIVE_ADMINISTRATION_COOKIE, ACTIVE_HR_GROUP_COOKIE, ACTIVE_TENANT_COOKIE } from '@/lib/context/context-cookies'
import { POST } from './route'

const APPLICATION_URL = 'http://localhost:3000'
const SYNTHETIC_TEST_PASSWORD = 'synthetic-admin-password'

function loginRequest(
  persona: string,
  origin = APPLICATION_URL,
  next?: string,
  requestUrl = APPLICATION_URL,
): NextRequest {
  const body = new URLSearchParams({ persona })
  if (next !== undefined) body.set('next', next)
  return new NextRequest(`${requestUrl}/api/auth/test-login`, {
    method: 'POST',
    headers: { origin, host: new URL(requestUrl).host },
    body,
  })
}

function enableHarness(): void {
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('VERCEL_ENV', '')
  vi.stubEnv('VERCEL', '')
  vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', 'true')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://wnpfloqpjvaacobppbpk.supabase.co')
  vi.stubEnv('TALENT_HR_ADMIN_PASSWORD', SYNTHETIC_TEST_PASSWORD)
}

describe('POST /api/auth/test-login', () => {
  beforeEach(() => {
    createClient.mockReset()
    signInWithPassword.mockReset()
    signOut.mockReset()
    createClient.mockResolvedValue({ auth: { signInWithPassword, signOut } })
    signInWithPassword.mockResolvedValue({ error: null })
    signOut.mockResolvedValue({ error: null })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('returns not found when the local harness is disabled by default', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', '')

    const response = await POST(loginRequest('hr-admin'))

    expect(response.status).toBe(404)
    expect(createClient).not.toHaveBeenCalled()
  })

  it.each(['production', 'preview'])('returns not found in Vercel %s even when locally enabled', async (vercelEnv) => {
    enableHarness()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('VERCEL_ENV', vercelEnv)

    const response = await POST(loginRequest('hr-admin'))

    expect(response.status).toBe(404)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('signs in the fixed synthetic HR Admin through the normal server Supabase client', async () => {
    enableHarness()

    const response = await POST(loginRequest('hr-admin'))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${APPLICATION_URL}/dashboard/start`)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    for (const cookieName of [ACTIVE_TENANT_COOKIE, ACTIVE_HR_GROUP_COOKIE, ACTIVE_ADMINISTRATION_COOKIE]) {
      expect(response.cookies.get(cookieName)?.value).toBe('')
    }
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(createClient).toHaveBeenCalledOnce()
    expect(signOut).toHaveBeenCalledOnce()
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'hradmin.fixture@liquidhr.test',
      password: SYNTHETIC_TEST_PASSWORD,
    })
    expect(response.headers.get('location')).not.toContain(SYNTHETIC_TEST_PASSWORD)
    expect(response.headers.get('set-cookie') ?? '').not.toContain(SYNTHETIC_TEST_PASSWORD)
  })

  it('preserves the browser loopback origin when Next.js normalizes request.nextUrl', async () => {
    enableHarness()
    const browserOrigin = 'http://127.0.0.1:3000'
    const request = loginRequest('hr-admin', browserOrigin, undefined, browserOrigin)

    expect(request.headers.get('origin')).toBe(browserOrigin)
    expect(request.nextUrl.origin).toBe(APPLICATION_URL)

    const response = await POST(request)

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${browserOrigin}/dashboard/start`)
  })

  it('denies a loopback origin that differs from the request Host', async () => {
    enableHarness()

    const request = loginRequest('hr-admin', APPLICATION_URL, undefined, 'http://127.0.0.1:3000')
    const response = await POST(request)

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'TEST_LOGIN_FORBIDDEN' })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('retains a validated relative route through the HR Admin test login', async () => {
    enableHarness()

    const response = await POST(loginRequest('hr-admin', APPLICATION_URL, '/employees?tab=profile'))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(APPLICATION_URL + '/employees?tab=profile')
  })

  it.each(['https://attacker.example', '//attacker.example', '/\\attacker.example'])(
    'falls back to the dashboard for an unsafe test-login redirect %s',
    async (next) => {
      enableHarness()

      const response = await POST(loginRequest('hr-admin', APPLICATION_URL, next))

      expect(response.status).toBe(303)
      expect(response.headers.get('location')).toBe(APPLICATION_URL + '/dashboard/start')
    },
  )

  it('denies unsupported personas before creating a Supabase client', async () => {
    enableHarness()

    const response = await POST(loginRequest('manager'))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'TEST_LOGIN_FORBIDDEN' })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('denies a cross-origin form post before creating a Supabase client', async () => {
    enableHarness()

    const response = await POST(loginRequest('hr-admin', 'https://attacker.example'))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'TEST_LOGIN_FORBIDDEN' })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('returns unavailable without a server credential and leaves Supabase untouched', async () => {
    enableHarness()
    vi.stubEnv('TALENT_HR_ADMIN_PASSWORD', '')

    const response = await POST(loginRequest('hr-admin'))

    expect(response.status).toBe(503)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('does not create an authenticated session when the regular password sign-in fails', async () => {
    enableHarness()
    signInWithPassword.mockResolvedValue({ error: new Error('invalid credentials') })

    const response = await POST(loginRequest('hr-admin'))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${APPLICATION_URL}/login?error=test-login`)
    expect(signInWithPassword).toHaveBeenCalledOnce()
  })

  it('retains the validated destination on a failed test login without exposing credentials', async () => {
    enableHarness()
    signInWithPassword.mockResolvedValue({ error: new Error('invalid credentials') })

    const response = await POST(loginRequest('hr-admin', APPLICATION_URL, '/employees?tab=profile'))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(
      APPLICATION_URL + '/login?error=test-login&next=%2Femployees%3Ftab%3Dprofile',
    )
    expect(response.headers.get('location')).not.toContain(SYNTHETIC_TEST_PASSWORD)
  })
})
