import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { ActualWorkServiceError, getActualWorkEmployeeProjection, saveActualWorkEntry } from '@/lib/actual-work/actual-work-service'

function errorCode(error: unknown, fallback: string): string {
  if (error instanceof ActualWorkServiceError) return error.code
  if (error instanceof Error && /^ACTUAL_WORK_[A-Z_]+$/.test(error.message)) return error.message
  return fallback
}

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams
    const employeeId = query.get('employeeId')
    if (!employeeId) return NextResponse.json({ error: 'ACTUAL_WORK_EMPLOYEE_REQUIRED' }, { status: 400 })
    return NextResponse.json({ data: await getActualWorkEmployeeProjection({ employeeId, employmentId: query.get('employmentId') ?? undefined, month: query.get('month') ?? new Date().toISOString().slice(0, 7) }) })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return NextResponse.json({ error: 'ACTUAL_WORK_NOT_AUTHORIZED' }, { status: response.status })
    return NextResponse.json({ error: errorCode(error, 'ACTUAL_WORK_ENTRIES_FAILED') }, { status: error instanceof ActualWorkServiceError ? error.status : 400 })
  }
}

export async function POST(request: Request) {
  try {
    return NextResponse.json({ data: await saveActualWorkEntry(await request.json()) }, { status: 201 })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return NextResponse.json({ error: 'ACTUAL_WORK_NOT_AUTHORIZED' }, { status: response.status })
    return NextResponse.json({ error: errorCode(error, 'ACTUAL_WORK_ENTRY_SAVE_FAILED') }, { status: error instanceof ActualWorkServiceError ? error.status : 400 })
  }
}

export async function PATCH(request: Request) {
  return POST(request)
}
