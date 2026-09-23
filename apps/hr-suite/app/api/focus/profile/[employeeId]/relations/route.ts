import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { employeeErrorPayload } from '@/lib/employees/http-errors'
import { relationSchema } from '@/lib/employees/schemas'
import { createFocusEmployeeRelation } from '@/lib/focus/profile-service'

interface RouteContext { params: Promise<{ employeeId: string }> }

const inputSchema = relationSchema.extend({
  actAs: z.string().trim().min(1).max(4096).nullable().optional(),
}).strict()

function fail(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  const payload = employeeErrorPayload(error)
  return NextResponse.json(payload.body, { status: payload.status })
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const parsed = inputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'FOCUS_RELATION_INPUT_INVALID' }, { status: 400 })
    const { employeeId } = await context.params
    const { actAs, ...input } = parsed.data
    const id = await createFocusEmployeeRelation(employeeId, input, actAs)
    return NextResponse.json({ data: { id } }, { status: 201 })
  } catch (error) {
    return fail(error)
  }
}
