import { NextRequest, NextResponse } from 'next/server'
import {
  canInitiateTestRoleSwitch,
  getTestRoleSwitchTarget,
  isTestRoleSwitchAccount,
  isTestRoleSwitchEnabled,
} from '@/lib/auth/test-role-switch'
import { getRequestAuthorizationContext, permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import { safeNextPath } from '@/lib/auth/login-rules'
import { resolveRequestOrigin } from '@/lib/auth/request-origin'
import { clearActiveContextCookies } from '@/lib/context/context-cookies'
import { createAdminClient } from '@/lib/supabase/admin'

const HANDOFF_COOKIE = 'liquidhr-test-role-switch'
const NEXT_PATH_COOKIE = 'liquidhr-test-role-switch-next'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  if (!isTestRoleSwitchEnabled()) {
    return NextResponse.json({ error: 'TEST_ROLE_SWITCH_DISABLED' }, { status: 404 })
  }

  const origin = resolveRequestOrigin({
    canonicalUrl: process.env.NEXT_PUBLIC_APP_URL,
    fallbackUrl: request.url,
    forwardedHost: request.headers.get('x-forwarded-host'),
    forwardedProtocol: request.headers.get('x-forwarded-proto'),
    host: request.headers.get('host') ?? request.nextUrl.host,
  })
  if (request.headers.get('origin') !== origin) {
    return NextResponse.json({ error: 'TEST_ROLE_SWITCH_FORBIDDEN' }, { status: 403 })
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
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'TEST_ROLE_SWITCH_FORBIDDEN' }, { status: 403 })
  }
  const target = getTestRoleSwitchTarget(String(formData.get('target') ?? ''))
  const targetKey = String(formData.get('target') ?? '')
  const employeeId = String(formData.get('employeeId') ?? '')
  const scopedEmployeeTarget = targetKey === 'scoped-employee' && UUID_PATTERN.test(employeeId)
  const requestedNextPath = formData.get('next')
  const nextPath = typeof requestedNextPath === 'string' && requestedNextPath.length <= 2048
    ? safeNextPath(requestedNextPath)
    : '/dashboard/start'

  if (
    !isTestRoleSwitchAccount(currentEmail)
    || !canInitiateTestRoleSwitch(requestContext.context.activeRoles)
    || (!target && !scopedEmployeeTarget)
  ) {
    return NextResponse.json({ error: 'TEST_ROLE_SWITCH_FORBIDDEN' }, { status: 403 })
  }

  let targetEmail: string | null = target?.email ?? null
  let admin: ReturnType<typeof createAdminClient> | null = null
  if (scopedEmployeeTarget) {
    let employeeContext: Awaited<ReturnType<typeof requirePermission>>
    try {
      employeeContext = await requirePermission('employee:read', employeeId)
    } catch (error) {
      const response = permissionErrorResponse(error)
      if (response) return response
      throw error
    }

    const tenantId = requestContext.context.tenantId
    const hrGroupId = requestContext.context.hrGroupId
    const administrationId = requestContext.context.administrationId
    if (!hrGroupId || !administrationId
      || employeeContext.tenantId !== tenantId
      || employeeContext.hrGroupId !== hrGroupId
      || employeeContext.administrationId !== administrationId) {
      return NextResponse.json({ error: 'TEST_ROLE_SWITCH_FORBIDDEN' }, { status: 403 })
    }

    const today = new Date().toISOString().slice(0, 10)
    const [employeeResult, essResult, employmentResult] = await Promise.all([
      requestContext.supabase.from('employees').select('auth_user_id')
        .eq('id', employeeId).eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId)
        .eq('is_active', true).eq('is_archived', false).is('deleted_at', null).maybeSingle(),
      requestContext.supabase.from('employee_ess_access').select('status')
        .eq('employee_id', employeeId).eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId)
        .eq('status', 'ACTIVE').maybeSingle(),
      requestContext.supabase.from('employments').select('id')
        .eq('employee_id', employeeId).eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId)
        .eq('administration_id', administrationId).eq('record_status', 'CONFIRMED')
        .is('deleted_at', null).lte('starts_on', today).or(`ends_on.is.null,ends_on.gte.${today}`)
        .limit(1).maybeSingle(),
    ])
    const authUserId = employeeResult.data?.auth_user_id
    if (employeeResult.error || essResult.error || employmentResult.error
      || !authUserId || !essResult.data || !employmentResult.data) {
      return NextResponse.json({ error: 'TEST_ROLE_SWITCH_FORBIDDEN' }, { status: 403 })
    }

    admin = createAdminClient()
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(authUserId)
    if (userError || !userResult.user?.email) {
      return NextResponse.json({ error: 'TEST_ROLE_SWITCH_UNAVAILABLE' }, { status: 503 })
    }
    targetEmail = userResult.user.email
  }

  if (!targetEmail) {
    return NextResponse.json({ error: 'TEST_ROLE_SWITCH_UNAVAILABLE' }, { status: 503 })
  }

  admin ??= createAdminClient()
  const { data: generated, error: generateError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetEmail,
  })

  if (generateError || !generated.properties.hashed_token) {
    return NextResponse.json({ error: 'TEST_ROLE_SWITCH_UNAVAILABLE' }, { status: 503 })
  }

  await requestContext.supabase.auth.signOut()

  const callbackUrl = new URL('/auth/test-role-switch/confirm', origin)
  const response = NextResponse.redirect(callbackUrl, { status: 303 })
  clearActiveContextCookies(response)
  response.cookies.set(HANDOFF_COOKIE, generated.properties.hashed_token, {
    httpOnly: true,
    maxAge: 60,
    path: '/',
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
  })
  response.cookies.set(NEXT_PATH_COOKIE, nextPath, {
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
