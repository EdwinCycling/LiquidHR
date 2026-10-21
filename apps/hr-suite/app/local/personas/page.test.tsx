import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { cookies, headers, notFound, createClient, createAdminClient, getLocalPayrollPersonaReadiness, getClaims, getUser, getRequestAuthorizationContext, requireComponentLibraryAccess } = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getLocalPayrollPersonaReadiness: vi.fn(),
  getClaims: vi.fn(),
  getUser: vi.fn(),
  getRequestAuthorizationContext: vi.fn(),
  requireComponentLibraryAccess: vi.fn(),
}))

vi.mock('next/headers', () => ({ cookies, headers }))
vi.mock('next/navigation', () => ({ notFound }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))
vi.mock('@/lib/auth/local-payroll-persona-readiness', () => ({
  getLocalPayrollPersonaReadiness,
  PAYFULL02_MARS_SCOPE: {
    tenantId: '07249eb9-545c-883b-b26b-d52f83b4f4a1',
    hrGroupId: '6ba6f1df-e376-40f2-abff-ffdf000172e1',
    administrationId: '2057f6ec-cd3e-3c28-9126-c41235d4ffae',
  },
}))
vi.mock('@/lib/auth/permissions', () => ({ getRequestAuthorizationContext }))
vi.mock('@/lib/payroll/component-library-access', () => ({ requireComponentLibraryAccess }))
vi.mock('@/lib/i18n/server', () => ({ getTranslator: async () => (key: string) => key }))

import { renderToStaticMarkup } from 'react-dom/server'
import { createLocalPersonaOwnerMarker, TEST_ROLE_SWITCH_OWNER_COOKIE } from '@/lib/auth/test-role-switch'
import LocalPersonasPage from './page'

const CANONICAL_SUPABASE_URL = 'https://wnpfloqpjvaacobppbpk.supabase.co'

function setIdentity(email: string, emailVerified = true, sub = 'auth-owner') {
  getClaims.mockResolvedValue({
    data: { claims: { sub, email, email_verified: emailVerified } },
    error: null,
  })
  getUser.mockResolvedValue({ data: { user: { id: sub, email, email_confirmed_at: emailVerified ? '2026-01-01T00:00:00Z' : null, is_anonymous: false } }, error: null })
  createClient.mockResolvedValue({ auth: { getClaims, getUser } })
}

async function renderPage(): Promise<string> {
  return renderToStaticMarkup(await LocalPersonasPage())
}

