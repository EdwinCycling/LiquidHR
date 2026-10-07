import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildConsentLoginHref, buildConsentPath } from './authorization'

const {
  approveAuthorization,
  createAdminClient,
  createClient,
  denyAuthorization,
  getAuthorizationDetails,
  getClaims,
  redirect,
  requireAuthContext,
  rpc,
} = vi.hoisted(() => ({
  approveAuthorization: vi.fn(),
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  denyAuthorization: vi.fn(),
  getAuthorizationDetails: vi.fn(),
  getClaims: vi.fn(),
  redirect: vi.fn(),
  requireAuthContext: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/auth/permissions', () => ({ requireAuthContext }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { approveChatGptMcpConsent, denyChatGptMcpConsent } from './actions'

const AUTHORIZATION_ID = '1b72f03c-a41c-4b81-9d71-4f8a377b1064'
const CALLBACK_URL = 'https://chatgpt.com/connector/oauth/callback?code=issued-code&state=client-state'
const DENY_URL = 'https://chatgpt.com/connector/oauth/callback?error=access_denied&state=client-state'

function authorizationDetails(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    authorization_id: AUTHORIZATION_ID,
    client: { id: 'dynamic-client-id', name: 'ChatGPT' },
    redirect_uri: 'https://chatgpt.com/connector/oauth/callback',
    scope: 'openid email offline_access',
    user: { id: null, email: null },
    ...overrides,
  }
}

function formData(authorizationId = AUTHORIZATION_ID): FormData {
  const form = new FormData()
  form.set('authorization_id', authorizationId)
  return form
}

describe('APIAI-07 OAuth consent actions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getAuthorizationDetails.mockResolvedValue({ data: authorizationDetails(), error: null })
    getClaims.mockResolvedValue({ data: { claims: { sub: 'synthetic-employee-user' } }, error: null })
    approveAuthorization.mockResolvedValue({ data: { redirect_url: CALLBACK_URL }, error: null })
    denyAuthorization.mockResolvedValue({ data: { redirect_url: DENY_URL }, error: null })
    rpc.mockResolvedValue({ data: 'dynamic-client-id', error: null })
    requireAuthContext.mockResolvedValue({ employeeId: 'synthetic-employee', activeRoles: ['EMPLOYEE'] })
    createAdminClient.mockReturnValue({ rpc })
    createClient.mockResolvedValue({
      auth: {
        getClaims,
        oauth: { getAuthorizationDetails, approveAuthorization, denyAuthorization },
      },
    })
    redirect.mockImplementation((destination: string) => {
      throw new Error(`NEXT_REDIRECT:${destination}`)
    })
  })

  it('uses Supabase details and current Employee auth without requiring a pre-consent user_id', async () => {
    await expect(approveChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${CALLBACK_URL}`)

    expect(getAuthorizationDetails).toHaveBeenCalledWith(AUTHORIZATION_ID)
    expect(getAuthorizationDetails.mock.invocationCallOrder[0]).toBeLessThan(getClaims.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER)
    expect(approveAuthorization).toHaveBeenCalledWith(AUTHORIZATION_ID, { skipBrowserRedirect: true })
    expect(approveAuthorization.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER)
    expect(rpc).toHaveBeenCalledWith('register_apiai07_mcp_client', { requested_client_id: 'dynamic-client-id' })
  })

  it('preserves the same authorization_id when direct approval has no authenticated session', async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error('session missing') })

    await expect(approveChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${buildConsentLoginHref(AUTHORIZATION_ID)}`)

    expect(approveAuthorization).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it.each([
    ['unknown authorization', { data: null, error: new Error('not found') }],
    ['expired authorization', { data: null, error: new Error('expired') }],
    ['already approved authorization', { data: { redirect_url: CALLBACK_URL }, error: null }],
    ['stale or swapped browser flow', { data: authorizationDetails({ authorization_id: 'b75c8126-9c6c-4697-a183-59a2a6d9d08c' }), error: null }],
    ['unsupported scopes', { data: authorizationDetails({ scope: 'openid api:write' }), error: null }],
    ['untrusted redirect URI', { data: authorizationDetails({ redirect_uri: 'https://attacker.example/callback' }), error: null }],
  ])('fails closed for %s', async (_label, response) => {
    getAuthorizationDetails.mockResolvedValue(response)

    await expect(approveChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${buildConsentPath(AUTHORIZATION_ID)}`)

    expect(approveAuthorization).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('uses the Supabase callback and ignores a form-supplied redirect URI', async () => {
    const form = formData()
    form.set('redirect_uri', 'https://attacker.example/callback')

    await expect(approveChatGptMcpConsent(form)).rejects.toThrow(`NEXT_REDIRECT:${CALLBACK_URL}`)

    expect(approveAuthorization).toHaveBeenCalledOnce()
  })

  it('requires the Employee self context before calling Supabase approval', async () => {
    requireAuthContext.mockResolvedValue({ employeeId: 'synthetic-employee', activeRoles: ['HR_ADMIN', 'EMPLOYEE'] })

    await expect(approveChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${buildConsentPath(AUTHORIZATION_ID)}`)

    expect(approveAuthorization).not.toHaveBeenCalled()
  })

  it('denies through Supabase and follows only its validated ChatGPT callback', async () => {
    await expect(denyChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${DENY_URL}`)

    expect(denyAuthorization).toHaveBeenCalledWith(AUTHORIZATION_ID, { skipBrowserRedirect: true })
    expect(approveAuthorization).not.toHaveBeenCalled()
  })

  it('rejects callback responses with unexpected query parameters', async () => {
    approveAuthorization.mockResolvedValue({
      data: { redirect_url: 'https://chatgpt.com/connector/oauth/callback?code=issued&redirect_uri=https://attacker.example' },
      error: null,
    })

    await expect(approveChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${buildConsentPath(AUTHORIZATION_ID)}`)

    expect(rpc).not.toHaveBeenCalled()
  })
})
