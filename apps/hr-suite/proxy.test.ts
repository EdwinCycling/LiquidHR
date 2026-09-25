import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getClaims } = vi.hoisted(() => ({ getClaims: vi.fn() }))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({ auth: { getClaims } })),
}))

import { NextRequest } from 'next/server'
import { proxy } from './proxy'

describe('proxy login routing', () => {
  beforeEach(() => {
    getClaims.mockReset()
    getClaims.mockResolvedValue({ data: { claims: { sub: 'user-a' } } })
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test-project.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('redirects stale refresh sessions without throwing and clears auth cookies', async () => {
    getClaims.mockRejectedValue({
      code: 'refresh_token_not_found',
      message: 'Invalid Refresh Token: Refresh Token Not Found',
      status: 400,
    })

    const request = new NextRequest('https://liquidhr.example/departments', {
      headers: { cookie: 'sb-test-auth-token=stale; sb-test-auth-token.0=part' },
    })
    const response = await proxy(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://liquidhr.example/login?next=%2Fdepartments')
    const setCookie = response.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('sb-test-auth-token=')
    expect(setCookie).toContain('sb-test-auth-token.0=')
    expect(setCookie).toContain('Max-Age=0')
  })

  it('uses the role-aware app root for an authenticated login without a destination', async () => {
    const response = await proxy(new NextRequest('https://liquidhr.test/login'))

    expect(response.headers.get('location')).toBe('https://liquidhr.test/')
  })
})
