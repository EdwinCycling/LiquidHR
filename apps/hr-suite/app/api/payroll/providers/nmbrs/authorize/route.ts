import { NextResponse } from 'next/server'
import {
  PAYROLL_OAUTH_STATE_COOKIE,
  payrollErrorResponse,
  payrollOAuthStateCookieOptions,
  startNmbrsAuthorization,
} from '@/lib/payroll/payroll-service'

export const runtime = 'nodejs'

function isSameOriginRequest(request: Request): boolean {
  const expectedOrigin = new URL(request.url).origin
  const source = request.headers.get('origin') ?? request.headers.get('referer')
  if (source) {
    try {
      return new URL(source).origin === expectedOrigin
    } catch {
      return false
    }
  }
  return request.headers.get('sec-fetch-site') === 'same-origin'
}

export async function GET(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) return Response.json({ error: 'PAYROLL_REQUEST_ORIGIN_INVALID' }, { status: 403 })
  try {
    const url = new URL(request.url)
    const result = await startNmbrsAuthorization(url.searchParams.get('connectionId') ?? undefined)
    const response = NextResponse.redirect(result.authorizationUrl)
    response.cookies.set(PAYROLL_OAUTH_STATE_COOKIE, result.state, payrollOAuthStateCookieOptions())
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Referrer-Policy', 'no-referrer')
    return response
  } catch (error) {
    return payrollErrorResponse(error)
  }
}
