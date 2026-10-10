import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createAdminClient, generateLink, getRequestAuthorizationContext, permissionErrorResponse, signOut } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  generateLink: vi.fn(),
  getRequestAuthorizationContext: vi.fn(),
  permissionErrorResponse: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ getRequestAuthorizationContext, permissionErrorResponse }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))

import { NextRequest } from 'next/server'
import { ACTIVE_ADMINISTRATION_COOKIE, ACTIVE_HR_GROUP_COOKIE, ACTIVE_TENANT_COOKIE } from '@/lib/context/context-cookies'
import { POST } from './route'

const CANONICAL_SUPABASE_URL = 'https://wnpfloqpjvaacobppbpk.supabase.co'
const APPLICATION_URL = 'https://liquid-hr-hr-suite.vercel.app'

function switchRequest(target: string, next?: string, requestUrl = APPLICATION_URL): NextRequest {
  const body = new URLSearchParams({ target })
  if (next !== undefined) body.set('next', next)
  return new NextRequest(`${requestUrl}/api/auth/test-role-switch`, {
    method: 'POST',
    headers: { origin: requestUrl, host: new URL(requestUrl).host },
    body,
  })
}

function enableSwitcher(supabaseUrl = CANONICAL_SUPABASE_URL): void {
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('VERCEL_ENV', '')
  vi.stubEnv('VERCEL', '')
  vi.stubEnv('VERCEL_URL', 'liquid-hr-hr-suite.vercel.app')
  vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', 'true')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl)
}

function setAuthorizationContext(email: string, activeRoles: string[]): void {
  getRequestAuthorizationContext.mockResolvedValue({
    supabase: { auth: { signOut } },
    context: { activeRoles },
    email,
  })
}

