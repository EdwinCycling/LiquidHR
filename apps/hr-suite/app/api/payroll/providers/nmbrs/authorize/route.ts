import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  PAYROLL_OAUTH_STATE_COOKIE,
  payrollErrorResponse,
  payrollOAuthStateCookieOptions,
  startNmbrsAuthorization,
} from '@/lib/payroll/payroll-service'

export const runtime = 'nodejs'

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url)
    const result = await startNmbrsAuthorization(url.searchParams.get('connectionId') ?? undefined)
    const cookieStore = await cookies()
    cookieStore.set(PAYROLL_OAUTH_STATE_COOKIE, result.state, payrollOAuthStateCookieOptions())
    return NextResponse.redirect(result.authorizationUrl)
  } catch (error) {
    return payrollErrorResponse(error)
  }
}
