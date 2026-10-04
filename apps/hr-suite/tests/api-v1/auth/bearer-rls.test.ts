import { describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import {
  assertDelegatedBearerRlsClient,
  assertDelegatedBearerVerifiedToken,
} from '@/lib/api-v1/auth/bearer-rls'
import {
  assertDelegatedAuthContext,
  authenticateDelegatedBearerRequest,
  createSupabaseBearerRlsBinding,
  createSupabaseBearerRlsClient,
  requireDelegatedPermission,
  requireDelegatedSelfEmployee,
  type DelegatedBearerRlsClient,
  type DelegatedRequestAuthenticationInput,
  type SupabaseBearerRlsClient,
} from '@/lib/api-v1/auth'
import type { DelegatedAccountLink, DelegatedIdentity, VerifiedDelegatedToken } from '@/lib/api-v1/auth'

const issuer = 'https://issuer.synthetic.invalid'
const audience = 'liquid-hr-api'
const accessToken = 'synthetic-access-token'
const nowEpochSeconds = 1_780_000_000
const account: DelegatedAccountLink = { userId: 'user-123' }
const identity: DelegatedIdentity = { issuer, subject: 'subject-123' }
const authContext: AuthContext = {
  tenantId: 'tenant-123',
  hrGroupId: 'hr-group-123',
  administrationId: 'administration-123',
  userId: account.userId,
  employeeId: 'employee-123',
  activeRoles: ['DIRECT_MANAGER'],
  permissions: ['employee:read', 'self:talent-goal:read'],
}

const verifiedToken: VerifiedDelegatedToken = {
  issuer,
  subject: identity.subject,
  audience,
  expiresAtEpochSeconds: nowEpochSeconds + 300,
  revocation: 'active',
  scopes: ['workforce.summary.read'],
  clientId: 'synthetic-client',
}

function requestInput(overrides: Partial<DelegatedRequestAuthenticationInput> = {}): Omit<DelegatedRequestAuthenticationInput, 'authContextLoader'> {
  return {
    headers: new Headers({ authorization: `Bearer ${accessToken}` }),
    expectedIssuer: issuer,
    expectedAudience: audience,
    nowEpochSeconds,
    verifier: { verify: vi.fn().mockResolvedValue(verifiedToken) },
    clientRegistrationResolver: { isActiveClient: vi.fn().mockResolvedValue(true) },
    accountLinkResolver: { findByIssuerAndSubject: vi.fn().mockResolvedValue([account]) },
    ...overrides,
  }
}

function bearerRlsStub(): DelegatedBearerRlsClient<SupabaseBearerRlsClient> {
  return createSupabaseBearerRlsBinding({
    supabaseUrl: 'https://project.supabase.co',
    publishableKey: 'publishable-test-key',
    accessToken,
    supabaseUserId: account.userId,
    identity,
    account,
    fetch: async () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }),
  })
}

describe('Supabase bearer RLS client', () => {
  it('sends the request bearer through Supabase REST without cookies or session persistence', async () => {
    const requests: Request[] = []
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push(new Request(input, init))
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
    }

    const client = createSupabaseBearerRlsClient({
      supabaseUrl: 'https://project.supabase.co',
      publishableKey: 'publishable-test-key',
      accessToken,
      fetch: fetchImpl,
    })
    const result = await client.from('tenants').select('id')

    expect(result.error).toBeNull()
    expect(requests).toHaveLength(1)
    expect(requests[0].headers.get('authorization')).toBe(`Bearer ${accessToken}`)
    expect(requests[0].headers.get('cookie')).toBeNull()
  })

  it('rejects an unexpected alternate JWT at the branded Auth client boundary', async () => {
    const client = createSupabaseBearerRlsClient({
      supabaseUrl: 'https://project.supabase.co',
      publishableKey: 'publishable-test-key',
      accessToken,
    })

    await expect(client.auth.getClaims('another-access-token')).rejects.toThrowError(
      expect.objectContaining({ code: 'RLS_CLIENT_INVALID', status: 500 }),
    )
  })

  it('rejects a Supabase subject that is not the linked LiquidHR auth user', () => {
    expect(() => createSupabaseBearerRlsBinding({
      supabaseUrl: 'https://project.supabase.co',
      publishableKey: 'publishable-test-key',
      accessToken,
      supabaseUserId: 'different-user',
      identity,
      account,
    })).toThrowError(expect.objectContaining({ code: 'RLS_SUBJECT_MISMATCH', status: 401 }))
  })

  it('rejects new and legacy service-role keys at the bearer client boundary', () => {
    expect(() => createSupabaseBearerRlsClient({
      supabaseUrl: 'https://project.supabase.co',
      publishableKey: 'sb_secret_synthetic',
      accessToken,
    })).toThrowError(expect.objectContaining({ code: 'RLS_CLIENT_INVALID', status: 500 }))

    const legacyServiceRoleKey = `header.${Buffer.from(JSON.stringify({ role: 'service_role' }), 'utf8').toString('base64url')}.signature`
    expect(() => createSupabaseBearerRlsClient({
      supabaseUrl: 'https://project.supabase.co',
      publishableKey: legacyServiceRoleKey,
      accessToken,
    })).toThrowError(expect.objectContaining({ code: 'RLS_CLIENT_INVALID', status: 500 }))
  })
})

