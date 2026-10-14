import { NextRequest, NextResponse } from 'next/server'
import {
  getLocalPersonaOwnerKey,
  getVerifiedLocalPersonaIdentity,
  isLocalPersonaRuntime,
  normalizedEmail,
} from '@/lib/auth/test-role-switch'
import {
  getLocalPayrollPersonaReadiness,
  LOCAL_PAYROLL_PERSONA_RECORDS,
  type LocalPayrollPersonaReadiness,
  type LocalPayrollPersonaKey,
} from '@/lib/auth/local-payroll-persona-readiness'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const OPERATOR_EMAIL = 'hradmin.fixture@liquidhr.test'
const ALLOWED_TARGETS = ['payroll-jaap', 'payroll-frits'] as const
type ProvisionTarget = (typeof ALLOWED_TARGETS)[number]

function sameLocalOrigin(request: NextRequest): string | null {
  const host = request.headers.get('host')
  const origin = request.headers.get('origin')
  if (!isLocalPersonaRuntime(host) || !origin) return null

  try {
    const parsed = new URL(origin)
    if (
      parsed.protocol !== 'http:'
      || parsed.username
      || parsed.password
      || parsed.pathname !== '/'
      || parsed.search
      || parsed.hash
      || !isLocalPersonaRuntime(parsed.host)
      || parsed.host.toLowerCase() !== host?.trim().toLowerCase()
      || !isLocalPersonaRuntime(request.nextUrl.host)
    ) return null
    return parsed.origin
  } catch {
    return null
  }
}

function errorResponse(code: string, status: number): NextResponse {
  const response = NextResponse.json({ error: code }, { status })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  return response
}

function isProvisionTarget(value: string): value is ProvisionTarget {
  return ALLOWED_TARGETS.some((key) => key === value)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = sameLocalOrigin(request)
  if (!origin) return errorResponse('LOCAL_PERSONA_PROVISION_FORBIDDEN', 404)

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return errorResponse('LOCAL_PERSONA_PROVISION_FORBIDDEN', 403)
  }

  const fields = Array.from(formData.keys()).filter((key) => !key.startsWith('$ACTION_'))
  const targetValue = formData.get('target')
  if (fields.length !== 1 || fields[0] !== 'target' || typeof targetValue !== 'string' || !isProvisionTarget(targetValue)) {
    return errorResponse('LOCAL_PERSONA_PROVISION_INVALID', 400)
  }

  const supabase = await createClient()
  const verified = await getVerifiedLocalPersonaIdentity(supabase)
  const actorEmail = verified?.identity.email ?? null
  const ownerKey = verified ? getLocalPersonaOwnerKey(request.headers.get('host'), verified.identity) : null

  if (ownerKey !== 'hr-admin' || normalizedEmail(actorEmail) !== OPERATOR_EMAIL) {
    return errorResponse('LOCAL_PERSONA_PROVISION_FORBIDDEN', 403)
  }

  const key = targetValue as LocalPayrollPersonaKey
  const record = LOCAL_PAYROLL_PERSONA_RECORDS[key]
  const admin = createAdminClient()
  let readiness: LocalPayrollPersonaReadiness
  try {
    readiness = await getLocalPayrollPersonaReadiness(key, admin)
  } catch {
    return errorResponse('LOCAL_PERSONA_STATUS_UNAVAILABLE', 503)
  }

  if (readiness.status === 'available' || readiness.status === 'first-sign-in-required') {
    return NextResponse.redirect(new URL('/local/personas?linked=already', origin), { status: 303 })
  }
  if (!readiness.canProvision) return errorResponse('LOCAL_PERSONA_PROVISION_CONFLICT', 409)

  let authUserId = readiness.authUserId
  let createdAuthUser = false
  if (!authUserId) {
    const { data, error } = await admin.auth.admin.createUser({ email: record.email, email_confirm: true })
    if (error || !data.user) {
      try {
        readiness = await getLocalPayrollPersonaReadiness(key, admin)
      } catch {
        return errorResponse('LOCAL_PERSONA_PROVISION_UNAVAILABLE', 503)
      }
      if (readiness.status !== 'link-required' || !readiness.authUserId) {
        return errorResponse('LOCAL_PERSONA_PROVISION_UNAVAILABLE', 503)
      }
      authUserId = readiness.authUserId
    } else {
      authUserId = data.user.id
      createdAuthUser = true
    }
  }

  if (!authUserId) return errorResponse('LOCAL_PERSONA_PROVISION_UNAVAILABLE', 503)

  const { error: linkError } = await supabase.rpc('link_local_test_payroll_persona_v1', {
    p_persona_key: key,
    p_employee_id: record.employeeId,
    p_employment_id: record.employmentId,
    p_auth_user_id: authUserId,
  })
  if (linkError) {
    if (createdAuthUser) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(authUserId)
      if (deleteError) return errorResponse('LOCAL_PERSONA_CLEANUP_REQUIRES_REVIEW', 503)
    }
    return errorResponse('LOCAL_PERSONA_PROVISION_UNAVAILABLE', 503)
  }

  let linkedReadback: LocalPayrollPersonaReadiness
  try {
    linkedReadback = await getLocalPayrollPersonaReadiness(key, admin)
  } catch {
    if (createdAuthUser) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(authUserId)
      if (deleteError) return errorResponse('LOCAL_PERSONA_CLEANUP_REQUIRES_REVIEW', 503)
    }
    return errorResponse('LOCAL_PERSONA_READBACK_UNAVAILABLE', 503)
  }

  if (linkedReadback.status !== 'first-sign-in-required' && linkedReadback.status !== 'available') {
    if (createdAuthUser) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(authUserId)
      if (deleteError) return errorResponse('LOCAL_PERSONA_CLEANUP_REQUIRES_REVIEW', 503)
    }
    return errorResponse('LOCAL_PERSONA_READBACK_UNAVAILABLE', 503)
  }

  const response = NextResponse.redirect(new URL(`/local/personas?linked=${key}`, origin), { status: 303 })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
