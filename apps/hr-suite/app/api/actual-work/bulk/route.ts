import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { getActualWorkBulkProjection, saveActualWorkBulkEntries } from '@/lib/actual-work/actual-work-service'

function queryValue(value: string | null): string | undefined {
  return value && value.trim() ? value.trim() : undefined
}

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams
    const entryGranularity = query.get('view') === 'period' ? 'PERIOD' : 'DAY'
    return NextResponse.json({ data: await getActualWorkBulkProjection({
      month: queryValue(query.get('month')) ?? new Date().toISOString().slice(0, 7),
      typeId: queryValue(query.get('typeId')),
      entryGranularity,
      employeeQuery: queryValue(query.get('employee')),
      departmentId: queryValue(query.get('departmentId')),
    }) })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ACTUAL_WORK_BULK_READ_FAILED' }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    return NextResponse.json({ data: await saveActualWorkBulkEntries(await request.json()) }, { status: 201 })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : 400
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ACTUAL_WORK_BULK_SAVE_FAILED' }, { status })
  }
}
