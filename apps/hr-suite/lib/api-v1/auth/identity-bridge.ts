import {
  assertDelegatedBearerVerifiedToken,
  type DelegatedBearerRlsClient,
  type SupabaseBearerRlsClient,
} from './bearer-rls'
import {
  DelegatedAuthError,
  type DelegatedAccountLink,
  type DelegatedAccountLinkResolver,
  type DelegatedClientRegistrationResolver,
  type DelegatedIdentity,
  type VerifiedDelegatedToken,
} from './delegated'

/**
 * A persisted identity-link record must carry its own stable key and active
 * state.  Email, display names and provider profile fields are deliberately
 * absent from this contract.
 *
 * The repository has no approved identity-link table yet.  The resolver is
 * therefore injected by the eventual provider integration instead of this
 * module inventing storage or using a service-role client.
 */
export interface IdentityBridgeLink extends DelegatedAccountLink {
  readonly issuer: string
  readonly subject: string
  readonly isActive: boolean
}

/**
 * This is intentionally a stricter version of the existing account-link
 * contract.  Implementations still resolve by exactly `(issuer, subject)`;
 * the additional fields let this seam reject stale/inactive storage rows.
 */
export interface IdentityBridgeAccountLinkResolver extends DelegatedAccountLinkResolver {
  findByIssuerAndSubject(identity: DelegatedIdentity): Promise<readonly IdentityBridgeLink[]>
}

/** The existing active client-registration contract is the grant boundary. */
export type IdentityBridgeGrantResolver = DelegatedClientRegistrationResolver

export interface IdentityBridgeResolutionInput {
  /** Must be the output of the provider verifier; this module does not parse JWTs. */
  readonly verifiedToken: VerifiedDelegatedToken
  readonly expectedIssuer: string
  readonly expectedAudience: string
  readonly expectedClientId: string
  readonly nowEpochSeconds?: number
  readonly grantResolver: IdentityBridgeGrantResolver
  readonly accountLinkResolver: IdentityBridgeAccountLinkResolver
}

export interface IdentityBridgeResolution {
  readonly verifiedToken: VerifiedDelegatedToken
  readonly identity: DelegatedIdentity
  readonly account: DelegatedAccountLink
}

export interface IdentityBridgeSupabaseBindingInput {
  readonly resolution: IdentityBridgeResolution
  /** Must be the private bearer-bound Supabase client from bearer-rls.ts. */
  readonly rls: DelegatedBearerRlsClient<SupabaseBearerRlsClient>
  readonly expectedIssuer: string
  readonly expectedAudience: string
  readonly expectedClientId: string
  readonly nowEpochSeconds?: number
}