describe('/local/personas', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('VERCEL_URL', '')
    vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', 'true')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', CANONICAL_SUPABASE_URL)
    headers.mockResolvedValue({ get: (name: string) => name === 'host' ? '127.0.0.1:3010' : null })
    cookies.mockResolvedValue({ get: () => undefined })
    notFound.mockClear()
    createClient.mockReset()
    createAdminClient.mockReset()
    getLocalPayrollPersonaReadiness.mockReset()
    getClaims.mockReset()
    getUser.mockReset()
    getRequestAuthorizationContext.mockReset()
    requireComponentLibraryAccess.mockReset()
    getRequestAuthorizationContext.mockResolvedValue({ context: { userId: 'auth-owner', activeRoles: ['EMPLOYEE'] } })
    createAdminClient.mockReturnValue({})
    getLocalPayrollPersonaReadiness.mockImplementation(async (key: string) => ({
      key,
      status: key === 'payroll-lisa' ? 'available' : 'account-required',
      available: key === 'payroll-lisa',
      canStartSignIn: key === 'payroll-lisa',
      canProvision: key !== 'payroll-lisa',
      authUserId: null,
    }))
    setIdentity('edwin@editsolutions.nl')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('shows the local switcher to verified Edwin without an administrator business role', async () => {
    const markup = await renderPage()

    expect(markup).toContain('EMPLOYEE')
    expect(markup).toContain('localPersonaGuardWouldDeny')
    expect(markup).toContain('localPersonaGuardAllowed')
    expect(markup).toContain('value="payroll-jaap"')
    expect(markup).toContain('disabled')
    expect(markup).not.toContain('action="/api/local/personas/provision"')
    expect(markup).not.toContain('edwin@editsolutions.nl')
    expect(notFound).not.toHaveBeenCalled()
  })

  it('allows the verified HR Admin operator directly and limits its choices to the three payroll personas', async () => {
    setIdentity('hradmin.fixture@liquidhr.test', true, 'auth-hr-admin')
    getRequestAuthorizationContext.mockResolvedValue({ context: { userId: 'auth-hr-admin', activeRoles: ['TENANT_ADMIN'] } })

    const markup = await renderPage()

    expect(markup).toContain('value="payroll-lisa"')
    expect(markup).toContain('value="payroll-jaap"')
    expect(markup).toContain('value="payroll-frits"')
    expect(markup).not.toContain('value="manager"')
    expect(markup).not.toContain('value="employee"')
    expect(markup).toContain('action="/api/local/personas/provision"')
    expect(markup).toContain('localPersonaProvisionDescription')
  })

  it('does not offer a linked payroll account without customer context access', async () => {
    setIdentity('hradmin.fixture@liquidhr.test', true, 'auth-hr-admin')
    getLocalPayrollPersonaReadiness.mockImplementation(async (key: string) => ({
      key,
      status: key === 'payroll-lisa' ? 'available' : 'context-access-required',
      available: key === 'payroll-lisa',
      canStartSignIn: key === 'payroll-lisa',
      canProvision: false,
      authUserId: 'existing-auth-user',
    }))

    const markup = await renderPage()

    expect(markup).toContain('localPersonaContextAccessRequired')
    expect(markup).toMatch(/<option disabled="" value="payroll-jaap"/)
    expect(markup).toMatch(/<option disabled="" value="payroll-frits"/)
    expect(markup).not.toContain('action="/api/local/personas/provision"')
  })

  it('does not offer DEMO-002 provisioning to a different Mars admin than the RPC-authorized fixture operator', async () => {
    setIdentity('mars.hradmin@liquidhr.test', true, 'auth-other-mars-admin')
    requireComponentLibraryAccess.mockResolvedValue({ scope: {
      tenantId: '07249eb9-545c-883b-b26b-d52f83b4f4a1',
      hrGroupId: '6ba6f1df-e376-40f2-abff-ffdf000172e1',
      administrationId: '2057f6ec-cd3e-3c28-9126-c41235d4ffae',
    } })

    const markup = await renderPage()

    expect(markup).toContain('localPersonaPayrollDemo002')
    expect(markup).not.toContain('action="/api/local/personas/provision"')
    expect(requireComponentLibraryAccess).toHaveBeenCalledWith(true)
  })

  it('does not render for an unverified allowlisted identity', async () => {
    setIdentity('edwin@editsolutions.nl', false)

    await expect(renderPage()).rejects.toThrow('NOT_FOUND')
    expect(getRequestAuthorizationContext).not.toHaveBeenCalled()
  })

  it('does not render for a nonallowlisted identity even with an administrator role', async () => {
    setIdentity('other@example.com')

    await expect(renderPage()).rejects.toThrow('NOT_FOUND')
    expect(getRequestAuthorizationContext).not.toHaveBeenCalled()
  })

  it('does not render on a hosted hostname', async () => {
    headers.mockResolvedValue({ get: (name: string) => name === 'host' ? 'liquidhr-preview.vercel.app' : null })

    await expect(renderPage()).rejects.toThrow('NOT_FOUND')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('shows only the safe return action to the signed initiating account for a non-owner persona', async () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', 'unit-test-only-owner-marker-secret')
    const marker = createLocalPersonaOwnerMarker('hr-admin')
    cookies.mockResolvedValue({
      get: (name: string) => name === TEST_ROLE_SWITCH_OWNER_COOKIE && marker ? { value: marker } : undefined,
    })
    setIdentity('manager.fixture@liquidhr.test', true, 'auth-manager')

    const markup = await renderPage()

    expect(markup).toContain('value="hr-admin"')
    expect(markup).toContain('localPersonaReturn')
    expect(markup).not.toContain('local-persona-target')
    expect(getRequestAuthorizationContext).not.toHaveBeenCalled()
  })
})
