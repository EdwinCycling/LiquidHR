import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { cookies, createClient } = vi.hoisted(() => ({
  cookies: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('next/headers', () => ({ cookies }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { NextRequest } from 'next/server'
import { GET } from './route'

describe('GET /auth/test-role-switch/confirm', () => {
  beforeEach(() => {
    cookies.mockReset()
    createClient.mockReset()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', 'true')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://liquid-hr-hr-suite.vercel.app')
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'liquid-hr-hr-suite.vercel.app')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('verifieert geen handoff-cookie in productie, ook niet met een stale flag', async () => {
    const request = new NextRequest('https://internal.vercel.app/auth/test-role-switch/confirm', {
      headers: {
        host: 'internal.vercel.app',
        'x-forwarded-host': 'attacker.example',
      },
    })

    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://liquid-hr-hr-suite.vercel.app/login?error=test-role-switch')
    expect(cookies).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })
})