describe('POST /api/auth/test-role-switch', () => {
  beforeEach(() => {
    createAdminClient.mockReset()
    generateLink.mockReset()
    getRequestAuthorizationContext.mockReset()
    permissionErrorResponse.mockReset()
    signOut.mockReset()
    permissionErrorResponse.mockReturnValue(null)
    setAuthorizationContext('hradmin.fixture@liquidhr.test', ['TENANT_ADMIN'])
    createAdminClient.mockReturnValue({ auth: { admin: { generateLink } } })
    generateLink.mockResolvedValue({ data: { properties: { hashed_token: 'hashed-token' } }, error: null })
    signOut.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('weigert een niet-canoniek Supabase-project voordat de sessie wordt gelezen', async () => {
    enableSwitcher('https://other-project.supabase.co')

    const response = await POST(switchRequest('manager'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'TEST_ROLE_SWITCH_DISABLED' })
    expect(getRequestAuthorizationContext).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('weigert een cross-origin verzoek voordat de sessie of adminclient wordt gelezen', async () => {
    enableSwitcher()
    const request = new NextRequest(`${APPLICATION_URL}/api/auth/test-role-switch`, {
      method: 'POST',
      headers: { origin: 'https://attacker.example' },
      body: new URLSearchParams({ target: 'manager' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(403)
    expect(getRequestAuthorizationContext).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('blijft lokaal in een productie-build zonder Vercel-context gesloten', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', 'true')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', CANONICAL_SUPABASE_URL)

    const response = await POST(switchRequest('manager'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'TEST_ROLE_SWITCH_DISABLED' })
    expect(getRequestAuthorizationContext).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it.each(['production', 'preview'])('blijft gesloten in Vercel %s', async (vercelEnv) => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', vercelEnv)
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', 'true')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', CANONICAL_SUPABASE_URL)

    const response = await POST(switchRequest('manager'))

    expect(response.status).toBe(404)
    expect(getRequestAuthorizationContext).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('houdt de bestaande HR Admin-handoff en de kortlevende beveiligde cookie intact', async () => {
    enableSwitcher()

    const response = await POST(switchRequest('manager'))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${APPLICATION_URL}/auth/test-role-switch/confirm`)
    const handoffCookie = response.headers.get('set-cookie') ?? ''
    expect(handoffCookie).toContain('liquidhr-test-role-switch=hashed-token')
    expect(handoffCookie).toContain('HttpOnly')
    expect(handoffCookie).toContain('Max-Age=60')
    expect(handoffCookie).toContain('SameSite=lax')
    expect(handoffCookie).toContain('Secure')
    for (const cookieName of [ACTIVE_TENANT_COOKIE, ACTIVE_HR_GROUP_COOKIE, ACTIVE_ADMINISTRATION_COOKIE]) {
      expect(response.cookies.get(cookieName)?.value).toBe('')
    }
    expect(handoffCookie).toContain('Max-Age=0')
    expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'manager.fixture@liquidhr.test' })
    expect(signOut).toHaveBeenCalledOnce()
  })

  it('behoudt de same-origin rolwissel als Next.js request.nextUrl normaliseert', async () => {
    enableSwitcher()
    const browserOrigin = 'http://127.0.0.1:3010'
    const request = switchRequest('manager', undefined, browserOrigin)

    expect(request.headers.get('origin')).toBe(browserOrigin)
    expect(request.nextUrl.origin).toBe('http://localhost:3010')

    const response = await POST(request)

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${browserOrigin}/auth/test-role-switch/confirm`)
    expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'manager.fixture@liquidhr.test' })
  })

  it('bewaart een gevalideerde relatieve route in een kortlevende HttpOnly-cookie', async () => {
    enableSwitcher()

    const response = await POST(switchRequest('manager', '/employees?tab=profile'))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(APPLICATION_URL + '/auth/test-role-switch/confirm')
    const cookies = response.headers.get('set-cookie') ?? ''
    expect(cookies).toContain('liquidhr-test-role-switch-next=')
    expect(cookies).toContain('HttpOnly')
    expect(cookies).toContain('Max-Age=60')
    expect(cookies).not.toContain('/employees?tab=profile')
    expect(generateLink).toHaveBeenCalledOnce()
  })

  it.each(['https://attacker.example', '//attacker.example', '/\\attacker.example'])(
    'stores only the safe fallback for an unsafe role-switch redirect %s',
    async (next) => {
      enableSwitcher()

      const response = await POST(switchRequest('manager', next))

      expect(response.status).toBe(303)
      const cookies = response.headers.get('set-cookie') ?? ''
      expect(cookies).toMatch(/liquidhr-test-role-switch-next=(?:%2Fdashboard%2Fstart|\/dashboard\/start)/i)
      expect(cookies).not.toContain('attacker.example')
      expect(generateLink).toHaveBeenCalledOnce()
    },
  )

  it('laat een HR_ADMIN-systeemrol de bestaande allowlisted targets gebruiken', async () => {
    enableSwitcher()
    setAuthorizationContext('edwin@editsolutions.nl', ['HR_ADMIN'])

    const response = await POST(switchRequest('employee'))

    expect(response.status).toBe(303)
    expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'employee.fixture@liquidhr.test' })
  })

  it('weigert Manager als bron voordat de admin-handoff wordt aangemaakt', async () => {
    enableSwitcher()
    setAuthorizationContext('manager.fixture@liquidhr.test', ['DIRECT_MANAGER'])

    const response = await POST(switchRequest('hr-admin'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'TEST_ROLE_SWITCH_FORBIDDEN' })
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('weigert Employee als bron voor Manager- en HR Admin-sessies', async () => {
    enableSwitcher()
    setAuthorizationContext('employee.fixture@liquidhr.test', ['EMPLOYEE'])

    for (const target of ['manager', 'hr-admin']) {
      const response = await POST(switchRequest(target))
      expect(response.status).toBe(403)
      await expect(response.json()).resolves.toEqual({ error: 'TEST_ROLE_SWITCH_FORBIDDEN' })
    }

    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('weigert een niet-allowlisted bron ook met een beheerrol', async () => {
    enableSwitcher()
    setAuthorizationContext('outsider@example.com', ['TENANT_ADMIN'])

    const response = await POST(switchRequest('manager'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'TEST_ROLE_SWITCH_FORBIDDEN' })
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('weigert een vervalste target voordat de admin-handoff wordt aangemaakt', async () => {
    enableSwitcher()

    const response = await POST(switchRequest('hr-admin%00'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'TEST_ROLE_SWITCH_FORBIDDEN' })
    expect(createAdminClient).not.toHaveBeenCalled()
  })
})
