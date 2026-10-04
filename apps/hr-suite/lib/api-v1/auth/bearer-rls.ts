import 'server-only'

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@scope/db'
import { requireAuthContext, type AuthContext } from '@/lib/auth/permissions'
import { selectActiveContext } from '@/lib/context/administration-context'
import { loadAccessibleContextOptions } from '@/lib/context/server-context'
import {
  DelegatedAuthError,
  type DelegatedAccountLink,
  type DelegatedAuthErrorCode,
  type DelegatedIdentity,
  type DelegatedRequestAuthenticationInput,
  type DelegatedVerifiedRequest,
  type VerifiedDelegatedToken,
  parseAuthorizationHeader,
  verifyDelegatedRequest,
} from './delegated'

/**
 * Een Supabase-client per verzoek die de gedelegeerde bearer in de
 * Authorization-header meestuurt. De client blijft voor de contextloader
 * opzettelijk opaque: de cookiegebonden SSR-client kan niet per ongeluk worden
 * teruggeplaatst.
 */
export interface DelegatedBearerRlsClient<TClient> {
  readonly kind: 'supabase-bearer'
  readonly client: TClient
  readonly userId: string
  readonly identity: DelegatedIdentity
}

// Deze bindingen blijven module-privé. Alleen de canonieke constructor kan
// een wrapper maken die de requestketen accepteert.
const bearerRlsBindings = new WeakSet<object>()
const bearerRlsTokens = new WeakMap<object, string>()
const bearerRlsClients = new WeakMap<object, unknown>()
const bearerRlsIdentities = new WeakMap<object, DelegatedIdentity>()

export interface DelegatedBearerRlsClientExpectation {
  readonly userId?: string
  readonly issuer?: string
  readonly subject?: string
}

export interface DelegatedBearerRlsClientFactory<TClient> {
  create(input: {
    readonly accessToken: string
    readonly verifiedToken: VerifiedDelegatedToken
    readonly account: DelegatedAccountLink
  }): Promise<DelegatedBearerRlsClient<TClient>> | DelegatedBearerRlsClient<TClient>
}

/**
 * De contextloader voor API-verzoeken moet de bearergebonden RLS-client
 * ontvangen. Een loader die alleen een user-id accepteert, past niet in dit
 * pad.
 */
export interface DelegatedBearerAuthContextLoader<TClient> {
  load(input: DelegatedBearerAuthContextInput<TClient>): Promise<AuthContext>
}

export interface DelegatedBearerAuthContextInput<TClient> {
  readonly userId: string
  readonly identity: DelegatedIdentity
  readonly rls: DelegatedBearerRlsClient<TClient>
}

export interface DelegatedBearerRequestAuthentication<TClient> {
  readonly verifiedToken: VerifiedDelegatedToken
  readonly account: DelegatedAccountLink
  readonly authContext: AuthContext
  readonly rls: DelegatedBearerRlsClient<TClient>
}

export type DelegatedBearerAuthErrorCode = Extract<
  DelegatedAuthErrorCode,
  | 'RLS_CLIENT_UNAVAILABLE'
  | 'RLS_CLIENT_INVALID'
  | 'RLS_SUBJECT_MISMATCH'
  | 'AUTH_CONTEXT_INVALID'
  | 'DELEGATED_PERMISSION_DENIED'
  | 'DELEGATED_SELF_CONTEXT_REQUIRED'
  | 'DELEGATED_CONTEXT_SELECTION_REQUIRED'
  | 'DELEGATED_CONTEXT_FORBIDDEN'
>

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

function assertScopeString(value: unknown): asserts value is string {
  if (!isNonEmptyText(value)) throw new DelegatedAuthError('AUTH_CONTEXT_INVALID')
}

function assertStringList(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || value.some((entry) => !isNonEmptyText(entry))) {
    throw new DelegatedAuthError('AUTH_CONTEXT_INVALID')
  }
}

function isBoundBearerRlsClient<TClient>(value: unknown): value is DelegatedBearerRlsClient<TClient> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && bearerRlsBindings.has(value)
}

