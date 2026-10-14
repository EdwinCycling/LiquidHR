import { NextRequest, NextResponse } from 'next/server'
import {
  canReturnToLocalPersonaOwner,
  createLocalPersonaOwnerMarker,
  getLocalPersonaOwnerKey,
  getLocalPersonaOperatorTargetKeys,
  isLocalPersonaRuntime,
  normalizedEmail,
  readLocalPersonaOwnerMarker,
  getTestRoleSwitchTarget,
  TEST_ROLE_SWITCH_OWNER_COOKIE,
} from '@/lib/auth/test-role-switch'
import { getLocalPayrollPersonaReadiness } from '@/lib/auth/local-payroll-persona-readiness'
import { safeNextPath } from '@/lib/auth/login-rules'
import { clearActiveContextCookies } from '@/lib/context/context-cookies'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const HANDOFF_COOKIE = 'liquidhr-local-persona-handoff'
const NEXT_PATH_COOKIE = 'liquidhr-local-persona-next'
const AUTH_USER_PAGE_SIZE = 1000
const MAX_AUTH_USER_PAGES = 100

function isSameLocalOriginRequest(request: NextRequest): string | null {
  const host = request.headers.get('host')
  const origin = request.headers.get('origin')
  if (!isLocalPersonaRuntime(host) || !origin) return null

  try {
    const parsedOrigin = new URL(origin)
    if (
      !['http:', 'https:'].includes(parsedOrigin.protocol)
      || parsedOrigin.username
      || parsedOrigin.password
      || parsedOrigin.pathname !== '/'
      || parsedOrigin.search
      || parsedOrigin.hash
      || !isLocalPersonaRuntime(parsedOrigin.host)
      || parsedOrigin.host.toLowerCase() !== host?.trim().toLowerCase()
      || !isLocalPersonaRuntime(request.nextUrl.host)
    ) return null

    return parsedOrigin.origin
  } catch {
    return null
  }
}

async function hasExistingVerifiedAuthUser(admin: ReturnType<typeof createAdminClient>, email: string): Promise<boolean> {
  const expectedEmail = normalizedEmail(email)
  for (let page = 1; page <= MAX_AUTH_USER_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: AUTH_USER_PAGE_SIZE })
    if (error) return false
    if (data.users.some((user) => (
      normalizedEmail(user.email) === expectedEmail
      && Boolean(user.email_confirmed_at)
      && user.is_anonymous !== true
    ))) return true
    if (data.lastPage <= page) return false
  }
  return false
}

function jsonError(error: string, status: number): NextResponse {
  const response = NextResponse.json({ error }, { status })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  return response
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = isSameLocalOriginRequest(request)
  if (!origin) return jsonError('LOCAL_PERSONA_SWITCH_FORBIDDEN', 404)

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return jsonError('LOCAL_PERSONA_SWITCH_FORBIDDEN', 403)
  }

  const targetKey = String(formData.get('target') ?? '')
  const target = getTestRoleSwitchTarget(targetKey)
  if (!target) return jsonError('LOCAL_PERSONA_SWITCH_FORBIDDEN', 403)

  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  const identity = {
    email: typeof claims?.email === 'string' ? claims.email : null,
    emailVerified: claims?.email_verified === true,
  }
  const host = request.headers.get('host')
  const ownerKey = !claimsError && Boolean(claims?.sub) ? getLocalPersonaOwnerKey(host, identity) : null
  const ownerMarker = request.cookies.get(TEST_ROLE_SWITCH_OWNER_COOKIE)?.value ?? null
  const returnOwnerKey = readLocalPersonaOwnerMarker(ownerMarker)
  const isOwner = ownerKey !== null
  const canReturnToOwner = !claimsError && Boolean(claims?.sub)
    && canReturnToLocalPersonaOwner(host, identity, ownerMarker)

  if (!isOwner && !canReturnToOwner) return jsonError('LOCAL_PERSONA_SWITCH_FORBIDDEN', 403)
  if (isOwner && ownerKey && target.key !== ownerKey && !getLocalPersonaOperatorTargetKeys(ownerKey).includes(target.key)) {
    return jsonError('LOCAL_PERSONA_SWITCH_FORBIDDEN', 403)
  }
  if (!isOwner && target.key !== returnOwnerKey) return jsonError('LOCAL_PERSONA_SWITCH_FORBIDDEN', 403)

  const requestedNextPath = formData.get('next')
  const nextPath = typeof requestedNextPath === 'string' && requestedNextPath.length <= 2048
    ? safeNextPath(requestedNextPath)
    : '/dashboard/start'

  if (normalizedEmail(identity.email) === target.email) {
    const response = NextResponse.redirect(new URL(nextPath, origin), { status: 303 })
    response.cookies.set(TEST_ROLE_SWITCH_OWNER_COOKIE, '', { expires: new Date(0), maxAge: 0, path: '/' })
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Referrer-Policy', 'no-referrer')
    return response
  }

  const admin = createAdminClient()
  if (target.key === 'payroll-lisa' || target.key === 'payroll-jaap' || target.key === 'payroll-frits') {
    try {
      const readiness = await getLocalPayrollPersonaReadiness(target.key, admin)
      if (!readiness.canStartSignIn) return jsonError('LOCAL_PERSONA_UNAVAILABLE', 503)
    } catch {
      return jsonError('LOCAL_PERSONA_UNAVAILABLE', 503)
    }
  } else if (!target.available) {
    return jsonError('LOCAL_PERSONA_UNAVAILABLE', 503)
  }

  const ownerMarkerValue = isOwner && ownerKey ? createLocalPersonaOwnerMarker(ownerKey) : ownerMarker
  if (!ownerMarkerValue) return jsonError('LOCAL_PERSONA_UNAVAILABLE', 503)

  if (!await hasExistingVerifiedAuthUser(admin, target.email)) {
    return jsonError('LOCAL_PERSONA_UNAVAILABLE', 503)
  }

  const { data: generated, error: generateError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: target.email,
  })
  if (generateError || !generated.properties.hashed_token) return jsonError('LOCAL_PERSONA_UNAVAILABLE', 503)

  const { error: signOutError } = await supabase.auth.signOut()
  if (signOutError) return jsonError('LOCAL_PERSONA_UNAVAILABLE', 503)

  const callbackUrl = new URL('/auth/test-role-switch/confirm', origin)
  const response = NextResponse.redirect(callbackUrl, { status: 303 })
  clearActiveContextCookies(response)
  response.cookies.set(HANDOFF_COOKIE, generated.properties.hashed_token, {
    httpOnly: true,
    maxAge: 60,
    path: '/',
    sameSite: 'lax',
    secure: origin.startsWith('https:'),
  })
  response.cookies.set(NEXT_PATH_COOKIE, nextPath, {
    httpOnly: true,
    maxAge: 60,
    path: '/',
    sameSite: 'lax',
    secure: origin.startsWith('https:'),
  })
  response.cookies.set(TEST_ROLE_SWITCH_OWNER_COOKIE, ownerMarkerValue, {
    httpOnly: true,
    maxAge: 60 * 60 * 8,
    path: '/',
    sameSite: 'strict',
    secure: origin.startsWith('https:'),
  })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
