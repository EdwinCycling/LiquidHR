import { readFile } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildConsentLoginHref, buildConsentPath, OAUTH_DECISION_ERROR_PATH } from './authorization'

const {
  approveAuthorization,
  createAdminClient,
  createClient,
  denyAuthorization,
  getAuthorizationDetails,
  getClaims,
  isRemoteMcpEnabled,
  redirect,
  resolveEmployeeSelfContext,
  rpc,
} = vi.hoisted(() => ({
  approveAuthorization: vi.fn(),
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  denyAuthorization: vi.fn(),
  getAuthorizationDetails: vi.fn(),
  getClaims: vi.fn(),
  isRemoteMcpEnabled: vi.fn(),
  redirect: vi.fn(),
  resolveEmployeeSelfContext: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/api-v1/auth/employee-self-context', () => ({ resolveEmployeeSelfContext }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/workforce-tools/mcp/remote-config', () => ({ isRemoteMcpEnabled }))

import { approveChatGptMcpConsent, denyChatGptMcpConsent } from './actions'

const AUTHORIZATION_ID = 'f6a4c2e8b1d3a5f70918273645546321'
const DECISION_ERROR_PATH = OAUTH_DECISION_ERROR_PATH
const CALLBACK_URL = 'https://chatgpt.com/connector/oauth/callback?code=issued-code&state=client-state&iss=https%3A%2F%2Fwnpfloqpjvaacobppbpk.supabase.co%2Fauth%2Fv1'
const DENY_URL = 'https://chatgpt.com/connector/oauth/callback?error=access_denied&state=client-state'

function authorizationDetails(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    authorization_id: AUTHORIZATION_ID,
    client: { id: 'b7e6b5ae-33be-493f-8456-02fa41e307e8', name: 'ChatGPT' },
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
    isRemoteMcpEnabled.mockReturnValue(false)
    getAuthorizationDetails.mockResolvedValue({ data: authorizationDetails(), error: null })
    getClaims.mockResolvedValue({ data: { claims: { sub: 'synthetic-employee-user' } }, error: null })
    approveAuthorization.mockResolvedValue({ data: { redirect_url: CALLBACK_URL }, error: null })
    denyAuthorization.mockResolvedValue({ data: { redirect_url: DENY_URL }, error: null })
    rpc.mockResolvedValue({ data: { registered: true }, error: null })
    resolveEmployeeSelfContext.mockResolvedValue({
      kind: 'resolved',
      context: { tenantId: 'tenant-1', hrGroupId: 'group-1', administrationId: 'admin-1', userId: 'synthetic-employee-user', employeeId: 'synthetic-employee', activeRoles: ['EMPLOYEE'] },
    })
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

  it('follows the exact Supabase approval redirect without loading the consumed authorization again', async () => {
    await expect(approveChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${CALLBACK_URL}`)

    expect(getAuthorizationDetails).toHaveBeenCalledWith(AUTHORIZATION_ID)
    expect(getAuthorizationDetails).toHaveBeenCalledOnce()
    expect(getClaims.mock.invocationCallOrder[0]).toBeLessThan(getAuthorizationDetails.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER)
    expect(resolveEmployeeSelfContext).toHaveBeenCalledWith(expect.any(Object), 'synthetic-employee-user')
    expect(approveAuthorization).toHaveBeenCalledWith(AUTHORIZATION_ID, { skipBrowserRedirect: true })
    expect(approveAuthorization).toHaveBeenCalledOnce()
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(approveAuthorization.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER)
    expect(rpc).toHaveBeenCalledWith('register_apiai07_mcp_client', { requested_client_id: 'b7e6b5ae-33be-493f-8456-02fa41e307e8' })
    expect(redirect).toHaveBeenCalledWith(CALLBACK_URL)
    expect(redirect).not.toHaveBeenCalledWith(expect.stringContaining('/oauth/consent'))
    expect(redirect).not.toHaveBeenCalledWith(expect.stringContaining(AUTHORIZATION_ID))
  })

  it('fails closed before approval when trusted client registration fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'APIAI07_CLIENT_REGISTRATION_UNAVAILABLE' } })

    await expect(approveChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${DECISION_ERROR_PATH}`)

    expect(rpc).toHaveBeenCalledWith('register_apiai07_mcp_client', { requested_client_id: 'b7e6b5ae-33be-493f-8456-02fa41e307e8' })
    expect(rpc).toHaveBeenCalledOnce()
    expect(approveAuthorization).not.toHaveBeenCalled()
    expect(redirect).toHaveBeenCalledWith(DECISION_ERROR_PATH)
    expect(redirect).not.toHaveBeenCalledWith(expect.stringContaining(AUTHORIZATION_ID))
  })

  it('fails closed when the RPC does not confirm registration', async () => {
    rpc.mockResolvedValue({ data: { registered: false }, error: null })

    await expect(approveChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${DECISION_ERROR_PATH}`)

    expect(rpc).toHaveBeenCalledOnce()
    expect(approveAuthorization).not.toHaveBeenCalled()
  })

  it('logs only sanitized registration diagnostics in the TEST environment', async () => {
    isRemoteMcpEnabled.mockReturnValue(true)
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        message: 'permission denied for client b7e6b5ae-33be-493f-8456-02fa41e307e8 and edwin@example.test; token=eyJabcdefgh.opaque.signature; authorization_code=short-secret',
      },
    })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await expect(approveChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${DECISION_ERROR_PATH}`)

      expect(log).toHaveBeenCalledWith('[APIAI07_CONSENT_CLIENT_REGISTRATION_FAILED]', {
        clientIdentifierPresent: true,
        clientIdentifierType: 'string',
        failureStage: 'registration-rpc',
        rpcErrorCode: '42501',
        rpcErrorMessage: 'permission denied for client [redacted-id] and [redacted-email]; token=[redacted]; authorization_code=[redacted]',
      })
      expect(JSON.stringify(log.mock.calls)).not.toContain('b7e6b5ae-33be-493f-8456-02fa41e307e8')
      expect(JSON.stringify(log.mock.calls)).not.toContain('edwin@example.test')
      expect(JSON.stringify(log.mock.calls)).not.toContain('eyJabcdefgh')
      expect(JSON.stringify(log.mock.calls)).not.toContain('short-secret')
    } finally {
      log.mockRestore()
    }
  })

  it('does not log registration diagnostics outside the TEST environment', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'registration unavailable' } })

    try {
      await expect(approveChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${DECISION_ERROR_PATH}`)
      expect(log).not.toHaveBeenCalled()
    } finally {
      log.mockRestore()
    }
  })

  it.each([
    ['missing ID', authorizationDetails({ client: { name: 'ChatGPT' } })],
    ['malformed ID', authorizationDetails({ client: { id: 'not-a-uuid', name: 'ChatGPT' } })],
  ])('does not register or approve when Supabase returns a %s', async (_label, details) => {
    getAuthorizationDetails.mockResolvedValue({ data: details, error: null })

    await expect(approveChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${buildConsentPath(AUTHORIZATION_ID)}`)

    expect(rpc).not.toHaveBeenCalled()
    expect(approveAuthorization).not.toHaveBeenCalled()
  })

  it('keeps client registration server-only', async () => {
    const actionSource = await readFile(new URL('./actions.ts', import.meta.url), 'utf8')
    const adminSource = await readFile(new URL('../../../lib/supabase/admin.ts', import.meta.url), 'utf8')

    expect(actionSource.startsWith("'use server'")).toBe(true)
    expect(actionSource).toContain("import { createAdminClient } from '@/lib/supabase/admin'")
    expect(adminSource).toContain("import 'server-only'")
    expect(adminSource).toContain('SUPABASE_SECRET_KEY')
  })

  it('registers a newly issued ChatGPT DCR client ID from Supabase details', async () => {
    const newClientId = 'df25c01f-5b70-4e53-9fe6-a1a2cc01d382'
    getAuthorizationDetails.mockResolvedValue({
      data: authorizationDetails({ client: { id: newClientId, name: 'ChatGPT' } }),
      error: null,
    })

    await expect(approveChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${CALLBACK_URL}`)

    expect(rpc).toHaveBeenCalledWith('register_apiai07_mcp_client', { requested_client_id: newClientId })
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(approveAuthorization.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER)
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
    ['stale or swapped browser flow', { data: authorizationDetails({ authorization_id: 'b75c81269c6c4697a18359a2a6d9d08c' }), error: null }],
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
    form.set('client_id', '00000000-0000-4000-8000-000000000099')

    await expect(approveChatGptMcpConsent(form)).rejects.toThrow(`NEXT_REDIRECT:${CALLBACK_URL}`)

    expect(rpc).toHaveBeenCalledWith('register_apiai07_mcp_client', { requested_client_id: 'b7e6b5ae-33be-493f-8456-02fa41e307e8' })
    expect(approveAuthorization).toHaveBeenCalledOnce()
  })

  it('fails safely after an approval error without returning to the consumed consent URL', async () => {
    approveAuthorization.mockResolvedValue({ data: { redirect_url: CALLBACK_URL }, error: new Error('approval failed') })

    await expect(approveChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${DECISION_ERROR_PATH}`)

    expect(approveAuthorization).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledOnce()
    expect(getAuthorizationDetails).toHaveBeenCalledOnce()
    expect(redirect).toHaveBeenCalledWith(DECISION_ERROR_PATH)
    expect(redirect).not.toHaveBeenCalledWith(expect.stringContaining(AUTHORIZATION_ID))
  })

  it('fails safely if the approval SDK call throws', async () => {
    approveAuthorization.mockRejectedValue(new Error('approval request failed'))

    await expect(approveChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${DECISION_ERROR_PATH}`)

    expect(approveAuthorization).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledOnce()
    expect(getAuthorizationDetails).toHaveBeenCalledOnce()
    expect(redirect).toHaveBeenCalledWith(DECISION_ERROR_PATH)
  })

  it('fails safely when Supabase approval succeeds without a redirect_url', async () => {
    approveAuthorization.mockResolvedValue({ data: {}, error: null })

    await expect(approveChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${DECISION_ERROR_PATH}`)

    expect(approveAuthorization).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledOnce()
    expect(getAuthorizationDetails).toHaveBeenCalledOnce()
    expect(redirect).toHaveBeenCalledWith(DECISION_ERROR_PATH)
    expect(redirect).not.toHaveBeenCalledWith(expect.stringContaining(AUTHORIZATION_ID))
  })

  it('requires the Employee self context before calling Supabase approval', async () => {
    resolveEmployeeSelfContext.mockResolvedValue({ kind: 'none' })

    await expect(approveChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${buildConsentPath(AUTHORIZATION_ID)}`)

    expect(approveAuthorization).not.toHaveBeenCalled()
  })

  it('denies through Supabase and follows its exact returned redirect_url', async () => {
    await expect(denyChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${DENY_URL}`)

    expect(denyAuthorization).toHaveBeenCalledWith(AUTHORIZATION_ID, { skipBrowserRedirect: true })
    expect(denyAuthorization).toHaveBeenCalledOnce()
    expect(approveAuthorization).not.toHaveBeenCalled()
    expect(getAuthorizationDetails).toHaveBeenCalledOnce()
    expect(redirect).not.toHaveBeenCalledWith(expect.stringContaining('/oauth/consent'))
    expect(redirect).not.toHaveBeenCalledWith(expect.stringContaining(AUTHORIZATION_ID))
  })

  it('fails safely after a denial response omits redirect_url', async () => {
    denyAuthorization.mockResolvedValue({ data: {}, error: null })

    await expect(denyChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${DECISION_ERROR_PATH}`)

    expect(denyAuthorization).toHaveBeenCalledOnce()
    expect(approveAuthorization).not.toHaveBeenCalled()
    expect(getAuthorizationDetails).toHaveBeenCalledOnce()
    expect(redirect).toHaveBeenCalledWith(DECISION_ERROR_PATH)
    expect(redirect).not.toHaveBeenCalledWith(expect.stringContaining(AUTHORIZATION_ID))
  })

  it('rejects callback responses with unexpected query parameters', async () => {
    approveAuthorization.mockResolvedValue({
      data: { redirect_url: 'https://chatgpt.com/connector/oauth/callback?code=issued&redirect_uri=https://attacker.example' },
      error: null,
    })

    await expect(approveChatGptMcpConsent(formData())).rejects.toThrow(`NEXT_REDIRECT:${DECISION_ERROR_PATH}`)

    expect(rpc).toHaveBeenCalledOnce()
    expect(getAuthorizationDetails).toHaveBeenCalledOnce()
    expect(redirect).not.toHaveBeenCalledWith(expect.stringContaining(AUTHORIZATION_ID))
  })
})
