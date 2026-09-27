import { NextResponse } from 'next/server'
import { AuthorizationError, permissionErrorResponse } from '@/lib/auth/permissions'
import { createFocusActAsSession } from '@/lib/focus/act-as-token'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json()
    const employeeId = body && typeof body === 'object' && 'employeeId' in body
      ? (body as { employeeId?: unknown }).employeeId
      : null
    if (typeof employeeId !== 'string' || employeeId.length === 0) {
      return NextResponse.json({ error: 'FOCUS_ACT_AS_EMPLOYEE_REQUIRED' }, { status: 400 })
    }
    const session = await createFocusActAsSession(employeeId)
    const response = NextResponse.json({ href: session.href })
    response.cookies.set({
      name: 'liquidhr_focus_act_as',
      value: session.token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600,
    })
    return response
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ error: 'FOCUS_ACT_AS_START_FAILED' }, { status: 500 })
  }
}
