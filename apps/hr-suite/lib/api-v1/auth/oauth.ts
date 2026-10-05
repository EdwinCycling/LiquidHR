import {
  DelegatedAuthError,
  type DelegatedAccessTokenVerifier,
  type DelegatedTokenVerificationInput,
  type VerifiedDelegatedToken,
} from './delegated'

/**
 * Provider-neutral OAuth/OIDC plumbing for APIAI-01.
 *
 * This module owns protocol invariants that are the same for every provider:
 * Authorization Code + PKCE S256, exact client/redirect configuration,
 * token-response parsing, and same-bearer revocation confirmation. Provider
 * specific JWT/JWKS and introspection work is deliberately injected through
 * `ProviderAccessTokenVerifier`.
 */

export type OAuthErrorCode =
  | 'OAUTH_CONFIGURATION_INVALID'
  | 'OAUTH_CRYPTO_UNAVAILABLE'
  | 'OAUTH_PROVIDER_UNAVAILABLE'
  | 'OAUTH_AUTHORIZATION_RESPONSE_INVALID'
  | 'OAUTH_AUTHORIZATION_DENIED'
  | 'OAUTH_TOKEN_RESPONSE_INVALID'
  | 'OAUTH_REVOCATION_FAILED'
  | 'OAUTH_REVOCATION_NOT_EFFECTIVE'
  | 'OAUTH_TOKEN_LIVENESS_UNAVAILABLE'

export class OAuthProtocolError extends Error {
  readonly status: number

  constructor(readonly code: OAuthErrorCode, status = 400) {
    super(code)
    this.name = 'OAuthProtocolError'
    this.status = status
  }
}

export interface OAuthProviderMetadata {
  readonly issuer: string
  readonly authorizationEndpoint: string
  readonly tokenEndpoint: string
  readonly revocationEndpoint?: string
  readonly jwksUri?: string
  readonly introspectionEndpoint?: string
}

export interface OAuthClientConfiguration {
  readonly issuer: string
  readonly authorizationEndpoint: string
  readonly tokenEndpoint: string
  readonly revocationEndpoint?: string
  readonly clientId: string
  readonly redirectUri: string
  readonly audience: string
  readonly scopes: readonly string[]
}

export interface OAuthDiscoveryInput {
  readonly issuer: string
  readonly discoveryEndpoint?: string
  readonly fetch?: typeof globalThis.fetch
}

export type OAuthCrypto = Pick<Crypto, 'getRandomValues' | 'subtle'>

export interface OAuthPkcePair {
  readonly codeVerifier: string
  readonly codeChallenge: string
  readonly codeChallengeMethod: 'S256'
}

export interface OAuthAuthorizationRequest {
  readonly url: string
  readonly state: string
  readonly codeVerifier: string
  readonly codeChallenge: string
  readonly codeChallengeMethod: 'S256'
  readonly scopes: readonly string[]
}

export interface OAuthAuthorizationResponseInput {
  readonly authorizationRequest: OAuthAuthorizationRequest
  readonly state: unknown
  readonly code?: unknown
  readonly error?: unknown
}

export interface OAuthTokenSet {
  /** This is the only token that may be used as an API bearer. */
  readonly accessToken: string
  readonly tokenType: 'Bearer'
  readonly expiresAtEpochSeconds: number
  readonly scopes: readonly string[]
  readonly issuer: string
  readonly audience: string
  readonly clientId: string
  /** OIDC identity token; never substitute this for accessToken. */
  readonly idToken?: string
  readonly refreshToken?: string
}

export interface OAuthAuthorizationCodeExchangeInput {
  readonly config: OAuthClientConfiguration
  readonly authorizationRequest: OAuthAuthorizationRequest
  readonly state: unknown
  readonly code: unknown
  readonly nowEpochSeconds?: number
  readonly crypto?: OAuthCrypto
  readonly fetch?: typeof globalThis.fetch
}

