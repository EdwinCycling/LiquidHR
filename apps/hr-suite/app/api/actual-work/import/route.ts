import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { ActualWorkServiceError } from '@/lib/actual-work/actual-work-service'
import { previewActualWorkCsv } from '@/lib/actual-work/payroll-work-hours-service'

export async function POST(request: Request) {
  try {
    return NextResponse.json({ data: await previewActualWorkCsv(await request.json()) })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    const status = error instanceof ActualWorkServiceError ? error.status : 400
    const code = error instanceof ActualWorkServiceError ? error.code : 'ACTUAL_WORK_CSV_IMPORT_FAILED'
    return NextResponse.json({ error: code }, { status })
  }
}