function createBoundBearerRlsClient<TClient>(input: {
  readonly accessToken: string
  readonly client: TClient
  readonly userId: string
  readonly identity: DelegatedIdentity
}): DelegatedBearerRlsClient<TClient> {
  const identity = Object.freeze({
    issuer: input.identity.issuer,
    subject: input.identity.subject,
  })
  const binding: DelegatedBearerRlsClient<TClient> = Object.freeze({
    kind: 'supabase-bearer',
    client: input.client,
    userId: input.userId,
    identity,
  })
  bearerRlsBindings.add(binding)
  bearerRlsTokens.set(binding, input.accessToken)
  bearerRlsClients.set(binding, input.client)
  bearerRlsIdentities.set(binding, identity)
  return binding
}

/**
 * Valideer de private bearerbinding voordat een handler of service de client
 * doorgeeft. De verwachte identiteit is optioneel, maar als zij wordt
 * meegegeven moet zij exact overeenkomen met de verified request.
 */
export function assertDelegatedBearerRlsClient<TClient>(
  value: unknown,
  expected: DelegatedBearerRlsClientExpectation = {},
): DelegatedBearerRlsClient<TClient> {
  if (!isBoundBearerRlsClient<TClient>(value)) {
    throw new DelegatedAuthError('RLS_CLIENT_INVALID')
  }

  const candidate = value
  const boundIdentity = bearerRlsIdentities.get(candidate)
  if (
    candidate.kind !== 'supabase-bearer'
    || candidate.client === null
    || candidate.client === undefined
    || bearerRlsClients.get(candidate) !== candidate.client
    || boundIdentity === undefined
    || candidate.identity !== boundIdentity
    || (expected.userId !== undefined && candidate.userId !== expected.userId)
    || (expected.issuer !== undefined && candidate.identity.issuer !== expected.issuer)
    || (expected.subject !== undefined && candidate.identity.subject !== expected.subject)
  ) {
    throw new DelegatedAuthError('RLS_CLIENT_INVALID')
  }

  return candidate
}

/**
 * Valideer de scope die door LiquidHR-services is bepaald. Tenant-, groeps-
 * en administratiewaarden worden nooit van de API-aanroeper overgenomen.
 */
export function assertDelegatedAuthContext(userId: string, context: AuthContext): AuthContext {
  if (!context || context.userId !== userId) throw new DelegatedAuthError('AUTH_CONTEXT_INVALID')
  assertScopeString(context.userId)
  assertScopeString(context.tenantId)
  assertScopeString(context.hrGroupId)
  if (context.administrationId !== null) assertScopeString(context.administrationId)
  if (context.employeeId !== null) assertScopeString(context.employeeId)
  assertStringList(context.activeRoles)
  assertStringList(context.permissions)
  return context
}

/**
 * Vereis een exact intern recht nadat de actuele AuthContext is geladen.
 * Externe OAuth-scopes blijven een afzonderlijke, smallere mapping op
 * applicatieniveau en verlenen nooit zelfstandig een recht.
 */
export function requireDelegatedPermission(context: AuthContext, permission: string): void {
  assertDelegatedAuthContext(context.userId, context)
  if (!isNonEmptyText(permission) || !context.permissions.includes(permission)) {
    throw new DelegatedAuthError('DELEGATED_PERMISSION_DENIED')
  }
}

/**
 * Self-resources leiden de medewerker uit AuthContext af. Een aanroeper mag
 * nooit zelf een employee-id aanleveren om deze grens te verbreden.
 */
export function requireDelegatedSelfEmployee(context: AuthContext): string {
  assertDelegatedAuthContext(context.userId, context)
  if (!context.employeeId) throw new DelegatedAuthError('DELEGATED_SELF_CONTEXT_REQUIRED')
  return context.employeeId
}

function assertRlsBinding<TClient>(
  value: unknown,
  account: DelegatedAccountLink,
  identity: DelegatedIdentity,
  accessToken: string,
): DelegatedBearerRlsClient<TClient> {
  const candidate = assertDelegatedBearerRlsClient<TClient>(value, {
    userId: account.userId,
    issuer: identity.issuer,
    subject: identity.subject,
  })
  if (bearerRlsTokens.get(candidate) !== accessToken) {
    throw new DelegatedAuthError('RLS_CLIENT_INVALID')
  }
  return candidate
}

/**
 * Maak de gedelegeerde requestketen af met een bearergebonden RLS-client en
 * een cookievrije AuthContext-loader. De provideradapter van de aanroeper
 * moet vaststellen dat de bearer geldig is voor het Supabase-project en naar
 * de gekoppelde LiquidHR-auth-user verwijst voordat hij de RLS-client
 * retourneert.
 */
