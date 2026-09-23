import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { employeeErrorPayload } from '@/lib/employees/http-errors'
import { relationSchema } from '@/lib/employees/schemas'
import { archiveFocusEmployeeRelation, updateFocusEmployeeRelation } from '@/lib/focus/profile-service'

interface RouteContext { params: Promise<{ employeeId: string; relationId: string }> }

const patchSchema = relationSchema.extend({
  actAs: z.string().trim().min(1).max(4096).nullable().optional(),
}).strict()
const deleteSchema = z.object({ actAs: z.string().trim().min(1).max(4096).nullable().optional() }).strict()

function fail(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  const payload = employeeErrorPayload(error)
  return NextResponse.json(payload.body, { status: payload.status })
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'FOCUS_RELATION_INPUT_INVALID' }, { status: 400 })
    const ids = await context.params
    const { actAs, ...input } = parsed.data
    await updateFocusEmployeeRelation(ids.employeeId, ids.relationId, input, actAs)
    return NextResponse.json({ data: { updated: true } })
  } catch (error) {
    return fail(error)
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const parsed = deleteSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'FOCUS_RELATION_INPUT_INVALID' }, { status: 400 })
    const ids = await context.params
    await archiveFocusEmployeeRelation(ids.employeeId, ids.relationId, parsed.data.actAs)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return fail(error)
  }
}
