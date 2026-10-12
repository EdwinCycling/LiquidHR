import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  getUser: vi.fn(),
  fetchOAuthGrants: vi.fn(),
  createBinding: vi.fn(),
  resolveContext: vi.fn(),
  resolveManagerContext: vi.fn(),
  assertContext: vi.fn((_userId: string, context: unknown) => context),
  rls: {
    userId: '00000000-0000-4000-8000-000000000001',
    identity: {
      issuer: 'https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1',
      subject: '00000000-0000-4000-8000-000000000001',
    },
    client: {},
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getClaims: authMocks.getClaims, getUser: authMocks.getUser } }),
}))
vi.mock('@/lib/api-v1/auth', () => ({
  assertDelegatedAuthContext: authMocks.assertContext,
  createSupabaseBearerRlsBinding: authMocks.createBinding,
}))
vi.mock('@/lib/api-v1/auth/employee-self-context', () => ({ resolveEmployeeSelfContext: authMocks.resolveContext }))
vi.mock('@/lib/api-v1/auth/manager-context', () => ({ resolveDirectManagerContext: authMocks.resolveManagerContext }))

import { authenticateRemoteMcpRequest } from './remote-auth'
import { CURRENT_MANAGER_MCP_CONSENT_VERSION } from './manager-consent'
import {
  REMOTE_MCP_TEST_AUDIENCE,
  REMOTE_MCP_TEST_ISSUER,
  REMOTE_MCP_TEST_SUPABASE_URL,
  REMOTE_MCP_URL,
} from './remote-config'

const subject = '00000000-0000-4000-8000-000000000001'
const token = 'synthetic-test-access-token'
const clientId = '00000000-0000-4000-8000-000000000020'
const managerConsentKey = `liquidhr_manager_mcp_consent_${clientId}`
const authContext = {
  tenantId: '00000000-0000-4000-8000-000000000010',
  hrGroupId: '00000000-0000-4000-8000-000000000011',
  administrationId: null,
  userId: subject,
  employeeId: '00000000-0000-4000-8000-000000000012',
  activeRoles: ['EMPLOYEE'],
  permissions: ['self:talent-goal:read'],
}

function request(): Request {
  return new Request(REMOTE_MCP_URL, { headers: { authorization: `Bearer ${token}` } })
}

function validClaims(): Record<string, unknown> {
  return {
    iss: REMOTE_MCP_TEST_ISSUER,
    aud: [REMOTE_MCP_URL, REMOTE_MCP_TEST_AUDIENCE],
    role: 'authenticated',
    sub: subject,
    exp: Math.floor(Date.now() / 1000) + 300,
    client_id: clientId,
  }
}

