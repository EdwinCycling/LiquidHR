import { describe, expect, it, vi } from 'vitest'
import {
  bindIdentityBridgeToSupabaseAuth,
  resolveIdentityBridge,
  type IdentityBridgeAccountLinkResolver,
  type IdentityBridgeGrantResolver,
  type IdentityBridgeResolution,
  type IdentityBridgeSupabaseBindingInput,
} from './identity-bridge'
import { createSupabaseBearerRlsBinding } from './bearer-rls'
import type { DelegatedIdentity, VerifiedDelegatedToken } from './delegated'

const issuer = 'https://issuer.synthetic.invalid'
const audience = 'liquid-hr-api'
const clientId = 'synthetic-client'
const subject = 'provider-subject-123'
const userId = '11111111-1111-4111-8111-111111111111'
const nowEpochSeconds = 1_780_000_000
const identity: DelegatedIdentity = { issuer, subject }

function validToken(overrides: Partial<VerifiedDelegatedToken> = {}): VerifiedDelegatedToken {
  return {
    issuer,
    subject,
    audience,
    expiresAtEpochSeconds: nowEpochSeconds + 300,
    revocation: 'active',
    scopes: ['development-plans.self.read'],
    clientId,
    ...overrides,
  }
}

function validLink(overrides: Partial<{
  issuer: string
  subject: string
  userId: string
  isActive: boolean
}> = {}) {
  return {
    issuer,
    subject,
    userId,
    isActive: true,
    ...overrides,
  }
}

function resolutionInput(overrides: Partial<{
  verifiedToken: VerifiedDelegatedToken
  grantResolver: IdentityBridgeGrantResolver
  accountLinkResolver: IdentityBridgeAccountLinkResolver
  expectedIssuer: string
  expectedAudience: string
  expectedClientId: string
  nowEpochSeconds: number
}> = {}) {
  const isActiveClient = vi.fn().mockResolvedValue(true)
  const findByIssuerAndSubject = vi.fn().mockResolvedValue([validLink()])

  return {
    verifiedToken: validToken(),
    expectedIssuer: issuer,
    expectedAudience: audience,
    expectedClientId: clientId,
    nowEpochSeconds,
    grantResolver: overrides.grantResolver ?? { isActiveClient },
    accountLinkResolver: overrides.accountLinkResolver ?? { findByIssuerAndSubject },
    ...overrides,
    isActiveClient,
    findByIssuerAndSubject,
  }
}

describe('resolveIdentityBridge', () => {
  it('resolves one active issuer-subject link after the active grant check', async () => {
    const input = resolutionInput()

    await expect(resolveIdentityBridge(input)).resolves.toEqual({
      verifiedToken: validToken(),
      identity,
      account: { userId },
    })
    expect(input.isActiveClient).toHaveBeenCalledWith({ issuer, audience, clientId })
    expect(input.findByIssuerAndSubject).toHaveBeenCalledWith(identity)
    expect(input.isActiveClient.mock.invocationCallOrder[0]).toBeLessThan(
      input.findByIssuerAndSubject.mock.invocationCallOrder[0],
    )
  })

  it.each([
    ['issuer mismatch', { issuer: 'https://other.synthetic.invalid' }],
    ['audience mismatch', { audience: ['other-api'] }],
    ['client mismatch', { clientId: 'other-client' }],
    ['expired token', { expiresAtEpochSeconds: nowEpochSeconds }],
    ['revoked token', { revocation: 'revoked' }],
    ['missing subject', { subject: '' }],
  ] as const)('rejects %s before grant or account lookup', async (_description, tokenPatch) => {
    const input = resolutionInput({ verifiedToken: validToken(tokenPatch) })

    await expect(resolveIdentityBridge(input)).rejects.toMatchObject({
      code: 'INVALID_ACCESS_TOKEN',
      status: 401,
    })
    expect(input.isActiveClient).not.toHaveBeenCalled()
    expect(input.findByIssuerAndSubject).not.toHaveBeenCalled()
  })

  it('rejects invalid bridge configuration before lookup', async () => {
    const input = resolutionInput({ expectedClientId: ' ' })

    await expect(resolveIdentityBridge(input)).rejects.toMatchObject({
      code: 'AUTH_CONFIGURATION_INVALID',
      status: 500,
    })
    expect(input.isActiveClient).not.toHaveBeenCalled()
    expect(input.findByIssuerAndSubject).not.toHaveBeenCalled()
  })

  it('rejects an inactive grant before probing identity links', async () => {
    const isActiveClient = vi.fn().mockResolvedValue(false)
    const input = resolutionInput({ grantResolver: { isActiveClient } })

    await expect(resolveIdentityBridge(input)).rejects.toMatchObject({
      code: 'CLIENT_NOT_REGISTERED',
      status: 401,
    })
    expect(input.findByIssuerAndSubject).not.toHaveBeenCalled()
  })

  it('fails closed when the grant registry is unavailable', async () => {
    const input = resolutionInput({
      grantResolver: { isActiveClient: vi.fn().mockRejectedValue(new Error('synthetic grant failure')) },
    })

    await expect(resolveIdentityBridge(input)).rejects.toMatchObject({
      code: 'CLIENT_REGISTRY_UNAVAILABLE',
      status: 503,
    })
    expect(input.findByIssuerAndSubject).not.toHaveBeenCalled()
  })

  it.each([
    ['missing link', []],
    ['inactive link', [validLink({ isActive: false })]],
  ] as const)('rejects %s', async (_description, links) => {
    const input = resolutionInput({
      accountLinkResolver: { findByIssuerAndSubject: vi.fn().mockResolvedValue(links) },
    })

    await expect(resolveIdentityBridge(input)).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_LINKED',
      status: 401,
    })
  })

  it('rejects duplicate links even when they point to the same auth user', async () => {
    const input = resolutionInput({
      accountLinkResolver: {
        findByIssuerAndSubject: vi.fn().mockResolvedValue([validLink(), validLink()]),
      },
    })

    await expect(resolveIdentityBridge(input)).rejects.toMatchObject({
      code: 'AMBIGUOUS_ACCOUNT_LINK',
      status: 401,
    })
  })

  it('rejects a resolver row that is not bound to the requested identity', async () => {
    const input = resolutionInput({
      accountLinkResolver: {
        findByIssuerAndSubject: vi.fn().mockResolvedValue([validLink({ subject: 'other-subject' })]),
      },
    })

    await expect(resolveIdentityBridge(input)).rejects.toMatchObject({
      code: 'ACCOUNT_LINK_INVALID',
      status: 500,
    })
  })

  it('maps link-store failures to a safe unavailable response', async () => {
    const input = resolutionInput({
      accountLinkResolver: {
        findByIssuerAndSubject: vi.fn().mockRejectedValue(new Error('synthetic link failure')),
      },
    })

    await expect(resolveIdentityBridge(input)).rejects.toMatchObject({
      code: 'ACCOUNT_LINK_UNAVAILABLE',
      status: 503,
    })
  })
})

