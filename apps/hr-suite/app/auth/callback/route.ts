import { NextRequest, NextResponse } from 'next/server'
import { safeNextPath } from '@/lib/auth/login-rules'
import { resolveRequestOrigin } from '@/lib/auth/request-origin'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const next = safeNextPath(request.nextUrl.searchParams.get('next'))
  const origin = resolveRequestOrigin({
    canonicalUrl: process.env.NEXT_PUBLIC_APP_URL,
    fallbackUrl: request.url,
    forwardedHost: request.headers.get('x-forwarded-host'),
    forwardedProtocol: request.headers.get('x-forwarded-proto'),
    host: request.headers.get('host') ?? request.nextUrl.host,
  })

  if (!code) {
    return NextResponse.redirect(buildAuthErrorUrl(origin, next))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  return NextResponse.redirect(error ? buildAuthErrorUrl(origin, next) : new URL(next, origin))
}

function buildAuthErrorUrl(origin: string, next: string): URL {
  const url = new URL('/login', origin)
  url.searchParams.set('error', 'auth')
  url.searchParams.set('next', next)
  return url
}
