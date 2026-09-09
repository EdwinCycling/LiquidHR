import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  completeNmbrsAuthorization,
  failNmbrsAuthorization,
  PAYROLL_OAUTH_STATE_COOKIE,
  payrollOAuthStateCookieOptions,
} from '@/lib/payroll/payroll-service'

export const runtime = 'nodejs'

function settingsRedirect(request: Request, status: 'connected' | 'error'): NextResponse {
  const url = new URL('/payroll/settings', request.url)
  url.searchParams.set('payroll', status)
  return NextResponse.redirect(url)
}

async function clearStateCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(PAYROLL_OAUTH_STATE_COOKIE, '', { ...payrollOAuthStateCookieOptions(), maxAge: 0 })
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  try {
    const cookieStore = await cookies()
    const cookieState = cookieStore.get(PAYROLL_OAUTH_STATE_COOKIE)?.value
    const stateMatchesCookie = Boolean(state && cookieState && state === cookieState)
    if (url.searchParams.get('error')) {
      if (stateMatchesCookie) await failNmbrsAuthorization({ state })
      await clearStateCookie()
      return settingsRedirect(request, 'error')
    }
    if (!stateMatchesCookie || !code) {
      await clearStateCookie()
      return settingsRedirect(request, 'error')
    }
    await completeNmbrsAuthorization({ state, code })
    await clearStateCookie()
    return settingsRedirect(request, 'connected')
  } catch {
    await clearStateCookie()
    return settingsRedirect(request, 'error')
  }
}
