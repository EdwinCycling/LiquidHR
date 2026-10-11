import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  completeNmbrsAuthorization,
  failNmbrsAuthorization,
  PAYROLL_OAUTH_STATE_COOKIE,
  payrollOAuthStateCookieOptions,
} from '@/lib/payroll/payroll-service'

export const runtime = 'nodejs'

function settingsRedirect(status: 'connected' | 'error'): NextResponse {
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: `/payroll-lab/integrations?payroll=${status}` },
  })
  response.cookies.set(PAYROLL_OAUTH_STATE_COOKIE, '', { ...payrollOAuthStateCookieOptions(), maxAge: 0 })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
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
      return settingsRedirect('error')
    }
    if (!stateMatchesCookie || !code) {
      return settingsRedirect('error')
    }
    await completeNmbrsAuthorization({ state, code })
    return settingsRedirect('connected')
  } catch {
    return settingsRedirect('error')
  }
}
