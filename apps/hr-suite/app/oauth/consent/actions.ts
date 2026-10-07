'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireAuthContext } from '@/lib/auth/permissions'

const AUTHORIZATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CHATGPT_CALLBACK_PATTERN = /^\/connector\/oauth\/[a-zA-Z0-9_-]{1,128}$/

function isAllowedChatGptRedirectUri(value: string): boolean {
  try {
    const uri = new URL(value)
    return uri.protocol === 'https:'
      && uri.hostname === 'chatgpt.com'
      && !uri.port
      && !uri.username
      && !uri.password
      && !uri.search
      && !uri.hash
      && (uri.pathname === '/connector_platform_oauth_redirect' || CHATGPT_CALLBACK_PATTERN.test(uri.pathname))
  } catch {
    return false
  }
}

function consentPageUrl(authorizationId: string, errorCode: string): string {
  const query = new URLSearchParams({ authorization_id: authorizationId, error: errorCode })
  return `/oauth/consent?${query.toString()}`
}

async function getCurrentAuthorization(authorizationId: string) {
  if (!AUTHORIZATION_ID_PATTERN.test(authorizationId)) return null

  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (claimsError || typeof userId !== 'string') return null

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
  if (error || !data || 'redirect_url' in data) return null
  if (
    data.authorization_id !== authorizationId
    || data.user.id !== userId
    || !isAllowedChatGptRedirectUri(data.redirect_uri)
  ) return null

  return { supabase, details: data }
}

export async function approveChatGptMcpConsent(formData: FormData): Promise<never> {
  const authorizationId = formData.get('authorization_id')
  if (typeof authorizationId !== 'string' || !AUTHORIZATION_ID_PATTERN.test(authorizationId)) {
    redirect('/oauth/consent?error=invalid-request')
  }

  const authorization = await getCurrentAuthorization(authorizationId)
  if (!authorization) redirect(consentPageUrl(authorizationId, 'invalid-request'))

  const requestedScopes = authorization.details.scope.split(/\s+/u).filter(Boolean)
  if (requestedScopes.length !== 1 || requestedScopes[0] !== 'openid') {
    redirect(consentPageUrl(authorizationId, 'unsupported-scope'))
  }

  let context
  try {
    context = await requireAuthContext()
  } catch {
    redirect(consentPageUrl(authorizationId, 'employee-only'))
  }
  const isEmployeeSelf = context.employeeId !== null
    && context.activeRoles.includes('EMPLOYEE')
    && !context.activeRoles.some((role) => role === 'DIRECT_MANAGER' || role.includes('HR') || role === 'TENANT_ADMIN')
  if (!isEmployeeSelf) redirect(consentPageUrl(authorizationId, 'employee-only'))

  const { data, error } = await authorization.supabase.auth.oauth.approveAuthorization(
    authorizationId,
    { skipBrowserRedirect: true },
  )
  if (error || !data?.redirect_url || !isAllowedChatGptRedirectUri(data.redirect_url)) {
    redirect(consentPageUrl(authorizationId, 'approval-failed'))
  }

  let registrationFailed = false
  try {
    const admin = createAdminClient()
    const { error: registrationError } = await admin.rpc('register_apiai07_mcp_client', {
      requested_client_id: authorization.details.client.id,
    })
    registrationFailed = registrationError !== null
  } catch {
    registrationFailed = true
  }
  if (registrationFailed) redirect(consentPageUrl(authorizationId, 'approval-failed'))

  redirect(data.redirect_url)
}

export async function denyChatGptMcpConsent(formData: FormData): Promise<never> {
  const authorizationId = formData.get('authorization_id')
  if (typeof authorizationId !== 'string' || !AUTHORIZATION_ID_PATTERN.test(authorizationId)) {
    redirect('/oauth/consent?error=invalid-request')
  }

  const authorization = await getCurrentAuthorization(authorizationId)
  if (!authorization) redirect(consentPageUrl(authorizationId, 'invalid-request'))

  const { data, error } = await authorization.supabase.auth.oauth.denyAuthorization(
    authorizationId,
    { skipBrowserRedirect: true },
  )
  if (error || !data?.redirect_url || !isAllowedChatGptRedirectUri(data.redirect_url)) {
    redirect(consentPageUrl(authorizationId, 'approval-failed'))
  }

  redirect(data.redirect_url)
}
