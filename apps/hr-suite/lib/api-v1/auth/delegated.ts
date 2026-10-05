import type { AuthContext } from '@/lib/auth/permissions'

export type DelegatedAuthorizationHeaders = Pick<Headers, 'get'>

export type DelegatedAudienceClaim = string | readonly string[]
export type DelegatedRevocationStatus = 'active' | 'revoked'

/**
 * Claims that a provider adapter must return after it has verified the token.
 * Numeric dates use OAuth/JWT epoch seconds. The adapter owns signature/JWKS,
 * issuer, audience, expiry and revocation checks; this boundary rechecks the
 * returned contract before any LiquidHR lookup is allowed.
 */
export interface VerifiedDelegatedToken {
  readonly issuer: string
  readonly subject: string
  readonly audience: DelegatedAudienceClaim
  readonly expiresAtEpochSeconds: number
  readonly revocation: DelegatedRevocationStatus
  readonly scopes: readonly string[]
  /** Provider-verified claim; the active registration resolver is checked separately per request. */
  readonly clientId: string
}

export interface DelegatedTokenVerificationInput {
  readonly accessToken: string
  readonly expectedIssuer: string
  readonly expectedAudience: string
  /** When present, the provider adapter must bind the token to this exact client. */
  readonly expectedClientId?: string
  readonly nowEpochSeconds: number
}

/** Provider-specific verification is injected; this module contains no provider configuration. */
export interface DelegatedAccessTokenVerifier {
  verify(input: DelegatedTokenVerificationInput): Promise<VerifiedDelegatedToken>
}

export interface DelegatedIdentity {
  readonly issuer: string
  readonly subject: string
}

export interface DelegatedAccountLink {
  readonly userId: string
}

/**
 * The lookup key is exactly issuer + subject. An implementation must enforce
 * uniqueness for that pair and must not add email as a fallback key.
 */
export interface DelegatedAccountLinkResolver {
  findByIssuerAndSubject(identity: DelegatedIdentity): Promise<readonly DelegatedAccountLink[]>
}

export interface DelegatedClientRegistrationResolver {
  /** Must fail closed and run before account-link lookup or AuthContext loading. */
  isActiveClient(input: {
    readonly issuer: string
    readonly audience: string
    readonly clientId: string
  }): Promise<boolean>
}

export interface DelegatedAuthContextLoader {
  load(input: { readonly userId: string }): Promise<AuthContext>
}

export interface DelegatedRequestAuthenticationInput {
  readonly headers: DelegatedAuthorizationHeaders
  readonly expectedIssuer: string
  readonly expectedAudience: string
  /** Optional exact client binding for provider-neutral adapters. */
  readonly expectedClientId?: string
  readonly nowEpochSeconds?: number
  readonly verifier: DelegatedAccessTokenVerifier
  readonly clientRegistrationResolver: DelegatedClientRegistrationResolver
  readonly accountLinkResolver: DelegatedAccountLinkResolver
  readonly authContextLoader: DelegatedAuthContextLoader
}

export interface DelegatedRequestAuthentication {
  readonly verifiedToken: VerifiedDelegatedToken
  readonly account: DelegatedAccountLink
  readonly authContext: AuthContext
}

/**
 * Het geverifieerde providerresultaat voordat de LiquidHR-context wordt
 * geladen. Deze stap blijft afzonderlijk zodat een API-adapter exact dezelfde
 * bearer aan de RLS-client kan binden voordat de huidige tenant-/groepcontext
 * wordt opgevraagd.
 */
export interface DelegatedVerifiedRequest {
  readonly accessToken: string
  readonly verifiedToken: VerifiedDelegatedToken
  readonly account: DelegatedAccountLink
}

export type DelegatedAuthErrorCode =
  | 'MISSING_AUTHORIZATION'
  | 'MALFORMED_AUTHORIZATION'
  | 'INVALID_ACCESS_TOKEN'
  | 'TOKEN_VERIFIER_UNAVAILABLE'
  | 'CLIENT_NOT_REGISTERED'
  | 'CLIENT_REGISTRY_UNAVAILABLE'
  | 'ACCOUNT_NOT_LINKED'
  | 'AMBIGUOUS_ACCOUNT_LINK'
  | 'ACCOUNT_LINK_INVALID'
  | 'ACCOUNT_LINK_UNAVAILABLE'
  | 'AUTH_CONTEXT_MISMATCH'
  | 'AUTH_CONTEXT_UNAVAILABLE'
  | 'AUTH_CONFIGURATION_INVALID'
  | 'RLS_CLIENT_UNAVAILABLE'
  | 'RLS_CLIENT_INVALID'
  | 'RLS_SUBJECT_MISMATCH'
  | 'AUTH_CONTEXT_INVALID'
  | 'DELEGATED_PERMISSION_DENIED'
  | 'DELEGATED_SELF_CONTEXT_REQUIRED'
  | 'DELEGATED_CONTEXT_SELECTION_REQUIRED'
  | 'DELEGATED_CONTEXT_FORBIDDEN'