describe('remote MCP Supabase bearer verification', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', REMOTE_MCP_TEST_SUPABASE_URL)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'synthetic-publishable-key')
    vi.stubGlobal('fetch', authMocks.fetchOAuthGrants)
    authMocks.getClaims.mockReset().mockResolvedValue({ data: { claims: validClaims() }, error: null })
    authMocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: subject } }, error: null })
    authMocks.fetchOAuthGrants.mockReset().mockResolvedValue(new Response(JSON.stringify([{
      client: { id: clientId, name: 'ChatGPT' },
      scopes: ['openid', 'email', 'offline_access'],
      granted_at: '2026-10-08T09:00:00.000Z',
    }]), { status: 200, headers: { 'content-type': 'application/json' } }))
    authMocks.createBinding.mockReset().mockReturnValue(authMocks.rls)
    authMocks.resolveContext.mockReset().mockResolvedValue({ kind: 'resolved', context: authContext })
    authMocks.resolveManagerContext.mockReset().mockResolvedValue({ kind: 'resolved', context: {
      ...authContext,
      administrationId: '00000000-0000-4000-8000-000000000013',
      activeRoles: ['DIRECT_MANAGER'],
      permissions: ['talent-team:read'],
    } })
    authMocks.assertContext.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('verifies the resource-bound token and binds that bearer to the current Employee context', async () => {
    const authenticated = await authenticateRemoteMcpRequest(request())
    expect(authenticated.clientId).toBe('00000000-0000-4000-8000-000000000020')
    expect(authenticated.execution.authContext).toBe(authContext)
    expect(authMocks.getClaims).toHaveBeenCalledWith(token)
    expect(authMocks.getUser).toHaveBeenCalledWith(token)
    expect(authMocks.createBinding).toHaveBeenCalledWith(expect.objectContaining({
      supabaseUrl: REMOTE_MCP_TEST_SUPABASE_URL,
      accessToken: token,
      supabaseUserId: subject,
    }))
    expect(authMocks.resolveContext).toHaveBeenCalledWith(authMocks.rls.client, subject)
    expect(authMocks.assertContext).toHaveBeenCalledWith(subject, authContext)
  })

  it('resolves Manager tool calls through the same request-bound RLS identity and current direct-manager context', async () => {
    authMocks.getUser.mockResolvedValueOnce({
      data: { user: { id: subject, app_metadata: { [managerConsentKey]: CURRENT_MANAGER_MCP_CONSENT_VERSION } } },
      error: null,
    })
    const authenticated = await authenticateRemoteMcpRequest(request(), 'MANAGER')
    expect(authenticated.execution.rls).toBe(authMocks.rls)
    expect(authenticated.execution.authContext.activeRoles).toEqual(['DIRECT_MANAGER'])
    expect(authMocks.fetchOAuthGrants).toHaveBeenCalledWith(
      new URL('/auth/v1/user/oauth/grants', REMOTE_MCP_TEST_SUPABASE_URL),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          apikey: 'synthetic-publishable-key',
          authorization: `Bearer ${token}`,
        }),
        cache: 'no-store',
      }),
    )
    expect(authMocks.resolveManagerContext).toHaveBeenCalledWith(authMocks.rls.client, subject)
    expect(authMocks.resolveContext).not.toHaveBeenCalled()
    expect(authMocks.createBinding).toHaveBeenCalledWith(expect.objectContaining({
      accessToken: token,
      supabaseUserId: subject,
    }))
  })

  it('denies an existing OAuth grant without current per-client Manager consent before RLS or team reads', async () => {
    await expect(authenticateRemoteMcpRequest(request(), 'MANAGER')).rejects.toMatchObject({
      code: 'MANAGER_CONSENT_REQUIRED',
      status: 403,
    })
    expect(authMocks.getUser).toHaveBeenCalledWith(token)
    expect(authMocks.fetchOAuthGrants).not.toHaveBeenCalled()
    expect(authMocks.createBinding).not.toHaveBeenCalled()
    expect(authMocks.resolveManagerContext).not.toHaveBeenCalled()
  })

  it('denies an old bearer after its OAuth grant has been revoked even while its access JWT remains valid', async () => {
    authMocks.getUser.mockResolvedValueOnce({
      data: { user: { id: subject, app_metadata: { [managerConsentKey]: CURRENT_MANAGER_MCP_CONSENT_VERSION } } },
      error: null,
    })
    authMocks.fetchOAuthGrants.mockResolvedValueOnce(new Response('[]', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))

    await expect(authenticateRemoteMcpRequest(request(), 'MANAGER')).rejects.toMatchObject({
      code: 'MANAGER_CONSENT_REQUIRED',
      status: 403,
    })
    expect(authMocks.createBinding).not.toHaveBeenCalled()
    expect(authMocks.resolveManagerContext).not.toHaveBeenCalled()
  })

  it('fails closed when the current OAuth grant cannot be verified', async () => {
    authMocks.getUser.mockResolvedValueOnce({
      data: { user: { id: subject, app_metadata: { [managerConsentKey]: CURRENT_MANAGER_MCP_CONSENT_VERSION } } },
      error: null,
    })
    authMocks.fetchOAuthGrants.mockResolvedValueOnce(new Response('unavailable', { status: 503 }))

    await expect(authenticateRemoteMcpRequest(request(), 'MANAGER')).rejects.toMatchObject({
      code: 'TOKEN_VERIFIER_UNAVAILABLE',
      status: 503,
    })
    expect(authMocks.createBinding).not.toHaveBeenCalled()
    expect(authMocks.resolveManagerContext).not.toHaveBeenCalled()
  })

  it('ignores user-controlled metadata that copies the Manager consent marker', async () => {
    authMocks.getUser.mockResolvedValueOnce({
      data: { user: {
        id: subject,
        app_metadata: {},
        user_metadata: { [managerConsentKey]: CURRENT_MANAGER_MCP_CONSENT_VERSION },
      } },
      error: null,
    })

    await expect(authenticateRemoteMcpRequest(request(), 'MANAGER')).rejects.toMatchObject({
      code: 'MANAGER_CONSENT_REQUIRED',
      status: 403,
    })
    expect(authMocks.createBinding).not.toHaveBeenCalled()
    expect(authMocks.resolveManagerContext).not.toHaveBeenCalled()
  })

  it('denies the same bearer immediately after its Manager consent marker is removed', async () => {
    authMocks.getUser
      .mockResolvedValueOnce({
        data: { user: { id: subject, app_metadata: { [managerConsentKey]: CURRENT_MANAGER_MCP_CONSENT_VERSION } } },
        error: null,
      })
      .mockResolvedValueOnce({ data: { user: { id: subject, app_metadata: {} } }, error: null })

    await expect(authenticateRemoteMcpRequest(request(), 'MANAGER')).resolves.toBeDefined()
    await expect(authenticateRemoteMcpRequest(request(), 'MANAGER')).rejects.toMatchObject({
      code: 'MANAGER_CONSENT_REQUIRED',
      status: 403,
    })
    expect(authMocks.createBinding).toHaveBeenCalledOnce()
    expect(authMocks.resolveManagerContext).toHaveBeenCalledOnce()
  })

  it('rejects an expired Manager bearer before binding RLS or resolving team context', async () => {
    authMocks.getClaims.mockResolvedValueOnce({
      data: { claims: { ...validClaims(), exp: Math.floor(Date.now() / 1000) - 1 } },
      error: null,
    })

    await expect(authenticateRemoteMcpRequest(request(), 'MANAGER')).rejects.toMatchObject({
      code: 'INVALID_ACCESS_TOKEN',
    })
    expect(authMocks.createBinding).not.toHaveBeenCalled()
    expect(authMocks.resolveManagerContext).not.toHaveBeenCalled()
  })

  it('rejects Supabase-revoked OAuth credentials before binding an RLS client', async () => {
    authMocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: { status: 401, message: 'invalid token' } })

    await expect(authenticateRemoteMcpRequest(request())).rejects.toMatchObject({
      code: 'INVALID_ACCESS_TOKEN',
    })
    expect(authMocks.createBinding).not.toHaveBeenCalled()
    expect(authMocks.resolveContext).not.toHaveBeenCalled()
  })

  it('rejects tokens without the exact MCP resource audience before resolving LiquidHR context', async () => {
    authMocks.getClaims.mockResolvedValueOnce({
      data: { claims: { ...validClaims(), aud: [REMOTE_MCP_TEST_AUDIENCE] } },
      error: null,
    })
    await expect(authenticateRemoteMcpRequest(request())).rejects.toMatchObject({
      code: 'INVALID_ACCESS_TOKEN',
    })
    expect(authMocks.createBinding).not.toHaveBeenCalled()
    expect(authMocks.resolveContext).not.toHaveBeenCalled()
  })

  it('rejects a mismatched Supabase user identity after token verification', async () => {
    authMocks.getUser.mockResolvedValueOnce({ data: { user: { id: '00000000-0000-4000-8000-000000000099' } }, error: null })
    await expect(authenticateRemoteMcpRequest(request())).rejects.toMatchObject({ code: 'INVALID_ACCESS_TOKEN' })
    expect(authMocks.resolveContext).not.toHaveBeenCalled()
  })

  it('rejects an ambiguous Employee context before any Workforce call', async () => {
    authMocks.resolveContext.mockResolvedValueOnce({ kind: 'selection-required' })

    await expect(authenticateRemoteMcpRequest(request())).rejects.toMatchObject({
      code: 'DELEGATED_CONTEXT_SELECTION_REQUIRED',
      status: 409,
    })
  })

  it('rejects a non-Employee context', async () => {
    authMocks.resolveContext.mockResolvedValueOnce({ kind: 'none' })

    await expect(authenticateRemoteMcpRequest(request())).rejects.toMatchObject({
      code: 'DELEGATED_SELF_CONTEXT_REQUIRED',
      status: 403,
    })
  })
})
