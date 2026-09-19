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
    return NextResponse.json(await createFocusActAsSession(employeeId))
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ error: 'FOCUS_ACT_AS_START_FAILED' }, { status: 500 })
  }
}