function defaultStatus(code: DelegatedAuthErrorCode): number {
  if (code === 'TOKEN_VERIFIER_UNAVAILABLE'
    || code === 'CLIENT_REGISTRY_UNAVAILABLE'
    || code === 'ACCOUNT_LINK_UNAVAILABLE'
    || code === 'AUTH_CONTEXT_UNAVAILABLE'
    || code === 'RLS_CLIENT_UNAVAILABLE') return 503
  if (
    code === 'AUTH_CONFIGURATION_INVALID'
    || code === 'ACCOUNT_LINK_INVALID'
    || code === 'RLS_CLIENT_INVALID'
    || code === 'AUTH_CONTEXT_INVALID'
  ) return 500
  if (code === 'DELEGATED_PERMISSION_DENIED'
    || code === 'DELEGATED_SELF_CONTEXT_REQUIRED'
    || code === 'DELEGATED_CONTEXT_FORBIDDEN') return 403
  if (code === 'DELEGATED_CONTEXT_SELECTION_REQUIRED') return 409
  return 401
}

export class DelegatedAuthError extends Error {
  readonly status: number

  constructor(readonly code: DelegatedAuthErrorCode) {
    super(code)
    this.name = 'DelegatedAuthError'
    this.status = defaultStatus(code)
  }
}

const bearerTokenPattern = /^Bearer ([A-Za-z0-9\-._~+/]+={0,})$/i

/** Parse one strict RFC 6750 Authorization header without accepting fallbacks. */
export function parseAuthorizationHeader(value: string | null): string {
  if (value === null) throw new DelegatedAuthError('MISSING_AUTHORIZATION')
  const match = bearerTokenPattern.exec(value)
  if (!match) throw new DelegatedAuthError('MALFORMED_AUTHORIZATION')
  return match[1]
}

/** Read the Authorization header from a request-like object and parse it strictly. */
export function parseBearerToken(headers: DelegatedAuthorizationHeaders): string {
  return parseAuthorizationHeader(headers.get('authorization'))
}

function nonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

function isAudienceClaim(value: unknown): value is DelegatedAudienceClaim {
  if (typeof value === 'string') return nonEmptyText(value)
  return Array.isArray(value) && value.length > 0 && value.every((entry) => nonEmptyText(entry))
}

function audienceValues(value: DelegatedAudienceClaim): readonly string[] {
  return typeof value === 'string' ? [value] : value
}

function isVerifiedDelegatedToken(value: unknown): value is VerifiedDelegatedToken {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return nonEmptyText(candidate.issuer)
    && nonEmptyText(candidate.subject)
    && isAudienceClaim(candidate.audience)
    && typeof candidate.expiresAtEpochSeconds === 'number'
    && Number.isFinite(candidate.expiresAtEpochSeconds)
    && (candidate.revocation === 'active' || candidate.revocation === 'revoked')
    && Array.isArray(candidate.scopes)
    && candidate.scopes.every((scope) => nonEmptyText(scope))
    && nonEmptyText(candidate.clientId)
}

function assertVerificationConfiguration(
  input: Pick<DelegatedRequestAuthenticationInput, 'expectedIssuer' | 'expectedAudience' | 'expectedClientId'>,
  nowEpochSeconds: number,
): void {
  if (
    !nonEmptyText(input.expectedIssuer)
    || !nonEmptyText(input.expectedAudience)
    || (input.expectedClientId !== undefined && !nonEmptyText(input.expectedClientId))
    || !Number.isFinite(nowEpochSeconds)
  ) {
    throw new DelegatedAuthError('AUTH_CONFIGURATION_INVALID')
  }
}

function assertVerifiedToken(
  value: unknown,
  expectedIssuer: string,
  expectedAudience: string,
  expectedClientId: string | undefined,
  nowEpochSeconds: number,
): VerifiedDelegatedToken {
  if (!isVerifiedDelegatedToken(value)) throw new DelegatedAuthError('INVALID_ACCESS_TOKEN')
  if (value.issuer !== expectedIssuer) throw new DelegatedAuthError('INVALID_ACCESS_TOKEN')
  if (!audienceValues(value.audience).includes(expectedAudience)) throw new DelegatedAuthError('INVALID_ACCESS_TOKEN')
  if (expectedClientId !== undefined && value.clientId !== expectedClientId) {
    throw new DelegatedAuthError('INVALID_ACCESS_TOKEN')
  }
  if (value.expiresAtEpochSeconds <= nowEpochSeconds) throw new DelegatedAuthError('INVALID_ACCESS_TOKEN')
  if (value.revocation !== 'active') throw new DelegatedAuthError('INVALID_ACCESS_TOKEN')
  return value
}

