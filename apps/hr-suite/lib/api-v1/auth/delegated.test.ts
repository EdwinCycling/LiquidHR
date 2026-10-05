import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import {
  authenticateDelegatedRequest,
  DelegatedAuthError,
  loadCurrentLiquidHrAuthContext,
  parseAuthorizationHeader,
  parseBearerToken,
  resolveDelegatedAccount,
  type DelegatedAccessTokenVerifier,
  type DelegatedAccountLinkResolver,
  type DelegatedAuthContextLoader,
  type DelegatedClientRegistrationResolver,
  type DelegatedIdentity,
  type VerifiedDelegatedToken,
} from './delegated'

// Synthetic opaque tokens and provider doubles in this file prove local contract behavior only.
// They are not JWTs, real keys, or hosted OAuth acceptance evidence.

const issuer = 'https://issuer.synthetic.invalid'
const audience = 'liquid-hr-api'
const clientId = 'synthetic-client'
const nowEpochSeconds = 1_780_000_000
const identity: DelegatedIdentity = { issuer, subject: 'subject-123' }

const authContext: AuthContext = {
  tenantId: 'tenant-123',
  hrGroupId: 'hr-group-123',
  administrationId: 'administration-123',
  userId: 'user-123',
  employeeId: 'employee-123',
  activeRoles: ['EMPLOYEE'],
  permissions: ['self:talent-goal:read'],
}

function validToken(overrides: Partial<VerifiedDelegatedToken> = {}): VerifiedDelegatedToken {
  return {
    issuer,
    subject: identity.subject,
    audience: [audience],
    expiresAtEpochSeconds: nowEpochSeconds + 300,
    revocation: 'active',
    scopes: ['development-plans.self.read'],
    clientId,
    ...overrides,
  }
}

function createAuthenticationInput(overrides: {
  verifier?: DelegatedAccessTokenVerifier
  accountLinkResolver?: DelegatedAccountLinkResolver
  clientRegistrationResolver?: DelegatedClientRegistrationResolver
  authContextLoader?: DelegatedAuthContextLoader
  token?: Partial<VerifiedDelegatedToken>
} = {}) {
  const verify = vi.fn(async (): Promise<VerifiedDelegatedToken> => validToken(overrides.token))
  const findByIssuerAndSubject = vi.fn().mockResolvedValue([{ userId: authContext.userId }])
  const isActiveClient = vi.fn().mockResolvedValue(true)
  const load = vi.fn().mockResolvedValue(authContext)

  return {
    headers: new Headers({ authorization: 'Bearer synthetic-access-token' }),
    expectedIssuer: issuer,
    expectedAudience: audience,
    nowEpochSeconds,
    verifier: overrides.verifier ?? { verify },
    clientRegistrationResolver: overrides.clientRegistrationResolver ?? { isActiveClient },
    accountLinkResolver: overrides.accountLinkResolver ?? { findByIssuerAndSubject },
    authContextLoader: overrides.authContextLoader ?? { load },
    verify,
    isActiveClient,
    findByIssuerAndSubject,
    load,
  }
}

describe('parseBearerToken', () => {
  it('accepts exactly one RFC 6750 bearer token', () => {
    expect(parseBearerToken(new Headers({ authorization: 'Bearer synthetic-access-token' }))).toBe('synthetic-access-token')
    expect(parseBearerToken(new Headers({ authorization: 'bearer opaque~token+/=' }))).toBe('opaque~token+/=')
  })

  it.each([
    ['missing header', undefined],
    ['wrong scheme', 'Basic synthetic-access-token'],
    ['leading whitespace', ' Bearer synthetic-access-token'],
    ['trailing whitespace', 'Bearer synthetic-access-token '],
    ['multiple spaces', 'Bearer  synthetic-access-token'],
    ['tab separator', 'Bearer\tsynthetic-access-token'],
    ['duplicate values', 'Bearer first-token,Bearer second-token'],
    ['empty token', 'Bearer '],
    ['invalid token character', 'Bearer token with-space'],
    ['padding in the middle', 'Bearer tok=en'],
  ] as const)('rejects %s', (_description, headerValue) => {
    const parse = headerValue === undefined
      ? () => parseBearerToken(new Headers())
      : () => parseAuthorizationHeader(headerValue)

    expect(parse).toThrowError(
      expect.objectContaining({ code: headerValue === undefined ? 'MISSING_AUTHORIZATION' : 'MALFORMED_AUTHORIZATION' }),
    )
  })
})

