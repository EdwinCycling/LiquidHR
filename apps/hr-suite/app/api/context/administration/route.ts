import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import {
  ContextSelectionError,
  parseAdministrationSelection,
  validateAdministrationSelection,
} from '@/lib/context/context-response'
import {
  ACTIVE_ADMINISTRATION_COOKIE,
  ACTIVE_HR_GROUP_COOKIE,
  ACTIVE_TENANT_COOKIE,
  loadActiveContext,
} from '@/lib/context/server-context'

function sameOriginFormOrigin(request: Request): string | null {
  const origin = request.headers.get('origin') ?? request.headers.get('referer')
  if (!origin) return null
  try {
    const source = new URL(origin)
    const target = new URL(request.url)
    if (source.origin === target.origin) return source.origin
    const loopback = (host: string) => ['localhost', '127.0.0.1', '::1'].includes(host)
    return process.env.NODE_ENV === 'development'
      && source.protocol === 'http:'
      && target.protocol === 'http:'
      && source.port === target.port
      && loopback(source.hostname)
      && loopback(target.hostname)
      ? source.origin : null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  const formSubmission = contentType === 'application/x-www-form-urlencoded' || contentType === 'multipart/form-data'
  const formOrigin = formSubmission ? sameOriginFormOrigin(request) : null
  try {
    if (formSubmission && !formOrigin) return NextResponse.json({ error: 'CONTEXT_SELECTION_FORBIDDEN' }, { status: 403 })
    const body: unknown = formSubmission
      ? { administrationId: (await request.formData()).get('administrationId') }
      : await request.json().catch(() => null)
    const selection = parseAdministrationSelection(body)
    const context = await loadActiveContext()
    const administration = validateAdministrationSelection(context, selection.administrationId)
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    }

    if (formSubmission) {
      const response = NextResponse.redirect(new URL('/dashboard/start', formOrigin!), { status: 303 })
      response.cookies.set(ACTIVE_TENANT_COOKIE, context.tenant.id, cookieOptions)
      response.cookies.set(ACTIVE_HR_GROUP_COOKIE, context.activeHrGroup.id, cookieOptions)
      response.cookies.set(ACTIVE_ADMINISTRATION_COOKIE, administration.id, cookieOptions)
      return response
    }

    const cookieStore = await cookies()
    cookieStore.set(ACTIVE_TENANT_COOKIE, context.tenant.id, cookieOptions)
    cookieStore.set(ACTIVE_HR_GROUP_COOKIE, context.activeHrGroup.id, cookieOptions)
    cookieStore.set(ACTIVE_ADMINISTRATION_COOKIE, administration.id, cookieOptions)

    return NextResponse.json({ data: { administration } })
  } catch (error) {
    if (error instanceof ContextSelectionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const response = permissionErrorResponse(error)
    if (response) return response
    throw error
  }
}
