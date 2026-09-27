import { NextResponse } from 'next/server'
import { permissionErrorResponse, getRequestAuthorizationContext } from '@/lib/auth/permissions'
import { FOCUS_ACT_AS_COOKIE, resolveFocusActAsSession, revokeFocusActAsSession, writeFocusActAsAudit } from '@/lib/focus/act-as-token'

export async function POST(): Promise<NextResponse> {
  try {
    const requestContext = await getRequestAuthorizationContext()
    const session = await resolveFocusActAsSession(undefined, requestContext.context, requestContext.supabase)
    const response = NextResponse.json({ href: '/focus' })
    response.cookies.set({ name: FOCUS_ACT_AS_COOKIE, value: '', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 })
    if (!session) return response
    await revokeFocusActAsSession(requestContext.supabase, session)
    await writeFocusActAsAudit(requestContext.supabase, requestContext.context, session.subjectEmployeeId, 'STOP', {
      mode: session.mode,
      expiresAt: session.expiresAt,
    })
    return response
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    return NextResponse.json({ error: 'FOCUS_ACT_AS_STOP_FAILED' }, { status: 500 })
  }
}
