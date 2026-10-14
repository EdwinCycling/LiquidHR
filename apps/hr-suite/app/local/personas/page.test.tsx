import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { headers, notFound, createClient, getClaims, getRequestAuthorizationContext } = vi.hoisted(() => ({
  headers: vi.fn(),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
  createClient: vi.fn(),
  getClaims: vi.fn(),
  getRequestAuthorizationContext: vi.fn(),
}))

vi.mock('next/headers', () => ({ headers }))
vi.mock('next/navigation', () => ({ notFound }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/auth/permissions', () => ({ getRequestAuthorizationContext }))
vi.mock('@/lib/i18n/server', () => ({ getTranslator: async () => (key: string) => key }))

import { renderToStaticMarkup } from 'react-dom/server'
import LocalPersonasPage from './page'

const CANONICAL_SUPABASE_URL = 'https://wnpfloqpjvaacobppbpk.supabase.co'

function setIdentity(email: string, emailVerified = true, sub = 'auth-owner') {
  getClaims.mockResolvedValue({
    data: { claims: { sub, email, email_verified: emailVerified } },
    error: null,
  })
  createClient.mockResolvedValue({ auth: { getClaims } })
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
    notFound.mockClear()
    createClient.mockReset()
    getClaims.mockReset()
    getRequestAuthorizationContext.mockReset()
    getRequestAuthorizationContext.mockResolvedValue({ context: { userId: 'auth-owner', activeRoles: ['EMPLOYEE'] } })
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
    expect(markup).not.toContain('edwin@editsolutions.nl')
    expect(notFound).not.toHaveBeenCalled()
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

  it('shows only the safe return action for an authenticated non-owner persona', async () => {
    setIdentity('manager.fixture@liquidhr.test', true, 'auth-manager')

    const markup = await renderPage()

    expect(markup).toContain('value="edwin"')
    expect(markup).toContain('localPersonaReturn')
    expect(markup).not.toContain('local-persona-target')
    expect(getRequestAuthorizationContext).not.toHaveBeenCalled()
  })
})
