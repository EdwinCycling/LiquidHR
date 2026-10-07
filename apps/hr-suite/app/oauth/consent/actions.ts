'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireAuthContext } from '@/lib/auth/permissions'
import {
  buildConsentLoginHref,
  buildConsentPath,
  isAllowedChatGptRedirectUri,
  isAllowedChatGptRedirectUrl,
  isAuthorizationId,
  isSupportedChatGptScope,
  parseConsentAuthorization,
} from './authorization'

type AuthorizationLookup =
  | { readonly kind: 'unauthenticated' }
  | { readonly kind: 'invalid' }
  | {
      readonly kind: 'ready'
      readonly supabase: Awaited<ReturnType<typeof createClient>>
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

  let authorizationResponse: unknown = null
  let authorizationError = false
  try {
    const response = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
    authorizationResponse = response.data
    authorizationError = response.error !== null
  } catch {
    authorizationError = true
  }

  let authenticated = false
  try {
    const { data, error } = await supabase.auth.getClaims()
    authenticated = !error && typeof data?.claims?.sub === 'string' && data.claims.sub.length > 0
  } catch {
    authenticated = false
  }
  if (!authenticated) return { kind: 'unauthenticated' }

  const authorization = authorizationError ? null : parseConsentAuthorization(authorizationResponse, authorizationId)
  if (!authorization || !isAllowedChatGptRedirectUri(authorization.redirectUri)) return { kind: 'invalid' }

  return {
    kind: 'ready',
    supabase,
    clientId: authorization.clientId,
    scope: authorization.scope,
    redirectUri: authorization.redirectUri,
  }
}

async function requireEmployeeSelf(): Promise<boolean> {
  try {
    const context = await requireAuthContext()
    return context.employeeId !== null
      && context.activeRoles.includes('EMPLOYEE')
      && !context.activeRoles.some((role) => role === 'DIRECT_MANAGER' || role.includes('HR') || role === 'TENANT_ADMIN')
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
  if (!isSupportedChatGptScope(authorization.scope) || !(await requireEmployeeSelf())) {
    redirect(buildConsentPath(authorizationId))
  }

  const { data, error } = await authorization.supabase.auth.oauth.approveAuthorization(
    authorizationId,
    { skipBrowserRedirect: true },
  )
  if (error || !data?.redirect_url || !isAllowedChatGptRedirectUrl(data.redirect_url)) {
    redirect(buildConsentPath(authorizationId))
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
  if (registrationFailed) redirect(buildConsentPath(authorizationId))

  redirect(data.redirect_url)
}

export async function denyChatGptMcpConsent(formData: FormData): Promise<never> {
  const authorizationId = formData.get('authorization_id')
  if (!isAuthorizationId(authorizationId)) redirect('/oauth/consent')

  const authorization = await getCurrentAuthorization(authorizationId)
  if (authorization.kind === 'unauthenticated') redirect(buildConsentLoginHref(authorizationId))
  if (authorization.kind !== 'ready') redirect(buildConsentPath(authorizationId))

  const { data, error } = await authorization.supabase.auth.oauth.denyAuthorization(
    authorizationId,
    { skipBrowserRedirect: true },
  )
  if (error || !data?.redirect_url || !isAllowedChatGptRedirectUrl(data.redirect_url)) {
    redirect(buildConsentPath(authorizationId))
  }

  redirect(data.redirect_url)
}
