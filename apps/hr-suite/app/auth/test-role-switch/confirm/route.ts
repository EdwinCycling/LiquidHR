import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestOrigin } from '@/lib/auth/request-origin'
import { isTestRoleSwitchEnabled } from '@/lib/auth/test-role-switch'
import { createClient } from '@/lib/supabase/server'

const HANDOFF_COOKIE = 'liquidhr-test-role-switch'

function redirectWithClearedHandoff(request: NextRequest, path: string): NextResponse {
  const origin = resolveRequestOrigin({
    canonicalUrl: process.env.NEXT_PUBLIC_APP_URL,
    fallbackUrl: request.url,
    forwardedHost: request.headers.get('x-forwarded-host'),
    forwardedProtocol: request.headers.get('x-forwarded-proto'),
    host: request.headers.get('host') ?? request.nextUrl.host,
  })
  const response = NextResponse.redirect(new URL(path, origin))
  response.cookies.set(HANDOFF_COOKIE, '', { expires: new Date(0), maxAge: 0, path: '/' })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

export async function GET(request: NextRequest) {
  if (!isTestRoleSwitchEnabled()) return redirectWithClearedHandoff(request, '/login?error=test-role-switch')

  const cookieStore = await cookies()
  const tokenHash = cookieStore.get(HANDOFF_COOKIE)?.value
  if (!tokenHash) return redirectWithClearedHandoff(request, '/login?error=test-role-switch')

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  return redirectWithClearedHandoff(request, error ? '/login?error=test-role-switch' : '/dashboard/start')
}
