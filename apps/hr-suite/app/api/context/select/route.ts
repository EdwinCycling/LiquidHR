import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { selectActiveContext } from '@/lib/context/administration-context'
import { ACTIVE_ADMINISTRATION_COOKIE, ACTIVE_HR_GROUP_COOKIE, ACTIVE_TENANT_COOKIE, loadAccessibleContextOptions } from '@/lib/context/server-context'

const selectionSchema = z.object({
  tenantId: z.string().uuid(),
  hrGroupId: z.string().uuid(),
}).strict()

function contextSelectionErrorRedirect(request: Request, error: 'invalid' | 'failed') {
  const destination = new URL('/context/select', request.url)
  destination.searchParams.set('error', error)
  return NextResponse.redirect(destination, 303)
}

function isSameOriginForm(request: Request): boolean {
  const requestUrl = new URL(request.url)
  const isLoopbackHost = (hostname: string) => ['localhost', '127.0.0.1', '::1'].includes(hostname.replace(/^\[|\]$/g, '').toLowerCase())
  const isTrustedSource = (value: string) => {
    try {
      const sourceUrl = new URL(value)
      if (sourceUrl.origin === requestUrl.origin) return true
      return process.env.NODE_ENV === 'development'
        && sourceUrl.protocol === 'http:'
        && requestUrl.protocol === 'http:'
        && sourceUrl.port === requestUrl.port
        && isLoopbackHost(sourceUrl.hostname)
        && isLoopbackHost(requestUrl.hostname)
    } catch {
      return false
    }
  }

  const origin = request.headers.get('origin')
  if (origin && origin !== 'null') return isTrustedSource(origin)

  const referer = request.headers.get('referer')
  if (referer) return isTrustedSource(referer)

  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite === 'same-origin') return true
  if (fetchSite) return process.env.NODE_ENV === 'development' && fetchSite === 'same-site' && isLoopbackHost(requestUrl.hostname)

  return process.env.NODE_ENV === 'development' && isLoopbackHost(requestUrl.hostname)
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  let isFormSubmission = contentType !== 'application/json'

  try {
    let body: unknown
    if (contentType === 'application/json') {
      body = await request.json().catch(() => null)
      if (typeof body === 'object' && body !== null && 'selection' in body && typeof body.selection === 'string') {
        isFormSubmission = true
        if (!isSameOriginForm(request)) return NextResponse.json({ error: 'CONTEXT_SELECTION_INVALID' }, { status: 403 })
        const parts = body.selection.split('|')
        body = parts.length === 2 ? { tenantId: parts[0], hrGroupId: parts[1] } : null
      }
    } else if (isFormSubmission) {
      if (!isSameOriginForm(request)) return NextResponse.json({ error: 'CONTEXT_SELECTION_INVALID' }, { status: 403 })
      let contextKey: FormDataEntryValue | string | null = null
      if (contentType === 'application/x-www-form-urlencoded' || contentType === 'multipart/form-data') {
        const formData = await request.formData().catch(() => null)
        contextKey = formData?.get('selection') ?? null
      } else if (contentType === 'text/plain' || !contentType) {
        const formBody = await request.text()
        contextKey = new URLSearchParams(formBody.replace(/\r?\n/g, '&')).get('selection')?.trim() ?? null
      } else {
        return contextSelectionErrorRedirect(request, 'invalid')
      }
      if (typeof contextKey !== 'string') return contextSelectionErrorRedirect(request, 'invalid')
      const parts = contextKey.split('|')
      body = parts.length === 2 ? { tenantId: parts[0], hrGroupId: parts[1] } : null
    } else {
      return NextResponse.json({ error: 'CONTEXT_SELECTION_INVALID' }, { status: 415 })
    }

    const selection = selectionSchema.parse(body)
    const { tenants } = await loadAccessibleContextOptions()
    const context = selectActiveContext({ tenants, requestedTenantId: selection.tenantId, requestedHrGroupId: selection.hrGroupId })
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    }

    if (isFormSubmission) {
      const response = NextResponse.redirect(new URL('/dashboard/start', request.url), 303)
      response.cookies.set(ACTIVE_TENANT_COOKIE, context.tenant.id, cookieOptions)
      response.cookies.set(ACTIVE_HR_GROUP_COOKIE, context.activeHrGroup.id, cookieOptions)
      response.cookies.delete(ACTIVE_ADMINISTRATION_COOKIE)
      return response
    }

    const cookieStore = await cookies()
    cookieStore.set(ACTIVE_TENANT_COOKIE, context.tenant.id, cookieOptions)
    cookieStore.set(ACTIVE_HR_GROUP_COOKIE, context.activeHrGroup.id, cookieOptions)
    cookieStore.delete(ACTIVE_ADMINISTRATION_COOKIE)
    return NextResponse.json({ data: { tenantId: context.tenant.id, hrGroupId: context.activeHrGroup.id } })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return isFormSubmission && response.status === 403 ? contextSelectionErrorRedirect(request, 'invalid') : response
    if (error instanceof z.ZodError) return isFormSubmission ? contextSelectionErrorRedirect(request, 'invalid') : NextResponse.json({ error: 'CONTEXT_SELECTION_INVALID' }, { status: 400 })
    if (isFormSubmission) return contextSelectionErrorRedirect(request, 'failed')
    throw error
  }
}
