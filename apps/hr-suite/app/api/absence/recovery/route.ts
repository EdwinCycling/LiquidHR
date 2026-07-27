import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { recoverEmployeeAbsence } from '@/lib/absence/service'
import { permissionErrorResponse } from '@/lib/auth/permissions'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as { caseId?: unknown; recoveredOn?: unknown; idempotencyKey?: unknown }
    if (typeof body.caseId !== 'string') return NextResponse.json({ error: 'ABSENCE_INPUT_INVALID' }, { status: 400 })
    const caseId = await recoverEmployeeAbsence(body.caseId, { recoveredOn: body.recoveredOn, idempotencyKey: body.idempotencyKey })
    return NextResponse.json({ caseId })
  } catch (error) {
    const denied = permissionErrorResponse(error)
    if (denied) return denied
    if (error instanceof ZodError) return NextResponse.json({ error: 'ABSENCE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ABSENCE_RECOVERY_FAILED' }, { status: 500 })
  }
}