export interface OAuthRevocationInput {
  readonly config: OAuthClientConfiguration
  readonly token: string
  readonly tokenTypeHint: 'access_token' | 'refresh_token'
  readonly fetch?: typeof globalThis.fetch
}

export interface OAuthRevocationConfirmationInput extends OAuthRevocationInput {
  readonly tokenTypeHint: 'access_token'
  readonly expectedIssuer: string
  readonly expectedAudience: string
  readonly expectedClientId?: string
  readonly nowEpochSeconds?: number
  readonly verifier: DelegatedAccessTokenVerifier
}

export interface ProviderAccessTokenVerifier {
  /**
   * The provider adapter must verify the access-token signature, issuer,
   * audience, allowed algorithm and expiry before returning these claims.
   */
  verify(input: DelegatedTokenVerificationInput): Promise<VerifiedDelegatedToken>
  /**
   * Re-check current grant/token liveness for every request. A JWT's expiry
   * alone is not sufficient to prove that a revoked grant is unusable.
   */
  isActive(input: {
    readonly accessToken: string
    readonly token: VerifiedDelegatedToken
  }): Promise<boolean>
}

const OAUTH_SCOPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,127}$/
const OAUTH_TOKEN_VALUE_PATTERN = /^\S+$/
const PKCE_VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/
const STATE_PATTERN = /^[A-Za-z0-9\-._~]{16,256}$/
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

function isSafeTokenValue(value: unknown): value is string {
  return isNonEmptyText(value) && value.length <= 16_384 && OAUTH_TOKEN_VALUE_PATTERN.test(value)
}

function isSafeEndpoint(value: unknown, label: string, options: { readonly allowLoopbackHttp?: boolean } = {}): string {
  if (!isNonEmptyText(value)) throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')
  }

  const allowLoopbackHttp = options.allowLoopbackHttp ?? false
  const isLoopbackHttp = url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)
  if (url.protocol !== 'https:' && !(allowLoopbackHttp && isLoopbackHttp)) {
    throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')
  }
  if (url.username !== '' || url.password !== '' || url.hash !== '') {
    throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')
  }
  if (label === 'issuer' && url.search !== '') {
    throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')
  }
  return value
}

function assertScopeList(scopes: readonly string[]): readonly string[] {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')
  }
  const seen = new Set<string>()
  for (const scope of scopes) {
    if (typeof scope !== 'string' || !OAUTH_SCOPE_PATTERN.test(scope) || seen.has(scope)) {
      throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')
    }
    seen.add(scope)
  }
  return Object.freeze([...scopes])
}

function assertStringValue(value: unknown, code: OAuthErrorCode): string {
  if (!isNonEmptyText(value)) throw new OAuthProtocolError(code)
  return value
}

function assertState(value: unknown): string {
  if (typeof value !== 'string' || !STATE_PATTERN.test(value)) {
    throw new OAuthProtocolError('OAUTH_AUTHORIZATION_RESPONSE_INVALID')
  }
  return value
}

function assertCodeVerifier(value: unknown): string {
  if (typeof value !== 'string' || !PKCE_VERIFIER_PATTERN.test(value)) {
    throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')
  }
  return value
}

function assertNow(value: number | undefined): number {
  const now = value ?? Math.floor(Date.now() / 1000)
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')
  }
  return now
}

