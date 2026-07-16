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
  ACTIVE_TENANT_COOKIE,
  loadActiveContext,
} from '@/lib/context/server-context'

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => null)
    const selection = parseAdministrationSelection(body)
    const context = await loadActiveContext()
    const administration = validateAdministrationSelection(context, selection.administrationId)
    const cookieStore = await cookies()
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    }

    cookieStore.set(ACTIVE_TENANT_COOKIE, context.tenant.id, cookieOptions)
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
