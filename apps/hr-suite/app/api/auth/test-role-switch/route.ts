import { NextRequest, NextResponse } from 'next/server'
import {
  canInitiateTestRoleSwitch,
  getTestRoleSwitchTarget,
  isTestRoleSwitchAccount,
  isTestRoleSwitchEnabled,
} from '@/lib/auth/test-role-switch'
import { getRequestAuthorizationContext, permissionErrorResponse } from '@/lib/auth/permissions'
import { resolveRequestOrigin } from '@/lib/auth/request-origin'
import { createAdminClient } from '@/lib/supabase/admin'

const HANDOFF_COOKIE = 'liquidhr-test-role-switch'

export async function POST(request: NextRequest) {
  if (!isTestRoleSwitchEnabled()) {
    return NextResponse.json({ error: 'TEST_ROLE_SWITCH_DISABLED' }, { status: 404 })
  }

  let requestContext: Awaited<ReturnType<typeof getRequestAuthorizationContext>>
  try {
    requestContext = await getRequestAuthorizationContext()
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    throw error
  }

  const currentEmail = typeof requestContext.email === 'string' ? requestContext.email : null
  const formData = await request.formData()
  const target = getTestRoleSwitchTarget(String(formData.get('target') ?? ''))

  if (
    !isTestRoleSwitchAccount(currentEmail)
    || !canInitiateTestRoleSwitch(requestContext.context.activeRoles)
    || !target
  ) {
    return NextResponse.json({ error: 'TEST_ROLE_SWITCH_FORBIDDEN' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: generated, error: generateError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: target.email,
  })

  if (generateError || !generated.properties.hashed_token) {
    return NextResponse.json({ error: 'TEST_ROLE_SWITCH_UNAVAILABLE' }, { status: 503 })
  }

  await requestContext.supabase.auth.signOut()

  const origin = resolveRequestOrigin({
    canonicalUrl: process.env.NEXT_PUBLIC_APP_URL,
    fallbackUrl: request.url,
    forwardedHost: request.headers.get('x-forwarded-host'),
    forwardedProtocol: request.headers.get('x-forwarded-proto'),
    host: request.headers.get('host') ?? request.nextUrl.host,
  })
  const callbackUrl = new URL('/auth/test-role-switch/confirm', origin)
  const response = NextResponse.redirect(callbackUrl, { status: 303 })
  response.cookies.set(HANDOFF_COOKIE, generated.properties.hashed_token, {
    httpOnly: true,
    maxAge: 60,
    path: '/',
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
  })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