describe('resolveDelegatedAccount', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resolves only the exact issuer and subject pair', async () => {
    const findByIssuerAndSubject = vi.fn().mockResolvedValue([{ userId: 'user-123' }])
    const resolver: DelegatedAccountLinkResolver = { findByIssuerAndSubject }

    await expect(resolveDelegatedAccount(identity, resolver)).resolves.toEqual({ userId: 'user-123' })
    expect(findByIssuerAndSubject).toHaveBeenCalledWith(identity)
  })

  it('does not fall back to an email when the stable pair is not linked', async () => {
    const findByIssuerAndSubject = vi.fn().mockResolvedValue([])
    const resolver: DelegatedAccountLinkResolver = { findByIssuerAndSubject }

    await expect(resolveDelegatedAccount(identity, resolver)).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_LINKED',
      status: 401,
    })
    expect(findByIssuerAndSubject).toHaveBeenCalledTimes(1)
  })

  it('fails closed when the stable pair has duplicate links', async () => {
    const resolver: DelegatedAccountLinkResolver = {
      findByIssuerAndSubject: vi.fn().mockResolvedValue([{ userId: 'user-123' }, { userId: 'user-456' }]),
    }

    await expect(resolveDelegatedAccount(identity, resolver)).rejects.toMatchObject({
      code: 'AMBIGUOUS_ACCOUNT_LINK',
      status: 401,
    })
  })

  it('fails closed when the account-link store is unavailable', async () => {
    const resolver: DelegatedAccountLinkResolver = {
      findByIssuerAndSubject: vi.fn().mockRejectedValue(new Error('synthetic link-store failure')),
    }

    await expect(resolveDelegatedAccount(identity, resolver)).rejects.toMatchObject({
      code: 'ACCOUNT_LINK_UNAVAILABLE',
      status: 503,
    })
  })
})

describe('loadCurrentLiquidHrAuthContext', () => {
  it('loads the current server-side context for the linked auth user', async () => {
    const load = vi.fn().mockResolvedValue(authContext)
    const loader: DelegatedAuthContextLoader = { load }

    await expect(loadCurrentLiquidHrAuthContext('user-123', loader)).resolves.toEqual(authContext)
    expect(load).toHaveBeenCalledWith({ userId: 'user-123' })
  })

  it('rejects a context for another user', async () => {
    const loader: DelegatedAuthContextLoader = {
      load: vi.fn().mockResolvedValue({ ...authContext, userId: 'different-user' }),
    }

    await expect(loadCurrentLiquidHrAuthContext('user-123', loader)).rejects.toMatchObject({
      code: 'AUTH_CONTEXT_MISMATCH',
      status: 401,
    })
  })

  it('maps context loader failures to a safe unavailable error', async () => {
    const loader: DelegatedAuthContextLoader = {
      load: vi.fn().mockRejectedValue(new Error('synthetic context failure')),
    }

    await expect(loadCurrentLiquidHrAuthContext('user-123', loader)).rejects.toMatchObject({
      code: 'AUTH_CONTEXT_UNAVAILABLE',
      status: 503,
    })
  })
})

