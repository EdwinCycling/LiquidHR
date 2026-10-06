import { describe, expect, it, vi } from 'vitest'
import {
  DelegatedAuthError,
  createLiveDelegatedAccessTokenVerifier,
  createOAuthAuthorizationRequest,
  discoverOAuthProviderMetadata,
  exchangeOAuthAuthorizationCode,
  OAuthProtocolError,
  revokeAndConfirmOAuthAccessToken,
  validateOAuthClientConfiguration,
  type OAuthClientConfiguration,
  type OAuthAuthorizationRequest,
  type ProviderAccessTokenVerifier,
} from './index'
import type { VerifiedDelegatedToken } from './delegated'

const config: OAuthClientConfiguration = {
  issuer: 'https://issuer.synthetic.invalid',
  authorizationEndpoint: 'https://issuer.synthetic.invalid/oauth/authorize',
  tokenEndpoint: 'https://issuer.synthetic.invalid/oauth/token',
  revocationEndpoint: 'https://issuer.synthetic.invalid/oauth/revoke',
  clientId: 'liquidhr-synthetic-client',
  redirectUri: 'https://liquidhr.synthetic.invalid/oauth/callback',
  audience: 'liquid-hr-api',
  scopes: ['openid', 'development-plans.self.read'],
}

const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
const state = 'state-0123456789'
const nowEpochSeconds = 1_780_000_000

function validToken(overrides: Partial<VerifiedDelegatedToken> = {}): VerifiedDelegatedToken {
  return {
    issuer: config.issuer,
    subject: 'external-subject-123',
    audience: config.audience,
    expiresAtEpochSeconds: nowEpochSeconds + 300,
    revocation: 'active',
    scopes: ['development-plans.self.read'],
    clientId: config.clientId,
    ...overrides,
  }
}

async function authorizationRequest(): Promise<OAuthAuthorizationRequest> {
  return createOAuthAuthorizationRequest({ config, codeVerifier, state })
}

