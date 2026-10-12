import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@scope/db'
import { assertDelegatedAuthContext, createSupabaseBearerRlsBinding } from '@/lib/api-v1/auth'
import { resolveEmployeeSelfContext } from '@/lib/api-v1/auth/employee-self-context'
import { resolveDirectManagerContext } from '@/lib/api-v1/auth/manager-context'
import { isChatGptOAuthGrant, parseUserOAuthGrants } from '@/lib/oauth/user-grants'
import { hasCurrentManagerMcpConsent } from './manager-consent'
import { DelegatedAuthError, parseBearerToken, type VerifiedDelegatedToken } from '@/lib/api-v1/auth/delegated'
import type { DelegatedWorkforceToolExecutionContext } from '@/lib/workforce-tools/contracts'
import {
  REMOTE_MCP_TEST_AUDIENCE,
  REMOTE_MCP_TEST_ISSUER,
  REMOTE_MCP_TEST_SUPABASE_URL,
  REMOTE_MCP_URL,
} from './remote-config'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidToken(): never {
  throw new DelegatedAuthError('INVALID_ACCESS_TOKEN')
}

function authFailure(error: unknown): DelegatedAuthError {
  if (isRecord(error) && typeof error.status === 'number' && error.status >= 500) {
    return new DelegatedAuthError('TOKEN_VERIFIER_UNAVAILABLE')
  }
  return new DelegatedAuthError('INVALID_ACCESS_TOKEN')
}

function verifiedTokenFromClaims(claims: Record<string, unknown>): VerifiedDelegatedToken {
  const now = Math.floor(Date.now() / 1000)
  const subject = claims.sub
  const expiresAt = claims.exp
  const clientId = claims.client_id
  const audiences = claims.aud
  const resourceBoundAudience = Array.isArray(audiences)
    && audiences.length === 2
    && audiences.every((audience): audience is string => typeof audience === 'string')
    && audiences.includes(REMOTE_MCP_URL)
    && audiences.includes(REMOTE_MCP_TEST_AUDIENCE)
  if (
    claims.iss !== REMOTE_MCP_TEST_ISSUER
    || !resourceBoundAudience
    || claims.role !== 'authenticated'
    || typeof subject !== 'string'
    || !UUID_PATTERN.test(subject)
    || typeof expiresAt !== 'number'
    || !Number.isSafeInteger(expiresAt)
    || expiresAt <= now
    || typeof clientId !== 'string'
    || clientId.trim() !== clientId
    || clientId.length < 1
    || clientId.length > 128
    || /[\u0000-\u0020\u007f-\u009f]/u.test(clientId)
  ) {
    invalidToken()
  }

  return Object.freeze({
    issuer: REMOTE_MCP_TEST_ISSUER,
    subject,
    audience: Object.freeze([REMOTE_MCP_URL, REMOTE_MCP_TEST_AUDIENCE]),
    expiresAtEpochSeconds: expiresAt,
    revocation: 'active',
    scopes: [],
    clientId,
  })
}

async function hasCurrentChatGptOAuthGrant(
  supabaseUrl: string,
  publishableKey: string,
  accessToken: string,
  clientId: string,
): Promise<boolean> {
  let response: Response
  try {
    response = await fetch(new URL('/auth/v1/user/oauth/grants', supabaseUrl), {
      method: 'GET',
      headers: {
        apikey: publishableKey,
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      },
      cache: 'no-store',
    })
  } catch {
    throw new DelegatedAuthError('TOKEN_VERIFIER_UNAVAILABLE')
  }

  if (response.status === 401) return false
  if (!response.ok) throw new DelegatedAuthError('TOKEN_VERIFIER_UNAVAILABLE')

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new DelegatedAuthError('TOKEN_VERIFIER_UNAVAILABLE')
  }
  const grants = parseUserOAuthGrants(payload)
  if (grants.status !== 'ready') throw new DelegatedAuthError('TOKEN_VERIFIER_UNAVAILABLE')

  return grants.grants.some((grant) => grant.clientId === clientId && isChatGptOAuthGrant(grant))
}

/**
 * Verifies one Supabase TEST OAuth bearer, checks its live Auth user, binds the
 * same bearer to the RLS client, then resolves LiquidHR's server-derived
 * current context. Email and cookies are not consulted.
 */
export async function authenticateRemoteMcpRequest(
  request: Request,
  audience: 'EMPLOYEE' | 'MANAGER' = 'EMPLOYEE',
): Promise<{
  readonly clientId: string
  readonly execution: DelegatedWorkforceToolExecutionContext
}> {
  const accessToken = parseBearerToken(request.headers)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (supabaseUrl !== REMOTE_MCP_TEST_SUPABASE_URL || !publishableKey?.trim()) {
    throw new DelegatedAuthError('AUTH_CONFIGURATION_INVALID')
  }

  const verifier = createClient<Database>(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })

  let claimsResult: Awaited<ReturnType<typeof verifier.auth.getClaims>>
  try {
    claimsResult = await verifier.auth.getClaims(accessToken)
  } catch (error) {
    throw authFailure(error)
  }
  if (claimsResult.error || !isRecord(claimsResult.data?.claims)) {
    throw authFailure(claimsResult.error)
  }
  const verifiedToken = verifiedTokenFromClaims(claimsResult.data.claims)

  let userResult: Awaited<ReturnType<typeof verifier.auth.getUser>>
  try {
    userResult = await verifier.auth.getUser(accessToken)
  } catch (error) {
    throw authFailure(error)
  }
  if (userResult.error) throw authFailure(userResult.error)
  if (!userResult.data.user || userResult.data.user.id !== verifiedToken.subject) invalidToken()
  if (audience === 'MANAGER') {
    if (!hasCurrentManagerMcpConsent(userResult.data.user.app_metadata, verifiedToken.clientId)) {
      throw new DelegatedAuthError('MANAGER_CONSENT_REQUIRED')
    }
    if (!(await hasCurrentChatGptOAuthGrant(supabaseUrl, publishableKey, accessToken, verifiedToken.clientId))) {
      throw new DelegatedAuthError('MANAGER_CONSENT_REQUIRED')
    }
  }

  const identity = Object.freeze({
    issuer: verifiedToken.issuer,
    subject: verifiedToken.subject,
  })
  const account = Object.freeze({ userId: verifiedToken.subject })
  const rls = createSupabaseBearerRlsBinding({
    supabaseUrl,
    publishableKey,
    accessToken,
    supabaseUserId: verifiedToken.subject,
    identity,
    account,
    verifiedToken,
  })

  const resolution = audience === 'MANAGER'
    ? await resolveDirectManagerContext(rls.client, verifiedToken.subject)
    : await resolveEmployeeSelfContext(rls.client, verifiedToken.subject)
  if (resolution.kind === 'none') throw new DelegatedAuthError('DELEGATED_SELF_CONTEXT_REQUIRED')
  if (resolution.kind === 'selection-required') throw new DelegatedAuthError('DELEGATED_CONTEXT_SELECTION_REQUIRED')
  if (resolution.kind === 'unavailable') throw new DelegatedAuthError('AUTH_CONTEXT_UNAVAILABLE')
  const authContext = assertDelegatedAuthContext(verifiedToken.subject, resolution.context)

  return {
    clientId: verifiedToken.clientId,
    execution: { authContext, rls },
  }
}
