import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { ActualWorkServiceError } from '@/lib/actual-work/actual-work-service'
import { getActualWorkPayrollReview, mutateActualWorkPayroll } from '@/lib/actual-work/payroll-work-hours-service'

function serviceError(error: unknown) {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  const status = error instanceof ActualWorkServiceError ? error.status : 400
  const code = error instanceof ActualWorkServiceError ? error.code : 'ACTUAL_WORK_PAYROLL_OPERATION_FAILED'
  return NextResponse.json({ error: code }, { status })
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams
    const period = searchParams.get('period') ?? searchParams.get('periodId') ?? searchParams.get('periodStart')
    if (!period) return NextResponse.json({ error: 'ACTUAL_WORK_PAYROLL_PERIOD_REQUIRED' }, { status: 400 })
    return NextResponse.json({ data: await getActualWorkPayrollReview(period) })
  } catch (error) {
    return serviceError(error)
  }
}

export async function POST(request: Request) {
  try {
    return NextResponse.json({ data: await mutateActualWorkPayroll(await request.json()) })
  } catch (error) {
    return serviceError(error)
  }
}
