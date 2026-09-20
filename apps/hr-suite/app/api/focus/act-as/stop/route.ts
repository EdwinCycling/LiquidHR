import { NextResponse } from 'next/server'
import { permissionErrorResponse, getRequestAuthorizationContext } from '@/lib/auth/permissions'
import { resolveFocusActAsSession, writeFocusActAsAudit } from '@/lib/focus/act-as-token'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json()
    const token = body && typeof body === 'object' && 'token' in body
      ? (body as { token?: unknown }).token
      : null
    if (typeof token !== 'string') return NextResponse.json({ error: 'FOCUS_ACT_AS_TOKEN_REQUIRED' }, { status: 400 })
    const requestContext = await getRequestAuthorizationContext()
    const session = await resolveFocusActAsSession(token, requestContext.context, requestContext.supabase)
    if (!session) return NextResponse.json({ href: '/focus' })
    await writeFocusActAsAudit(requestContext.supabase, requestContext.context, session.subjectEmployeeId, 'STOP', {
      mode: session.mode,
      expiresAt: session.expiresAt,
    })
    return NextResponse.json({ href: '/focus' })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    return NextResponse.json({ error: 'FOCUS_ACT_AS_STOP_FAILED' }, { status: 500 })
  }
}