describe('provider-neutral OAuth authorization flow', () => {
  it('builds an exact redirect-bound Authorization Code request with PKCE S256', async () => {
    const request = await authorizationRequest()
    const url = new URL(request.url)

    expect(request.codeChallenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
    expect(request.codeChallengeMethod).toBe('S256')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('client_id')).toBe(config.clientId)
    expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri)
    expect(url.searchParams.get('scope')).toBe(config.scopes.join(' '))
    expect(url.searchParams.get('state')).toBe(state)
    expect(url.searchParams.get('code_challenge')).toBe(request.codeChallenge)
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge_method')).not.toBe('plain')
  })

  it('rejects a requested scope outside the registered client capability', async () => {
    await expect(createOAuthAuthorizationRequest({
      config,
      requestedScopes: ['development-plans.self.read', 'employee:read'],
      codeVerifier,
      state,
    })).rejects.toMatchObject({ code: 'OAUTH_CONFIGURATION_INVALID' })
  })

  it('requires exact provider issuer and safe endpoint configuration', () => {
    expect(() => validateOAuthClientConfiguration({
      ...config,
      issuer: 'https://other.synthetic.invalid',
    })).not.toThrow()
    expect(() => validateOAuthClientConfiguration({
      ...config,
      tokenEndpoint: 'http://provider.example.invalid/token',
    })).toThrowError(expect.objectContaining({ code: 'OAUTH_CONFIGURATION_INVALID' }))
    expect(() => validateOAuthClientConfiguration({
      ...config,
      tokenEndpoint: 'http://localhost:8080/oauth/token',
    })).toThrowError(expect.objectContaining({ code: 'OAUTH_CONFIGURATION_INVALID' }))
  })

  it('requires the callback state and the original PKCE verifier to match', async () => {
    const request = await authorizationRequest()
    const fetch = vi.fn<typeof globalThis.fetch>()

    await expect(exchangeOAuthAuthorizationCode({
      config,
      authorizationRequest: request,
      state: 'state-9876543210',
      code: 'synthetic-code',
      nowEpochSeconds,
      fetch,
    })).rejects.toMatchObject({ code: 'OAUTH_AUTHORIZATION_RESPONSE_INVALID' })
    expect(fetch).not.toHaveBeenCalled()

    await expect(exchangeOAuthAuthorizationCode({
      config,
      authorizationRequest: { ...request, codeChallenge: 'wrong-challenge' },
      state,
      code: 'synthetic-code',
      nowEpochSeconds,
      fetch,
    })).rejects.toMatchObject({ code: 'OAUTH_AUTHORIZATION_RESPONSE_INVALID' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('exchanges only the authorization code and returns ID token separately from the API bearer', async () => {
    let sentRequest: Request | undefined
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      sentRequest = new Request(input, init)
      return new Response(JSON.stringify({
        access_token: 'synthetic-access-token',
        token_type: 'Bearer',
        expires_in: 300,
        scope: 'openid development-plans.self.read',
        refresh_token: 'synthetic-refresh-token',
        id_token: 'synthetic-id-token',
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    const request = await authorizationRequest()

    const result = await exchangeOAuthAuthorizationCode({
      config,
      authorizationRequest: request,
      state,
      code: 'synthetic-code',
      nowEpochSeconds,
      fetch,
    })

    expect(result).toEqual({
      accessToken: 'synthetic-access-token',
      tokenType: 'Bearer',
      expiresAtEpochSeconds: nowEpochSeconds + 300,
      scopes: config.scopes,
      issuer: config.issuer,
      audience: config.audience,
      clientId: config.clientId,
      refreshToken: 'synthetic-refresh-token',
      idToken: 'synthetic-id-token',
    })
    expect(sentRequest?.method).toBe('POST')
    expect(sentRequest?.url).toBe(config.tokenEndpoint)
    expect(sentRequest?.redirect).toBe('error')
    expect(sentRequest?.headers.get('authorization')).toBeNull()
    const body = new URLSearchParams(await sentRequest!.text())
    expect(Object.fromEntries(body.entries())).toEqual({
      grant_type: 'authorization_code',
      code: 'synthetic-code',
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      code_verifier: codeVerifier,
    })
  })

  it('rejects a token response that escalates the requested scope or changes token type', async () => {
    const request = await authorizationRequest()
    const responses = [
      { access_token: 'access', token_type: 'Bearer', expires_in: 300, scope: 'openid employee:read' },
      { access_token: 'access', token_type: 'DPoP', expires_in: 300, scope: 'openid' },
    ]

    for (const responseBody of responses) {
      const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify(responseBody), { status: 200 }))
      await expect(exchangeOAuthAuthorizationCode({
        config,
        authorizationRequest: request,
        state,
        code: 'synthetic-code',
        nowEpochSeconds,
        fetch,
      })).rejects.toMatchObject({ code: 'OAUTH_TOKEN_RESPONSE_INVALID' })
    }
  })

  it('requires discovery metadata to repeat the configured issuer exactly', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({
      issuer: 'https://other.synthetic.invalid',
      authorization_endpoint: config.authorizationEndpoint,
      token_endpoint: config.tokenEndpoint,
    }), { status: 200 }))

    await expect(discoverOAuthProviderMetadata({ issuer: config.issuer, fetch }))
      .rejects.toMatchObject({ code: 'OAUTH_CONFIGURATION_INVALID' })
    expect(fetch).toHaveBeenCalledWith(
      `${config.issuer}/.well-known/openid-configuration`,
      expect.objectContaining({ method: 'GET', cache: 'no-store', redirect: 'error' }),
    )
  })
})

describe('provider-neutral live access-token verification', () => {
  it('requires exact issuer, audience and client, then performs live grant checking', async () => {
    const provider: ProviderAccessTokenVerifier = {
      verify: vi.fn().mockResolvedValue(validToken()),
      isActive: vi.fn().mockResolvedValue(true),
    }
    const verifier = createLiveDelegatedAccessTokenVerifier(provider)

    await expect(verifier.verify({
      accessToken: 'synthetic-access-token',
      expectedIssuer: config.issuer,
      expectedAudience: config.audience,
      expectedClientId: config.clientId,
      nowEpochSeconds,
    })).resolves.toMatchObject(validToken())
    expect(provider.isActive).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'synthetic-access-token' }))

    await expect(verifier.verify({
      accessToken: 'synthetic-access-token',
      expectedIssuer: config.issuer,
      expectedAudience: config.audience,
      expectedClientId: 'other-client',
      nowEpochSeconds,
    })).rejects.toMatchObject({ code: 'INVALID_ACCESS_TOKEN' })
    expect(provider.isActive).toHaveBeenCalledTimes(1)
  })

  it('rejects a still cryptographically valid but revoked or inactive grant', async () => {
    const provider: ProviderAccessTokenVerifier = {
      verify: vi.fn().mockResolvedValue(validToken()),
      isActive: vi.fn().mockResolvedValue(false),
    }
    const verifier = createLiveDelegatedAccessTokenVerifier(provider)

    await expect(verifier.verify({
      accessToken: 'synthetic-access-token',
      expectedIssuer: config.issuer,
      expectedAudience: config.audience,
      expectedClientId: config.clientId,
      nowEpochSeconds,
    })).rejects.toMatchObject({ code: 'INVALID_ACCESS_TOKEN' })
  })
})

