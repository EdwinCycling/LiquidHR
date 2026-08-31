import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, signOut } = vi.hoisted(() => ({
  createClient: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { NextRequest } from 'next/server'
import { POST } from './route'

describe('POST /auth/signout', () => {
  beforeEach(() => {
    createClient.mockReset()
    signOut.mockReset()
    createClient.mockResolvedValue({ auth: { signOut } })
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://liquid-hr-hr-suite.vercel.app')
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'liquid-hr-hr-suite.vercel.app')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('redirecteert na uitloggen niet naar een onbekende Host', async () => {
    signOut.mockResolvedValue({ error: null })
    const request = new NextRequest('https://internal.vercel.app/auth/signout', {
      method: 'POST',
      headers: {
        host: 'internal.vercel.app',
        'x-forwarded-host': 'attacker.example',
        'x-forwarded-proto': 'https',
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://liquid-hr-hr-suite.vercel.app/login')
  })
})
