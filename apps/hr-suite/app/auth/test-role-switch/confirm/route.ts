import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const HANDOFF_COOKIE = 'liquidhr-test-role-switch'

function redirectWithClearedHandoff(request: NextRequest, path: string): NextResponse {
  const response = NextResponse.redirect(new URL(path, request.url))
  response.cookies.set(HANDOFF_COOKIE, '', { expires: new Date(0), maxAge: 0, path: '/' })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const tokenHash = cookieStore.get(HANDOFF_COOKIE)?.value
  if (!tokenHash) return redirectWithClearedHandoff(request, '/login?error=test-role-switch')

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  return redirectWithClearedHandoff(request, error ? '/login?error=test-role-switch' : '/dashboard/start')
}
