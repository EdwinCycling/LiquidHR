import { isValidElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, getAuthorizationDetails, getClaims, getTranslator, redirect, resolveEmployeeSelfContext } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getAuthorizationDetails: vi.fn(),
  getClaims: vi.fn(),
  getTranslator: vi.fn(),
  redirect: vi.fn(),
  resolveEmployeeSelfContext: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/api-v1/auth/employee-self-context', () => ({ resolveEmployeeSelfContext }))
vi.mock('@/lib/i18n/server', () => ({ getTranslator }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import OAuthConsentPage from './page'

const AUTHORIZATION_ID = 'f6a4c2e8b1d3a5f70918273645546321'
const CALLBACK_URL = 'https://chatgpt.com/connector/oauth/callback'
const RESOURCE_URL = 'https://liquid-hr-hr-suite.vercel.app/mcp'

function response(authorizationId = AUTHORIZATION_ID, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    authorization_id: authorizationId,
    client: { id: 'dynamic-client-id', name: 'ChatGPT' },
    redirect_uri: CALLBACK_URL,
    scope: 'openid email offline_access',
    resource: RESOURCE_URL,
    user: { id: null, email: null },
    ...overrides,
  }
}

function pageText(node: ReactNode): string[] {
  if (typeof node === 'string' || typeof node === 'number') return [String(node)]
  if (Array.isArray(node)) return node.flatMap(pageText)
  if (isValidElement<{ readonly children?: ReactNode }>(node)) return pageText(node.props.children)
  return []
}

describe('GET /oauth/consent page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getTranslator.mockImplementation(async () => (key: string) => key)
    getAuthorizationDetails.mockResolvedValue({ data: response(), error: null })
    getClaims.mockResolvedValue({ data: { claims: { sub: 'synthetic-employee-user' } }, error: null })
    resolveEmployeeSelfContext.mockResolvedValue({
      kind: 'resolved',
      context: { employeeId: 'employee-fixture-id', activeRoles: ['EMPLOYEE'] },
    })
    createClient.mockResolvedValue({ auth: { getClaims, oauth: { getAuthorizationDetails } } })
    redirect.mockImplementation((destination: string) => {
      throw new Error(`NEXT_REDIRECT:${destination}`)
    })
  })

  it('authenticates before loading pending details and shows Supabase metadata with pre-consent user_id NULL', async () => {
    const page = await OAuthConsentPage({ searchParams: Promise.resolve({ authorization_id: AUTHORIZATION_ID }) })
    const text = pageText(page)

    expect(getAuthorizationDetails).toHaveBeenCalledWith(AUTHORIZATION_ID)
    expect(getClaims.mock.invocationCallOrder[0]).toBeLessThan(getAuthorizationDetails.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER)
    expect(resolveEmployeeSelfContext).toHaveBeenCalledWith(expect.any(Object), 'synthetic-employee-user')
    expect(text).toContain('ChatGPT')
    expect(text).toContain(CALLBACK_URL)
    expect(text).toContain('openid email offline_access')
    expect(text).toContain(RESOURCE_URL)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('allows a uniquely resolved Employee context without consulting a stale dashboard context cookie', async () => {
    const supabaseClient = {
      auth: {
        getClaims,
        oauth: { getAuthorizationDetails },
      },
    }
    createClient.mockResolvedValue(supabaseClient)
    resolveEmployeeSelfContext.mockResolvedValueOnce({
      kind: 'resolved',
      context: { tenantId: 'employee-tenant', hrGroupId: 'employee-group', administrationId: 'employee-administration', userId: 'synthetic-employee-user', employeeId: 'employee-fixture-id', activeRoles: ['EMPLOYEE'] },
    })

    const page = await OAuthConsentPage({ searchParams: Promise.resolve({ authorization_id: AUTHORIZATION_ID }) })
    const text = pageText(page)

    expect(resolveEmployeeSelfContext).toHaveBeenCalledWith(supabaseClient, 'synthetic-employee-user')
    expect(text).toContain('oauthConsentApprove')
    expect(text).toContain('ChatGPT')
  })

  it.each([
    ['no Employee self context', { kind: 'none' }],
    ['multiple Employee contexts', { kind: 'selection-required' }],
  ] as const)('keeps Allow hidden for %s', async (_case, resolution) => {
    resolveEmployeeSelfContext.mockResolvedValueOnce(resolution)

    const page = await OAuthConsentPage({ searchParams: Promise.resolve({ authorization_id: AUTHORIZATION_ID }) })
    const text = pageText(page)

    expect(text).not.toContain('oauthConsentApprove')
    expect(text).toContain(resolution.kind === 'none' ? 'oauthConsentNoEmployeeContext' : 'oauthConsentContextSelectionRequired')
    expect(text).toContain('oauthConsentDeny')
  })

  it('sends an unauthenticated browser to login and preserves the same consent request', async () => {
    getAuthorizationDetails.mockResolvedValue({ data: null, error: new Error('session missing') })
    getClaims.mockResolvedValue({ data: null, error: new Error('session missing') })

    await expect(OAuthConsentPage({ searchParams: Promise.resolve({ authorization_id: AUTHORIZATION_ID }) }))
      .rejects.toThrow(`NEXT_REDIRECT:/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${AUTHORIZATION_ID}`)}`)

    expect(getAuthorizationDetails).not.toHaveBeenCalled()
  })

  it('does not display or follow an authorization response for a different browser flow', async () => {
    getAuthorizationDetails.mockResolvedValue({ data: response('b75c81269c6c4697a18359a2a6d9d08c'), error: null })

    const page = await OAuthConsentPage({ searchParams: Promise.resolve({ authorization_id: AUTHORIZATION_ID }) })
    const text = pageText(page)

    expect(text).toContain('oauthConsentInvalidRequest')
    expect(text).not.toContain('ChatGPT')
    expect(redirect).not.toHaveBeenCalled()
  })

  it('fails closed when Supabase reports an already-resolved authorization', async () => {
    getAuthorizationDetails.mockResolvedValue({ data: { redirect_url: `${CALLBACK_URL}?code=old&state=old` }, error: null })

    const page = await OAuthConsentPage({ searchParams: Promise.resolve({ authorization_id: AUTHORIZATION_ID }) })
    const text = pageText(page)

    expect(text).toContain('oauthConsentInvalidRequest')
    expect(redirect).not.toHaveBeenCalled()
  })

  it('rejects a missing or repeated authorization_id before contacting Supabase', async () => {
    await OAuthConsentPage({ searchParams: Promise.resolve({}) })
    await OAuthConsentPage({ searchParams: Promise.resolve({ authorization_id: [AUTHORIZATION_ID, AUTHORIZATION_ID] }) })

    expect(createClient).not.toHaveBeenCalled()
    expect(getAuthorizationDetails).not.toHaveBeenCalled()
  })
})
