'use server'

import { redirect } from 'next/navigation'
import { createAdminRpcClient, getAdminCredentialMode } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { resolveEmployeeSelfContext } from '@/lib/api-v1/auth/employee-self-context'
import { isRemoteMcpEnabled } from '@/lib/workforce-tools/mcp/remote-config'
import {
  buildConsentLoginHref,
  buildConsentPath,
  isAllowedChatGptRedirectUri,
  isAuthorizationId,
  isSupabaseAuthorizationRedirectUrl,
  isSupportedChatGptScope,
  OAUTH_DECISION_ERROR_PATH,
  parseConsentAuthorization,
} from './authorization'

type AuthorizationLookup =
  | { readonly kind: 'unauthenticated' }
  | { readonly kind: 'invalid' }
  | {
      readonly kind: 'ready'
      readonly supabase: Awaited<ReturnType<typeof createClient>>
      readonly userId: string
      readonly clientId: string
      readonly scope: string
      readonly redirectUri: string
    }

async function getCurrentAuthorization(authorizationId: string): Promise<AuthorizationLookup> {
  if (!isAuthorizationId(authorizationId)) return { kind: 'invalid' }

  let supabase: Awaited<ReturnType<typeof createClient>>
  try {
    supabase = await createClient()
  } catch {
    return { kind: 'invalid' }
  }

  let userId: string | null = null
  try {
    const { data, error } = await supabase.auth.getClaims()
    const subject = data?.claims?.sub
    if (!error && typeof subject === 'string' && subject.length > 0) userId = subject
  } catch {
    userId = null
  }
  if (!userId) return { kind: 'unauthenticated' }

  let authorizationResponse: unknown = null
  let authorizationError = false
  try {
    const response = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
    authorizationResponse = response.data
    authorizationError = response.error !== null
  } catch {
    authorizationError = true
  }

  const authorization = authorizationError ? null : parseConsentAuthorization(authorizationResponse, authorizationId)
  if (!authorization || !isAllowedChatGptRedirectUri(authorization.redirectUri)) return { kind: 'invalid' }

  return {
    kind: 'ready',
    supabase,
    userId,
    clientId: authorization.clientId,
    scope: authorization.scope,
    redirectUri: authorization.redirectUri,
  }
}

async function requireEmployeeSelf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  try {
    const resolution = await resolveEmployeeSelfContext(supabase, userId)
    return resolution.kind === 'resolved'
  } catch {
    return false
  }
}

function recordValue(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  return (value as Record<string, unknown>)[key]
}

function safeDiagnosticCode(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9]{5,8}$/iu.test(value) ? value : null
}

function safeDiagnosticMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value
    .replace(/\bBearer\s+[^\s,;]+/giu, 'Bearer [redacted]')
    .replace(/\b(?:sb_secret|sb_publishable)_[A-Za-z0-9_-]+\b/giu, '[redacted-key]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, '[redacted-token]')
    .replace(/\b((?:(?:access|refresh|authorization|auth)[_-]?)?(?:token|code)|client[_-]?secret|secret|password|api[_-]?key|state)\b\s*[:=]\s*[^,;\s]+/giu, '$1=[redacted]')
    .replace(/([?&](?:code|access_token|refresh_token|client_secret|state)=)[^&\s]+/giu, '$1[redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, '[redacted-email]')
    .replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/giu, '[redacted-id]')
    .replace(/\b[A-Za-z0-9_~+/=-]{32,}\b/gu, '[redacted-value]')
    .replace(/[\r\n\t]+/gu, ' ')
    .slice(0, 240)
}

function classifyRegistrationRpcError(error: unknown): string {
  const code = recordValue(error, 'code')
  const message = recordValue(error, 'message')
  if (code !== '42501') return 'other'
  if (message === 'APIAI07_CLIENT_REGISTRATION_UNAVAILABLE') return 'explicit-function-guard'
  if (typeof message === 'string' && /permission denied for function/iu.test(message)) {
    return 'execute-privilege-denied'
  }
  return 'authorization-failure-unclassified'
}

