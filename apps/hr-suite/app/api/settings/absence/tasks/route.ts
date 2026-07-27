import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { AbsenceTaskTemplateError, createAbsenceTaskTemplate, listAbsenceTaskTemplates, updateAbsenceTaskTemplate } from '@/lib/absence/task-service'

function errorResponse(error: unknown): NextResponse {
  const permissionResponse = permissionErrorResponse(error)
  if (permissionResponse) return permissionResponse
  if (error instanceof ZodError) return NextResponse.json({ error: 'ABSENCE_TASK_INPUT_INVALID' }, { status: 400 })
  if (error instanceof AbsenceTaskTemplateError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: 'ABSENCE_TASK_REQUEST_FAILED' }, { status: 500 })
}

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ data: await listAbsenceTaskTemplates() })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const id = await createAbsenceTaskTemplate(await request.json())
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    await updateAbsenceTaskTemplate(await request.json())
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