/** Validate and snapshot the exact provider/client values used by the flow. */
export function validateOAuthClientConfiguration(
  config: OAuthClientConfiguration,
): OAuthClientConfiguration {
  const issuer = isSafeEndpoint(config.issuer, 'issuer')
  const authorizationEndpoint = isSafeEndpoint(config.authorizationEndpoint, 'authorization_endpoint')
  const tokenEndpoint = isSafeEndpoint(config.tokenEndpoint, 'token_endpoint')
  const revocationEndpoint = config.revocationEndpoint === undefined
    ? undefined
    : isSafeEndpoint(config.revocationEndpoint, 'revocation_endpoint')
  const clientId = assertStringValue(config.clientId, 'OAUTH_CONFIGURATION_INVALID')
  const redirectUri = isSafeEndpoint(config.redirectUri, 'redirect_uri')
  const audience = assertStringValue(config.audience, 'OAUTH_CONFIGURATION_INVALID')
  const scopes = assertScopeList(config.scopes)

  return Object.freeze({
    issuer,
    authorizationEndpoint,
    tokenEndpoint,
    ...(revocationEndpoint === undefined ? {} : { revocationEndpoint }),
    clientId,
    redirectUri,
    audience,
    scopes,
  })
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new OAuthProtocolError('OAUTH_TOKEN_RESPONSE_INVALID')
  }
  return value as Record<string, unknown>
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (!isSafeTokenValue(value)) throw new OAuthProtocolError('OAUTH_TOKEN_RESPONSE_INVALID')
  return value
}

function parseProviderMetadata(value: unknown, expectedIssuer: string): OAuthProviderMetadata {
  const record = asRecord(value)
  const issuer = record.issuer
  if (issuer !== expectedIssuer) throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')

  const authorizationEndpoint = record.authorization_endpoint
  const tokenEndpoint = record.token_endpoint
  if (!isNonEmptyText(authorizationEndpoint) || !isNonEmptyText(tokenEndpoint)) {
    throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')
  }

  const metadata: OAuthProviderMetadata = {
    issuer: isSafeEndpoint(issuer, 'issuer'),
    authorizationEndpoint: isSafeEndpoint(authorizationEndpoint, 'authorization_endpoint'),
    tokenEndpoint: isSafeEndpoint(tokenEndpoint, 'token_endpoint'),
  }
  const revocationEndpoint = record.revocation_endpoint
  const jwksUri = record.jwks_uri
  const introspectionEndpoint = record.introspection_endpoint
  if (revocationEndpoint !== undefined) {
    if (!isNonEmptyText(revocationEndpoint)) throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')
    ;(metadata as { revocationEndpoint?: string }).revocationEndpoint = isSafeEndpoint(revocationEndpoint, 'revocation_endpoint')
  }
  if (jwksUri !== undefined) {
    if (!isNonEmptyText(jwksUri)) throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')
    ;(metadata as { jwksUri?: string }).jwksUri = isSafeEndpoint(jwksUri, 'jwks_uri')
  }
  if (introspectionEndpoint !== undefined) {
    if (!isNonEmptyText(introspectionEndpoint)) throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')
    ;(metadata as { introspectionEndpoint?: string }).introspectionEndpoint = isSafeEndpoint(introspectionEndpoint, 'introspection_endpoint')
  }
  return Object.freeze(metadata)
}

/** Fetch OIDC discovery metadata and require an exact issuer match. */
export async function discoverOAuthProviderMetadata(
  input: OAuthDiscoveryInput,
): Promise<OAuthProviderMetadata> {
  const issuer = isSafeEndpoint(input.issuer, 'issuer')
  const discoveryEndpoint = input.discoveryEndpoint === undefined
    ? `${issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`
    : isSafeEndpoint(input.discoveryEndpoint, 'discovery_endpoint')
  const fetchImpl = input.fetch ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') throw new OAuthProtocolError('OAUTH_PROVIDER_UNAVAILABLE', 503)

  let response: Response
  try {
    response = await fetchImpl(discoveryEndpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
    })
  } catch {
    throw new OAuthProtocolError('OAUTH_PROVIDER_UNAVAILABLE', 503)
  }
  if (!response.ok) throw new OAuthProtocolError('OAUTH_PROVIDER_UNAVAILABLE', 503)

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')
  }
  return parseProviderMetadata(body, issuer)
}

