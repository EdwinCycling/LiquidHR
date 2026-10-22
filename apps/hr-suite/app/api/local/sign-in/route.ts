import { NextRequest, NextResponse } from 'next/server'
import { localFiscalRequestOrigin } from '@/lib/employment/local-fiscal-request-origin'
import { isLocalPersonaRuntime } from '@/lib/auth/test-role-switch'
import {
  getLocalTestPersonaPassword,
  getLocalTestPersonaPasswordEnvironmentKey,
  getLocalTestPersonaEmail,
  isLocalTestPersonaKey,
  verifyLocalTestPersonaIdentity,
} from '@/lib/auth/local-test-personas'
import { createClient } from '@/lib/supabase/server'
import {
  ACTIVE_ADMINISTRATION_COOKIE,
  ACTIVE_HR_GROUP_COOKIE,
  ACTIVE_TENANT_COOKIE,
  clearActiveContextCookies,
} from '@/lib/context/context-cookies'

function noStore<T extends NextResponse>(response: T): T {
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

function unavailable(environmentKey: string): NextResponse {
  return noStore(NextResponse.json(
    { error: 'LOCAL_SIGN_IN_UNAVAILABLE', missing: environmentKey },
    { status: 503 },
  ))
}

async function denyAuthenticatedPersona(
  client: Awaited<ReturnType<typeof createClient>>,
  status: 403 | 503 = 403,
): Promise<NextResponse> {
  let signOutFailed = false
  try {
    const { error } = await client.auth.signOut({ scope: 'local' })
    signOutFailed = Boolean(error)
  } catch {
    signOutFailed = true
  }
  const response = noStore(new NextResponse(null, { status: signOutFailed ? 503 : status }))
  clearActiveContextCookies(response)
  return response
}

export async function POST(request: NextRequest) {
  if (
    !isLocalPersonaRuntime(request.headers.get('host'))
    || !isLocalPersonaRuntime(request.nextUrl.host)
  ) return noStore(new NextResponse(null, { status: 404 }))

  const origin = localFiscalRequestOrigin(request.headers.get('host'), request.url, request.headers.get('origin'))
  if (!origin) return noStore(new NextResponse(null, { status: 403 }))

  const form = await request.formData()
  const keys = Array.from(form.keys())
  const account = form.get('account')
  if (keys.length !== 1 || keys[0] !== 'account' || typeof account !== 'string' || !isLocalTestPersonaKey(account)) {
    return noStore(new NextResponse(null, { status: 400 }))
  }

  const password = getLocalTestPersonaPassword(account)
  if (!password) return unavailable(getLocalTestPersonaPasswordEnvironmentKey(account))

  const client = await createClient()
  const result = await client.auth.signInWithPassword({ email: getLocalTestPersonaEmail(account), password })
  if (result.error) return noStore(NextResponse.json({ error: 'LOCAL_SIGN_IN_FAILED' }, { status: 401 }))

  let verified
  try {
    verified = await verifyLocalTestPersonaIdentity(client, account)
  } catch {
    return denyAuthenticatedPersona(client, 503)
  }
  if (!verified) return denyAuthenticatedPersona(client)

  const response = NextResponse.redirect(new URL('/dashboard/start', origin), { status: 303 })
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  }
  response.cookies.set(ACTIVE_TENANT_COOKIE, verified.tenantId, cookieOptions)
  response.cookies.set(ACTIVE_HR_GROUP_COOKIE, verified.hrGroupId, cookieOptions)
  response.cookies.delete(ACTIVE_ADMINISTRATION_COOKIE)
  return noStore(response)
}