export async function authenticateDelegatedBearerRequest<TClient>(input: {
  readonly request: Omit<DelegatedRequestAuthenticationInput, 'authContextLoader'>
  readonly rlsClientFactory: DelegatedBearerRlsClientFactory<TClient>
  readonly authContextLoader: DelegatedBearerAuthContextLoader<TClient>
}): Promise<DelegatedBearerRequestAuthentication<TClient>> {
  const verified: DelegatedVerifiedRequest = await verifyDelegatedRequest(input.request)
  const identity: DelegatedIdentity = {
    issuer: verified.verifiedToken.issuer,
    subject: verified.verifiedToken.subject,
  }

  let rls: DelegatedBearerRlsClient<TClient>
  try {
    rls = await input.rlsClientFactory.create({
      accessToken: verified.accessToken,
      verifiedToken: verified.verifiedToken,
      account: verified.account,
    })
  } catch (error) {
    if (error instanceof DelegatedAuthError) throw error
    throw new DelegatedAuthError('RLS_CLIENT_UNAVAILABLE')
  }
  rls = assertRlsBinding<TClient>(rls, verified.account, identity, verified.accessToken)

  let authContext: AuthContext
  try {
    authContext = await input.authContextLoader.load({
      userId: verified.account.userId,
      identity,
      rls,
    })
  } catch (error) {
    if (error instanceof DelegatedAuthError) throw error
    throw new DelegatedAuthError('AUTH_CONTEXT_UNAVAILABLE')
  }

  assertDelegatedAuthContext(verified.account.userId, authContext)
  return {
    verifiedToken: verified.verifiedToken,
    account: verified.account,
    authContext,
    rls,
  }
}

/**
 * Resolve the existing LiquidHR AuthContext through the bearer-bound
 * Supabase client. No active-context cookie is read. A user with more than
 * one possible tenant, HR-group or administration is rejected until an
 * explicit non-cookie selection contract is approved.
 */
export async function loadBearerAuthContext(
  input: DelegatedBearerAuthContextInput<SupabaseBearerRlsClient>,
): Promise<AuthContext> {
  const rls = assertDelegatedBearerRlsClient<SupabaseBearerRlsClient>(input.rls, {
    userId: input.userId,
    issuer: input.identity.issuer,
    subject: input.identity.subject,
  })
  const accessToken = bearerRlsTokens.get(rls)
  if (!accessToken) throw new DelegatedAuthError('RLS_CLIENT_INVALID')

  let claimsData: Awaited<ReturnType<SupabaseBearerRlsClient['auth']['getClaims']>>['data']
  let claimsError: Awaited<ReturnType<SupabaseBearerRlsClient['auth']['getClaims']>>['error']
  try {
    // Zonder expliciete JWT valt getClaims terug op getSession/storage;
    // gebruik daarom uitsluitend de private bearerbinding van dit verzoek.
    const claims = await rls.client.auth.getClaims(accessToken)
    claimsData = claims.data
    claimsError = claims.error
  } catch {
    throw new DelegatedAuthError('RLS_CLIENT_UNAVAILABLE')
  }

  const supabaseUserId = claimsData?.claims?.sub
  if (claimsError || typeof supabaseUserId !== 'string') {
    throw new DelegatedAuthError('RLS_CLIENT_UNAVAILABLE')
  }
  if (supabaseUserId !== input.userId) throw new DelegatedAuthError('RLS_SUBJECT_MISMATCH')

  let accessible: Awaited<ReturnType<typeof loadAccessibleContextOptions>>
  try {
    accessible = await loadAccessibleContextOptions(input.userId, rls.client)
  } catch {
    throw new DelegatedAuthError('AUTH_CONTEXT_UNAVAILABLE')
  }

  if (accessible.tenants.length === 0) throw new DelegatedAuthError('DELEGATED_CONTEXT_FORBIDDEN')
  if (accessible.tenants.length !== 1) {
    throw new DelegatedAuthError('DELEGATED_CONTEXT_SELECTION_REQUIRED')
  }

  const tenant = accessible.tenants[0]
  if (tenant.hrGroups.length === 0) throw new DelegatedAuthError('DELEGATED_CONTEXT_FORBIDDEN')
  if (tenant.hrGroups.length !== 1) {
    throw new DelegatedAuthError('DELEGATED_CONTEXT_SELECTION_REQUIRED')
  }

  if (tenant.hrGroups[0].administrations.length > 1) {
    throw new DelegatedAuthError('DELEGATED_CONTEXT_SELECTION_REQUIRED')
  }

  let context: AuthContext
  try {
    const activeContext = selectActiveContext({ tenants: accessible.tenants })
    context = await requireAuthContext(rls.client, activeContext)
  } catch (error) {
    if (error instanceof DelegatedAuthError) throw error
    throw new DelegatedAuthError('AUTH_CONTEXT_UNAVAILABLE')
  }

  return assertDelegatedAuthContext(input.userId, context)
}

