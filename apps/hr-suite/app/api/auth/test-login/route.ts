import { NextRequest, NextResponse } from 'next/server'
import {
  getTestAuthHarnessCredentials,
  isTestRoleSwitchEnabled,
} from '@/lib/auth/test-role-switch'
import { safeNextPath } from '@/lib/auth/login-rules'
import { resolveRequestOrigin } from '@/lib/auth/request-origin'
import { clearActiveContextCookies } from '@/lib/context/context-cookies'
import { createClient } from '@/lib/supabase/server'

function jsonError(error: string, status: number): NextResponse {
  const response = NextResponse.json({ error }, { status })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  return response
}

function requestOrigin(request: NextRequest): string {
  return resolveRequestOrigin({
    canonicalUrl: process.env.NEXT_PUBLIC_APP_URL,
    fallbackUrl: request.url,
    forwardedHost: request.headers.get('x-forwarded-host'),
    forwardedProtocol: request.headers.get('x-forwarded-proto'),
    host: request.headers.get('host') ?? request.nextUrl.host,
  })
}

function loginRedirect(origin: string, path: string): NextResponse {
  const response = NextResponse.redirect(new URL(path, origin), { status: 303 })
  clearActiveContextCookies(response)
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isTestRoleSwitchEnabled()) return jsonError('TEST_LOGIN_DISABLED', 404)

  const origin = request.headers.get('origin')
  const resolvedOrigin = requestOrigin(request)
  if (origin !== resolvedOrigin) {
    return jsonError('TEST_LOGIN_FORBIDDEN', 403)
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return jsonError('TEST_LOGIN_FORBIDDEN', 403)
  }

  const persona = formData.get('persona')
  if (persona !== 'hr-admin') return jsonError('TEST_LOGIN_FORBIDDEN', 403)
  const requestedNextPath = formData.get('next')
  const nextPath = safeNextPath(typeof requestedNextPath === 'string' ? requestedNextPath : null)
  const loginFailurePath = '/login?error=test-login'
    + (typeof requestedNextPath === 'string' ? '&next=' + encodeURIComponent(nextPath) : '')

  const credentials = getTestAuthHarnessCredentials(persona)
  if (!credentials) return jsonError('TEST_LOGIN_UNAVAILABLE', 503)

  try {
    const supabase = await createClient()
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) return loginRedirect(resolvedOrigin, loginFailurePath)

    const { error: signInError } = await supabase.auth.signInWithPassword(credentials)
    if (signInError) return loginRedirect(resolvedOrigin, loginFailurePath)

    return loginRedirect(resolvedOrigin, nextPath)
  } catch {
    return loginRedirect(resolvedOrigin, loginFailurePath)
  }
}
