import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { AbsenceServiceError, changeEmployeeAbsenceCapacity } from '@/lib/absence/service'
import { permissionErrorResponse } from '@/lib/auth/permissions'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as { caseId?: unknown; effectiveOn?: unknown; absencePercentage?: unknown; expectedNextReviewOn?: unknown; idempotencyKey?: unknown }
    if (typeof body.caseId !== 'string') return NextResponse.json({ error: 'ABSENCE_INPUT_INVALID' }, { status: 400 })
    const caseId = await changeEmployeeAbsenceCapacity(body.caseId, {
      effectiveOn: body.effectiveOn,
      absencePercentage: body.absencePercentage,
      expectedNextReviewOn: body.expectedNextReviewOn,
      idempotencyKey: body.idempotencyKey,
    })
    return NextResponse.json({ caseId })
  } catch (error) {
    const denied = permissionErrorResponse(error)
    if (denied) return denied
    if (error instanceof ZodError) return NextResponse.json({ error: 'ABSENCE_INPUT_INVALID' }, { status: 400 })
    if (error instanceof AbsenceServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'ABSENCE_CAPACITY_FAILED' }, { status: 500 })
  }
}