export interface IdentityBridgeSupabaseBinding {
  readonly verifiedToken: VerifiedDelegatedToken
  readonly identity: DelegatedIdentity
  readonly account: DelegatedAccountLink
  readonly rls: DelegatedBearerRlsClient<SupabaseBearerRlsClient>
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

function isAudienceClaim(value: unknown): value is string | readonly string[] {
  if (typeof value === 'string') return isNonEmptyText(value)
  return Array.isArray(value) && value.length > 0 && value.every((entry) => isNonEmptyText(entry))
}

function audienceContains(value: string | readonly string[], expected: string): boolean {
  return typeof value === 'string' ? value === expected : value.includes(expected)
}

function isVerifiedToken(value: unknown): value is VerifiedDelegatedToken {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return isNonEmptyText(candidate.issuer)
    && isNonEmptyText(candidate.subject)
    && isAudienceClaim(candidate.audience)
    && typeof candidate.expiresAtEpochSeconds === 'number'
    && Number.isFinite(candidate.expiresAtEpochSeconds)
    && (candidate.revocation === 'active' || candidate.revocation === 'revoked')
    && Array.isArray(candidate.scopes)
    && candidate.scopes.every((scope) => isNonEmptyText(scope))
    && isNonEmptyText(candidate.clientId)
}

function resolveNow(nowEpochSeconds: number | undefined): number {
  const resolved = nowEpochSeconds ?? Math.floor(Date.now() / 1000)
  if (!Number.isFinite(resolved)) throw new DelegatedAuthError('AUTH_CONFIGURATION_INVALID')
  return resolved
}

function assertBridgeConfiguration(input: Pick<
  IdentityBridgeResolutionInput,
  'expectedIssuer' | 'expectedAudience' | 'expectedClientId'
>, nowEpochSeconds: number): void {
  if (!isNonEmptyText(input.expectedIssuer)
    || !isNonEmptyText(input.expectedAudience)
    || !isNonEmptyText(input.expectedClientId)
    || !Number.isFinite(nowEpochSeconds)) {
    throw new DelegatedAuthError('AUTH_CONFIGURATION_INVALID')
  }
}

/**
 * Re-check the provider result at the bridge boundary.  The provider adapter
 * remains responsible for signature/JWKS verification; this seam rejects a
 * malformed, stale, revoked, or differently targeted result before any
 * LiquidHR account lookup occurs.
 */
type IdentityBridgeTokenValidationInput = Pick<
  IdentityBridgeResolutionInput,
  'verifiedToken' | 'expectedIssuer' | 'expectedAudience' | 'expectedClientId' | 'nowEpochSeconds'
>

function assertBridgeToken(input: IdentityBridgeTokenValidationInput): VerifiedDelegatedToken {
  const nowEpochSeconds = resolveNow(input.nowEpochSeconds)
  assertBridgeConfiguration(input, nowEpochSeconds)

  const token: unknown = input.verifiedToken
  if (!isVerifiedToken(token)
    || token.issuer !== input.expectedIssuer
    || !audienceContains(token.audience, input.expectedAudience)
    || token.clientId !== input.expectedClientId
    || token.expiresAtEpochSeconds <= nowEpochSeconds
    || token.revocation !== 'active') {
    throw new DelegatedAuthError('INVALID_ACCESS_TOKEN')
  }

  return token
}

async function assertActiveGrant(
  token: VerifiedDelegatedToken,
  expectedAudience: string,
  resolver: IdentityBridgeGrantResolver,
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

/**
 * Resolve an external provider identity to exactly one active LiquidHR
 * Supabase auth user.  The grant check deliberately precedes account lookup,
 * so an inactive client cannot probe the identity-link store.
 */
export async function resolveIdentityBridge(
  input: IdentityBridgeResolutionInput,
): Promise<IdentityBridgeResolution> {
  const token = assertBridgeToken(input)
  const identity: DelegatedIdentity = {
    issuer: token.issuer,
    subject: token.subject,
  }

  await assertActiveGrant(token, input.expectedAudience, input.grantResolver)

  let links: readonly IdentityBridgeLink[]
  try {
    links = await input.accountLinkResolver.findByIssuerAndSubject(identity)
  } catch {
    throw new DelegatedAuthError('ACCOUNT_LINK_UNAVAILABLE')
  }

  if (!Array.isArray(links)) throw new DelegatedAuthError('ACCOUNT_LINK_UNAVAILABLE')
  if (links.length === 0) throw new DelegatedAuthError('ACCOUNT_NOT_LINKED')
  if (links.length > 1) throw new DelegatedAuthError('AMBIGUOUS_ACCOUNT_LINK')

  const link = links[0]
  if (!link || typeof link !== 'object' || Array.isArray(link)) {
    throw new DelegatedAuthError('ACCOUNT_LINK_INVALID')
  }
  if (link.issuer !== identity.issuer || link.subject !== identity.subject) {
    throw new DelegatedAuthError('ACCOUNT_LINK_INVALID')
  }
  if (link.isActive !== true) throw new DelegatedAuthError('ACCOUNT_NOT_LINKED')
  if (!isNonEmptyText(link.userId)) throw new DelegatedAuthError('ACCOUNT_LINK_INVALID')

  return {
    verifiedToken: token,
    identity,
    account: { userId: link.userId },
  }
}

/**
 * Finish the bridge against the already-created private Supabase bearer
 * client.  The `auth.uid()`/`sub` claim is read through that exact bearer and
 * must equal the linked `auth.users.id`; no cookie or service-role fallback is
 * possible at this boundary.
 */
export async function bindIdentityBridgeToSupabaseAuth(
  input: IdentityBridgeSupabaseBindingInput,
): Promise<IdentityBridgeSupabaseBinding> {
  const token = assertBridgeToken({
    ...input,
    verifiedToken: input.resolution.verifiedToken,
  })
  const { resolution } = input

  if (resolution.identity.issuer !== token.issuer
    || resolution.identity.subject !== token.subject
    || resolution.account.userId !== input.rls.userId) {
    throw new DelegatedAuthError('RLS_CLIENT_INVALID')
  }

  let rls: DelegatedBearerRlsClient<SupabaseBearerRlsClient>
  try {
    rls = assertDelegatedBearerVerifiedToken(input.rls, token)
  } catch (error) {
    if (error instanceof DelegatedAuthError) throw error
    throw new DelegatedAuthError('RLS_CLIENT_INVALID')
  }

  let claims: Awaited<ReturnType<SupabaseBearerRlsClient['auth']['getClaims']>>
  try {
    // The branded client binds the no-argument call to the request bearer.
    claims = await rls.client.auth.getClaims()
  } catch {
    throw new DelegatedAuthError('RLS_CLIENT_UNAVAILABLE')
  }

  const supabaseUserId = claims.data?.claims?.sub
  if (claims.error || !isNonEmptyText(supabaseUserId)) {
    throw new DelegatedAuthError('RLS_CLIENT_UNAVAILABLE')
  }
  if (supabaseUserId !== resolution.account.userId) {
    throw new DelegatedAuthError('RLS_SUBJECT_MISMATCH')
  }

  return Object.freeze({
    verifiedToken: token,
    identity: resolution.identity,
    account: resolution.account,
    rls,
  })
}
