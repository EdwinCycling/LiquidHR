import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { deleteEmployeeNote, EmployeeNoteServiceError, updateEmployeeNote } from '@/lib/employees/employee-notes-service'
import { employeeNoteUpdateSchema } from '@/lib/employees/employee-notes-schemas'

interface RouteContext { params: Promise<{ employeeId: string; noteId: string }> }

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const parsed = employeeNoteUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'EMPLOYEE_NOTE_INPUT_INVALID' }, { status: 400 })
    const params = await context.params
    await updateEmployeeNote(params.employeeId, params.noteId, parsed.data)
    return NextResponse.json({ data: { updated: true } })
  } catch (error) { return noteError(error) }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const params = await context.params
    await deleteEmployeeNote(params.employeeId, params.noteId)
    return NextResponse.json({ data: { deleted: true } })
  } catch (error) { return noteError(error) }
}

function noteError(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof EmployeeNoteServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: 'EMPLOYEE_NOTE_OPERATION_FAILED' }, { status: 500 })
}
