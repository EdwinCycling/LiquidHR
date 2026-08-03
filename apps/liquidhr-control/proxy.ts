import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { ControlDatabase } from '@/lib/supabase/database'

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const { pathname } = request.nextUrl

  if (!supabaseUrl || !publishableKey) {
    if (pathname !== '/setup' && !pathname.startsWith('/_next')) {
      return NextResponse.redirect(new URL('/setup', request.url))
    }
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient<ControlDatabase>(supabaseUrl, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  const { data } = await supabase.auth.getClaims()
  const authenticated = Boolean(data?.claims)
  const publicPath = pathname === '/login' || pathname === '/setup' || pathname === '/auth/callback'

  if (!publicPath && !authenticated) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (pathname === '/login' && authenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  return response
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
