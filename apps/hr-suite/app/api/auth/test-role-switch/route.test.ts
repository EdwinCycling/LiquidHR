import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, createAdminClient, getClaims, signOut, generateLink, listUsers, getLocalPayrollPersonaReadiness } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getClaims: vi.fn(),
  signOut: vi.fn(),
  generateLink: vi.fn(),
  listUsers: vi.fn(),
  getLocalPayrollPersonaReadiness: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))
vi.mock('@/lib/auth/local-payroll-persona-readiness', () => ({ getLocalPayrollPersonaReadiness }))

import { NextRequest } from 'next/server'
import { ACTIVE_ADMINISTRATION_COOKIE, ACTIVE_HR_GROUP_COOKIE, ACTIVE_TENANT_COOKIE } from '@/lib/context/context-cookies'
import { createLocalPersonaOwnerMarker, readLocalPersonaOwnerMarker, TEST_ROLE_SWITCH_OWNER_COOKIE } from '@/lib/auth/test-role-switch'
import { POST } from './route'

const CANONICAL_SUPABASE_URL = 'https://wnpfloqpjvaacobppbpk.supabase.co'
const LOCAL_ORIGIN = 'http://127.0.0.1:3010'
type AuthTestUser = { id: string; email: string; email_confirmed_at: string | null; is_anonymous: boolean }
const TARGET_EMAILS: AuthTestUser[] = [
  'edwin@editsolutions.nl',
  'hradmin.fixture@liquidhr.test',
  'manager.fixture@liquidhr.test',
  'employee.fixture@liquidhr.test',
  'lisa.test@liquidhr.test',
  'jaap.test@liquidhr.test',
  'frits.test@liquidhr.test',
].map((email, index) => ({
  id: `user-${index + 1}`,
  email,
  email_confirmed_at: '2026-01-01T00:00:00.000Z',
  is_anonymous: false,
}))

function switchRequest(target: string, next?: string, origin = LOCAL_ORIGIN, requestUrl = origin, ownerMarker?: string | null): NextRequest {
  const body = new URLSearchParams({ target })
  if (next !== undefined) body.set('next', next)
  return new NextRequest(`${requestUrl}/api/auth/test-role-switch`, {
    method: 'POST',
    headers: {
      origin,
      host: new URL(requestUrl).host,
      ...(ownerMarker ? { cookie: `${TEST_ROLE_SWITCH_OWNER_COOKIE}=${ownerMarker}` } : {}),
    },
    body,
  })
}

function enableSwitcher(supabaseUrl = CANONICAL_SUPABASE_URL): void {
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('VERCEL_ENV', '')
  vi.stubEnv('VERCEL', '')
  vi.stubEnv('VERCEL_URL', '')
  vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', 'true')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'unit-test-only-owner-marker-secret')
}

function setIdentity(email: string, emailVerified = true) {
  getClaims.mockResolvedValue({
    data: { claims: { sub: `auth-${email}`, email, email_verified: emailVerified } },
    error: null,
  })
  return { auth: { getClaims, signOut } }
}

function authAdmin(users: AuthTestUser[] = TARGET_EMAILS) {
  createAdminClient.mockReturnValue({ auth: { admin: { generateLink, listUsers } } })
  listUsers.mockResolvedValue({ data: { users, lastPage: 1 }, error: null })
}

