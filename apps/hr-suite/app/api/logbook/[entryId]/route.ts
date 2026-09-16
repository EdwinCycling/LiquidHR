import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { deletePersonalLogbookEntry, LogbookServiceError, updatePersonalLogbookEntry } from '@/lib/logbook/service'
import { personalLogbookEntryUpdateSchema } from '@/lib/logbook/schemas'

interface RouteContext { params: Promise<{ entryId: string }> }

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const parsed = personalLogbookEntryUpdateSchema.safeParse(await request.json().catch(() => null) as unknown)
    if (!parsed.success) return NextResponse.json({ error: 'LOGBOOK_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await updatePersonalLogbookEntry((await context.params).entryId, parsed.data) })
  } catch (error) {
    return logbookError(error)
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    await deletePersonalLogbookEntry((await context.params).entryId)
    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    return logbookError(error)
  }
}

function logbookError(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof LogbookServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: 'LOGBOOK_OPERATION_FAILED' }, { status: 500 })
}
