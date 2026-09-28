import { type NextRequest, NextResponse } from 'next/server'
import { resolveRequestOrigin } from '@/lib/auth/request-origin'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { ACTIVE_ADMINISTRATION_COOKIE, ACTIVE_HR_GROUP_COOKIE, ACTIVE_TENANT_COOKIE } from '@/lib/context/server-context'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const cookieStore = await cookies()
  cookieStore.delete(ACTIVE_TENANT_COOKIE)
  cookieStore.delete(ACTIVE_HR_GROUP_COOKIE)
  cookieStore.delete(ACTIVE_ADMINISTRATION_COOKIE)
  const origin = resolveRequestOrigin({
    canonicalUrl: process.env.NEXT_PUBLIC_APP_URL,
    fallbackUrl: request.url,
    forwardedHost: request.headers.get('x-forwarded-host'),
    forwardedProtocol: request.headers.get('x-forwarded-proto'),
    host: request.headers.get('host') ?? request.nextUrl.host,
  })
  return NextResponse.redirect(new URL('/login', origin), { status: 302 })
}
