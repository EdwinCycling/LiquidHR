import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { employeeErrorPayload } from '@/lib/employees/http-errors'
import { focusProfileUpdateSchema } from '@/lib/employees/schemas'
import { updateFocusEmployeeProfile } from '@/lib/focus/profile-service'

interface RouteContext { params: Promise<{ employeeId: string }> }

const inputSchema = focusProfileUpdateSchema.extend({
  actAs: z.string().trim().min(1).max(4096).nullable().optional(),
}).strict()

function fail(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  const payload = employeeErrorPayload(error)
  return NextResponse.json(payload.body, { status: payload.status })
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const parsed = inputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'FOCUS_PROFILE_INPUT_INVALID' }, { status: 400 })
    const { employeeId } = await context.params
    const { actAs, ...input } = parsed.data
    const data = await updateFocusEmployeeProfile(employeeId, input, actAs)
    return NextResponse.json({ data })
  } catch (error) {
    return fail(error)
  }
}