function reportClientRegistrationFailure(clientId: unknown, stage: string, error: unknown): void {
  if (!isRemoteMcpEnabled()) return

  const rawCode = recordValue(error, 'code')
  const rawMessage = recordValue(error, 'message')
  console.error('[APIAI07_CONSENT_CLIENT_REGISTRATION_FAILED]', {
    clientIdentifierPresent: typeof clientId === 'string' && clientId.length > 0,
    clientIdentifierType: typeof clientId,
    failureStage: stage,
    authorizationMethod: 'apikey-only',
    credentialMode: getAdminCredentialMode(),
    rpcErrorCode: safeDiagnosticCode(rawCode),
    rpcErrorClass: classifyRegistrationRpcError(error),
    rpcErrorMessage: safeDiagnosticMessage(rawMessage),
  })
}

function reportClientRegistrationSuccess(): void {
  if (!isRemoteMcpEnabled()) return
  console.info('[APIAI07_CONSENT_CLIENT_REGISTRATION_SUCCEEDED]', {
    authorizationMethod: 'apikey-only',
    credentialMode: getAdminCredentialMode(),
  })
}

async function registerChatGptMcpClient(clientId: string): Promise<boolean> {
  let stage = 'admin-client'
  try {
    const admin = createAdminRpcClient()
    stage = 'registration-rpc'
    const { data, error } = await admin.rpc('register_apiai07_mcp_client', {
      requested_client_id: clientId,
    })
    if (error) {
      reportClientRegistrationFailure(clientId, stage, error)
      return false
    }

    if (
      typeof data !== 'object'
      || data === null
      || Array.isArray(data)
      || (data as Record<string, unknown>).registered !== true
    ) {
      reportClientRegistrationFailure(clientId, 'registration-unconfirmed', {
        code: null,
        message: 'registration_not_confirmed',
      })
      return false
    }
    reportClientRegistrationSuccess()
    return true
  } catch (error) {
    reportClientRegistrationFailure(clientId, stage, error)
    return false
  }
}

export async function approveChatGptMcpConsent(formData: FormData): Promise<never> {
  const authorizationId = formData.get('authorization_id')
  if (!isAuthorizationId(authorizationId)) redirect('/oauth/consent')

  const authorization = await getCurrentAuthorization(authorizationId)
  if (authorization.kind === 'unauthenticated') redirect(buildConsentLoginHref(authorizationId))
  if (authorization.kind !== 'ready') redirect(buildConsentPath(authorizationId))
  if (!isSupportedChatGptScope(authorization.scope) || !(await requireEmployeeSelf(authorization.supabase, authorization.userId))) {
    redirect(buildConsentPath(authorizationId))
  }

  if (!(await registerChatGptMcpClient(authorization.clientId))) {
    redirect(OAUTH_DECISION_ERROR_PATH)
  }

  let approvalRedirectUrl: unknown = null
  let approvalFailed = false
  try {
    const response = await authorization.supabase.auth.oauth.approveAuthorization(
      authorizationId,
      { skipBrowserRedirect: true },
    )
    approvalFailed = response.error !== null
    if (!approvalFailed) approvalRedirectUrl = response.data?.redirect_url
  } catch {
    approvalFailed = true
  }
  if (approvalFailed || !isSupabaseAuthorizationRedirectUrl(approvalRedirectUrl, authorization.redirectUri)) {
    redirect(OAUTH_DECISION_ERROR_PATH)
  }

  redirect(approvalRedirectUrl)
}

export async function denyChatGptMcpConsent(formData: FormData): Promise<never> {
  const authorizationId = formData.get('authorization_id')
  if (!isAuthorizationId(authorizationId)) redirect('/oauth/consent')

  const authorization = await getCurrentAuthorization(authorizationId)
  if (authorization.kind === 'unauthenticated') redirect(buildConsentLoginHref(authorizationId))
  if (authorization.kind !== 'ready') redirect(buildConsentPath(authorizationId))

  let denialRedirectUrl: unknown = null
  let denialFailed = false
  try {
    const response = await authorization.supabase.auth.oauth.denyAuthorization(
      authorizationId,
      { skipBrowserRedirect: true },
    )
    denialFailed = response.error !== null
    if (!denialFailed) denialRedirectUrl = response.data?.redirect_url
  } catch {
    denialFailed = true
  }
  if (denialFailed || !isSupabaseAuthorizationRedirectUrl(denialRedirectUrl, authorization.redirectUri)) {
    redirect(OAUTH_DECISION_ERROR_PATH)
  }

  redirect(denialRedirectUrl)
}
