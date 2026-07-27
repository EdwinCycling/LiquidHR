import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createEmployeeNote, EmployeeNoteServiceError, listEmployeeNotes } from '@/lib/employees/employee-notes-service'
import { employeeNoteCreateSchema } from '@/lib/employees/employee-notes-schemas'

interface RouteContext { params: Promise<{ employeeId: string }> }

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try { return NextResponse.json({ data: await listEmployeeNotes((await context.params).employeeId) }) }
  catch (error) { return noteError(error) }
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const parsed = employeeNoteCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'EMPLOYEE_NOTE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await createEmployeeNote((await context.params).employeeId, parsed.data) }, { status: 201 })
  } catch (error) { return noteError(error) }
}

function noteError(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof EmployeeNoteServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: 'EMPLOYEE_NOTE_OPERATION_FAILED' }, { status: 500 })
}