function base64UrlEncode(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let output = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    output += alphabet[first >> 2]
    output += alphabet[((first & 0x03) << 4) | ((second ?? 0) >> 4)]
    if (second !== undefined) output += alphabet[((second & 0x0f) << 2) | ((third ?? 0) >> 6)]
    if (third !== undefined) output += alphabet[third & 0x3f]
  }
  return output
}

function randomBase64Url(byteLength: number, crypto: OAuthCrypto): string {
  if (!Number.isInteger(byteLength) || byteLength < 16) {
    throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')
  }
  const bytes = new Uint8Array(byteLength)
  try {
    crypto.getRandomValues(bytes)
  } catch {
    throw new OAuthProtocolError('OAUTH_CRYPTO_UNAVAILABLE', 503)
  }
  return base64UrlEncode(bytes)
}

async function sha256Base64Url(value: string, crypto: OAuthCrypto): Promise<string> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
    return base64UrlEncode(new Uint8Array(digest))
  } catch {
    throw new OAuthProtocolError('OAUTH_CRYPTO_UNAVAILABLE', 503)
  }
}

export async function createOAuthPkcePair(
  input: { readonly codeVerifier?: string; readonly crypto?: OAuthCrypto } = {},
): Promise<OAuthPkcePair> {
  const crypto = input.crypto ?? globalThis.crypto
  if (!crypto || typeof crypto.getRandomValues !== 'function' || !crypto.subtle) {
    throw new OAuthProtocolError('OAUTH_CRYPTO_UNAVAILABLE', 503)
  }
  const codeVerifier = input.codeVerifier === undefined
    ? randomBase64Url(32, crypto)
    : assertCodeVerifier(input.codeVerifier)
  const codeChallenge = await sha256Base64Url(codeVerifier, crypto)
  return Object.freeze({ codeVerifier, codeChallenge, codeChallengeMethod: 'S256' as const })
}

function assertRequestedScopes(
  requestedScopes: readonly string[] | undefined,
  allowedScopes: readonly string[],
): readonly string[] {
  const scopes = assertScopeList(requestedScopes ?? allowedScopes)
  const allowed = new Set(allowedScopes)
  if (scopes.some((scope) => !allowed.has(scope))) {
    throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')
  }
  return scopes
}

/** Build an exact redirect-bound Authorization Code + PKCE S256 request. */
export async function createOAuthAuthorizationRequest(input: {
  readonly config: OAuthClientConfiguration
  readonly requestedScopes?: readonly string[]
  readonly state?: string
  readonly codeVerifier?: string
  readonly crypto?: OAuthCrypto
}): Promise<OAuthAuthorizationRequest> {
  const config = validateOAuthClientConfiguration(input.config)
  const scopes = assertRequestedScopes(input.requestedScopes, config.scopes)
  const pkce = await createOAuthPkcePair({ codeVerifier: input.codeVerifier, crypto: input.crypto })
  const state = input.state === undefined
    ? randomBase64Url(32, input.crypto ?? globalThis.crypto)
    : assertState(input.state)
  if (!STATE_PATTERN.test(state)) throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')

  const url = new URL(config.authorizationEndpoint)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('scope', scopes.join(' '))
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', pkce.codeChallenge)
  url.searchParams.set('code_challenge_method', pkce.codeChallengeMethod)

  return Object.freeze({
    url: url.toString(),
    state,
    codeVerifier: pkce.codeVerifier,
    codeChallenge: pkce.codeChallenge,
    codeChallengeMethod: pkce.codeChallengeMethod,
    scopes,
  })
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left)
  const rightBytes = new TextEncoder().encode(right)
  if (leftBytes.length !== rightBytes.length) return false
  let difference = 0
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0)
  }
  return difference === 0
}