describe('same-bearer revocation confirmation', () => {
  async function revokeInput(
    verifier: ProviderAccessTokenVerifier,
    fetch: typeof globalThis.fetch,
  ) {
    return {
      config,
      token: 'synthetic-access-token',
      tokenTypeHint: 'access_token' as const,
      expectedIssuer: config.issuer,
      expectedAudience: config.audience,
      expectedClientId: config.clientId,
      nowEpochSeconds,
      verifier: createLiveDelegatedAccessTokenVerifier(verifier),
      fetch,
    }
  }

  it('requires the exact same access bearer to be rejected after provider revoke', async () => {
    let sentRequest: Request | undefined
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      sentRequest = new Request(input, init)
      return new Response(null, { status: 200 })
    })
    const provider: ProviderAccessTokenVerifier = {
      verify: vi.fn()
        .mockResolvedValueOnce(validToken())
        .mockRejectedValueOnce(new DelegatedAuthError('INVALID_ACCESS_TOKEN')),
      isActive: vi.fn().mockResolvedValue(true),
    }

    await expect(revokeAndConfirmOAuthAccessToken(await revokeInput(provider, fetch))).resolves.toBeUndefined()
    expect(sentRequest?.url).toBe(config.revocationEndpoint)
    expect(sentRequest?.redirect).toBe('error')
    expect(sentRequest?.headers.get('authorization')).toBeNull()
    const body = new URLSearchParams(await sentRequest!.text())
    expect(body.get('token')).toBe('synthetic-access-token')
    expect(body.get('token_type_hint')).toBe('access_token')
    expect(body.get('client_id')).toBe(config.clientId)
  })

  it('fails closed when the same bearer remains active or liveness cannot be checked', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status: 200 }))
    const activeProvider: ProviderAccessTokenVerifier = {
      verify: vi.fn().mockResolvedValue(validToken()),
      isActive: vi.fn().mockResolvedValue(true),
    }
    await expect(revokeAndConfirmOAuthAccessToken(await revokeInput(activeProvider, fetch)))
      .rejects.toMatchObject({ code: 'OAUTH_REVOCATION_NOT_EFFECTIVE' })

    const unavailableProvider: ProviderAccessTokenVerifier = {
      verify: vi.fn().mockRejectedValue(new Error('synthetic liveness outage')),
      isActive: vi.fn(),
    }
    await expect(revokeAndConfirmOAuthAccessToken(await revokeInput(unavailableProvider, fetch)))
      .rejects.toMatchObject({ code: 'OAUTH_TOKEN_LIVENESS_UNAVAILABLE' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not treat an expired or already invalid bearer as revocation evidence', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status: 200 }))
    const expiredProvider: ProviderAccessTokenVerifier = {
      verify: vi.fn().mockResolvedValue(validToken({ expiresAtEpochSeconds: nowEpochSeconds - 1 })),
      isActive: vi.fn().mockResolvedValue(true),
    }
    await expect(revokeAndConfirmOAuthAccessToken(await revokeInput(expiredProvider, fetch)))
      .rejects.toMatchObject({ code: 'OAUTH_REVOCATION_NOT_EFFECTIVE' })

    const alreadyInvalidProvider: ProviderAccessTokenVerifier = {
      verify: vi.fn().mockRejectedValue(new DelegatedAuthError('INVALID_ACCESS_TOKEN')),
      isActive: vi.fn(),
    }
    await expect(revokeAndConfirmOAuthAccessToken(await revokeInput(alreadyInvalidProvider, fetch)))
      .rejects.toMatchObject({ code: 'OAUTH_REVOCATION_NOT_EFFECTIVE' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('binds revocation confirmation to the configured issuer, audience and client', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status: 200 }))
    const provider: ProviderAccessTokenVerifier = {
      verify: vi.fn().mockResolvedValue(validToken()),
      isActive: vi.fn().mockResolvedValue(true),
    }
    const input = await revokeInput(provider, fetch)

    await expect(revokeAndConfirmOAuthAccessToken({ ...input, expectedAudience: 'other-audience' }))
      .rejects.toMatchObject({ code: 'OAUTH_CONFIGURATION_INVALID' })
    await expect(revokeAndConfirmOAuthAccessToken({ ...input, expectedClientId: 'other-client' }))
      .rejects.toMatchObject({ code: 'OAUTH_CONFIGURATION_INVALID' })
    expect(fetch).not.toHaveBeenCalled()
  })
})

it('does not expose provider error bodies through OAuth errors', () => {
  const error = new OAuthProtocolError('OAUTH_TOKEN_RESPONSE_INVALID')
  expect(error.message).toBe('OAUTH_TOKEN_RESPONSE_INVALID')
  expect(error.message).not.toContain('token')
})
