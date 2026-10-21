import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { safeNextPath } from '@/lib/auth/login-rules'
import { getLocalPersonaOwnerEmail, isLocalPersonaRuntime, readLocalPersonaOwnerMarker, TEST_ROLE_SWITCH_OWNER_COOKIE } from '@/lib/auth/test-role-switch'
import { normalizedEmail } from '@/lib/auth/test-role-switch'
import { createClient } from '@/lib/supabase/server'

const HANDOFF_COOKIE = 'liquidhr-local-persona-handoff'
const NEXT_PATH_COOKIE = 'liquidhr-local-persona-next'

function clearHandoffCookies(response: NextResponse): NextResponse {
  response.cookies.set(HANDOFF_COOKIE, '', { expires: new Date(0), maxAge: 0, path: '/' })
  response.cookies.set(NEXT_PATH_COOKIE, '', { expires: new Date(0), maxAge: 0, path: '/' })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

function localOrigin(request: NextRequest): string | null {
  const host = request.headers.get('host') ?? request.nextUrl.host
  if (!isLocalPersonaRuntime(host) || !isLocalPersonaRuntime(request.nextUrl.host)) return null
  const protocol = request.nextUrl.protocol
  if (!['http:', 'https:'].includes(protocol)) return null
  return `${protocol}//${host}`
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = localOrigin(request)
  if (!origin) return clearHandoffCookies(NextResponse.json({ error: 'LOCAL_PERSONA_SWITCH_FORBIDDEN' }, { status: 404 }))

  const cookieStore = await cookies()
  const tokenHash = cookieStore.get(HANDOFF_COOKIE)?.value
  if (!tokenHash) return clearHandoffCookies(NextResponse.redirect(new URL('/login?error=test-role-switch', origin)))
  const nextPath = safeNextPath(cookieStore.get(NEXT_PATH_COOKIE)?.value)
  const ownerKey = readLocalPersonaOwnerMarker(cookieStore.get(TEST_ROLE_SWITCH_OWNER_COOKIE)?.value)

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  const destination = error ? '/login?error=test-role-switch' : nextPath
  const response = clearHandoffCookies(NextResponse.redirect(new URL(destination, origin)))
  if (!error && ownerKey) {
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
    const ownerEmail = getLocalPersonaOwnerEmail(ownerKey)
    if (!claimsError && ownerEmail && normalizedEmail(claimsData?.claims?.email) === ownerEmail) {
      response.cookies.set(TEST_ROLE_SWITCH_OWNER_COOKIE, '', { expires: new Date(0), maxAge: 0, path: '/' })
    }
  }
  return response
}
