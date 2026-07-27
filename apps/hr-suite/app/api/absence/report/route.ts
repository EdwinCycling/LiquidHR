import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { reportEmployeeAbsence } from '@/lib/absence/service'
import { permissionErrorResponse } from '@/lib/auth/permissions'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || typeof (body as { employeeId?: unknown }).employeeId !== 'string') {
      return NextResponse.json({ error: 'ABSENCE_INPUT_INVALID' }, { status: 400 })
    }
    const input = body as { employeeId: string; employmentId?: string; startDate?: string; absencePercentage?: number; expectedRecoveryOn?: string | null; hasSicknessBenefitSafetyNet?: boolean | null; isWorkAccident?: boolean | null; isThirdPartyTrafficAccident?: boolean | null; idempotencyKey?: string }
    const caseId = await reportEmployeeAbsence(input.employeeId, input)
    return NextResponse.json({ caseId }, { status: 201 })
  } catch (error) {
    const denied = permissionErrorResponse(error)
    if (denied) return denied
    if (error instanceof ZodError) return NextResponse.json({ error: 'ABSENCE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ABSENCE_REPORT_FAILED' }, { status: 500 })
  }
}
