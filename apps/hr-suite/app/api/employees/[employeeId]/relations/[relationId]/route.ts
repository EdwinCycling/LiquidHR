import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { archiveEmployeeRelation, updateEmployeeRelation } from '@/lib/employees/employee-service'
import { employeeErrorPayload } from '@/lib/employees/http-errors'
import { relationSchema } from '@/lib/employees/schemas'

interface Context { params: Promise<{ employeeId: string; relationId: string }> }
function fail(error: unknown): NextResponse { const permission = permissionErrorResponse(error); if (permission) return permission; const payload = employeeErrorPayload(error); return NextResponse.json(payload.body, { status: payload.status }) }
export async function PATCH(request: Request, context: Context): Promise<NextResponse> { try { const input = relationSchema.safeParse(await request.json()); if (!input.success) return NextResponse.json({ error: 'RELATION_INPUT_INVALID' }, { status: 400 }); const ids = await context.params; await updateEmployeeRelation(ids.employeeId, ids.relationId, input.data); return NextResponse.json({ data: { updated: true } }) } catch (error) { return fail(error) } }
export async function DELETE(_request: Request, context: Context): Promise<NextResponse> { try { const ids = await context.params; await archiveEmployeeRelation(ids.employeeId, ids.relationId); return new NextResponse(null, { status: 204 }) } catch (error) { return fail(error) } }
