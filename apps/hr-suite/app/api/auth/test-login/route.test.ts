import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, signInWithPassword, signOut } = vi.hoisted(() => ({
  createClient: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { NextRequest } from 'next/server'
import { POST } from './route'

const APPLICATION_URL = 'http://localhost:3000'
const SYNTHETIC_TEST_PASSWORD = 'synthetic-admin-password'

function loginRequest(persona: string, origin = APPLICATION_URL): NextRequest {
  return new NextRequest(`${APPLICATION_URL}/api/auth/test-login`, {
    method: 'POST',
    headers: { origin },
    body: new URLSearchParams({ persona }),
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
    expect(createClient).toHaveBeenCalledOnce()
    expect(signOut).toHaveBeenCalledOnce()
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'hradmin.fixture@liquidhr.test',
      password: SYNTHETIC_TEST_PASSWORD,
    })
    expect(response.headers.get('location')).not.toContain(SYNTHETIC_TEST_PASSWORD)
    expect(response.headers.get('set-cookie') ?? '').not.toContain(SYNTHETIC_TEST_PASSWORD)
  })

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
})
