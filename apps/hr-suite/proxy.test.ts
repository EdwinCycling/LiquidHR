import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createServerClient } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({ createServerClient }))

import { NextRequest } from 'next/server'
import { proxy } from './proxy'

describe('proxy auth recovery', () => {
  beforeEach(() => {
    createServerClient.mockReset()
  })

  it('redirects stale refresh sessions without throwing and clears auth cookies', async () => {
    createServerClient.mockReturnValue({
      auth: {
        getClaims: vi.fn().mockRejectedValue({
          code: 'refresh_token_not_found',
          message: 'Invalid Refresh Token: Refresh Token Not Found',
          status: 400,
        }),
      },
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
})