export interface SupabaseBearerClientConfig {
  readonly supabaseUrl: string
  readonly publishableKey: string
  readonly fetch?: typeof fetch
}

export type SupabaseBearerRlsClient = SupabaseClient<Database>

export interface SupabaseBearerRlsBindingInput extends SupabaseBearerClientConfig {
  readonly accessToken: string
  readonly supabaseUserId: string
  readonly identity: DelegatedIdentity
  readonly account: DelegatedAccountLink
}

function assertSupabaseClientConfig(input: SupabaseBearerClientConfig): void {
  if (!isNonEmptyText(input.supabaseUrl) || !isNonEmptyText(input.publishableKey)) {
    throw new DelegatedAuthError('RLS_CLIENT_UNAVAILABLE')
  }
  if (isServiceRoleKey(input.publishableKey)) {
    throw new DelegatedAuthError('RLS_CLIENT_INVALID')
  }

  let url: URL
  try {
    url = new URL(input.supabaseUrl)
  } catch {
    throw new DelegatedAuthError('RLS_CLIENT_UNAVAILABLE')
  }

  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new DelegatedAuthError('RLS_CLIENT_UNAVAILABLE')
  }
}

function isServiceRoleKey(value: string): boolean {
  if (value.toLowerCase().startsWith('sb_secret_')) return true

  const payload = value.split('.')[1]
  if (!payload) return false

  try {
    const decoded = Buffer.from(payload, 'base64url').toString('utf8')
    const parsed: unknown = JSON.parse(decoded)
    return typeof parsed === 'object'
      && parsed !== null
      && !Array.isArray(parsed)
      && (parsed as Record<string, unknown>).role === 'service_role'
  } catch {
    return false
  }
}

/**
 * Maak een Supabase-client waarvan REST- en Auth-verzoeken de bearer van dit
 * verzoek dragen. Er is geen cookiestorage, refreshflow of service-role-
 * fallback. De publishable key komt uit goedgekeurde runtimeconfiguratie; deze
 * helper leest zelf geen omgevingsvariabelen.
 */
export function createSupabaseBearerRlsClient(input: SupabaseBearerClientConfig & { readonly accessToken: string }): SupabaseBearerRlsClient {
  assertSupabaseClientConfig(input)
  if (!isNonEmptyText(input.accessToken)) throw new DelegatedAuthError('MALFORMED_AUTHORIZATION')
  parseAuthorizationHeader(`Bearer ${input.accessToken}`)

  const client = createSupabaseClient<Database>(input.supabaseUrl, input.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
      },
      fetch: input.fetch,
    },
  })

  // De bestaande AuthContext-resolver vraagt claims zonder argument op. Voor
  // deze cookievrije client bindt die vorm altijd aan dezelfde request-bearer;
  // AuthClient mag dan niet terugvallen op session storage.
  const getClaims = client.auth.getClaims.bind(client.auth)
  client.auth.getClaims = ((jwt?: string, options?: { allowExpired?: boolean }) =>
    getClaims(jwt ?? input.accessToken, options)) as typeof client.auth.getClaims

  return client
}

/**
 * Bind een geverifieerde Supabase Auth-subject aan het al opgeloste LiquidHR-
 * account. Een externe issuer/subject-koppeling alleen is onvoldoende: bij
 * doorsturen van de bearer naar Supabase moet diens `sub` naar dezelfde
 * auth-user verwijzen.
 */
export function createSupabaseBearerRlsBinding(
  input: SupabaseBearerRlsBindingInput,
): DelegatedBearerRlsClient<SupabaseBearerRlsClient> {
  if (!isNonEmptyText(input.supabaseUserId) || input.supabaseUserId !== input.account.userId) {
    throw new DelegatedAuthError('RLS_SUBJECT_MISMATCH')
  }

  return createBoundBearerRlsClient({
    accessToken: input.accessToken,
    client: createSupabaseBearerRlsClient(input),
    userId: input.account.userId,
    identity: input.identity,
  })
}
