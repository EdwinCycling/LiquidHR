import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { employeeErrorPayload } from '@/lib/employees/http-errors'
import { relationSchema } from '@/lib/employees/schemas'
import { archiveFocusEmployeeRelation, updateFocusEmployeeRelation } from '@/lib/focus/profile-service'

interface RouteContext { params: Promise<{ employeeId: string; relationId: string }> }

const patchSchema = relationSchema

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
    await updateFocusEmployeeRelation(ids.employeeId, ids.relationId, parsed.data)
    return NextResponse.json({ data: { updated: true } })
  } catch (error) {
    return fail(error)
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const ids = await context.params
    await archiveFocusEmployeeRelation(ids.employeeId, ids.relationId)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return fail(error)
  }
}