describe('authenticateDelegatedRequest', () => {
  it('verifies the bearer, links the stable identity, and then loads current AuthContext', async () => {
    const input = createAuthenticationInput()

    await expect(authenticateDelegatedRequest(input)).resolves.toEqual({
      verifiedToken: validToken(),
      account: { userId: 'user-123' },
      authContext,
    })
    expect(input.verify).toHaveBeenCalledWith({
      accessToken: 'synthetic-access-token',
      expectedIssuer: issuer,
      expectedAudience: audience,
      nowEpochSeconds,
    })
    expect(input.isActiveClient).toHaveBeenCalledWith({
      issuer,
      audience,
      clientId,
    })
    expect(input.findByIssuerAndSubject).toHaveBeenCalledWith(identity)
    expect(input.load).toHaveBeenCalledWith({ userId: 'user-123' })
  })

  const invalidTokenCases: ReadonlyArray<readonly [string, Partial<VerifiedDelegatedToken>]> = [
    ['issuer mismatch', { issuer: 'https://other.synthetic.invalid' }],
    ['audience mismatch', { audience: ['other-api'] }],
    ['expired token', { expiresAtEpochSeconds: nowEpochSeconds }],
    ['revoked token', { revocation: 'revoked' }],
    ['missing subject', { subject: '' }],
    ['missing client id', { clientId: undefined }],
    ['blank client id', { clientId: ' ' }],
  ]

  it.each(invalidTokenCases)('rejects %s before account linking', async (_description, tokenPatch) => {
    const input = createAuthenticationInput({ token: tokenPatch })

    await expect(authenticateDelegatedRequest(input)).rejects.toMatchObject({
      code: 'INVALID_ACCESS_TOKEN',
      status: 401,
    })
    expect(input.findByIssuerAndSubject).not.toHaveBeenCalled()
    expect(input.load).not.toHaveBeenCalled()
  })

  it('maps an unexpected verifier failure to safe unavailability', async () => {
    const verifier: DelegatedAccessTokenVerifier = {
      verify: vi.fn().mockRejectedValue(new Error('synthetic verifier rejection')),
    }

    const input = createAuthenticationInput({ verifier })
    await expect(authenticateDelegatedRequest(input)).rejects.toMatchObject({
      code: 'TOKEN_VERIFIER_UNAVAILABLE',
      status: 503,
    })
  })

  it('preserves a typed invalid-token rejection from the verifier', async () => {
    const verifier: DelegatedAccessTokenVerifier = {
      verify: vi.fn().mockRejectedValue(new DelegatedAuthError('INVALID_ACCESS_TOKEN')),
    }

    const input = createAuthenticationInput({ verifier })
    await expect(authenticateDelegatedRequest(input)).rejects.toMatchObject({
      code: 'INVALID_ACCESS_TOKEN',
      status: 401,
    })
  })

  it('preserves an explicit verifier-unavailable failure for safe 503 handling', async () => {
    const verifier: DelegatedAccessTokenVerifier = {
      verify: vi.fn().mockRejectedValue(new DelegatedAuthError('TOKEN_VERIFIER_UNAVAILABLE')),
    }

    const input = createAuthenticationInput({ verifier })
    await expect(authenticateDelegatedRequest(input)).rejects.toMatchObject({
      code: 'TOKEN_VERIFIER_UNAVAILABLE',
      status: 503,
    })
  })

  it('rejects a valid token from a client that is not actively registered before linking', async () => {
    const clientRegistrationResolver: DelegatedClientRegistrationResolver = {
      isActiveClient: vi.fn().mockResolvedValue(false),
    }
    const input = createAuthenticationInput({ clientRegistrationResolver })

    await expect(authenticateDelegatedRequest(input)).rejects.toMatchObject({
      code: 'CLIENT_NOT_REGISTERED',
      status: 401,
    })
    expect(input.findByIssuerAndSubject).not.toHaveBeenCalled()
    expect(input.load).not.toHaveBeenCalled()
  })

  it('fails closed with 503 when client registration cannot be checked', async () => {
    const clientRegistrationResolver: DelegatedClientRegistrationResolver = {
      isActiveClient: vi.fn().mockRejectedValue(new Error('synthetic registration-store failure')),
    }
    const input = createAuthenticationInput({ clientRegistrationResolver })

    await expect(authenticateDelegatedRequest(input)).rejects.toMatchObject({
      code: 'CLIENT_REGISTRY_UNAVAILABLE',
      status: 503,
    })
    expect(input.findByIssuerAndSubject).not.toHaveBeenCalled()
    expect(input.load).not.toHaveBeenCalled()
  })
})
