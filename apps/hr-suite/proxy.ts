import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isProtectedApplicationPath } from '@/lib/auth/route-access'

function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; message?: unknown; status?: unknown }
  return candidate.code === 'refresh_token_not_found' || (candidate.status === 400 && candidate.message === 'Invalid Refresh Token: Refresh Token Not Found')
}

function clearInvalidAuthCookies(response: NextResponse, request: NextRequest): void {
  request.cookies.getAll()
    .filter(({ name }) => name.startsWith('sb-'))
    .forEach(({ name }) => response.cookies.set(name, '', { expires: new Date(0), maxAge: 0, path: '/' }))
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  let data: Awaited<ReturnType<typeof supabase.auth.getClaims>>['data'] = null
  let hadInvalidRefreshToken = false
  try {
    data = (await supabase.auth.getClaims()).data
  } catch (error) {
    if (!isInvalidRefreshTokenError(error)) throw error
    hadInvalidRefreshToken = true
  }
  const isAuthenticated = Boolean(data?.claims)
  const { pathname } = request.nextUrl

  if (isProtectedApplicationPath(pathname) && !isAuthenticated) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    const redirectResponse = NextResponse.redirect(url)
    if (hadInvalidRefreshToken) clearInvalidAuthCookies(redirectResponse, request)
    return redirectResponse
  }

  if (pathname === '/login' && isAuthenticated) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard/start'
    return NextResponse.redirect(url)
  }

  if (hadInvalidRefreshToken) clearInvalidAuthCookies(response, request)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
