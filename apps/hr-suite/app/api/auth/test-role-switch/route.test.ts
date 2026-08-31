import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, createAdminClient, getUser, signOut, generateLink } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  generateLink: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))

import { NextRequest } from 'next/server'
import { POST } from './route'

describe('POST /api/auth/test-role-switch', () => {
  beforeEach(() => {
    createClient.mockReset()
    createAdminClient.mockReset()
    getUser.mockReset()
    signOut.mockReset()
    generateLink.mockReset()
    createClient.mockResolvedValue({ auth: { getUser, signOut } })
    createAdminClient.mockReturnValue({ auth: { admin: { generateLink } } })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('weigert directe productie-aanroepen ook met een stale enable-flag', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', 'true')

    const request = new NextRequest('https://liquid-hr-hr-suite.vercel.app/api/auth/test-role-switch', {
      method: 'POST',
      body: new URLSearchParams({ target: 'manager' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'TEST_ROLE_SWITCH_DISABLED' })
    expect(createClient).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('blijft lokaal in een productie-build gesloten als Vercel-context ontbreekt', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', 'true')

    const request = new NextRequest('https://liquid-hr-hr-suite.vercel.app/api/auth/test-role-switch', {
      method: 'POST',
      body: new URLSearchParams({ target: 'manager' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'TEST_ROLE_SWITCH_DISABLED' })
    expect(createClient).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('behoudt de bestaande allowlisted handoff in Preview', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('VERCEL_URL', 'preview.example.vercel.app')
    vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', 'true')
    getUser.mockResolvedValue({ data: { user: { email: 'edwin@editsolutions.nl' } }, error: null })
    generateLink.mockResolvedValue({ data: { properties: { hashed_token: 'hashed-token' } }, error: null })
    signOut.mockResolvedValue({ error: null })

    const request = new NextRequest('https://preview.example.vercel.app/api/auth/test-role-switch', {
      method: 'POST',
      body: new URLSearchParams({ target: 'manager' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://preview.example.vercel.app/auth/test-role-switch/confirm')
    const handoffCookie = response.headers.get('set-cookie') ?? ''
    expect(handoffCookie).toContain('liquidhr-test-role-switch=hashed-token')
    expect(handoffCookie).toContain('HttpOnly')
    expect(handoffCookie).toContain('Max-Age=60')
    expect(handoffCookie).toContain('SameSite=lax')
    expect(handoffCookie).toContain('Secure')
    expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'manager.fixture@liquidhr.test' })
  })

  it('weigert een niet-allowlisted crafted target vóór de admin-handoff', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', 'true')
    getUser.mockResolvedValue({ data: { user: { email: 'edwin@editsolutions.nl' } }, error: null })

    const request = new NextRequest('https://preview.example.vercel.app/api/auth/test-role-switch', {
      method: 'POST',
      body: new URLSearchParams({ target: 'hr-admin%00' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'TEST_ROLE_SWITCH_FORBIDDEN' })
    expect(createAdminClient).not.toHaveBeenCalled()
  })
})
