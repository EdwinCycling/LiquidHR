import { NextRequest, NextResponse } from 'next/server'
import { safeNextPath } from '@/lib/auth/login-rules'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const next = safeNextPath(request.nextUrl.searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=auth', request.url))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  return NextResponse.redirect(new URL(error ? '/login?error=auth' : next, request.url))
}
