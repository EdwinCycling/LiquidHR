'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { resolveEmployeeSelfContext } from '@/lib/api-v1/auth/employee-self-context'
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

export async function approveChatGptMcpConsent(formData: FormData): Promise<never> {
  const authorizationId = formData.get('authorization_id')
  if (!isAuthorizationId(authorizationId)) redirect('/oauth/consent')

  const authorization = await getCurrentAuthorization(authorizationId)
  if (authorization.kind === 'unauthenticated') redirect(buildConsentLoginHref(authorizationId))
  if (authorization.kind !== 'ready') redirect(buildConsentPath(authorizationId))
  if (!isSupportedChatGptScope(authorization.scope) || !(await requireEmployeeSelf(authorization.supabase, authorization.userId))) {
    redirect(buildConsentPath(authorizationId))
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

  let registrationFailed = false
  try {
    const admin = createAdminClient()
    const { error: registrationError } = await admin.rpc('register_apiai07_mcp_client', {
      requested_client_id: authorization.clientId,
    })
    registrationFailed = registrationError !== null
  } catch {
    registrationFailed = true
  }
  if (registrationFailed) console.error('[APIAI07_CONSENT_CLIENT_REGISTRATION_FAILED]')

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
