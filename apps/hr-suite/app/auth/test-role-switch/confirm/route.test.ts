import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { cookies, createClient, verifyOtp } = vi.hoisted(() => ({
  cookies: vi.fn(),
  createClient: vi.fn(),
  verifyOtp: vi.fn(),
}))

vi.mock('next/headers', () => ({ cookies }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { NextRequest } from 'next/server'
import { GET } from './route'

describe('GET /auth/test-role-switch/confirm', () => {
  beforeEach(() => {
    cookies.mockReset()
    createClient.mockReset()
    verifyOtp.mockReset()
    createClient.mockResolvedValue({ auth: { verifyOtp } })
    verifyOtp.mockResolvedValue({ error: null })
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', 'true')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://real-production.supabase.co')
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

  it('denies the handoff in Vercel Preview even when the stale flag is enabled', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('VERCEL', '1')

    const response = await GET(new NextRequest('https://preview.example/auth/test-role-switch/confirm'))

    expect(response.status).toBe(307)
    expect(cookies).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('verifies the existing Supabase handoff and returns to the validated route', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', 'true')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://wnpfloqpjvaacobppbpk.supabase.co')
    cookies.mockResolvedValue({
      get: (name: string) => {
        if (name === 'liquidhr-test-role-switch') return { value: 'fixture-handoff-token' }
        if (name === 'liquidhr-test-role-switch-next') return { value: '/employees?tab=profile' }
        return undefined
      },
    })

    const response = await GET(new NextRequest('http://localhost:3000/auth/test-role-switch/confirm'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/employees?tab=profile')
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'fixture-handoff-token', type: 'magiclink' })
    const clearedCookies = response.headers.get('set-cookie') ?? ''
    expect(clearedCookies).toContain('liquidhr-test-role-switch=;')
    expect(clearedCookies).toContain('liquidhr-test-role-switch-next=;')
    expect(response.headers.get('location')).not.toContain('fixture-handoff-token')
  })

  it.each(['https://attacker.example', '//attacker.example', '/\\attacker.example'])(
    'uses the safe destination fallback after a handoff with unsafe next %s',
    async (nextPath) => {
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('VERCEL_ENV', '')
      vi.stubEnv('VERCEL', '')
      vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', 'true')
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://wnpfloqpjvaacobppbpk.supabase.co')
      cookies.mockResolvedValue({
        get: (name: string) => {
          if (name === 'liquidhr-test-role-switch') return { value: 'fixture-handoff-token' }
          if (name === 'liquidhr-test-role-switch-next') return { value: nextPath }
          return undefined
        },
      })

      const response = await GET(new NextRequest('http://localhost:3000/auth/test-role-switch/confirm'))

      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard/start')
      expect(response.headers.get('location')).not.toContain('attacker.example')
    },
  )
})