export function validateOAuthAuthorizationResponse(input: OAuthAuthorizationResponseInput): string {
  const expectedState = assertState(input.authorizationRequest.state)
  if (typeof input.state !== 'string' || !constantTimeEqual(expectedState, input.state)) {
    throw new OAuthProtocolError('OAUTH_AUTHORIZATION_RESPONSE_INVALID')
  }
  if (input.error !== undefined) {
    if (!isNonEmptyText(input.error)) throw new OAuthProtocolError('OAUTH_AUTHORIZATION_RESPONSE_INVALID')
    throw new OAuthProtocolError('OAUTH_AUTHORIZATION_DENIED')
  }
  return assertStringValue(input.code, 'OAUTH_AUTHORIZATION_RESPONSE_INVALID')
}

function parseGrantedScopes(value: unknown, requestedScopes: readonly string[]): readonly string[] {
  if (value === undefined) return Object.freeze([...requestedScopes])
  if (!isNonEmptyText(value)) throw new OAuthProtocolError('OAUTH_TOKEN_RESPONSE_INVALID')
  const scopes = assertScopeList(value.split(' '))
  const requested = new Set(requestedScopes)
  if (scopes.some((scope) => !requested.has(scope))) {
    throw new OAuthProtocolError('OAUTH_TOKEN_RESPONSE_INVALID')
  }
  return scopes
}

function parseExpiresIn(value: unknown, nowEpochSeconds: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new OAuthProtocolError('OAUTH_TOKEN_RESPONSE_INVALID')
  }
  if (value > Number.MAX_SAFE_INTEGER - nowEpochSeconds) {
    throw new OAuthProtocolError('OAUTH_TOKEN_RESPONSE_INVALID')
  }
  return nowEpochSeconds + value
}

/** Exchange one callback code; the ID token remains separate from the API bearer. */
export async function exchangeOAuthAuthorizationCode(
  input: OAuthAuthorizationCodeExchangeInput,
): Promise<OAuthTokenSet> {
  const config = validateOAuthClientConfiguration(input.config)
  const codeVerifier = assertCodeVerifier(input.authorizationRequest.codeVerifier)
  if (input.authorizationRequest.codeChallengeMethod !== 'S256') {
    throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')
  }
  const crypto = input.crypto ?? globalThis.crypto
  if (!crypto || typeof crypto.getRandomValues !== 'function' || !crypto.subtle) {
    throw new OAuthProtocolError('OAUTH_CRYPTO_UNAVAILABLE', 503)
  }
  const derivedCodeChallenge = await sha256Base64Url(codeVerifier, crypto)
  if (!constantTimeEqual(derivedCodeChallenge, input.authorizationRequest.codeChallenge)) {
    throw new OAuthProtocolError('OAUTH_AUTHORIZATION_RESPONSE_INVALID')
  }
  const scopes = assertRequestedScopes(input.authorizationRequest.scopes, config.scopes)
  const code = validateOAuthAuthorizationResponse({
    authorizationRequest: input.authorizationRequest,
    state: input.state,
    code: input.code,
  })
  const nowEpochSeconds = assertNow(input.nowEpochSeconds)
  const fetchImpl = input.fetch ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') throw new OAuthProtocolError('OAUTH_PROVIDER_UNAVAILABLE', 503)

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: codeVerifier,
  })
  let response: Response
  try {
    response = await fetchImpl(config.tokenEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      cache: 'no-store',
      redirect: 'error',
    })
  } catch {
    throw new OAuthProtocolError('OAUTH_PROVIDER_UNAVAILABLE', 503)
  }
  if (!response.ok) throw new OAuthProtocolError('OAUTH_TOKEN_RESPONSE_INVALID')

  let bodyJson: unknown
  try {
    bodyJson = await response.json()
  } catch {
    throw new OAuthProtocolError('OAUTH_TOKEN_RESPONSE_INVALID')
  }
  const tokenResponse = asRecord(bodyJson)
  const accessToken = optionalString(tokenResponse, 'access_token')
  const tokenType = tokenResponse.token_type
  if (accessToken === undefined || typeof tokenType !== 'string' || tokenType.toLowerCase() !== 'bearer') {
    throw new OAuthProtocolError('OAUTH_TOKEN_RESPONSE_INVALID')
  }
  const expiresAtEpochSeconds = parseExpiresIn(tokenResponse.expires_in, nowEpochSeconds)
  const grantedScopes = parseGrantedScopes(tokenResponse.scope, scopes)
  const refreshToken = optionalString(tokenResponse, 'refresh_token')
  const idToken = optionalString(tokenResponse, 'id_token')

  return Object.freeze({
    accessToken,
    tokenType: 'Bearer' as const,
    expiresAtEpochSeconds,
    scopes: grantedScopes,
    issuer: config.issuer,
    audience: config.audience,
    clientId: config.clientId,
    ...(refreshToken === undefined ? {} : { refreshToken }),
    ...(idToken === undefined ? {} : { idToken }),
  })
}

