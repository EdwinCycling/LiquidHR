import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { getActualWorkEmployeeProjection, saveActualWorkEntry } from '@/lib/actual-work/actual-work-service'

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams
    const employeeId = query.get('employeeId')
    if (!employeeId) return NextResponse.json({ error: 'ACTUAL_WORK_EMPLOYEE_REQUIRED' }, { status: 400 })
    return NextResponse.json({ data: await getActualWorkEmployeeProjection({ employeeId, employmentId: query.get('employmentId') ?? undefined, month: query.get('month') ?? new Date().toISOString().slice(0, 7) }) })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ACTUAL_WORK_ENTRIES_FAILED' }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    return NextResponse.json({ data: await saveActualWorkEntry(await request.json()) }, { status: 201 })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : 400
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ACTUAL_WORK_ENTRY_SAVE_FAILED' }, { status })
  }
}

export async function PATCH(request: Request) {
  return POST(request)
}