async function assertRegisteredClient(
  token: VerifiedDelegatedToken,
  expectedAudience: string,
  resolver: DelegatedClientRegistrationResolver,
): Promise<void> {
  let isActive: boolean
  try {
    isActive = await resolver.isActiveClient({
      issuer: token.issuer,
      audience: expectedAudience,
      clientId: token.clientId,
    })
  } catch {
    throw new DelegatedAuthError('CLIENT_REGISTRY_UNAVAILABLE')
  }

  if (typeof isActive !== 'boolean') throw new DelegatedAuthError('CLIENT_REGISTRY_UNAVAILABLE')
  if (!isActive) throw new DelegatedAuthError('CLIENT_NOT_REGISTERED')
}

export async function resolveDelegatedAccount(
  identity: DelegatedIdentity,
  resolver: DelegatedAccountLinkResolver,
): Promise<DelegatedAccountLink> {
  if (!nonEmptyText(identity.issuer) || !nonEmptyText(identity.subject)) {
    throw new DelegatedAuthError('ACCOUNT_LINK_INVALID')
  }

  let links: readonly DelegatedAccountLink[]
  try {
    links = await resolver.findByIssuerAndSubject(identity)
  } catch (error) {
    if (error instanceof DelegatedAuthError) throw error
    throw new DelegatedAuthError('ACCOUNT_LINK_UNAVAILABLE')
  }

  if (!Array.isArray(links)) throw new DelegatedAuthError('ACCOUNT_LINK_UNAVAILABLE')
  if (links.length === 0) throw new DelegatedAuthError('ACCOUNT_NOT_LINKED')
  if (links.length > 1) throw new DelegatedAuthError('AMBIGUOUS_ACCOUNT_LINK')

  const link = links[0]
  if (!link || !nonEmptyText(link.userId)) throw new DelegatedAuthError('ACCOUNT_LINK_INVALID')
  return link
}

export async function loadCurrentLiquidHrAuthContext(
  userId: string,
  loader: DelegatedAuthContextLoader,
): Promise<AuthContext> {
  if (!nonEmptyText(userId)) throw new DelegatedAuthError('AUTH_CONTEXT_MISMATCH')

  let context: AuthContext
  try {
    context = await loader.load({ userId })
  } catch (error) {
    if (error instanceof DelegatedAuthError) throw error
    throw new DelegatedAuthError('AUTH_CONTEXT_UNAVAILABLE')
  }

  if (!context || context.userId !== userId) throw new DelegatedAuthError('AUTH_CONTEXT_MISMATCH')
  return context
}

export type DelegatedVerificationInput = Omit<DelegatedRequestAuthenticationInput, 'authContextLoader'>

/**
 * Verifieer bearer, clientregistratie en issuer/subject-koppeling zonder een
 * context te laden. Deze stap gebruikt geen cookie- of service-role-client.
 */
export async function verifyDelegatedRequest(
  input: DelegatedVerificationInput,
): Promise<DelegatedVerifiedRequest> {
  const accessToken = parseBearerToken(input.headers)
  const nowEpochSeconds = input.nowEpochSeconds ?? Math.floor(Date.now() / 1000)
  assertVerificationConfiguration(input, nowEpochSeconds)

  let verifiedCandidate: VerifiedDelegatedToken
  try {
    verifiedCandidate = await input.verifier.verify({
      accessToken,
      expectedIssuer: input.expectedIssuer,
      expectedAudience: input.expectedAudience,
      ...(input.expectedClientId === undefined ? {} : { expectedClientId: input.expectedClientId }),
      nowEpochSeconds,
    })
  } catch (error) {
    if (error instanceof DelegatedAuthError) throw error
    // Een ongeldige token moet door de provideradapter als typed 401 worden
    // gemeld. Een onverwachte fout betekent dat geldigheid niet betrouwbaar
    // kon worden vastgesteld en wordt daarom fail-closed als 503 behandeld.
    throw new DelegatedAuthError('TOKEN_VERIFIER_UNAVAILABLE')
  }

  const verifiedToken = assertVerifiedToken(
    verifiedCandidate,
    input.expectedIssuer,
    input.expectedAudience,
    input.expectedClientId,
    nowEpochSeconds,
  )
  await assertRegisteredClient(verifiedToken, input.expectedAudience, input.clientRegistrationResolver)
  const account = await resolveDelegatedAccount(
    { issuer: verifiedToken.issuer, subject: verifiedToken.subject },
    input.accountLinkResolver,
  )

  return { accessToken, verifiedToken, account }
}

export async function authenticateDelegatedRequest(
  input: DelegatedRequestAuthenticationInput,
): Promise<DelegatedRequestAuthentication> {
  const { verifiedToken, account } = await verifyDelegatedRequest(input)
  const authContext = await loadCurrentLiquidHrAuthContext(account.userId, input.authContextLoader)

  return { verifiedToken, account, authContext }
}