/** Revoke a provider grant/token without sending a client secret. */
export async function revokeOAuthGrant(input: OAuthRevocationInput): Promise<void> {
  const config = validateOAuthClientConfiguration(input.config)
  if (config.revocationEndpoint === undefined || !isSafeTokenValue(input.token)) {
    throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')
  }
  const fetchImpl = input.fetch ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') throw new OAuthProtocolError('OAUTH_PROVIDER_UNAVAILABLE', 503)

  let response: Response
  try {
    response = await fetchImpl(config.revocationEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: input.token,
        token_type_hint: input.tokenTypeHint,
        client_id: config.clientId,
      }),
      cache: 'no-store',
      redirect: 'error',
    })
  } catch {
    throw new OAuthProtocolError('OAUTH_PROVIDER_UNAVAILABLE', 503)
  }
  if (!response.ok) throw new OAuthProtocolError('OAUTH_REVOCATION_FAILED')
}

/**
 * Revoke the access token itself and prove that the same still-valid bearer is
 * no longer accepted. A successful provider HTTP response alone is not enough.
 */
export async function revokeAndConfirmOAuthAccessToken(
  input: OAuthRevocationConfirmationInput,
): Promise<void> {
  const config = validateOAuthClientConfiguration(input.config)
  const nowEpochSeconds = assertNow(input.nowEpochSeconds)
  if (
    !isNonEmptyText(input.expectedIssuer)
    || !isNonEmptyText(input.expectedAudience)
    || (input.expectedClientId !== undefined && !isNonEmptyText(input.expectedClientId))
    || input.expectedIssuer !== config.issuer
    || input.expectedAudience !== config.audience
    || (input.expectedClientId !== undefined && input.expectedClientId !== config.clientId)
    || config.revocationEndpoint === undefined
    || !isSafeTokenValue(input.token)
  ) {
    throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')
  }
  const verificationInput: DelegatedTokenVerificationInput = {
    accessToken: input.token,
    expectedIssuer: config.issuer,
    expectedAudience: config.audience,
    expectedClientId: config.clientId,
    nowEpochSeconds,
  }

  // Prove that this exact bearer is still valid before asking the provider to
  // revoke it. Otherwise an expired/already-invalid bearer could be mistaken
  // for evidence that this revocation attempt worked.
  try {
    const tokenBeforeRevoke = await input.verifier.verify(verificationInput)
    validateProviderTokenClaims(tokenBeforeRevoke, verificationInput)
  } catch (error) {
    if (error instanceof OAuthProtocolError) throw error
    if (error instanceof DelegatedAuthError && error.code === 'INVALID_ACCESS_TOKEN') {
      throw new OAuthProtocolError('OAUTH_REVOCATION_NOT_EFFECTIVE', 503)
    }
    throw new OAuthProtocolError('OAUTH_TOKEN_LIVENESS_UNAVAILABLE', 503)
  }

  await revokeOAuthGrant({ ...input, config })
  try {
    const token = await input.verifier.verify(verificationInput)
    // A provider that returns an active token after revoke has failed the
    // security contract, even if its revocation endpoint returned HTTP 200.
    if (token.revocation === 'active') {
      throw new OAuthProtocolError('OAUTH_REVOCATION_NOT_EFFECTIVE', 503)
    }
    throw new OAuthProtocolError('OAUTH_REVOCATION_NOT_EFFECTIVE', 503)
  } catch (error) {
    if (error instanceof OAuthProtocolError) throw error
    if (error instanceof DelegatedAuthError && error.code === 'INVALID_ACCESS_TOKEN') return
    throw new OAuthProtocolError('OAUTH_TOKEN_LIVENESS_UNAVAILABLE', 503)
  }
}