function accessTokenForSubject(claimedSubject: string): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: claimedSubject, exp: 4_102_444_800 })}.synthetic-signature`
}

function createBinding(options: {
  readonly claimedSubject?: string
  readonly token?: VerifiedDelegatedToken
} = {}): {
  readonly binding: IdentityBridgeSupabaseBindingInput['rls']
  readonly requests: Request[]
} {
  const requests: Request[] = []
  const accessToken = accessTokenForSubject(options.claimedSubject ?? userId)
  const binding = createSupabaseBearerRlsBinding({
    supabaseUrl: 'https://project.supabase.co',
    publishableKey: 'publishable-test-key',
    accessToken,
    supabaseUserId: userId,
    identity,
    account: { userId },
    verifiedToken: options.token ?? validToken(),
    fetch: async (input, init) => {
      const request = new Request(input, init)
      requests.push(request)
      return new Response(JSON.stringify({ id: options.claimedSubject ?? userId }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })
  return { binding, requests }
}

function bindingInput(overrides: Partial<IdentityBridgeSupabaseBindingInput> = {}): IdentityBridgeSupabaseBindingInput {
  const resolution: IdentityBridgeResolution = {
    verifiedToken: validToken(),
    identity,
    account: { userId },
  }
  return {
    resolution,
    rls: createBinding().binding,
    expectedIssuer: issuer,
    expectedAudience: audience,
    expectedClientId: clientId,
    nowEpochSeconds,
    ...overrides,
  }
}

describe('bindIdentityBridgeToSupabaseAuth', () => {
  it('requires auth.uid() from the same bearer-bound client as the linked user', async () => {
    const { binding, requests } = createBinding()

    await expect(bindIdentityBridgeToSupabaseAuth(bindingInput({ rls: binding }))).resolves.toMatchObject({
      identity,
      account: { userId },
      rls: binding,
    })
    expect(requests).toHaveLength(1)
    expect(requests[0].headers.get('authorization')).toBe(`Bearer ${accessTokenForSubject(userId)}`)
    expect(requests[0].headers.get('cookie')).toBeNull()
    expect(requests[0].url).toContain('/auth/v1/user')
  })

  it('rejects an auth.uid() subject that differs from the linked auth user', async () => {
    const { binding } = createBinding({ claimedSubject: 'different-auth-user' })

    await expect(bindIdentityBridgeToSupabaseAuth(bindingInput({ rls: binding }))).rejects.toMatchObject({
      code: 'RLS_SUBJECT_MISMATCH',
      status: 401,
    })
  })

  it('rejects a binding carrying a different verified token', async () => {
    const { binding } = createBinding({ token: validToken({ clientId: 'other-client' }) })

    await expect(bindIdentityBridgeToSupabaseAuth(bindingInput({ rls: binding }))).rejects.toMatchObject({
      code: 'RLS_CLIENT_INVALID',
      status: 500,
    })
  })

  it('rejects a stale token before reading auth.uid()', async () => {
    const staleToken = validToken({ expiresAtEpochSeconds: nowEpochSeconds })
    const { binding, requests } = createBinding({ token: staleToken })
    const input = bindingInput({
      rls: binding,
      resolution: { verifiedToken: staleToken, identity, account: { userId } },
    })

    await expect(bindIdentityBridgeToSupabaseAuth(input)).rejects.toMatchObject({
      code: 'INVALID_ACCESS_TOKEN',
      status: 401,
    })
    expect(requests).toHaveLength(0)
  })

  it('maps an unavailable auth claim read to a safe 503', async () => {
    const requests: Request[] = []
    const binding = createSupabaseBearerRlsBinding({
      supabaseUrl: 'https://project.supabase.co',
      publishableKey: 'publishable-test-key',
      accessToken: accessTokenForSubject(userId),
      supabaseUserId: userId,
      identity,
      account: { userId },
      verifiedToken: validToken(),
      fetch: async (input, init) => {
        requests.push(new Request(input, init))
        return new Response(JSON.stringify({ error: 'synthetic unavailable' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        })
      },
    })

    await expect(bindIdentityBridgeToSupabaseAuth(bindingInput({ rls: binding }))).rejects.toMatchObject({
      code: 'RLS_CLIENT_UNAVAILABLE',
      status: 503,
    })
    expect(requests).toHaveLength(1)
  })
})
