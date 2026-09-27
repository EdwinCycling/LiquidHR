import { NextRequest, NextResponse } from 'next/server'
import {
  getTestAuthHarnessCredentials,
  isTestRoleSwitchEnabled,
} from '@/lib/auth/test-role-switch'
import { createClient } from '@/lib/supabase/server'

function jsonError(error: string, status: number): NextResponse {
  const response = NextResponse.json({ error }, { status })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  return response
}

function loginRedirect(request: NextRequest, path: string): NextResponse {
  const response = NextResponse.redirect(new URL(path, request.nextUrl.origin), { status: 303 })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isTestRoleSwitchEnabled()) return jsonError('TEST_LOGIN_DISABLED', 404)

  if (request.headers.get('origin') !== request.nextUrl.origin) {
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

  const credentials = getTestAuthHarnessCredentials(persona)
  if (!credentials) return jsonError('TEST_LOGIN_UNAVAILABLE', 503)

  try {
    const supabase = await createClient()
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) return loginRedirect(request, '/login?error=test-login')

    const { error: signInError } = await supabase.auth.signInWithPassword(credentials)
    if (signInError) return loginRedirect(request, '/login?error=test-login')

    return loginRedirect(request, '/dashboard/start')
  } catch {
    return loginRedirect(request, '/login?error=test-login')
  }
}