function audienceContains(audience: unknown, expected: string): boolean {
  if (typeof audience === 'string') return audience === expected
  return Array.isArray(audience) && audience.every((value) => typeof value === 'string') && audience.includes(expected)
}

function validateProviderTokenClaims(
  token: unknown,
  input: DelegatedTokenVerificationInput,
): asserts token is VerifiedDelegatedToken {
  if (typeof token !== 'object' || token === null || Array.isArray(token)) {
    throw new DelegatedAuthError('INVALID_ACCESS_TOKEN')
  }
  const candidate = token as Partial<VerifiedDelegatedToken>
  if (
    !isNonEmptyText(candidate.issuer)
    || candidate.issuer !== input.expectedIssuer
    || !isNonEmptyText(candidate.subject)
    || !audienceContains(candidate.audience, input.expectedAudience)
    || (input.expectedClientId !== undefined && candidate.clientId !== input.expectedClientId)
    || typeof candidate.expiresAtEpochSeconds !== 'number'
    || !Number.isFinite(candidate.expiresAtEpochSeconds)
    || candidate.expiresAtEpochSeconds <= input.nowEpochSeconds
    || candidate.revocation !== 'active'
    || !isNonEmptyText(candidate.clientId)
    || !Array.isArray(candidate.scopes)
    || candidate.scopes.some((scope) => !isNonEmptyText(scope))
  ) {
    throw new DelegatedAuthError('INVALID_ACCESS_TOKEN')
  }
}

function snapshotProviderToken(token: VerifiedDelegatedToken): VerifiedDelegatedToken {
  return Object.freeze({
    issuer: token.issuer,
    subject: token.subject,
    audience: Array.isArray(token.audience) ? Object.freeze([...token.audience]) : token.audience,
    expiresAtEpochSeconds: token.expiresAtEpochSeconds,
    revocation: token.revocation,
    scopes: Object.freeze([...token.scopes]),
    clientId: token.clientId,
  })
}

/**
 * Adapt a provider's cryptographic/JWKS verifier plus live introspection into
 * the delegated bearer contract consumed by APIAI-01. Liveness is mandatory;
 * omitting it is a configuration error instead of a permissive fallback.
 */
export function createLiveDelegatedAccessTokenVerifier(
  provider: ProviderAccessTokenVerifier,
): DelegatedAccessTokenVerifier {
  if (!provider || typeof provider.verify !== 'function' || typeof provider.isActive !== 'function') {
    throw new OAuthProtocolError('OAUTH_CONFIGURATION_INVALID')
  }

  return {
    verify: async (input) => {
      let candidate: VerifiedDelegatedToken
      try {
        candidate = await provider.verify(input)
      } catch (error) {
        if (error instanceof DelegatedAuthError) throw error
        throw new DelegatedAuthError('TOKEN_VERIFIER_UNAVAILABLE')
      }
      validateProviderTokenClaims(candidate, input)
      const snapshot = snapshotProviderToken(candidate)
      let active: boolean
      try {
        active = await provider.isActive({ accessToken: input.accessToken, token: snapshot })
      } catch {
        throw new DelegatedAuthError('TOKEN_VERIFIER_UNAVAILABLE')
      }
      if (active !== true) throw new DelegatedAuthError('INVALID_ACCESS_TOKEN')
      return snapshot
    },
  }
}
