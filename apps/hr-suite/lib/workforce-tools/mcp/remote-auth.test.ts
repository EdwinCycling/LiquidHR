import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  getUser: vi.fn(),
  createBinding: vi.fn(),
  loadContext: vi.fn(),
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
  createSupabaseBearerRlsBinding: authMocks.createBinding,
  loadBearerAuthContext: authMocks.loadContext,
}))

import { authenticateRemoteMcpRequest } from './remote-auth'
import {
  REMOTE_MCP_TEST_AUDIENCE,
  REMOTE_MCP_TEST_ISSUER,
  REMOTE_MCP_TEST_SUPABASE_URL,
  REMOTE_MCP_URL,
} from './remote-config'

const subject = '00000000-0000-4000-8000-000000000001'
const token = 'synthetic-test-access-token'
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
    client_id: '00000000-0000-4000-8000-000000000020',
  }
}

describe('remote MCP Supabase bearer verification', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', REMOTE_MCP_TEST_SUPABASE_URL)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'synthetic-publishable-key')
    authMocks.getClaims.mockReset().mockResolvedValue({ data: { claims: validClaims() }, error: null })
    authMocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: subject } }, error: null })
    authMocks.createBinding.mockReset().mockReturnValue(authMocks.rls)
    authMocks.loadContext.mockReset().mockResolvedValue(authContext)
  })

  afterEach(() => vi.unstubAllEnvs())

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
    expect(authMocks.loadContext).toHaveBeenCalledOnce()
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
    expect(authMocks.loadContext).not.toHaveBeenCalled()
  })

  it('rejects a mismatched Supabase user identity after token verification', async () => {
    authMocks.getUser.mockResolvedValueOnce({ data: { user: { id: '00000000-0000-4000-8000-000000000099' } }, error: null })
    await expect(authenticateRemoteMcpRequest(request())).rejects.toMatchObject({ code: 'INVALID_ACCESS_TOKEN' })
    expect(authMocks.loadContext).not.toHaveBeenCalled()
  })
})