describe('POST /api/auth/test-role-switch', () => {
  beforeEach(() => {
    createClient.mockReset()
    createAdminClient.mockReset()
    getClaims.mockReset()
    signOut.mockReset()
    generateLink.mockReset()
    listUsers.mockReset()
    enableSwitcher()
    createClient.mockImplementation(async () => setIdentity('edwin@editsolutions.nl'))
    authAdmin()
    getLocalPayrollPersonaReadiness.mockImplementation(async (key: string) => ({
      key,
      status: key === 'payroll-lisa' ? 'available' : 'account-required',
      available: key === 'payroll-lisa',
      canStartSignIn: key === 'payroll-lisa',
      canProvision: key !== 'payroll-lisa',
      authUserId: key === 'payroll-lisa' ? 'user-5' : null,
    }))
    generateLink.mockResolvedValue({ data: { properties: { hashed_token: 'one-time-hash' } }, error: null })
    signOut.mockResolvedValue({ error: null })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('rejects a noncanonical TEST project before reading identity or creating an admin client', async () => {
    enableSwitcher('https://other-project.supabase.co')

    const response = await POST(switchRequest('manager'))

    expect(response.status).toBe(404)
    expect(getClaims).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('rejects hosted Preview and Production even if the feature flag is set', async () => {
    for (const vercelEnv of ['preview', 'production']) {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('VERCEL', '1')
      vi.stubEnv('VERCEL_ENV', vercelEnv)
      vi.stubEnv('VERCEL_URL', 'liquid-hr-preview.vercel.app')

      const request = switchRequest('manager', undefined, 'https://liquid-hr-preview.vercel.app', 'https://liquid-hr-preview.vercel.app')
      const response = await POST(request)

      expect(response.status).toBe(404)
      expect(getClaims).not.toHaveBeenCalled()
      expect(createAdminClient).not.toHaveBeenCalled()
      enableSwitcher()
    }
  })

  it('rejects nonlocal hosts in local Development', async () => {
    const response = await POST(switchRequest('manager', undefined, 'https://app.example.com', 'https://app.example.com'))

    expect(response.status).toBe(404)
    expect(getClaims).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('rejects cross-origin requests even when forwarded host headers try to override the request', async () => {
    const request = new NextRequest(`${LOCAL_ORIGIN}/api/auth/test-role-switch`, {
      method: 'POST',
      headers: {
        origin: 'https://attacker.example',
        host: '127.0.0.1:3010',
        'x-forwarded-host': 'attacker.example',
        'x-forwarded-proto': 'https',
      },
      body: new URLSearchParams({ target: 'manager' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(404)
    expect(getClaims).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('allows verified Edwin without any HR or tenant administrator role', async () => {
    createClient.mockImplementation(async () => setIdentity('edwin@editsolutions.nl'))

    const response = await POST(switchRequest('manager'))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${LOCAL_ORIGIN}/auth/test-role-switch/confirm`)
    expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'manager.fixture@liquidhr.test' })
    expect(signOut).toHaveBeenCalledOnce()
    expect(readLocalPersonaOwnerMarker(response.cookies.get(TEST_ROLE_SWITCH_OWNER_COOKIE)?.value)).toBe('edwin')
  })

  it('allows the verified Test HR Admin operator directly and binds the return to that account', async () => {
    createClient.mockImplementation(async () => setIdentity('hradmin.fixture@liquidhr.test'))

    const response = await POST(switchRequest('payroll-lisa'))

    expect(response.status).toBe(303)
    expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'lisa.test@liquidhr.test' })
    expect(readLocalPersonaOwnerMarker(response.cookies.get(TEST_ROLE_SWITCH_OWNER_COOKIE)?.value)).toBe('hr-admin')
  })

  it('rejects an unverified Edwin identity', async () => {
    createClient.mockImplementation(async () => setIdentity('edwin@editsolutions.nl', false))

    const response = await POST(switchRequest('manager'))

    expect(response.status).toBe(403)
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(generateLink).not.toHaveBeenCalled()
  })

  it('rejects a nonallowlisted identity even when its business role is an administrator', async () => {
    createClient.mockImplementation(async () => setIdentity('other@example.com'))

    const response = await POST(switchRequest('manager'))

    expect(response.status).toBe(403)
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(generateLink).not.toHaveBeenCalled()
  })

  it('allows a persona to return only to its signed initiating account', async () => {
    createClient.mockImplementation(async () => setIdentity('manager.fixture@liquidhr.test'))
    const ownerMarker = createLocalPersonaOwnerMarker('edwin')

    const response = await POST(switchRequest('edwin', undefined, LOCAL_ORIGIN, LOCAL_ORIGIN, ownerMarker))

    expect(response.status).toBe(303)
    expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'edwin@editsolutions.nl' })
  })

  it('returns a persona to Test HR Admin only when that account started the local session', async () => {
    createClient.mockImplementation(async () => setIdentity('manager.fixture@liquidhr.test'))
    const ownerMarker = createLocalPersonaOwnerMarker('hr-admin')

    const response = await POST(switchRequest('hr-admin', undefined, LOCAL_ORIGIN, LOCAL_ORIGIN, ownerMarker))

    expect(response.status).toBe(303)
    expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'hradmin.fixture@liquidhr.test' })
  })

  it('does not allow a persona to change its initiating account', async () => {
    createClient.mockImplementation(async () => setIdentity('manager.fixture@liquidhr.test'))
    const ownerMarker = createLocalPersonaOwnerMarker('edwin')

    const response = await POST(switchRequest('hr-admin', undefined, LOCAL_ORIGIN, LOCAL_ORIGIN, ownerMarker))

    expect(response.status).toBe(403)
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('does not let a persona switch to another persona', async () => {
    createClient.mockImplementation(async () => setIdentity('manager.fixture@liquidhr.test'))

    const response = await POST(switchRequest('payroll-lisa'))

    expect(response.status).toBe(403)
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it.each(['payroll-jaap', 'payroll-frits'])('keeps %s unavailable before any Auth operation', async (target) => {
    const response = await POST(switchRequest(target))

    expect(response.status).toBe(503)
    expect(createAdminClient).toHaveBeenCalledOnce()
    expect(getLocalPayrollPersonaReadiness).toHaveBeenCalledWith(target, expect.any(Object))
    expect(generateLink).not.toHaveBeenCalled()
  })

  it.each([
    ['payroll-jaap', 'jaap.test@liquidhr.test'],
    ['payroll-frits', 'frits.test@liquidhr.test'],
  ])('starts a one-time first sign-in for %s only after its Core link is ready', async (target, email) => {
    createClient.mockImplementation(async () => setIdentity('hradmin.fixture@liquidhr.test'))
    getLocalPayrollPersonaReadiness.mockImplementation(async (key: string) => ({
      key,
      status: key === target ? 'first-sign-in-required' : 'account-required',
      available: false,
      canStartSignIn: key === target,
      canProvision: false,
      authUserId: key === target ? 'linked-target-user' : null,
    }))

    const response = await POST(switchRequest(target))

    expect(response.status).toBe(303)
    expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email })
    expect(response.cookies.get('liquidhr-local-persona-handoff')?.httpOnly).toBe(true)
  })

  it('refuses to generate a link for a missing or unconfirmed Auth identity', async () => {
    authAdmin([{ ...TARGET_EMAILS[1]!, email_confirmed_at: null }])

    const response = await POST(switchRequest('hr-admin'))

    expect(response.status).toBe(503)
    expect(generateLink).not.toHaveBeenCalled()
    expect(signOut).not.toHaveBeenCalled()
  })

  it('keeps the one-time Auth handoff in a short-lived HttpOnly cookie only', async () => {
    const response = await POST(switchRequest('hr-admin'))

    expect(response.status).toBe(303)
    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('liquidhr-local-persona-handoff=one-time-hash')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Max-Age=60')
    expect(cookie).toContain('SameSite=lax')
    expect(response.cookies.get(TEST_ROLE_SWITCH_OWNER_COOKIE)?.httpOnly).toBe(true)
    expect(response.cookies.get(TEST_ROLE_SWITCH_OWNER_COOKIE)?.sameSite).toBe('strict')
    expect(response.cookies.get(TEST_ROLE_SWITCH_OWNER_COOKIE)?.maxAge).toBe(60 * 60 * 8)
    expect(cookie).not.toContain('access_token')
    expect(cookie).not.toContain('refresh_token')
    for (const name of [ACTIVE_TENANT_COOKIE, ACTIVE_HR_GROUP_COOKIE, ACTIVE_ADMINISTRATION_COOKIE]) {
      expect(response.cookies.get(name)?.value).toBe('')
    }
  })

  it('stores only a validated relative post-switch path', async () => {
    const response = await POST(switchRequest('manager', 'https://attacker.example'))

    expect(response.status).toBe(303)
    const cookies = response.headers.get('set-cookie') ?? ''
    expect(cookies).not.toContain('attacker.example')
    expect(generateLink).toHaveBeenCalledOnce()
  })

  it('does not mint a new link when the current user selects their own account', async () => {
    const response = await POST(switchRequest('edwin'))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${LOCAL_ORIGIN}/dashboard/start`)
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(signOut).not.toHaveBeenCalled()
  })
})