describe('authenticateDelegatedBearerRequest', () => {
  it('passes only the mapped identity and bearer-bound RLS client to the non-cookie context loader', async () => {
    const rls = bearerRlsStub()
    const load = vi.fn().mockResolvedValue(authContext)

    const result = await authenticateDelegatedBearerRequest({
      request: requestInput(),
      rlsClientFactory: { create: vi.fn().mockResolvedValue(rls) },
      authContextLoader: { load },
    })

    expect(result.authContext).toEqual(authContext)
    expect(result.rls).toBe(rls)
    expect(load).toHaveBeenCalledWith({ userId: account.userId, identity, rls })
  })

  it('fails closed when a structural wrapper is not the private bearer binding', async () => {
    const invalidRls = {
      kind: 'supabase-bearer',
      client: {},
      userId: account.userId,
      identity,
    } as unknown as DelegatedBearerRlsClient<unknown>

    await expect(authenticateDelegatedBearerRequest({
      request: requestInput(),
      rlsClientFactory: { create: vi.fn().mockResolvedValue(invalidRls) },
      authContextLoader: { load: vi.fn() },
    })).rejects.toThrowError(expect.objectContaining({ code: 'RLS_CLIENT_INVALID', status: 500 }))
  })

  it('fails closed when the context loader returns another user or an incomplete scope', async () => {
    const cases: AuthContext[] = [
      { ...authContext, userId: 'different-user' },
      { ...authContext, hrGroupId: undefined },
      { ...authContext, tenantId: '' },
      { ...authContext, administrationId: ' ' },
    ]

    for (const invalidContext of cases) {
      await expect(authenticateDelegatedBearerRequest({
        request: requestInput(),
        rlsClientFactory: { create: vi.fn().mockResolvedValue(bearerRlsStub()) },
        authContextLoader: { load: vi.fn().mockResolvedValue(invalidContext) },
      })).rejects.toThrowError(expect.objectContaining({ code: 'AUTH_CONTEXT_INVALID', status: 500 }))
    }
  })
})

describe('private bearer wrapper boundary', () => {
  it('keeps the wrapper and identity immutable and rejects a replaced client', () => {
    const binding = bearerRlsStub()

    expect(Object.isFrozen(binding)).toBe(true)
    expect(Object.isFrozen(binding.identity)).toBe(true)
    expect(assertDelegatedBearerRlsClient<SupabaseBearerRlsClient>(binding, {
      userId: account.userId,
      issuer,
      subject: identity.subject,
    })).toBe(binding)

    expect(() => Object.defineProperty(binding, 'client', { value: {} })).toThrow()

    const replacedClient = { ...binding, client: {} }
    expect(() => assertDelegatedBearerRlsClient<SupabaseBearerRlsClient>(replacedClient, {
      userId: account.userId,
      issuer,
      subject: identity.subject,
    })).toThrowError(expect.objectContaining({ code: 'RLS_CLIENT_INVALID', status: 500 }))
    expect(() => assertDelegatedBearerRlsClient<SupabaseBearerRlsClient>(binding, {
      userId: 'different-user',
    })).toThrowError(expect.objectContaining({ code: 'RLS_CLIENT_INVALID', status: 500 }))
  })

  it('binds verified client and scopes to the private bearer wrapper', () => {
    const binding = createSupabaseBearerRlsBinding({
      supabaseUrl: 'https://project.supabase.co',
      publishableKey: 'publishable-test-key',
      accessToken,
      supabaseUserId: account.userId,
      identity,
      account,
      verifiedToken,
    })

    expect(assertDelegatedBearerVerifiedToken(binding, verifiedToken)).toBe(binding)
    expect(() => assertDelegatedBearerVerifiedToken(binding, {
      ...verifiedToken,
      clientId: 'different-client',
    })).toThrowError(expect.objectContaining({ code: 'RLS_CLIENT_INVALID', status: 500 }))
    expect(() => assertDelegatedBearerVerifiedToken(binding, {
      ...verifiedToken,
      scopes: ['different.scope'],
    })).toThrowError(expect.objectContaining({ code: 'RLS_CLIENT_INVALID', status: 500 }))
  })
})

describe('delegated authorization boundary', () => {
  it('returns only the server-resolved tenant, HR-group and administration scope', () => {
    expect(assertDelegatedAuthContext(account.userId, authContext)).toBe(authContext)
    expect(() => assertDelegatedAuthContext(account.userId, { ...authContext, hrGroupId: undefined })).toThrowError(
      expect.objectContaining({ code: 'AUTH_CONTEXT_INVALID' }),
    )
  })

  it('requires exact permissions and derives self employee identity from context', () => {
    expect(() => requireDelegatedPermission(authContext, 'employee:read')).not.toThrow()
    expect(() => requireDelegatedPermission(authContext, 'employee:write')).toThrowError(
      expect.objectContaining({ code: 'DELEGATED_PERMISSION_DENIED', status: 403 }),
    )
    expect(requireDelegatedSelfEmployee(authContext)).toBe(authContext.employeeId)
    expect(() => requireDelegatedSelfEmployee({ ...authContext, employeeId: null })).toThrowError(
      expect.objectContaining({ code: 'DELEGATED_SELF_CONTEXT_REQUIRED', status: 403 }),
    )
  })
})
