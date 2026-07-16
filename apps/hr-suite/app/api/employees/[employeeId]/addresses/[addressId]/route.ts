import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { archiveEmployeeAddress, updateEmployeeAddress } from '@/lib/employees/employee-service'
import { employeeErrorPayload } from '@/lib/employees/http-errors'
import { addressSchema } from '@/lib/employees/schemas'

interface Context { params: Promise<{ employeeId: string; addressId: string }> }
function fail(error: unknown): NextResponse { const permission = permissionErrorResponse(error); if (permission) return permission; const payload = employeeErrorPayload(error); return NextResponse.json(payload.body, { status: payload.status }) }
export async function PATCH(request: Request, context: Context): Promise<NextResponse> { try { const input = addressSchema.safeParse(await request.json()); if (!input.success) return NextResponse.json({ error: 'ADDRESS_INPUT_INVALID' }, { status: 400 }); const ids = await context.params; await updateEmployeeAddress(ids.employeeId, ids.addressId, input.data); return NextResponse.json({ data: { updated: true } }) } catch (error) { return fail(error) } }
export async function DELETE(_request: Request, context: Context): Promise<NextResponse> { try { const ids = await context.params; await archiveEmployeeAddress(ids.employeeId, ids.addressId); return new NextResponse(null, { status: 204 }) } catch (error) { return fail(error) } }
